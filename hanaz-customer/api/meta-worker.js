"use strict";
const { safeEqual } = require("../server/core");
const { run } = require("../server/meta-worker");
module.exports = async function (req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end("{}");
  }
  if (
    !process.env.CRON_SECRET ||
    !safeEqual(req.headers.authorization, `Bearer ${process.env.CRON_SECRET}`)
  ) {
    res.statusCode = 401;
    return res.end("{}");
  }
  try {
    res.end(JSON.stringify(await run()));
  } catch {
    console.warn('{"component":"meta_delivery","code":"worker_failed"}');
    res.statusCode = 503;
    res.end('{"error":"Worker unavailable"}');
  }
};
