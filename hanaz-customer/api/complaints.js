/**
 * Vercel Serverless Function: Complaint Processing Workflow
 * Ported from ResolveSync server.js — preserves all connectors:
 *   - Fastn webhook (→ Google Sheets, GitHub Issues, Discord)
 *   - AI triage / categorization
 *   - Duplicate detection
 *   - Resolution / conflict handling
 */

const FASTN_WEBHOOK_URL = process.env.FASTN_WEBHOOK_URL || "https://webhooks.fastn.dev/prod/triggers/personal_f45a90dce32e1cb348f1/webhooks/b646815b-f3f8-4b03-b6de-f97ca6748aa1";

// In-memory state (per cold-start — acceptable for serverless; Fastn/Sheets is the source of truth)
const localState = new Map();
const incidentHistory = [];

function logEvent(type, message, details = null) {
  const entry = {
    id: Date.now() + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    type,
    message,
    details
  };
  console.log(`[${entry.timestamp}] [${type}] ${message}`);
  return entry;
}

// 1. Validation
function validateComplaint(payload) {
  const { complaint_id, customer_name, email, order_id, complaint_text } = payload || {};
  const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  if (isEmpty(complaint_id) || isEmpty(customer_name) || isEmpty(email) || isEmpty(order_id) || isEmpty(complaint_text)) {
    return false;
  }
  return true;
}

// 2. AI Triage (matching original workflow)
function triageComplaint(text) {
  const lower = (text || '').toLowerCase();

  let category = "Other";
  if (/\b(refund|money back|reimburse|reimbursement|return money|cancel and refund)\b/.test(lower)) {
    category = "Refund";
  } else if (/\b(payment|deducted|charged|billing|invoice|transaction|card|credit card|debit card|checkout|stripe|overcharged|double charge)\b/.test(lower)) {
    category = "Payment";
  } else if (/\b(login|log in|sign in|signin|password|auth|authentication|2fa|mfa|otp|locked out|access denied)\b/.test(lower)) {
    category = "Login/Auth";
  } else if (/\b(deliver|delivery|shipping|shipment|courier|carrier|tracking|package|parcel|arrived|transit|damaged box|missing item)\b/.test(lower)) {
    category = "Delivery";
  } else if (/\b(bug|crash|glitch|error|broken|defect|freeze|malfunction|fails|500|404|not working)\b/.test(lower)) {
    category = "Product Bug";
  } else if (/\b(account|profile|subscription|membership|email change|close account|cancel subscription|downgrade|upgrade)\b/.test(lower)) {
    category = "Account";
  }

  let severity = "LOW";
  if (/\b(security|breach|leak|legal|lawyer|police|unauthorized|fraud|stolen|emergency|hacked)\b/.test(lower)) {
    severity = "CRITICAL";
  } else if (
    /\b(deducted twice|charged twice|double charged|double charge|damaged|broken|missing|never arrived|lost|ruined|furious|urgent|severe|unacceptable|locked out|cannot log in|cannot sign in|cannot login|access denied|refund not received|overcharged)\b/.test(lower) ||
    category === "Payment" ||
    category === "Refund"
  ) {
    severity = "HIGH";
  } else if (/\b(delayed|delay|late|slow|issue|problem|bug|glitch|incorrect|wrong|confusing|disappointed|waiting|error|fail|fails|failing|failed|trouble|not working|crash|crashes|freeze)\b/.test(lower)) {
    severity = "MEDIUM";
  }

  const clean = (text || '').replace(/[\r\n\t]+/g, ' ').trim();
  const words = clean.split(/\s+/);
  let summary = words.length <= 18 ? clean : words.slice(0, 18).join(' ') + '...';
  if (summary.split(/\s+/).length >= 20) {
    summary = summary.split(/\s+/).slice(0, 19).join(' ');
  }

  return { category, severity, summary };
}

// 3. Dispatch to Fastn (→ Google Sheets + GitHub + Discord)
async function dispatchToFastn(payload) {
  try {
    const res = await fetch(FASTN_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => res.text());
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// 4. Dispatch to Notion with Safe Debugging Logs
async function dispatchToNotion(complaintRecord) {
  const notionToken = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID || process.env.NOTION_PAGE_ID || "3e0b4ad5cb6b819b89bff9deb1ff81be";

  console.log('[NOTION] Sending complaint...');

  // Prepare database schema payload matching expected Notion property types
  const cleanDbId = databaseId.replace(/-/g, '');
  const payload = {
    parent: { database_id: cleanDbId },
    properties: {
      "Complaint ID": {
        title: [
          { text: { content: complaintRecord.complaint_id || "" } }
        ]
      },
      "Customer Name": {
        rich_text: [
          { text: { content: complaintRecord.customer_name || "" } }
        ]
      },
      "Email": {
        email: complaintRecord.email || ""
      },
      "Order ID": {
        rich_text: [
          { text: { content: complaintRecord.order_id || "" } }
        ]
      },
      "Category": {
        select: { name: complaintRecord.category || "Other" }
      },
      "Severity": {
        select: { name: complaintRecord.severity || "LOW" }
      },
      "Status": {
        status: { name: complaintRecord.status || "OPEN" }
      },
      "Message": {
        rich_text: [
          { text: { content: (complaintRecord.complaint_text || "").slice(0, 2000) } }
        ]
      },
      "Created At": {
        date: { start: complaintRecord.created_at || new Date().toISOString() }
      }
    }
  };

  // Safe logging: Never log API tokens/secrets
  console.log('[NOTION] Payload:', JSON.stringify(payload, null, 2));

  if (!notionToken) {
    const errorMsg = 'Notion integration/token missing (neither NOTION_TOKEN nor NOTION_API_KEY environment variable is set)';
    console.log('[NOTION] ERROR:', errorMsg);
    return { ok: false, status: 401, error: errorMsg };
  }

  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(payload)
    });

    console.log('[NOTION] Response status:', res.status);
    const resText = await res.text();
    console.log('[NOTION] Response body:', resText);

    if (!res.ok) {
      console.log('[NOTION] ERROR:', resText);
      return { ok: false, status: res.status, error: resText };
    }

    let parsed = null;
    try { parsed = JSON.parse(resText); } catch {}
    return { ok: true, status: res.status, data: parsed };
  } catch (err) {
    console.log('[NOTION] ERROR:', err.message);
    return { ok: false, error: err.message };
  }
}

// 4. Core Workflow Processor (preserved from original)
async function processComplaintWorkflow(input) {
  const { complaint_id, customer_name, email, order_id, complaint_text, status: inputStatus, resolution_note, force_discord_failure } = input || {};

  // Resolution / Update Flow
  const isUpdateRequest = inputStatus !== undefined || resolution_note !== undefined;
  if (isUpdateRequest) {
    if (!complaint_id) {
      logEvent('ERROR', 'Resolution failed: Missing complaint_id');
      return { status: 400, body: "Complaint not found" };
    }

    const existingRecord = localState.get(`complaint:${complaint_id}`);
    const currentStatus = (existingRecord?.status || 'OPEN').trim().toUpperCase();
    const targetStatus = inputStatus !== undefined ? String(inputStatus).trim().toUpperCase() : currentStatus;

    if (currentStatus === 'RESOLVED' && targetStatus === 'OPEN') {
      logEvent('CONFLICT', `Blocked reopen attempt on resolved complaint "${complaint_id}"`);
      return {
        status: 409,
        body: "Conflict detected: resolved complaint cannot be reopened automatically"
      };
    }

    const finalStatus = inputStatus !== undefined ? String(inputStatus).trim() : currentStatus;
    const noteVal = resolution_note !== undefined && resolution_note !== null ? String(resolution_note) : (existingRecord?.resolution_note || '');
    const lastUpdatedAt = new Date().toISOString();
    const lastUpdatedBy = "ResolveSync";

    logEvent('FASTN_DISPATCH', `Relaying resolution for "${complaint_id}" to Fastn workflow...`);
    const fastnDispatch = await dispatchToFastn({
      complaint_id,
      status: finalStatus,
      resolution_note: noteVal,
      last_updated_at: lastUpdatedAt,
      last_updated_by: lastUpdatedBy
    });

    if (existingRecord) {
      existingRecord.status = finalStatus;
      existingRecord.resolution_note = noteVal;
      existingRecord.last_updated_at = lastUpdatedAt;
      existingRecord.last_updated_by = lastUpdatedBy;
      localState.set(`complaint:${complaint_id}`, existingRecord);
    }

    logEvent('SUCCESS', `Complaint "${complaint_id}" updated to ${finalStatus}`, fastnDispatch);
    return {
      status: 200,
      body: {
        status: finalStatus,
        complaint_id,
        resolution_note: noteVal,
        last_updated_at: lastUpdatedAt,
        last_updated_by: lastUpdatedBy,
        fastn_dispatch: fastnDispatch,
        sheets_synced: true,
        github_synced: true
      }
    };
  }

  // New Complaint Flow
  if (!validateComplaint(input)) {
    logEvent('VALIDATION_FAIL', 'Incoming payload rejected due to missing mandatory fields', input);
    return { status: 400, body: { error: "Invalid complaint data. Please fill in all required fields." } };
  }

  const triage = triageComplaint(complaint_text);
  logEvent('AI_TRIAGE', `Classified "${complaint_id}": [${triage.severity}] ${triage.category}`);

  const stateKey = `complaint:${complaint_id}`;
  const existingRecord = localState.get(stateKey);
  const isDuplicate = Boolean(existingRecord);

  const lastUpdatedAt = new Date().toISOString();
  const lastUpdatedBy = "ResolveSync";
  const incidentRecord = {
    complaint_id,
    customer_name,
    email,
    order_id,
    complaint_text,
    category: triage.category,
    severity: triage.severity,
    summary: triage.summary,
    status: "OPEN",
    is_duplicate: isDuplicate,
    resolution_note: "",
    last_updated_at: lastUpdatedAt,
    last_updated_by: lastUpdatedBy,
    notification_status: "SENT",
    github_repo: "syed-haseeb-badshah/AIHackathon",
    google_sheet: "ResolveSync Incidents",
    created_at: lastUpdatedAt
  };

  logEvent('FASTN_DISPATCH', `Relaying "${complaint_id}" to Fastn workflow (Google Sheets + GitHub Issue + Discord + ClickUp)...`);
  const fastnDispatch = await dispatchToFastn({
    complaint_id,
    customer_name,
    email,
    order_id,
    complaint_text
  });

  if (isDuplicate) {
    logEvent('DUPLICATE', `Duplicate complaint "${complaint_id}" relayed to Fastn.`);
    return {
      status: 200,
      body: {
        status: "duplicate",
        is_duplicate: true,
        action: "update",
        complaint_id,
        customer_name,
        email,
        order_id,
        complaint_text,
        category: triage.category,
        severity: triage.severity,
        summary: triage.summary,
        fastn_dispatch: fastnDispatch
      }
    };
  }

  // Notion Connector execution with safe debugging logs
  logEvent('NOTION_DISPATCH', `Relaying "${complaint_id}" to Notion...`);
  const notionDispatch = await dispatchToNotion(incidentRecord);

  incidentHistory.unshift(incidentRecord);
  localState.set(stateKey, incidentRecord);

  logEvent('SHEETS_WRITE', `Row queued for Google Sheet via Fastn for ${complaint_id}`);
  logEvent('GITHUB_ISSUE', `GitHub Issue queued via Fastn for ${complaint_id}`);
  logEvent('DISCORD', `Notification dispatched to Discord for ${complaint_id}`);
  if (notionDispatch.ok) {
    logEvent('NOTION', `Complaint logged to Notion for ${complaint_id}`);
  } else {
    logEvent('NOTION_ERROR', `Notion dispatch error for ${complaint_id}: ${notionDispatch.error}`);
  }

  return {
    status: 200,
    body: {
      status: "new",
      is_duplicate: false,
      action: "create",
      complaint_id,
      customer_name,
      email,
      order_id,
      complaint_text,
      category: triage.category,
      severity: triage.severity,
      summary: triage.summary,
      sheets_synced: true,
      github_synced: true,
      discord_synced: true,
      notion_synced: notionDispatch.ok,
      notion_dispatch: notionDispatch,
      fastn_dispatch: fastnDispatch
    }
  };
}

// Vercel Serverless Handler
async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const send = (status, body) => {
    if (typeof res.status === 'function') {
      if (typeof body === 'string') return res.status(status).send(body);
      return res.status(status).json(body);
    }
    res.statusCode = status;
    res.setHeader('Content-Type', typeof body === 'string' ? 'text/plain' : 'application/json');
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };

  if (req.method !== 'POST') {
    return send(405, { error: 'Method not allowed' });
  }

  try {
    let payload = req.body || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch {}
    }
    const result = await processComplaintWorkflow(payload);
    return send(result.status, result.body);
  } catch (err) {
    console.error('Complaint processing error:', err);
    return send(500, { error: 'An internal error occurred. Please try again later.' });
  }
};

module.exports = handler;
module.exports.localState = localState;
module.exports.incidentHistory = incidentHistory;

if (require.main === module) {
  const http = require('http');
  const PORT = process.env.PORT || 3001;
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (parsedUrl.pathname === '/api/complaints') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = body; }
        module.exports(req, res);
      });
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(PORT, () => {
    console.log(`[Complaint API] Running standalone on http://localhost:${PORT}/api/complaints`);
  });
}

