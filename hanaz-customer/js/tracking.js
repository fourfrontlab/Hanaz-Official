/* One consent-aware Meta integration for the existing multi-page storefront. */
(function () {
  "use strict";
  if (window.HanazTracking) return;
  let configPromise,
    configuration,
    initialized = false,
    viewed = false,
    lastView = "",
    product = null,
    checkout = null;
  const seen = new Set();
  let consent = "declined";
  let consentRevision = 0;
  try {
    consent = localStorage.getItem("hanaz_marketing_consent") || "unknown";
  } catch {}
  async function config() {
    if (!configPromise)
      configPromise = fetch("/api/commerce", {
        credentials: "same-origin",
        cache: "no-store",
      })
        .then(async (r) => {
          if (!r.ok) throw Error("unavailable");
          return (configuration = await r.json());
        })
        .catch((e) => {
          configPromise = null;
          throw e;
        });
    return configPromise;
  }
  const cookie = (name) =>
    document.cookie
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(name + "="))
      ?.slice(name.length + 1);
  function identifiers() {
    if (consent !== "accepted") return {};
    return { fbp: cookie("_fbp"), fbc: cookie("_fbc") };
  }
  async function submit(action, data, key) {
    const cfg = await config();
    const r = await fetch("/api/commerce", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Hanaz-CSRF": cfg.csrf },
      body: JSON.stringify({
        action,
        data,
        key,
        marketingConsent: consent === "accepted",
        context: identifiers(),
      }),
      signal: AbortSignal.timeout(15000),
      keepalive: action === "consent",
    });
    const result = await r.json();
    if (!r.ok) {
      // Validation/price rejection rolls back completely. An ambiguous failure retains its key.
      if (r.status === 400 || result.code === "cart_changed") {
        const kind = action === "checkout" ? "checkout" : data.kind;
        try {
          const slot = "hanaz_request:" + kind,
            old = JSON.parse(localStorage.getItem(slot) || "null");
          if (old?.key === key) localStorage.removeItem(slot);
        } catch {}
      }
      throw Error(
        result.error || "Unable to confirm your request. Please retry.",
      );
    }
    return result;
  }
  function pageIsSafe() {
    const u = new URL(location.href);
    if (
      /\/(account|login|signup|track-order)(\.html)?$/.test(u.pathname) ||
      u.hash.includes("token")
    )
      return false;
    // Pixel reads the browser URL itself. Suppress it on URLs with unapproved parameters.
    for (const [key, value] of u.searchParams) {
      if (key === "id" && /^[0-9a-f-]{36}$/i.test(value)) continue;
      if (key === "fbclid" && /^[A-Za-z0-9_-]{1,500}$/.test(value)) continue;
      return false;
    }
    return true;
  }
  function loadPixel() {
    if (initialized || consent !== "accepted" || !configuration?.enabled)
      return;
    initialized = true;
    const n = (window.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    n.queue = [];
    n.loaded = true;
    n.version = "2.0";
    n.push = n;
    window._fbq = n;
    n("consent", "grant");
    // Explicit business triggers replace implicit button/form inference. Account rules still require review.
    n("set", "autoConfig", false, configuration.pixelId);
    n("init", configuration.pixelId);
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  function emit(name, data = {}, id = crypto.randomUUID()) {
    if (consent !== "accepted" || !configuration?.enabled || !pageIsSafe())
      return false;
    loadPixel();
    const key = name + ":" + id;
    if (seen.has(key)) return false;
    try {
      if (sessionStorage.getItem("hanaz_event:" + key)) return false;
    } catch {}
    try {
      window.fbq("trackSingle", configuration.pixelId, name, data, {
        eventID: id,
      });
      seen.add(key);
      try {
        sessionStorage.setItem("hanaz_event:" + key, "1");
      } catch {}
      return true;
    } catch {
      return false;
    }
  }
  function cartData(items) {
    return {
      currency: "PKR",
      content_type: "product",
      content_ids: items.map((i) => i.id),
      contents: items.map((i) => ({
        id: i.id,
        quantity: i.qty,
        item_price: i.price,
      })),
      num_items: items.reduce((n, i) => n + i.qty, 0),
      value:
        Math.round(items.reduce((n, i) => n + i.price * i.qty, 0) * 100) / 100,
    };
  }
  function pageKey() {
    const u = new URL(location.href);
    return (
      u.pathname +
      (u.searchParams.has("id") ? "?id=" + u.searchParams.get("id") : "")
    );
  }
  function pageView() {
    const key = pageKey();
    if (viewed && lastView === key) return;
    if (emit("PageView")) {
      viewed = true;
      lastView = key;
    }
  }
  function currentViews() {
    pageView();
    if (product)
      emit(
        "ViewContent",
        cartData([{ id: product.id, price: product.sale_price, qty: 1 }]),
        product.eventId,
      );
    if (checkout)
      emit("InitiateCheckout", cartData(checkout.items), checkout.id);
  }
  function clearMetaCookies() {
    for (const name of ["_fbp", "_fbc"]) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
      const parts = location.hostname.split(".");
      for (let i = 0; i < parts.length - 1; i++)
        document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${parts.slice(i).join(".")}`;
    }
  }
  async function setConsent(accepted) {
    const revision = ++consentRevision;
    // Declining stops browser delivery immediately, even if the network is down.
    if (!accepted) {
      consent = "declined";
      try {
        localStorage.setItem("hanaz_marketing_consent", consent);
        localStorage.setItem("hanaz_consent_pending", "declined");
      } catch {}
      window.fbq?.("consent", "revoke");
      clearMetaCookies();
    }
    const result = await submit("consent", { accepted });
    if (revision !== consentRevision) return;
    consent = result.accepted ? "accepted" : "declined";
    try {
      localStorage.setItem("hanaz_marketing_consent", consent);
      localStorage.removeItem("hanaz_consent_pending");
    } catch {}
    document.getElementById("hanaz-consent")?.remove();
    if (accepted) {
      if (initialized) window.fbq("consent", "grant");
      currentViews();
    }
  }
  function consentUI() {
    if (document.getElementById("hanaz-consent")) return;
    const panel = document.createElement("section");
    panel.id = "hanaz-consent";
    panel.setAttribute("aria-label", "Marketing privacy choices");
    panel.innerHTML =
      '<p>Allow Meta marketing tracking to help us understand how our website is used? Shopping works with either choice. <a href="privacy.html">Privacy policy</a></p><div><button type="button" class="btn btn-secondary" data-consent="no">Decline</button><button type="button" class="btn btn-primary" data-consent="yes">Allow marketing</button></div><p class="consent-status" role="status"></p>';
    panel.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-consent]");
      if (!btn) return;
      panel.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        await setConsent(btn.dataset.consent === "yes");
      } catch {
        panel.querySelector(".consent-status").textContent =
          "Your choice could not be saved on the server. Marketing is paused in this browser. Please retry.";
        consent = "declined";
        window.fbq?.("consent", "revoke");
      } finally {
        panel.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    });
    document.body.appendChild(panel);
  }
  window.HanazTracking = {
    cartData,
    config,
    submit,
    setConsent,
    addToCart(item) {
      try {
        emit("AddToCart", cartData([item]));
      } catch {}
    },
    viewProduct(p) {
      if (!p?.id || !Number.isFinite(p.sale_price)) return;
      product = { ...p, eventId: crypto.randomUUID() };
      currentViews();
    },
    beginCheckout(items) {
      if (!items.length || checkout) return;
      checkout = { items, id: crypto.randomUUID() };
      currentViews();
    },
    confirmed(result) {
      if (result?.event && ["Purchase", "Lead"].includes(result.event.name))
        emit(result.event.name, result.event.data, result.event.id);
    },
    // Persistent key survives a lost response, refresh, and repeated form submission.
    async requestKey(kind, data) {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(data)),
      );
      const value = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
        slot = "hanaz_request:" + kind;
      const get = () => {
        let old;
        try {
          old = JSON.parse(localStorage.getItem(slot) || "null");
        } catch {
          throw Error("Please allow essential site storage before submitting.");
        }
        if (old?.key) {
          if (old.value !== value)
            throw Error(
              "A previous request is still unconfirmed. Retry with the same details or contact support before starting another.",
            );
          return old.key;
        }
        const key = crypto.randomUUID();
        try {
          localStorage.setItem(slot, JSON.stringify({ value, key }));
        } catch {
          throw Error("Please allow essential site storage before submitting.");
        }
        return key;
      };
      return navigator.locks ? navigator.locks.request(slot, get) : get();
    },
    clearRequest(kind) {
      try {
        localStorage.removeItem("hanaz_request:" + kind);
      } catch {}
    },
    privacy: consentUI,
  };
  // This is a multi-page site. Hash/accordion changes are not page views.
  addEventListener("popstate", pageView);
  addEventListener("pageshow", (e) => {
    if (e.persisted) {
      viewed = false;
      currentViews();
    }
  });
  addEventListener("storage", (e) => {
    if (e.key === "hanaz_marketing_consent" && e.newValue !== "accepted") {
      consent = "declined";
      window.fbq?.("consent", "revoke");
      clearMetaCookies();
    }
  });
  addEventListener("online", () => {
    try {
      if (localStorage.getItem("hanaz_consent_pending") === "declined")
        setConsent(false).catch(() => {});
    } catch {}
  });
  document.addEventListener("DOMContentLoaded", async () => {
    const link = document.createElement("button");
    link.type = "button";
    link.className = "hanaz-privacy-settings";
    link.textContent = "Privacy choices";
    link.addEventListener("click", consentUI);
    (document.querySelector("footer") || document.body).appendChild(link);
    if (consent === "unknown") consentUI();
    try {
      await config();
      if (consent === "accepted") await setConsent(true);
      else if (consent === "declined") {
        await submit("consent", { accepted: false });
        clearMetaCookies();
      }
    } catch {
      consent = "declined";
    }
  });
})();
