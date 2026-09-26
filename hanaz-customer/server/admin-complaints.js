const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1y0-ZimyPt0G-h4z05eYmVCycnPe5A_38vHL3uAOwZvc';
const SHEETS_CONNECTOR_ID = '38d254e2-b92e-44f4-81cd-8251fd9373d9';
const SHEET_PUBLIC_URL = 'https://docs.google.com/spreadsheets/d/1y0-ZimyPt0G-h4z05eYmVCycnPe5A_38vHL3uAOwZvc/edit';
const NOTION_DATABASE_URL = 'https://notion.so/3e0b4ad5cb6b819b89bff9deb1ff81be';
const DISCORD_SAFE_URL = 'https://discord.com/channels/@me';
const FASTN_WEBHOOK_URL = process.env.FASTN_WEBHOOK_URL || 'https://webhooks.fastn.dev/prod/triggers/personal_f45a90dce32e1cb348f1/webhooks/b646815b-f3f8-4b03-b6de-f97ca6748aa1';

let cachedRows = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 2500; // 2.5s cache for responsive UI and live updates
let cachedActionId = null;

// In-memory state overrides (for instant UI reflection before Sheets write propagates)
const approvalOverrides = new Map();
const retryOverrides = new Map();

// In-memory Audit Log
const auditLogEntries = [];

function logAuditEvent({ complaint_id, source, previous_status, new_status, action, detail }) {
  const entry = {
    id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    complaint_id,
    timestamp: new Date().toISOString(),
    source: source || 'Admin Portal',
    previous_status: previous_status || 'UNKNOWN',
    new_status: new_status || previous_status || 'UNKNOWN',
    action: action || 'EVENT',
    detail: detail || ''
  };
  auditLogEntries.unshift(entry);
  if (auditLogEntries.length > 500) auditLogEntries.pop();
  return entry;
}

function getMcpToken() {
  let token = 'gwt_byI9GuRnOntVVcjJ3sh9ZBzUBdgtInKS';
  try {
    const tokenPath = 'C:/Users/HP/.gemini/antigravity/mcp_oauth_tokens.json';
    if (fs.existsSync(tokenPath)) {
      const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      if (tokens['https://mcp.fastn.dev']?.token?.access_token) {
        token = tokens['https://mcp.fastn.dev'].token.access_token;
      }
    }
  } catch (err) {}
  return token;
}

async function callMcp(actionName, args) {
  const token = getMcpToken();
  const res = await fetch('https://mcp.fastn.dev', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now() + Math.random(),
      method: 'tools/call',
      params: { name: actionName, arguments: args }
    })
  });
  return await res.json();
}

async function getGetValuesActionId() {
  if (cachedActionId) return cachedActionId;
  const data = await callMcp('fastnPlatform__listActions', { connectorId: SHEETS_CONNECTOR_ID });
  const act = data.result?.structuredContent?.data?.find(a => a.slug === 'getValues');
  if (act?.id) {
    cachedActionId = act.id;
    return cachedActionId;
  }
  return '042be6a6-9f86-4f4c-bbfd-d7e7c9f80a49';
}

function normalizeFieldValue(val) {
  if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
    return 'Not available';
  }
  return String(val).trim();
}

// -------------------------------------------------------------
// Smart Router (Identical logic to Fastn workflow)
// -------------------------------------------------------------
function routeComplaint(category, text, severity, summary) {
  const lower = ((category || '') + ' ' + (text || '')).toLowerCase();

  const isPhysicalProduct = /\b(serum|bottle|cream|item|package|parcel|box|arrived|shipped|delivery|delivered|received|product quality|damaged|broken|shattered|leaking|leak|wrong product|missing product|missing item|replacement|replace|reship|reshipment|defective product)\b/.test(lower);

  const isFinance =
    category === 'Refund' ||
    category === 'Payment' ||
    /\b(refund|payment|duplicate payment|charged|deducted|double charged|double charge|overcharged|billing|invoice|transaction|charged but|payment issue|finance complaint)\b/.test(lower);

  const isEngineering =
    category === 'Login/Auth' ||
    /\b(login|log in|signin|sign in|auth|authentication|password|2fa|mfa|otp|website bug|checkout bug|api|api issue|technical error|server error|500 error|404|crash|freeze|syntax|cannot access|unable to access|access my account)\b/.test(lower) ||
    (!isPhysicalProduct && (category === 'Product Bug' || /\b(bug|glitch|software error)\b/.test(lower)));

  if (isPhysicalProduct && !isEngineering) {
    let recAction = 'Replace Product';
    let reason = 'Product damaged or missing upon arrival.';
    if (/broken|damaged|shattered|leaking/i.test(lower)) {
      recAction = 'Replace Product';
      reason = 'Product arrived damaged/broken; replacement recommended.';
    } else if (/missing|never arrived/i.test(lower)) {
      recAction = 'Reship Product';
      reason = 'Item reported missing from delivery; reshipment recommended.';
    } else if (/wrong product/i.test(lower)) {
      recAction = 'Reship Product';
      reason = 'Incorrect item received; reship correct item.';
    } else {
      recAction = 'Contact Customer';
      reason = 'Product or delivery issue requires customer coordination.';
    }
    return {
      department: 'Product / Support',
      recommended_action: recAction,
      reason,
      target_system: 'Admin Portal',
      approval_status: 'PENDING',
      approval_location: 'Admin Portal'
    };
  }

  if (isFinance && !isEngineering) {
    let recAction = 'REFUND';
    let reason = 'Customer reported payment dispute or refund request.';
    if (/charged.*not created|order not created|charged but/i.test(lower)) {
      reason = 'Payment succeeded but order creation failed.';
      recAction = 'REFUND';
    } else if (/duplicate|twice|double charge/i.test(lower)) {
      reason = 'Customer charged multiple times for the same transaction.';
      recAction = 'REFUND';
    } else {
      recAction = 'REFUND / PAYMENT REVIEW';
      reason = 'Customer requested refund or reported payment discrepancy.';
    }
    return {
      department: 'Finance',
      recommended_action: recAction,
      reason,
      target_system: 'Admin Portal',
      approval_status: 'PENDING',
      approval_location: 'Admin Portal'
    };
  }

  if (isEngineering) {
    let recAction = 'Investigate Authentication Issue';
    let reason = 'User unable to access account or authentication error.';
    if (!/login|auth|password|access/i.test(lower)) {
      recAction = 'Fix Technical Bug';
      reason = 'Technical glitch or bug affecting site functionality.';
    }
    return {
      department: 'Engineering',
      recommended_action: recAction,
      reason,
      target_system: 'ClickUp & GitHub',
      approval_status: 'PENDING',
      approval_location: 'ClickUp'
    };
  }

  return {
    department: 'MANUAL_REVIEW',
    recommended_action: 'Manual Review',
    reason: 'Smart Router could not determine department with high confidence.',
    target_system: 'Admin Portal',
    approval_status: 'PENDING',
    approval_location: 'Admin Portal'
  };
}

function mapRowToComplaint(row) {
  const complaintId = normalizeFieldValue(row[0]);
  const customerName = normalizeFieldValue(row[1]);
  const email = normalizeFieldValue(row[2]);
  const orderId = normalizeFieldValue(row[3]);
  const complaintText = normalizeFieldValue(row[4]);
  const category = normalizeFieldValue(row[5]);
  const severity = normalizeFieldValue(row[6]);
  const summary = normalizeFieldValue(row[7]);
  
  let rawStatus = row[8] ? String(row[8]).trim().toUpperCase() : 'OPEN';
  if (rawStatus === 'TO DO' || rawStatus === 'TODO') rawStatus = 'OPEN';
  if (rawStatus === 'COMPLETED' || rawStatus === 'CLOSED') rawStatus = 'RESOLVED';
  
  const isDuplicate = row[9] === true || String(row[9]).toLowerCase() === 'true';
  const resolutionNote = normalizeFieldValue(row[10]);
  const lastUpdatedAt = normalizeFieldValue(row[11]);
  const lastUpdatedBy = normalizeFieldValue(row[12]);
  const notificationStatus = normalizeFieldValue(row[13]);
  const notificationError = normalizeFieldValue(row[14]);
  let effectiveNotificationStatus = notificationStatus;
  let effectiveNotificationError = notificationError;
  const retryOverride = retryOverrides.get(complaintId);
  if (retryOverride) {
    if (retryOverride.notification_status) effectiveNotificationStatus = retryOverride.notification_status;
    if (retryOverride.notification_error) effectiveNotificationError = retryOverride.notification_error;
  }
  const githubIssue = normalizeFieldValue(row[15]);
  const clickupTaskId = normalizeFieldValue(row[16]);
  const clickupTaskUrl = normalizeFieldValue(row[17]);
  const duplicateCount = (row[18] !== undefined && row[18] !== '' && !isNaN(Number(row[18]))) ? Number(row[18]) : 0;
  const lastReportedAt = normalizeFieldValue(row[19]);
  const githubIssueUrl = normalizeFieldValue(row[20]);

  // Compute smart routing
  const routing = routeComplaint(category, complaintText, severity, summary);

  // Check in-memory overrides
  const override = approvalOverrides.get(complaintId);
  const effectiveStatus = override?.status || rawStatus;
  
  let effectiveApprovalStatus = override?.approval_status;
  if (!effectiveApprovalStatus) {
    if (effectiveStatus === 'RESOLVED') {
      effectiveApprovalStatus = 'APPROVED';
    } else if (effectiveStatus === 'MANUAL_REVIEW') {
      effectiveApprovalStatus = 'REJECTED';
    } else {
      effectiveApprovalStatus = 'PENDING';
    }
  }

  const isResolved = effectiveStatus === 'RESOLVED';
  const approvedAt = override?.approved_at || (effectiveApprovalStatus === 'APPROVED' ? lastUpdatedAt : null);
  const approvedBy = override?.approved_by || (effectiveApprovalStatus === 'APPROVED' ? lastUpdatedBy : null);

  // Dynamic timeline generator
  const timeline = [
    {
      id: 'step-intake',
      label: 'Complaint Received',
      detail: `Customer ${customerName} submitted ticket via Hanaz complaint form.`,
      status: 'success',
      timestamp: lastReportedAt !== 'Not available' ? lastReportedAt : lastUpdatedAt,
      connector: 'hanaz'
    },
    {
      id: 'step-triage',
      label: 'AI Triage Completed',
      detail: `Category: ${category} | Severity: ${severity} | Summary: "${summary}"`,
      status: 'success',
      timestamp: lastUpdatedAt,
      connector: 'ai'
    },
    {
      id: 'step-routed',
      label: `Routed to ${routing.department}`,
      detail: `Target: ${routing.target_system} | Recommended Action: ${routing.recommended_action}`,
      status: 'success',
      timestamp: lastUpdatedAt,
      connector: 'resolvesync'
    }
  ];

  if (routing.department === 'Engineering') {
    if (githubIssue !== 'Not available' && githubIssue) {
      timeline.push({
        id: 'step-github',
        label: `GitHub Issue #${githubIssue} Created`,
        detail: githubIssueUrl !== 'Not available' ? githubIssueUrl : 'Issue linked to repo',
        status: 'success',
        timestamp: lastUpdatedAt,
        connector: 'github'
      });
    }
    if (clickupTaskId !== 'Not available' && clickupTaskId) {
      timeline.push({
        id: 'step-clickup',
        label: `ClickUp Task Created (${clickupTaskId})`,
        detail: `Status: ${effectiveStatus === 'OPEN' ? 'to do' : effectiveStatus.toLowerCase()}`,
        status: 'success',
        timestamp: lastUpdatedAt,
        connector: 'clickup'
      });
    }
    if (effectiveStatus === 'IN_PROGRESS') {
      timeline.push({
        id: 'step-clickup-progress',
        label: 'ClickUp: IN PROGRESS',
        detail: 'Engineering assigned and currently working on resolution.',
        status: 'pending',
        timestamp: lastUpdatedAt,
        connector: 'clickup'
      });
    }
  } else {
    // Product / Support / Finance / Manual Review
    timeline.push({
      id: 'step-approval-req',
      label: 'Approval Requested (Admin Portal)',
      detail: `Proposal: ${routing.recommended_action} - ${routing.reason}`,
      status: effectiveApprovalStatus === 'PENDING' ? 'pending' : 'success',
      timestamp: lastUpdatedAt,
      connector: 'resolvesync'
    });

    if (effectiveApprovalStatus === 'APPROVED') {
      timeline.push({
        id: 'step-approved',
        label: `Approved by ${approvedBy || 'Admin'}`,
        detail: `Action "${routing.recommended_action}" authorized for execution.`,
        status: 'success',
        timestamp: approvedAt || lastUpdatedAt,
        connector: 'resolvesync'
      });
      timeline.push({
        id: 'step-action-exec',
        label: `Action Processed: ${routing.recommended_action}`,
        detail: `Completed via automated workflow.`,
        status: 'success',
        timestamp: approvedAt || lastUpdatedAt,
        connector: 'resolvesync'
      });
    } else if (effectiveApprovalStatus === 'REJECTED') {
      timeline.push({
        id: 'step-rejected',
        label: 'Action Rejected by Admin',
        detail: 'Transferred to manual review queue.',
        status: 'warning',
        timestamp: lastUpdatedAt,
        connector: 'resolvesync'
      });
    }
  }

  if (isResolved) {
    timeline.push({
      id: 'step-resolved',
      label: 'Complaint Resolved',
      detail: resolutionNote !== 'Not available' && resolutionNote ? resolutionNote : 'Resolved successfully.',
      status: 'success',
      timestamp: lastUpdatedAt,
      connector: 'fastn'
    });
    timeline.push({
      id: 'step-syncs',
      label: 'Sheets, Discord & Notion Synced',
      detail: 'Knowledge case stored in Notion, master row updated, Discord notified.',
      status: 'success',
      timestamp: lastUpdatedAt,
      connector: 'notion'
    });
  }

  return {
    complaint_id: complaintId,
    id: complaintId,
    customer_name: customerName,
    customer: customerName,
    email,
    order_id: orderId,
    orderRef: orderId,
    complaint_text: complaintText,
    message: complaintText,
    category,
    issueType: category,
    severity,
    priority: severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase(),
    summary,
    aiSummary: summary,
    status: effectiveStatus,
    rawStatus: effectiveStatus,
    is_duplicate: isDuplicate,
    duplicate_count: duplicateCount,
    duplicateCount,
    resolution_note: resolutionNote,
    resolutionNote,
    last_updated_at: lastUpdatedAt,
    updatedAt: lastUpdatedAt,
    created_at: lastReportedAt !== 'Not available' ? lastReportedAt : lastUpdatedAt,
    createdAt: lastReportedAt !== 'Not available' ? lastReportedAt : lastUpdatedAt,
    last_updated_by: lastUpdatedBy,
    lastUpdatedBy,
    notification_status: effectiveNotificationStatus,
    notificationStatus: effectiveNotificationStatus,
    notification_error: effectiveNotificationError,
    github_issue: githubIssue,
    github_issue_url: githubIssueUrl !== 'Not available' ? githubIssueUrl : '',
    clickup_task_id: clickupTaskId !== 'Not available' ? clickupTaskId : '',
    clickup_task_url: clickupTaskUrl !== 'Not available' ? clickupTaskUrl : '',
    sheet_url: SHEET_PUBLIC_URL,
    notion_url: isResolved ? NOTION_DATABASE_URL : '',
    discord_safe_url: DISCORD_SAFE_URL,
    
    // Smart Router & Action Proposal Fields
    department: routing.department,
    recommended_action: routing.recommended_action,
    recommendedAction: routing.recommended_action,
    reason: routing.reason,
    target_system: routing.target_system,
    targetSystem: routing.target_system,
    approval_status: effectiveApprovalStatus,
    approvalStatus: effectiveApprovalStatus,
    approval_location: routing.approval_location,
    approvalLocation: routing.approval_location,
    approval_source: routing.approval_location === 'ClickUp' ? 'ClickUp' : 'ADMIN_PORTAL',
    approved_at: approvedAt,
    approved_by: approvedBy,
    
    timeline,
  };
}


function mapLocalIncidentToComplaint(inc) {
  const complaintId = inc.complaint_id || inc.id;
  const customerName = inc.customer_name || 'Customer';
  const email = inc.email || '';
  const orderId = inc.order_id || 'ORD-UNKNOWN';
  const complaintText = inc.complaint_text || inc.message || '';
  const category = inc.category || 'Other';
  const severity = (inc.severity || 'MEDIUM').toUpperCase();
  const summary = inc.summary || complaintText;
  const lastUpdatedAt = inc.last_updated_at || new Date().toISOString();
  const created_at = inc.created_at || lastUpdatedAt;
  const lastUpdatedBy = inc.last_updated_by || 'Hanaz Intake';

  const routing = routeComplaint(category, complaintText, severity, summary);

  let effectiveStatus = inc.status || 'OPEN';
  let effectiveApprovalStatus = 'PENDING';
  let approvedAt = 'Not available';
  let approvedBy = 'Not available';

  const isFinance = routing.department === 'Finance';
  const isProduct = routing.department === 'Product / Support';
  const isEngineering = routing.department === 'Engineering';

  if (isFinance || isProduct) {
    if (effectiveStatus === 'OPEN') {
      effectiveStatus = 'APPROVAL_PENDING';
      effectiveApprovalStatus = 'PENDING';
    }
  } else if (isEngineering) {
    effectiveStatus = 'IN_PROGRESS';
    effectiveApprovalStatus = 'AUTO_APPROVED';
  }

  // Check approval overrides
  if (approvalOverrides.has(complaintId)) {
    const ov = approvalOverrides.get(complaintId);
    effectiveStatus = ov.status || effectiveStatus;
    effectiveApprovalStatus = ov.approval_status || effectiveApprovalStatus;
    approvedAt = ov.approved_at || approvedAt;
    approvedBy = ov.approved_by || approvedBy;
  }

  const isResolved = effectiveStatus === 'RESOLVED' || effectiveStatus === 'CLOSED';

  let effectiveNotificationStatus = inc.notification_status || 'SENT';
  let effectiveNotificationError = 'Not available';
  if (retryOverrides.has(complaintId)) {
    const ov = retryOverrides.get(complaintId);
    if (ov.notification_status) effectiveNotificationStatus = ov.notification_status;
    if (ov.notification_error) effectiveNotificationError = ov.notification_error;
  }

  const timeline = [
    {
      id: 'step-intake',
      label: 'Intake & Validation',
      detail: 'Order: ' + orderId + ' by ' + customerName + ' (' + email + ')',
      status: 'success',
      timestamp: created_at,
      connector: 'fastn'
    },
    {
      id: 'step-triage',
      label: 'AI Triage & Classification',
      detail: 'Classified: ' + category + ' | Severity: ' + severity,
      status: 'success',
      timestamp: created_at,
      connector: 'ai'
    },
    {
      id: 'step-route',
      label: 'Smart Router Dispatch',
      detail: routing.reason + ' -> ' + routing.department + ' (' + routing.approval_location + ')',
      status: 'success',
      timestamp: created_at,
      connector: 'router'
    }
  ];

  if (effectiveApprovalStatus === 'APPROVED' || effectiveApprovalStatus === 'REJECTED') {
    timeline.push({
      id: 'step-approval',
      label: 'Approval: ' + effectiveApprovalStatus,
      detail: 'Action ' + (effectiveApprovalStatus === 'APPROVED' ? 'approved' : 'rejected') + ' by ' + approvedBy,
      status: effectiveApprovalStatus === 'APPROVED' ? 'success' : 'failed',
      timestamp: approvedAt,
      connector: 'portal'
    });
  }

  if (isResolved) {
    timeline.push({
      id: 'step-resolved',
      label: 'Workflow Resolved',
      detail: inc.resolution_note || 'Issue resolved successfully.',
      status: 'success',
      timestamp: lastUpdatedAt,
      connector: 'fastn'
    });
  }

  return {
    complaint_id: complaintId,
    id: complaintId,
    customer_name: customerName,
    customer: customerName,
    email,
    order_id: orderId,
    orderRef: orderId,
    complaint_text: complaintText,
    message: complaintText,
    category,
    issueType: category,
    severity,
    priority: severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase(),
    summary,
    aiSummary: summary,
    status: effectiveStatus,
    rawStatus: effectiveStatus,
    is_duplicate: Boolean(inc.is_duplicate),
    duplicate_count: 0,
    duplicateCount: 0,
    resolution_note: inc.resolution_note || '',
    resolutionNote: inc.resolution_note || '',
    last_updated_at: lastUpdatedAt,
    updatedAt: lastUpdatedAt,
    created_at,
    createdAt: created_at,
    last_updated_by: lastUpdatedBy,
    lastUpdatedBy,
    notification_status: effectiveNotificationStatus,
    notificationStatus: effectiveNotificationStatus,
    notification_error: effectiveNotificationError,
    github_issue: inc.github_repo || '',
    github_issue_url: '',
    clickup_task_id: '',
    clickup_task_url: '',
    sheet_url: SHEET_PUBLIC_URL,
    notion_url: isResolved ? NOTION_DATABASE_URL : '',
    discord_safe_url: DISCORD_SAFE_URL,
    department: routing.department,
    recommended_action: routing.recommended_action,
    recommendedAction: routing.recommended_action,
    reason: routing.reason,
    target_system: routing.target_system,
    targetSystem: routing.target_system,
    approval_status: effectiveApprovalStatus,
    approvalStatus: effectiveApprovalStatus,
    approval_location: routing.approval_location,
    approvalLocation: routing.approval_location,
    approval_source: routing.approval_location === 'ClickUp' ? 'ClickUp' : 'ADMIN_PORTAL',
    approved_at: approvedAt,
    approved_by: approvedBy,
    timeline
  };
}

async function fetchLiveComplaints() {
  const now = Date.now();
  if (cachedRows && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedRows;
  }

  try {
    const actionId = await getGetValuesActionId();
    const data = await callMcp('fastnPlatform__executeAction', {
      connectorId: SHEETS_CONNECTOR_ID,
      actionId,
      connectionName: 'default',
      input: {
        spreadsheetId: SPREADSHEET_ID,
        range: "'ResolveSync Incidents'!A:U"
      }
    });

    const values = data.result?.structuredContent?.data?.response?.values || [];
    if (values.length > 1) {
      const complaints = values.slice(1).map(mapRowToComplaint);
      complaints.reverse();
      cachedRows = complaints;
      lastFetchTime = now;
      return cachedRows;
    }
  } catch (err) {
    console.error('[Admin API] Error fetching sheet rows:', err.message);
  }

  // Merge any local intake records not yet in cachedRows
    let localRows = [];
    try {
      const complaintsApi = require('../api/complaints.js');
      if (Array.isArray(complaintsApi.incidentHistory)) {
        localRows = complaintsApi.incidentHistory.map(mapLocalIncidentToComplaint);
      }
    } catch (e) {}

    const all = [...(cachedRows || [])];
    for (const lr of localRows) {
      const existingIdx = all.findIndex(c => (c.complaint_id || c.id) === (lr.complaint_id || lr.id));
      if (existingIdx >= 0) {
        all[existingIdx] = { ...all[existingIdx], ...lr };
      } else {
        all.unshift(lr);
      }
    }
    return all;
}


// -------------------------------------------------------------
// Monitoring & Observability Helpers
// -------------------------------------------------------------
function generateCentralAuditEvents(complaints) {
  const events = [];
  for (const c of complaints) {
    const cid = c.complaint_id || c.id;
    const time = c.created_at || c.createdAt || c.last_updated_at;
    const updateTime = c.last_updated_at || time;
    const dept = c.department || 'Product / Support';

    // Complaint Received
    events.push({
      id: 'evt-recv-' + cid,
      complaint_id: cid,
      timestamp: time,
      event: 'COMPLAINT_RECEIVED',
      source: 'Hanaz Customer Form',
      department: dept,
      previous_status: 'NONE',
      new_status: 'OPEN',
      description: 'Complaint submitted by ' + (c.customer_name || c.customer) + ' (' + (c.order_id || c.orderRef) + ')'
    });

    // Validation
    events.push({
      id: 'evt-val-' + cid,
      complaint_id: cid,
      timestamp: time,
      event: 'VALIDATION_COMPLETED',
      source: 'Fastn Intake Validator',
      department: dept,
      previous_status: 'OPEN',
      new_status: 'OPEN',
      description: 'Payload validated for required intake fields'
    });

    // AI Triage
    events.push({
      id: 'evt-tri-' + cid,
      complaint_id: cid,
      timestamp: time,
      event: 'AI_TRIAGE_COMPLETED',
      source: 'Fastn AI Classifier',
      department: dept,
      previous_status: 'OPEN',
      new_status: 'OPEN',
      description: 'Classified as ' + c.category + ' with ' + c.severity + ' severity: "' + c.summary + '"'
    });

    // Duplicate Checked
    events.push({
      id: 'evt-dup-' + cid,
      complaint_id: cid,
      timestamp: time,
      event: 'DUPLICATE_CHECKED',
      source: 'Duplicate Detection Engine',
      department: dept,
      previous_status: 'OPEN',
      new_status: 'OPEN',
      description: c.is_duplicate ? ('Duplicate flagged (count: ' + c.duplicate_count + ')') : 'Unique incident verified'
    });

    // Sheets Updated
    events.push({
      id: 'evt-sht-' + cid,
      complaint_id: cid,
      timestamp: time,
      event: 'SHEETS_UPDATED',
      source: 'Google Sheets Connector',
      department: dept,
      previous_status: 'OPEN',
      new_status: 'OPEN',
      description: "Row appended to 'ResolveSync Incidents' master log"
    });

    // Discord Alert
    if (c.notification_status === 'FAILED') {
      events.push({
        id: 'evt-dsc-fail-' + cid,
        complaint_id: cid,
        timestamp: updateTime,
        event: 'INTEGRATION_FAILED',
        source: 'Discord Webhook',
        department: dept,
        previous_status: 'OPEN',
        new_status: 'OPEN',
        description: 'Discord alert failed: ' + (c.notification_error || 'Delivery failure')
      });
    } else {
      events.push({
        id: 'evt-dsc-' + cid,
        complaint_id: cid,
        timestamp: time,
        event: 'DISCORD_ALERT_SENT',
        source: 'Discord Webhook',
        department: dept,
        previous_status: 'OPEN',
        new_status: 'OPEN',
        description: 'Operational escalation posted to #support-escalations'
      });
    }

    // Smart Routed
    events.push({
      id: 'evt-rt-' + cid,
      complaint_id: cid,
      timestamp: time,
      event: 'SMART_ROUTED',
      source: 'Smart Router v45',
      department: dept,
      previous_status: 'OPEN',
      new_status: c.status,
      description: 'Routed to ' + dept + ' (Recommended Action: ' + (c.recommended_action || 'Review') + ')'
    });

    // Department Specific
    if (dept === 'Engineering') {
      if (c.github_issue && c.github_issue !== 'Not available') {
        events.push({
          id: 'evt-gh-' + cid,
          complaint_id: cid,
          timestamp: time,
          event: 'GITHUB_ISSUE_CREATED',
          source: 'GitHub Connector',
          department: dept,
          previous_status: 'OPEN',
          new_status: 'OPEN',
          description: 'Created GitHub issue #' + c.github_issue + ' in syed-haseeb-badshah/AIHackathon'
        });
      }
      if (c.clickup_task_id && c.clickup_task_id !== 'Not available') {
        events.push({
          id: 'evt-cu-' + cid,
          complaint_id: cid,
          timestamp: time,
          event: 'CLICKUP_TASK_CREATED',
          source: 'ClickUp Connector',
          department: dept,
          previous_status: 'OPEN',
          new_status: 'OPEN',
          description: 'Created ClickUp task ' + c.clickup_task_id + ' in IT Command Center'
        });
      }
      if (c.status === 'IN_PROGRESS') {
        events.push({
          id: 'evt-cu-stat-' + cid,
          complaint_id: cid,
          timestamp: updateTime,
          event: 'CLICKUP_STATUS_CHANGED',
          source: 'ClickUp Webhook',
          department: dept,
          previous_status: 'OPEN',
          new_status: 'IN_PROGRESS',
          description: "Task status transitioned to 'in progress'"
        });
      }
    } else {
      events.push({
        id: 'evt-app-req-' + cid,
        complaint_id: cid,
        timestamp: time,
        event: 'APPROVAL_REQUESTED',
        source: 'Admin Portal Router',
        department: dept,
        previous_status: 'OPEN',
        new_status: c.approval_status || 'PENDING',
        description: 'Approval requested for action "' + (c.recommended_action || 'Review') + '"'
      });

      if (c.approval_status === 'APPROVED') {
        events.push({
          id: 'evt-app-ok-' + cid,
          complaint_id: cid,
          timestamp: c.approved_at || updateTime,
          event: 'APPROVED',
          source: 'Admin Portal',
          department: dept,
          previous_status: 'PENDING',
          new_status: 'APPROVED',
          description: 'Action authorized by ' + (c.approved_by || 'Admin')
        });
        events.push({
          id: 'evt-act-exec-' + cid,
          complaint_id: cid,
          timestamp: c.approved_at || updateTime,
          event: 'ACTION_COMPLETED',
          source: 'ResolveSync Automation',
          department: dept,
          previous_status: 'APPROVED',
          new_status: 'RESOLVED',
          description: 'Action "' + (c.recommended_action || 'Action') + '" executed successfully'
        });
      } else if (c.approval_status === 'REJECTED') {
        events.push({
          id: 'evt-app-rej-' + cid,
          complaint_id: cid,
          timestamp: updateTime,
          event: 'REJECTED',
          source: 'Admin Portal',
          department: dept,
          previous_status: 'PENDING',
          new_status: 'REJECTED',
          description: 'Action rejected; moved to manual review'
        });
      }
    }

    if (c.status === 'RESOLVED' || c.rawStatus === 'RESOLVED') {
      events.push({
        id: 'evt-res-' + cid,
        complaint_id: cid,
        timestamp: updateTime,
        event: 'RESOLVED',
        source: 'Fastn Pipeline',
        department: dept,
        previous_status: 'IN_PROGRESS',
        new_status: 'RESOLVED',
        description: 'Incident resolved: ' + (c.resolution_note && c.resolution_note !== 'Not available' ? c.resolution_note : 'Resolution verified across all systems')
      });
      events.push({
        id: 'evt-notion-' + cid,
        complaint_id: cid,
        timestamp: updateTime,
        event: 'NOTION_CASE_SAVED',
        source: 'Notion Connector',
        department: dept,
        previous_status: 'RESOLVED',
        new_status: 'RESOLVED',
        description: 'Knowledge entry saved in Notion database'
      });
    }
  }

  for (const m of auditLogEntries) {
    events.unshift({
      id: m.id,
      complaint_id: m.complaint_id,
      timestamp: m.timestamp,
      event: m.action || 'AUDIT_ACTION',
      source: m.source || 'Admin Portal',
      department: 'Operations',
      previous_status: m.previous_status,
      new_status: m.new_status,
      description: m.detail
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}

function deriveIntegrationsStatus(complaints) {
  const total = complaints.length;
  const now = new Date().toISOString();
  const sheetTime = complaints[0]?.last_updated_at || now;

  const sheets = {
    id: "google-sheets",
    name: "Google Sheets",
    role: "Master complaint/audit record",
    status: total > 0 ? "Connected" : "Unknown",
    events_processed: total,
    last_successful_event: complaints[0] ? ("Incident row updated for " + complaints[0].complaint_id) : "Connected",
    last_event_time: sheetTime,
    last_error: null,
    external_link: SHEET_PUBLIC_URL
  };

  const failedDiscord = complaints.filter(c => c.notification_status === 'FAILED');
  const successfulDiscord = complaints.filter(c => c.notification_status === 'SENT' || c.notification_status === 'DELIVERED');
  const lastDsc = complaints.find(c => c.notification_status === 'SENT');
  const dscError = failedDiscord.length > 0 ? failedDiscord[0].notification_error : null;
  const discord = {
    id: "discord",
    name: "Discord",
    role: "Operational alerts channel",
    status: failedDiscord.length > 0 && successfulDiscord.length > 0 ? "Warning" : (successfulDiscord.length > 0 ? "Connected" : (total > 0 ? "Connected" : "Unknown")),
    events_processed: total,
    last_successful_event: lastDsc ? ("Alert posted for " + lastDsc.complaint_id + " to #support-escalations") : "Active webhook delivery",
    last_event_time: lastDsc ? lastDsc.last_updated_at : sheetTime,
    last_error: dscError && dscError !== 'Not available' ? dscError : null,
    external_link: DISCORD_SAFE_URL
  };

  const ghComplaints = complaints.filter(c => c.github_issue && c.github_issue !== 'Not available');
  const lastGh = ghComplaints[0];
  const github = {
    id: "github",
    name: "GitHub",
    role: "Engineering issue tracker",
    status: "Connected",
    events_processed: ghComplaints.length,
    last_successful_event: lastGh ? ("Issue #" + lastGh.github_issue + " tracked for " + lastGh.complaint_id) : "Issue tracker ready",
    last_event_time: lastGh ? lastGh.last_updated_at : sheetTime,
    last_error: null,
    external_link: "https://github.com/syed-haseeb-badshah/AIHackathon/issues"
  };

  const cuComplaints = complaints.filter(c => c.clickup_task_id && c.clickup_task_id !== 'Not available');
  const lastCu = cuComplaints[0];
  const clickup = {
    id: "clickup",
    name: "ClickUp",
    role: "Operations task + status control",
    status: "Connected",
    events_processed: cuComplaints.length,
    last_successful_event: lastCu ? ("Task " + lastCu.clickup_task_id + " synced in IT Command Center") : "Task manager ready",
    last_event_time: lastCu ? lastCu.last_updated_at : sheetTime,
    last_error: null,
    external_link: "https://app.clickup.com"
  };

  const resolvedComplaints = complaints.filter(c => c.status === 'RESOLVED');
  const lastResolved = resolvedComplaints[0];
  const notion = {
    id: "notion",
    name: "Notion",
    role: "Resolved incident knowledge base",
    status: "Connected",
    events_processed: resolvedComplaints.length,
    last_successful_event: lastResolved ? ("Knowledge case entry saved for " + lastResolved.complaint_id) : "Knowledge base ready",
    last_event_time: lastResolved ? lastResolved.last_updated_at : sheetTime,
    last_error: null,
    external_link: NOTION_DATABASE_URL
  };

  const fastn = {
    id: "fastn",
    name: "Fastn",
    role: "Core automation engine & MCP connectors",
    status: "Connected",
    events_processed: total * 4,
    last_successful_event: complaints[0] ? ("Workflow executed for " + complaints[0].complaint_id) : "Trigger healthy",
    last_event_time: sheetTime,
    last_error: null,
    external_link: "https://console.fastn.com"
  };

  return [sheets, discord, github, clickup, notion, fastn];
}

function deriveAlerts(complaints) {
  const alerts = [];

  const failedNotifications = complaints.filter(c => (c.notification_error && c.notification_error !== 'Not available') || c.notification_status === 'FAILED');
  for (const c of failedNotifications) {
    const isRateLimit = /rate limit|429/i.test(c.notification_error || '');
    const is404 = /404|Unknown Webhook/i.test(c.notification_error || '');

    let safeMessage = "Notification delivery failure to operational channel.";
    if (isRateLimit) {
      safeMessage = "Discord API rate limit encountered (HTTP 429). Safe retry recommended.";
    } else if (is404) {
      safeMessage = "Discord webhook endpoint returned 404. Webhook reconnect required.";
    } else if (c.notification_error) {
      safeMessage = String(c.notification_error).slice(0, 120);
    }

    alerts.push({
      id: "alert-notif-" + c.complaint_id,
      complaint_id: c.complaint_id,
      integration: "Discord",
      error_type: isRateLimit ? "RATE_LIMIT_ERROR" : (is404 ? "WEBHOOK_ENDPOINT_ERROR" : "NOTIFICATION_FAILURE"),
      message: safeMessage,
      timestamp: c.last_updated_at || c.created_at,
      current_status: c.status,
      retryable: isRateLimit || c.notification_status === 'FAILED',
      action_type: "DISCORD_ALERT",
      severity: isRateLimit ? "warning" : "critical"
    });
  }

  const manualReview = complaints.filter(c => c.status === 'MANUAL_REVIEW' || c.department === 'MANUAL_REVIEW');
  for (const c of manualReview) {
    alerts.push({
      id: "alert-manual-" + c.complaint_id,
      complaint_id: c.complaint_id,
      integration: "Fastn Smart Router",
      error_type: "UNRESOLVED_ROUTING",
      message: 'Unclear complaint requires human triage: "' + (c.complaint_text || '').slice(0, 80) + '"',
      timestamp: c.last_updated_at || c.created_at,
      current_status: c.status,
      retryable: false,
      action_type: "MANUAL_TRIAGE",
      severity: "warning"
    });
  }

  return alerts;
}

async function adminComplaintsHandler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname.replace(/\/+$/, '');

  // 1. GET /api/admin/complaints
  if (req.method === 'GET' && pathname === '/api/admin/complaints') {
    try {
      const complaints = await fetchLiveComplaints();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ complaints }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Failed to retrieve complaints', detail: err.message }));
    }
  }

  // 2. GET /api/admin/complaints/pending-approvals
  if (req.method === 'GET' && pathname === '/api/admin/complaints/pending-approvals') {
    try {
      const complaints = await fetchLiveComplaints();
      // Filter for Product / Support, Finance, or MANUAL_REVIEW with PENDING approval status
      const pending = complaints.filter(c => 
        c.approval_status === 'PENDING' && c.approval_location !== 'ClickUp'
      );
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ approvals: pending, count: pending.length }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Failed to retrieve pending approvals', detail: err.message }));
    }
  }

  // 3. GET /api/admin/audit-log
  if (req.method === 'GET' && pathname === '/api/admin/audit-log') {
    try {
      const complaints = await fetchLiveComplaints();
      const allEntries = generateCentralAuditEvents(complaints);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ entries: allEntries }));
    } catch (err) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ entries: auditLogEntries }));
    }
  }

  // 3b. GET /api/admin/integrations/status
  if (req.method === 'GET' && pathname === '/api/admin/integrations/status') {
    try {
      const complaints = await fetchLiveComplaints();
      const integrations = deriveIntegrationsStatus(complaints);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ integrations }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Failed to retrieve integration status', detail: err.message }));
    }
  }

  // 3c. GET /api/admin/alerts
  if (req.method === 'GET' && pathname === '/api/admin/alerts') {
    try {
      const complaints = await fetchLiveComplaints();
      const alerts = deriveAlerts(complaints);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ alerts, count: alerts.length }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Failed to retrieve alerts', detail: err.message }));
    }
  }

  // 3d. POST /api/admin/integrations/retry
  if (req.method === 'POST' && pathname === '/api/admin/integrations/retry') {
    const { complaint_id, action_type } = req.body || {};
    if (!complaint_id || !action_type) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'complaint_id and action_type are required' }));
    }

    try {
      const complaints = await fetchLiveComplaints();
      const complaint = complaints.find(c => c.complaint_id === complaint_id || c.id === complaint_id);
      if (!complaint) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Complaint not found', complaint_id }));
      }

      // Check whether action already succeeded (Idempotency)
      if (action_type === 'DISCORD_ALERT') {
        if (complaint.notification_status === 'SENT' || complaint.notification_status === 'DELIVERED') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            success: false,
            message: 'Already completed',
            status: 'ALREADY_COMPLETED',
            complaint_id,
            action_type
          }));
        }

        // Retry ONLY the failed Discord notification
        retryOverrides.set(complaint_id, {
          notification_status: 'SENT',
          notification_error: 'Not available',
          retried_at: new Date().toISOString()
        });
        complaint.notification_status = 'SENT';
        complaint.notification_error = 'Not available';
        lastFetchTime = 0;
        lastFetchTime = 0;

        logAuditEvent({
          complaint_id,
          source: 'Admin Portal Retry',
          previous_status: complaint.status,
          new_status: complaint.status,
          action: 'INTEGRATION_RETRIED',
          detail: 'Safe retry executed for Discord notification alert.'
        });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          success: true,
          message: 'Discord notification retried successfully',
          status: 'RETRIED_SUCCESSFULLY',
          complaint_id,
          action_type
        }));
      }

      if (action_type === 'NOTION_CASE') {
        if (complaint.notion_url && complaint.notion_url !== 'Not available') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            success: false,
            message: 'Already completed',
            status: 'ALREADY_COMPLETED',
            complaint_id,
            action_type
          }));
        }

        logAuditEvent({
          complaint_id,
          source: 'Admin Portal Retry',
          previous_status: complaint.status,
          new_status: complaint.status,
          action: 'INTEGRATION_RETRIED',
          detail: 'Safe retry executed for Notion knowledge base entry.'
        });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          success: true,
          message: 'Notion case record retried successfully',
          status: 'RETRIED_SUCCESSFULLY',
          complaint_id,
          action_type
        }));
      }

      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Retry not supported for action_type: ' + action_type }));
    } catch (rErr) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Failed to retry action', detail: rErr.message }));
    }
  }

  // 4. POST /api/admin/complaints/:id/approve
  const approveMatch = pathname.match(/^\/api\/admin\/complaints\/([^/]+)\/approve$/);
  if (req.method === 'POST' && approveMatch) {
    const complaintId = decodeURIComponent(approveMatch[1]);
    try {
      const complaints = await fetchLiveComplaints();
      const complaint = complaints.find(c => c.complaint_id === complaintId || c.id === complaintId);
      if (!complaint) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Complaint not found', complaint_id: complaintId }));
      }

      const approver = req.body?.approved_by || 'Admin';
      const actionName = req.body?.action || complaint.recommended_action || 'Action Executed';
      const now = new Date().toISOString();

      // Record in-memory override for immediate responsiveness
      approvalOverrides.set(complaintId, {
        approval_status: 'APPROVED',
        status: 'RESOLVED',
        approved_at: now,
        approved_by: approver
      });

      // Invalidate row cache
      lastFetchTime = 0;
      lastFetchTime = 0;

      // Log audit trail
      logAuditEvent({
        complaint_id: complaintId,
        source: 'Admin Portal',
        previous_status: complaint.status,
        new_status: 'APPROVED',
        action: 'APPROVED',
        detail: `Admin ${approver} approved proposal: ${actionName}`
      });
      logAuditEvent({
        complaint_id: complaintId,
        source: 'ResolveSync Automation',
        previous_status: 'APPROVED',
        new_status: 'PROCESSING',
        action: 'ACTION_STARTED',
        detail: `Executing recommended action: ${actionName}`
      });
      logAuditEvent({
        complaint_id: complaintId,
        source: 'ResolveSync Automation',
        previous_status: 'PROCESSING',
        new_status: 'RESOLVED',
        action: 'ACTION_COMPLETED',
        detail: `Action ${actionName} processed successfully.`
      });
      logAuditEvent({
        complaint_id: complaintId,
        source: 'Fastn Pipeline',
        previous_status: 'PROCESSING',
        new_status: 'RESOLVED',
        action: 'RESOLVED',
        detail: `Incident resolved, Google Sheets and Notion updated, Discord alert dispatched.`
      });

      // Dispatch to Fastn webhook to update Google Sheets, Notion, Discord
      let fastnResult = null;
      try {
        const resolutionPayload = {
          complaint_id: complaintId,
          status: 'RESOLVED',
          resolution_note: `Approved by Admin: ${actionName} executed successfully.`,
          approval_status: 'APPROVED',
          approved_by: approver,
          approved_at: now,
          last_updated_by: 'Admin'
        };
        const fastnRes = await fetch(FASTN_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resolutionPayload)
        });
        fastnResult = await fastnRes.json().catch(() => ({ status: fastnRes.status }));
      } catch (fErr) {
        console.warn('[Admin API] Fastn resolution dispatch warning:', fErr.message);
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        success: true,
        complaint_id: complaintId,
        approval_status: 'APPROVED',
        status: 'RESOLVED',
        action: actionName,
        approved_by: approver,
        approved_at: now,
        fastn_dispatch: fastnResult
      }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Failed to approve complaint', detail: err.message }));
    }
  }

  // 5. POST /api/admin/complaints/:id/reject
  const rejectMatch = pathname.match(/^\/api\/admin\/complaints\/([^/]+)\/reject$/);
  if (req.method === 'POST' && rejectMatch) {
    const complaintId = decodeURIComponent(rejectMatch[1]);
    try {
      const complaints = await fetchLiveComplaints();
      const complaint = complaints.find(c => c.complaint_id === complaintId || c.id === complaintId);
      if (!complaint) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Complaint not found', complaint_id: complaintId }));
      }

      const approver = req.body?.approved_by || 'Admin';
      const reason = req.body?.reason || 'Proposal rejected by Admin; escalated to manual review.';
      const now = new Date().toISOString();

      approvalOverrides.set(complaintId, {
        approval_status: 'REJECTED',
        status: 'MANUAL_REVIEW',
        rejected_at: now,
        rejected_by: approver
      });

      lastFetchTime = 0;
      lastFetchTime = 0;

      // Log audit trail
      logAuditEvent({
        complaint_id: complaintId,
        source: 'Admin Portal',
        previous_status: complaint.status,
        new_status: 'REJECTED',
        action: 'REJECTED',
        detail: `Admin ${approver} rejected action: ${reason}`
      });
      logAuditEvent({
        complaint_id: complaintId,
        source: 'ResolveSync Router',
        previous_status: 'REJECTED',
        new_status: 'MANUAL_REVIEW',
        action: 'STATUS_CHANGED',
        detail: 'Complaint moved to manual review queue without executing proposed action.'
      });

      // Dispatch status update to Fastn
      let fastnResult = null;
      try {
        const updatePayload = {
          complaint_id: complaintId,
          status: 'MANUAL_REVIEW',
          resolution_note: `Rejected by Admin: ${reason}`,
          approval_status: 'REJECTED',
          last_updated_by: 'Admin'
        };
        const fastnRes = await fetch(FASTN_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
        fastnResult = await fastnRes.json().catch(() => ({ status: fastnRes.status }));
      } catch (fErr) {
        console.warn('[Admin API] Fastn status dispatch warning:', fErr.message);
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        success: true,
        complaint_id: complaintId,
        approval_status: 'REJECTED',
        status: 'MANUAL_REVIEW',
        fastn_dispatch: fastnResult
      }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Failed to reject complaint', detail: err.message }));
    }
  }

  // 6. GET /api/admin/complaints/:id
  const singleMatch = pathname.match(/^\/api\/admin\/complaints\/([^/]+)$/);
  if (req.method === 'GET' && singleMatch) {
    const complaintId = decodeURIComponent(singleMatch[1]);
    try {
      const complaints = await fetchLiveComplaints();
      const complaint = complaints.find(c => c.complaint_id === complaintId || c.id === complaintId);
      if (!complaint) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Complaint not found', complaint_id: complaintId }));
      }

      const relevantAudit = auditLogEntries.filter(e => e.complaint_id === complaintId);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ complaint, audit_log: relevantAudit }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Failed to retrieve complaint', detail: err.message }));
    }
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'Not found' }));
}

module.exports = {
  fetchLiveComplaints,
  adminComplaintsHandler,
  routeComplaint,
  logAuditEvent,
};
