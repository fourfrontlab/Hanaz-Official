"use strict";
const core = require("../server/core");
function handlerFactory({ env = process.env, rpc = core.rpc } = {}) {
  return async function (req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    const reply = (code, data) => {
      res.statusCode = code;
      res.end(JSON.stringify(data));
    };
    try {
      if (!["GET", "POST"].includes(req.method)) {
        res.setHeader("Allow", "GET, POST");
        return reply(405, { error: "Method not allowed" });
      }
      if (
        !env.SITE_ORIGIN ||
        new URL(env.SITE_ORIGIN).origin !== env.SITE_ORIGIN
      )
        throw new Error("config");
      if (req.method === "POST" && req.headers.origin !== env.SITE_ORIGIN)
        return reply(403, { error: "Origin rejected" });
      const sid = core.session(req, res, env),
        csrf = core.sign("csrf:" + sid, env);
      if (req.method === "GET") {
        const cfg = core.metaConfig(env);
        // Browser Pixel has no CAPI test_event_code switch. Require a separate test dataset.
        return reply(200, {
          csrf,
          ...cfg,
          enabled:
            cfg.enabled && (!cfg.test || cfg.pixelId !== "568351333004084"),
        });
      }
      if (!core.safeEqual(req.headers["x-hanaz-csrf"], csrf))
        return reply(403, { error: "Session expired. Reload and try again." });
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return reply(415, { error: "JSON required" });
      if (Number(req.headers["content-length"]) > 16384)
        return reply(413, { error: "Request too large" });
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (JSON.stringify(body || {}).length > 16384)
        return reply(413, { error: "Request too large" });
      const data = core.validate(body?.action, body?.data);
      if (body.action !== "consent" && !core.uuid(body.key))
        throw new Error("validation");
      const ctx = core.context(req, body, env);
      // Persistent per-IP and per-session limits; hashes only, not raw IPs in logs/storage.
      const bucket = core.sign(
        "rate:" + (ctx.user_data.client_ip_address || sid),
        env,
      );
      const allowed = await rpc("hanaz_rate_limit", { p_bucket: bucket }, env);
      if (!allowed) {
        res.setHeader("Retry-After", "60");
        return reply(429, {
          error: "Please wait a minute before trying again.",
        });
      }
      ctx.user_data = core.matching(data, ctx.user_data);
      const result = await rpc(
        "hanaz_submit",
        {
          p_session: sid,
          p_action: body.action,
          p_key: body.key || null,
          p_data: data,
          p_context: ctx,
        },
        env,
      );
      return reply(200, result);
    } catch (e) {
      if (e.message === "validation" || e instanceof SyntaxError)
        return reply(400, { error: "Please check the form and cart details." });
      if (e.code === "23505")
        return reply(409, {
          code: "request_conflict",
          error:
            "A previous request used different details. Retry with the original details or contact support.",
        });
      if (e.code === "P0001")
        return reply(409, {
          code: "cart_changed",
          error:
            "The cart price or availability changed. Remove affected items and add them again before retrying.",
        });
      // Never log request bodies, tokens, DB error details or customer fields.
      console.warn(
        JSON.stringify({
          component: "commerce",
          code:
            e.message === "config"
              ? "configuration_unavailable"
              : "request_failed",
        }),
      );
      return reply(503, {
        error:
          "We could not confirm your request. Please retry with the same details; your cart has been kept.",
      });
    }
  };
}
module.exports = handlerFactory();
module.exports.handlerFactory = handlerFactory;
