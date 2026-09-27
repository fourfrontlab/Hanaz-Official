"use strict";
const { metaConfig, rpc } = require("./core");
async function deliver(event, { env = process.env, fetcher = fetch } = {}) {
  const cfg = metaConfig(env);
  if (!cfg.enabled) return { outcome: "disabled" };
  if (!/^v\d+\.0$/.test(env.META_API_VERSION || "v26.0"))
    return { outcome: "dead", code: "version_configuration" };
  const body = {
    data: [event],
    ...(cfg.test ? { test_event_code: env.META_TEST_EVENT_CODE } : {}),
  };
  try {
    const r = await fetcher(
      `https://graph.facebook.com/${env.META_API_VERSION || "v26.0"}/${cfg.pixelId}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(7000),
      },
    );
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.events_received === 1)
      return { outcome: "sent", code: "accepted" };
    const transient =
      r.status === 429 || r.status >= 500 || data.error?.is_transient === true;
    return {
      outcome: transient ? "retry" : "dead",
      code: `http_${r.status}_meta_${Number(data.error?.code) || 0}`,
    };
  } catch {
    return { outcome: "retry", code: "network_timeout" };
  }
}
async function run({ env = process.env, call = rpc, fetcher = fetch } = {}) {
  if (!metaConfig(env).enabled) return { disabled: true };
  const jobs = await call("hanaz_claim_events", {}, env);
  const counts = { sent: 0, retry: 0, dead: 0, suppressed: 0 };
  for (const job of jobs) {
    const cfg = metaConfig(env);
    const allowed =
      job.dataset_id === cfg.pixelId &&
      job.delivery_mode === (cfg.test ? "test" : "live") &&
      (await call(
        "hanaz_event_allowed",
        { p_id: job.id, p_lease: job.lease },
        env,
      ));
    const result = allowed
      ? await deliver(job.payload, { env, fetcher })
      : { outcome: "suppressed", code: "consent_order_or_environment" };
    await call(
      "hanaz_finish_event",
      {
        p_id: job.id,
        p_lease: job.lease,
        p_outcome: result.outcome,
        p_code: result.code,
      },
      env,
    );
    counts[result.outcome] = (counts[result.outcome] || 0) + 1;
    console.info(
      JSON.stringify({ component: "meta_delivery", job: job.id, ...result }),
    );
  }
  return counts;
}
module.exports = { deliver, run };
