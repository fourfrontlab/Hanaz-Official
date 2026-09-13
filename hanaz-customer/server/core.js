"use strict";
const {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} = require("node:crypto");
const { isIP } = require("node:net");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const uuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
function safeEqual(a, b) {
  return (
    typeof a === "string" &&
    typeof b === "string" &&
    a.length === b.length &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
function sign(v, env = process.env) {
  return createHmac("sha256", env.SESSION_SECRET).update(v).digest("hex");
}
function session(req, res, env = process.env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
    throw new Error("config");
  const value =
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("hanaz_session="))
      ?.slice(14) || "";
  const [id, stamp, mac] = value.split(".");
  if (
    uuid(id) &&
    /^\d+$/.test(stamp) &&
    Number(stamp) > Date.now() / 1000 &&
    safeEqual(mac, sign(`${id}.${stamp}`, env))
  )
    return id;
  const sid = randomUUID(),
    expires = Math.floor(Date.now() / 1000) + 30 * 86400;
  res.setHeader(
    "Set-Cookie",
    `hanaz_session=${sid}.${expires}.${sign(`${sid}.${expires}`, env)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${env.SITE_ORIGIN?.startsWith("https:") ? "; Secure" : ""}`,
  );
  return sid;
}
function metaConfig(env = process.env) {
  const enabled = env.META_ENABLED === "true";
  const test = env.META_MODE === "test";
  const validMode = test
    ? !!env.META_TEST_EVENT_CODE
    : env.META_MODE === "live" &&
      !env.META_TEST_EVENT_CODE &&
      env.VERCEL_ENV === "production";
  const id = env.META_PIXEL_ID || "568351333004084";
  // A preview cannot send live events; production live mode is pinned to Hanaz.
  return {
    enabled:
      enabled &&
      validMode &&
      !!env.META_ACCESS_TOKEN &&
      /^\d{5,20}$/.test(id) &&
      (test || id === "568351333004084"),
    pixelId: id,
    test,
  };
}
async function rpc(name, args, env = process.env, fetcher = fetch) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("config");
  const r = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  });
  const data = await r.json();
  if (!r.ok) {
    const err = new Error("database");
    err.code = data.code;
    throw err;
  }
  return data;
}
function str(v, min, max) {
  if (typeof v !== "string" || v.trim().length < min || v.length > max)
    throw new Error("validation");
  return v.trim();
}
function phone(v) {
  const p = str(v, 10, 25).replace(/[\s()+-]/g, "");
  const n = p.startsWith("03") ? "92" + p.slice(1) : p;
  if (!/^923\d{9}$/.test(n)) throw new Error("validation");
  return n;
}
function email(v) {
  const e = str(v, 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("validation");
  return e;
}
function validate(action, d) {
  if (!d || typeof d !== "object" || Array.isArray(d))
    throw new Error("validation");
  if (action === "consent") {
    if (typeof d.accepted !== "boolean") throw new Error("validation");
    return { accepted: d.accepted };
  }
  if (action === "checkout") {
    if (!Array.isArray(d.items) || !d.items.length || d.items.length > 30)
      throw new Error("validation");
    const ids = new Set();
    const items = d.items.map((i) => {
      if (
        !uuid(i.id) ||
        !Number.isInteger(i.qty) ||
        i.qty < 1 ||
        i.qty > 10 ||
        ids.has(i.id)
      )
        throw new Error("validation");
      ids.add(i.id);
      return { id: i.id, qty: i.qty };
    });
    if (
      !["cod", "bank_deposit", "easypaisa", "jazzcash"].includes(
        d.payment_method,
      )
    )
      throw new Error("validation");
    if (!Number.isFinite(d.expected_total) || d.expected_total <= 0)
      throw new Error("validation");
    phone(d.phone); // Validate while retaining the existing order lookup's phone representation.
    return {
      items,
      name: str(d.name, 2, 120),
      phone: d.phone.trim(),
      address: str(d.address, 5, 500),
      payment_method: d.payment_method,
      expected_total: d.expected_total,
    };
  }
  if (action === "lead") {
    if (!["contact", "newsletter", "consultation"].includes(d.kind))
      throw new Error("validation");
    if (d.kind === "newsletter")
      return {
        kind: d.kind,
        name: "Newsletter subscriber",
        email: email(d.email),
        subject: "Newsletter signup",
        message: "Requested newsletter subscription.",
      };
    return {
      kind: d.kind,
      name: str(d.name, 2, 120),
      email: d.kind === "consultation" && !d.email ? "" : email(d.email),
      subject:
        d.kind === "consultation"
          ? "Consultation request"
          : str(d.subject, 1, 200),
      message: str(d.message, 1, 4000),
      ...(d.kind === "consultation" ? { phone: phone(d.phone) } : {}),
    };
  }
  throw new Error("validation");
}
function context(req, body, env = process.env) {
  // Fixed event URLs avoid leaking order IDs, search queries or health form fields.
  const path = body.action === "checkout" ? "/checkout.html" : "/contact.html";
  const ua =
    typeof req.headers["user-agent"] === "string"
      ? req.headers["user-agent"].slice(0, 512)
      : undefined;
  // Only trust Vercel's overwritten header on Vercel. Never arbitrary x-forwarded-for.
  const ip =
    env.VERCEL === "1"
      ? req.headers["x-vercel-forwarded-for"]?.split(",")[0].trim()
      : req.socket?.remoteAddress;
  const user = {};
  if (ua) user.client_user_agent = ua;
  if (ip && isIP(ip)) user.client_ip_address = ip;
  const ctx = body.context || {};
  for (const key of ["fbp", "fbc"]) {
    const v = ctx[key];
    if (
      typeof v === "string" &&
      v.length <= 500 &&
      /^fb\.\d+\.\d{13}\.[A-Za-z0-9_-]+$/.test(v) &&
      Number(v.split(".")[2]) <= Date.now() + 60000
    )
      user[key] = v;
  }
  const cfg = metaConfig(env);
  return {
    event_source_url: env.SITE_ORIGIN + path,
    user_data: user,
    enabled: cfg.enabled,
    consent_claim: body.marketingConsent === true,
    delivery_mode: cfg.test ? "test" : "live",
    dataset_id: cfg.pixelId,
  };
}
function matching(data, user = {}) {
  const out = { ...user };
  if (data.email) out.em = [hash(email(data.email))];
  if (data.phone) out.ph = [hash(phone(data.phone))];
  // No address, consultation details, date of birth, gender or invented identifiers.
  return out;
}
module.exports = {
  hash,
  uuid,
  safeEqual,
  sign,
  session,
  metaConfig,
  rpc,
  validate,
  context,
  matching,
  phone,
  email,
};
