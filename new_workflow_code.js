export default async function (ctx) {
  const { input } = ctx;
  const {
    complaint_id, customer_name, email, order_id, complaint_text,
    status: inputStatus, resolution_note, task_id, taskId,
    clickup_task_id, history_items, event, webhook_id, source,
    last_updated_by: inputLastUpdatedBy,
  } = input || {};

  const SPREADSHEET_ID = '1y0-ZimyPt0G-h4z05eYmVCycnPe5A_38vHL3uAOwZvc';
  const SHEET_NAME = 'ResolveSync Incidents';
  const CLICKUP_LIST_ID = '1100360000060397';

  const COL = {
    complaint_id: 0, customer_name: 1, email: 2, order_id: 3,
    complaint_text: 4, category: 5, severity: 6, summary: 7,
    status: 8, is_duplicate: 9, resolution_note: 10,
    last_updated_at: 11, last_updated_by: 12,
    notification_status: 13, notification_error: 14,
    github_issue_number: 15, clickup_task_id: 16, clickup_task_url: 17,
    duplicate_count: 18, last_reported_at: 19, github_issue_url: 20,
  };

  const isEmpty = (val) =>
    val === undefined || val === null || (typeof val === 'string' && val.trim() === '');

  function normalizeStatus(rawStatus) {
    if (!rawStatus) return 'OPEN';
    const s = String(rawStatus).trim().toLowerCase();
    if (s === 'open' || s === 'to do' || s === 'todo') return 'OPEN';
    if (s === 'in progress' || s === 'in_progress' || s === 'inprogress') return 'IN_PROGRESS';
    if (s === 'complete' || s === 'completed' || s === 'closed' || s === 'resolved' || s === 'done') return 'RESOLVED';
    return String(rawStatus).trim().toUpperCase();
  }

  function toClickUpStatus(rsStatus) {
    const s = String(rsStatus).trim().toUpperCase();
    if (s === 'IN_PROGRESS') return 'in progress';
    if (s === 'RESOLVED') return 'completed';
    return 'to do';
  }

  function severityRank(s) {
    const ranks = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    return ranks[String(s || 'LOW').trim().toUpperCase()] || 0;
  }

  async function notifyDiscord(content, forceFail, customUrl) {
    let discordWebhookUrl = customUrl || null;
    if (!discordWebhookUrl) {
      if (forceFail) {
        discordWebhookUrl = 'https://discord.com/api/webhooks/00000000/invalid_force_fail';
      } else {
        try { discordWebhookUrl = await fastn.secrets.get('DISCORD_WEBHOOK_URL'); } catch (e) {}
        if (!discordWebhookUrl) {
          discordWebhookUrl = 'https://discord.com/api/webhooks/1550744812716691457/XcSSVvF-B7byzxHoRcQGMrC25TbJVjxi3aqLvX1B_-wqm_Jtj1NgqTBV1NUw_LcRmeVm';
        }
      }
    }
    let attempts = 0, lastError = null;
    while (attempts < 2) {
      attempts++;
      try {
        const res = await fetch(discordWebhookUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) {
          let errText = ''; try { errText = await res.text(); } catch (e) {}
          throw new Error('Discord HTTP ' + res.status + ': ' + (errText || res.statusText));
        }
        return { notification_status: 'SENT', notification_error: null, attempts };
      } catch (err) {
        lastError = err.message || String(err);
      }
    }
    return { notification_status: 'FAILED', notification_error: lastError, attempts };
  }

  async function readAllSheetRows() {
    try {
      const r = await fastn.connector.googleSheets.getValues({
        spreadsheetId: SPREADSHEET_ID, range: "'ResolveSync Incidents'!A:U",
      });
      return r?.output?.values || r?.values || [];
    } catch (err) { return []; }
  }

  async function createClickUpTaskSafe(taskData, forceFail) {
    if (forceFail) return { success: false, error: 'Forced ClickUp failure for testing' };
    try {
      const cuRes = await fastn.connector.clickup.createTask({
        listId: CLICKUP_LIST_ID, name: taskData.name,
        description: taskData.description, status: 'to do',
      });
      const data = cuRes?.output || cuRes?.response || cuRes;
      const taskId = data?.id || data?.taskId || null;
      const taskUrl = data?.url || (taskId ? 'https://app.clickup.com/t/' + taskId : null);
      return { success: true, task: data, id: taskId, url: taskUrl };
    } catch (err) { return { success: false, error: err.message || String(err) }; }
  }

  async function updateClickUpTaskStatusSafe(taskId, statusName) {
    if (!taskId) return null;
    try {
      const cuRes = await fastn.connector.clickup.updateTask({ taskId, status: statusName });
      return cuRes?.output || cuRes?.response || cuRes;
    } catch (err) { return null; }
  }

  // FLOW 1: ClickUp Status Change Event
  const incomingClickUpTaskId =
    clickup_task_id || task_id || taskId ||
    (history_items && history_items[0]?.task_id) || null;

  const isClickUpStatusEvent =
    event === 'taskStatusUpdated' || Boolean(webhook_id) ||
    (Boolean(incomingClickUpTaskId) && isEmpty(complaint_text) &&
      (inputStatus !== undefined || input?.status !== undefined || Boolean(history_items)));

  if (isClickUpStatusEvent) {
    let rawStatus = null;
    if (history_items && history_items.length > 0) {
      const si = history_items.find((h) => h.field === 'status') || history_items[0];
      rawStatus = si?.after?.status || si?.after;
    }
    if (!rawStatus) rawStatus = inputStatus !== undefined ? inputStatus : input?.status;

    const targetStatus = normalizeStatus(rawStatus);
    const targetClickUpId = incomingClickUpTaskId;
    let complaintRecord = null;
    let foundComplaintId = complaint_id || null;

    if (targetClickUpId) {
      complaintRecord = await fastn.state.get('clickup_task:' + targetClickUpId);
      if (complaintRecord?.complaint_id) foundComplaintId = complaintRecord.complaint_id;
    }
    if (!complaintRecord && foundComplaintId) {
      complaintRecord = await fastn.state.get('complaint:' + foundComplaintId);
    }

    const rows = await readAllSheetRows();
    let foundRowIndex = -1, existingRow = null;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      if (targetClickUpId && r[COL.clickup_task_id] === targetClickUpId) {
        foundRowIndex = i + 1; existingRow = r;
        if (!foundComplaintId) foundComplaintId = r[COL.complaint_id]; break;
      }
      if (foundComplaintId && r[COL.complaint_id] === foundComplaintId) {
        foundRowIndex = i + 1; existingRow = r; break;
      }
    }

    if (!existingRow && !complaintRecord) {
      return { error: 'Complaint not found for ClickUp task', clickup_task_id: targetClickUpId };
    }

    const complaintIdFinal = foundComplaintId || existingRow?.[COL.complaint_id] || complaintRecord?.complaint_id;
    const orderIdFinal = existingRow?.[COL.order_id] || complaintRecord?.order_id || '';
    const currentStatus = (existingRow?.[COL.status] || complaintRecord?.status || 'OPEN').trim().toUpperCase();

    if (currentStatus === 'RESOLVED' && targetStatus === 'OPEN') {
      return 'Conflict detected: resolved complaint cannot be reopened automatically';
    }

    const lastUpdatedAt = new Date().toISOString();
    const lastUpdatedBy = 'ClickUp';
    const noteVal = (resolution_note !== undefined && resolution_note !== null)
      ? String(resolution_note)
      : (existingRow?.[COL.resolution_note] || complaintRecord?.resolution_note || '');

    if (foundRowIndex > 0) {
      const isDupVal = existingRow[COL.is_duplicate] !== undefined ? existingRow[COL.is_duplicate] : false;
      await fastn.connector.googleSheets.updateValues({
        spreadsheetId: SPREADSHEET_ID,
        range: "'ResolveSync Incidents'!I" + foundRowIndex + ':M' + foundRowIndex,
        valueInputOption: 'USER_ENTERED',
        values: [[targetStatus, isDupVal, noteVal, lastUpdatedAt, lastUpdatedBy]],
      });
    }

    let discordResult = null;
    if (targetStatus === 'IN_PROGRESS') {
      discordResult = await notifyDiscord(
        '🔄 COMPLAINT IN PROGRESS\nComplaint ID: ' + complaintIdFinal + '\nOrder: ' + orderIdFinal + '\nStatus: IN PROGRESS',
        Boolean(input?.force_discord_failure), input?.discord_webhook_url);
    } else if (targetStatus === 'RESOLVED') {
      const resText = noteVal ? '\nResolution: ' + noteVal : '';
      discordResult = await notifyDiscord(
        '✅ COMPLAINT RESOLVED\nComplaint ID: ' + complaintIdFinal + '\nOrder: ' + orderIdFinal + resText,
        Boolean(input?.force_discord_failure), input?.discord_webhook_url);
    }

    let githubUpdateResult = null, githubUpdateError = null;
    if (targetStatus === 'RESOLVED') {
      const issueNum = complaintRecord?.github_issue_number || existingRow?.[COL.github_issue_number] || input?.github_issue_number;
      if (issueNum) {
        try {
          if (input?.force_github_failure) throw new Error('Forced GitHub failure for testing');
          const ghRes = await fastn.connector.github.updateIssue({
            owner: input?.github_owner || 'syed-haseeb-badshah',
            repo: input?.github_repo || 'AIHackathon',
            issue_number: Number(issueNum), state: 'closed', state_reason: 'completed',
          });
          githubUpdateResult = ghRes?.output || ghRes;
        } catch (ghErr) { githubUpdateError = ghErr.message || String(ghErr); }
      }
    }

    let notionResult = null, notionError = null;
    if (targetStatus === 'RESOLVED' && !complaintRecord?.notion_page_id) {
      try {
        if (input?.force_notion_failure) throw new Error('Forced Notion failure for testing');
        const catVal = complaintRecord?.category || existingRow?.[COL.category] || 'Other';
        const sevRaw = (complaintRecord?.severity || existingRow?.[COL.severity] || 'LOW').trim().toUpperCase();
        const sumVal = complaintRecord?.summary || existingRow?.[COL.summary] || '';
        const finalSev = ['LOW','MEDIUM','HIGH','CRITICAL'].includes(sevRaw) ? sevRaw : 'LOW';
        const np = {
          Name: { title: [{ text: { content: complaintIdFinal } }] },
          category: { rich_text: [{ text: { content: String(catVal) } }] },
          severity: { select: { name: finalSev } },
          summary: { rich_text: [{ text: { content: String(sumVal) } }] },
          status: { select: { name: 'RESOLVED' } },
          resolution_note: { rich_text: [{ text: { content: String(noteVal || 'Resolved via ClickUp') } }] },
          resolved_at: { date: { start: lastUpdatedAt } },
        };
        let notionRes = null;
        try {
          notionRes = await fastn.connector.notion.createPageRaw({ parent: { data_source_id: '3e0b4ad5-cb6b-81c0-a30b-000b1de6b000' }, properties: np });
        } catch (e) {
          notionRes = await fastn.connector.notion.createPageRaw({ parent: { database_id: '3e0b4ad5-cb6b-819b-89bf-f9deb1ff81be' }, properties: np });
        }
        notionResult = notionRes?.output || notionRes;
      } catch (nErr) { notionError = nErr.message || String(nErr); }
    }

    if (complaintRecord) {
      complaintRecord.status = targetStatus;
      complaintRecord.resolution_note = noteVal;
      complaintRecord.last_updated_at = lastUpdatedAt;
      complaintRecord.last_updated_by = lastUpdatedBy;
      if (notionResult?.id) complaintRecord.notion_page_id = notionResult.id;
      await fastn.state.set('complaint:' + complaintIdFinal, complaintRecord);
      if (targetClickUpId) await fastn.state.set('clickup_task:' + targetClickUpId, complaintRecord);
    }

    return {
      status: targetStatus, complaint_id: complaintIdFinal, clickup_task_id: targetClickUpId,
      order_id: orderIdFinal, resolution_note: noteVal, last_updated_at: lastUpdatedAt,
      last_updated_by: lastUpdatedBy, sheets_synced: foundRowIndex > 0,
      discord_result: discordResult, github_update_result: githubUpdateResult,
      github_update_error: githubUpdateError, notion_result: notionResult, notion_error: notionError,
    };
  }

  // FLOW 2: Manual / API Resolution or Status Update
  const isUpdateRequest =
    inputStatus !== undefined || (resolution_note !== undefined && isEmpty(complaint_text));

  if (isUpdateRequest) {
    if (isEmpty(complaint_id)) return 'Complaint not found';

    const rows = await readAllSheetRows();
    let foundRowIndex = -1, existingRow = null;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][COL.complaint_id] === complaint_id) {
        foundRowIndex = i + 1; existingRow = rows[i]; break;
      }
    }
    const stateKey = 'complaint:' + complaint_id;
    const stateRecord = await fastn.state.get(stateKey);
    if (foundRowIndex === -1 && !stateRecord) return 'Complaint not found';

    const currentStatus = (existingRow?.[COL.status] || stateRecord?.status || 'OPEN').trim().toUpperCase();
    const targetStatus = inputStatus !== undefined ? normalizeStatus(inputStatus) : currentStatus;
    if (currentStatus === 'RESOLVED' && targetStatus === 'OPEN') {
      return 'Conflict detected: resolved complaint cannot be reopened automatically';
    }

    const finalStatus = targetStatus;
    const isDupVal = existingRow?.[COL.is_duplicate] !== undefined ? existingRow[COL.is_duplicate] : false;
    const noteVal = (resolution_note !== undefined && resolution_note !== null)
      ? String(resolution_note)
      : (existingRow?.[COL.resolution_note] || stateRecord?.resolution_note || '');
    const lastUpdatedAt = new Date().toISOString();
    const lastUpdatedBy = inputLastUpdatedBy || 'ResolveSync';

    const linkedClickUpId = stateRecord?.clickup_task_id || existingRow?.[COL.clickup_task_id] || null;
    if (linkedClickUpId) await updateClickUpTaskStatusSafe(linkedClickUpId, toClickUpStatus(finalStatus));

    if (foundRowIndex > 0) {
      await fastn.connector.googleSheets.updateValues({
        spreadsheetId: SPREADSHEET_ID,
        range: "'ResolveSync Incidents'!I" + foundRowIndex + ':M' + foundRowIndex,
        valueInputOption: 'USER_ENTERED',
        values: [[finalStatus, isDupVal, noteVal, lastUpdatedAt, lastUpdatedBy]],
      });
    }
    if (stateRecord) {
      stateRecord.status = finalStatus; stateRecord.resolution_note = noteVal;
      stateRecord.last_updated_at = lastUpdatedAt; stateRecord.last_updated_by = lastUpdatedBy;
      await fastn.state.set(stateKey, stateRecord);
      if (linkedClickUpId) await fastn.state.set('clickup_task:' + linkedClickUpId, stateRecord);
    }

    let discordResult = null, githubUpdateResult = null, githubUpdateError = null;
    let notionResult = null, notionError = null;

    if (finalStatus === 'RESOLVED') {
      const resText = noteVal ? '\nResolution: ' + noteVal : '';
      discordResult = await notifyDiscord(
        '✅ COMPLAINT RESOLVED\nComplaint ID: ' + complaint_id + '\nOrder: ' + (existingRow?.[COL.order_id] || stateRecord?.order_id || '') + resText,
        Boolean(input?.force_discord_failure), input?.discord_webhook_url);

      const issueNum = stateRecord?.github_issue_number || existingRow?.[COL.github_issue_number] || input?.github_issue_number;
      if (issueNum) {
        try {
          if (input?.force_github_failure) throw new Error('Forced GitHub failure for testing');
          const ghRes = await fastn.connector.github.updateIssue({
            owner: input?.github_owner || 'syed-haseeb-badshah',
            repo: input?.github_repo || 'AIHackathon',
            issue_number: Number(issueNum), state: 'closed', state_reason: 'completed',
          });
          githubUpdateResult = ghRes?.output || ghRes;
        } catch (ghErr) { githubUpdateError = ghErr.message || String(ghErr); }
      }

      if (!stateRecord?.notion_page_id) {
        try {
          if (input?.force_notion_failure) throw new Error('Forced Notion failure for testing');
          const catVal = stateRecord?.category || existingRow?.[COL.category] || 'Other';
          const sevRaw = (stateRecord?.severity || existingRow?.[COL.severity] || 'LOW').trim().toUpperCase();
          const sumVal = stateRecord?.summary || existingRow?.[COL.summary] || '';
          const finalSev = ['LOW','MEDIUM','HIGH','CRITICAL'].includes(sevRaw) ? sevRaw : 'LOW';
          const np = {
            Name: { title: [{ text: { content: complaint_id } }] },
            category: { rich_text: [{ text: { content: String(catVal) } }] },
            severity: { select: { name: finalSev } },
            summary: { rich_text: [{ text: { content: String(sumVal) } }] },
            status: { select: { name: 'RESOLVED' } },
            resolution_note: { rich_text: [{ text: { content: String(noteVal) } }] },
            resolved_at: { date: { start: lastUpdatedAt } },
          };
          let notionRes = null;
          try {
            notionRes = await fastn.connector.notion.createPageRaw({ parent: { data_source_id: '3e0b4ad5-cb6b-81c0-a30b-000b1de6b000' }, properties: np });
          } catch (e) {
            notionRes = await fastn.connector.notion.createPageRaw({ parent: { database_id: '3e0b4ad5-cb6b-819b-89bf-f9deb1ff81be' }, properties: np });
          }
          notionResult = notionRes?.output || notionRes;
          if (stateRecord) { stateRecord.notion_page_id = notionResult?.id || true; await fastn.state.set(stateKey, stateRecord); }
        } catch (nErr) { notionError = nErr.message || String(nErr); }
      }
    } else if (finalStatus === 'IN_PROGRESS') {
      discordResult = await notifyDiscord(
        '🔄 COMPLAINT IN PROGRESS\nComplaint ID: ' + complaint_id + '\nOrder: ' + (existingRow?.[COL.order_id] || stateRecord?.order_id || '') + '\nStatus: IN PROGRESS',
        Boolean(input?.force_discord_failure), input?.discord_webhook_url);
    }

    return {
      status: finalStatus, complaint_id, resolution_note: noteVal,
      last_updated_at: lastUpdatedAt, last_updated_by: lastUpdatedBy,
      notification_status: discordResult ? discordResult.notification_status : null,
      notification_error: discordResult ? discordResult.notification_error : null,
      updated_row: foundRowIndex, discord_result: discordResult,
      github_update_result: githubUpdateResult, github_update_error: githubUpdateError,
      notion_result: notionResult, notion_error: notionError, clickup_task_id: linkedClickUpId,
    };
  }

  // FLOW 3: New Complaint Intake & Triage

  // STEP 1: Validation
  if (isEmpty(complaint_id) || isEmpty(customer_name) || isEmpty(email) || isEmpty(order_id) || isEmpty(complaint_text)) {
    return 'Invalid complaint data';
  }

  // STEP 2: AI Triage
  function triageComplaint(text) {
    const lower = (text || '').toLowerCase();
    let category = 'Other';
    if (/\b(refund|money back|reimburse|reimbursement|return money|cancel and refund)\b/.test(lower)) {
      category = 'Refund';
    } else if (/\b(payment|deducted|charged|billing|invoice|transaction|card|credit card|debit card|checkout|stripe|overcharged|double charge)\b/.test(lower)) {
      category = 'Payment';
    } else if (/\b(login|log in|sign in|signin|password|auth|authentication|2fa|mfa|otp|locked out|access denied)\b/.test(lower)) {
      category = 'Login/Auth';
    } else if (/\b(deliver|delivery|shipping|shipment|courier|carrier|tracking|package|parcel|arrived|transit|damaged box|missing item)\b/.test(lower)) {
      category = 'Delivery';
    } else if (/\b(bug|crash|glitch|error|broken|defect|freeze|malfunction|fails|500|404|not working)\b/.test(lower)) {
      category = 'Product Bug';
    } else if (/\b(account|profile|subscription|membership|email change|close account|cancel subscription|downgrade|upgrade)\b/.test(lower)) {
      category = 'Account';
    }
    let severity = 'LOW';
    if (/\b(security|breach|leak|legal|lawyer|police|unauthorized|fraud|stolen|emergency|hacked)\b/.test(lower)) {
      severity = 'CRITICAL';
    } else if (/\b(deducted twice|charged twice|double charged|double charge|damaged|broken|missing|never arrived|lost|ruined|furious|urgent|severe|unacceptable|locked out|cannot log in|cannot sign in|cannot login|access denied|refund not received|overcharged)\b/.test(lower) || category === 'Payment' || category === 'Refund') {
      severity = 'HIGH';
    } else if (/\b(delayed|delay|late|slow|issue|problem|bug|glitch|incorrect|wrong|confusing|disappointed|waiting|error|fail|fails|failing|failed|trouble|not working|crash|crashes|freeze)\b/.test(lower)) {
      severity = 'MEDIUM';
    }
    const clean = (text || '').replace(/[\r\n\t]+/g, ' ').trim();
    const words = clean.split(/\s+/);
    let summary = words.length <= 18 ? clean : words.slice(0, 18).join(' ') + '...';
    if (summary.split(/\s+/).length >= 20) summary = summary.split(/\s+/).slice(0, 19).join(' ');
    return { category, severity, summary };
  }

  const triage = triageComplaint(complaint_text);

  // STEP 3: Duplicate Detection
  // Check A: complaint_id already exists
  // Check B: OPEN/IN_PROGRESS complaint with same order_id AND same category
  const stateKey = 'complaint:' + complaint_id;
  let existingRecord = await fastn.state.get(stateKey);

  const rows = await readAllSheetRows();
  let existingRowIndex = -1, existingSheetRow = null;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i] && rows[i][COL.complaint_id] === complaint_id) {
      existingRowIndex = i + 1; existingSheetRow = rows[i]; break;
    }
  }

  if (!existingSheetRow && !existingRecord) {
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const rowOrderId = r[COL.order_id];
      const rowCategory = r[COL.category];
      const rowStatus = (r[COL.status] || 'OPEN').trim().toUpperCase();
      if (rowOrderId === order_id && rowCategory === triage.category && (rowStatus === 'OPEN' || rowStatus === 'IN_PROGRESS')) {
        existingRowIndex = i + 1; existingSheetRow = r;
        const altCid = r[COL.complaint_id];
        if (altCid) { const alt = await fastn.state.get('complaint:' + altCid); if (alt) existingRecord = alt; }
        break;
      }
    }
  }

  const isDuplicate = Boolean(existingRecord || existingSheetRow);

  if (isDuplicate) {
    const lastReportedAt = new Date().toISOString();
    const existingSeverity = existingSheetRow?.[COL.severity] || existingRecord?.severity || 'LOW';
    const newSeverity = triage.severity;
    const isEscalation = severityRank(newSeverity) > severityRank(existingSeverity);

    const currentDupCount = Number(
      existingRecord?.duplicate_count != null ? existingRecord.duplicate_count : (existingSheetRow?.[COL.duplicate_count] ?? 0)
    );
    const updatedDupCount = currentDupCount + 1;

    if (existingRecord) {
      existingRecord.duplicate_count = updatedDupCount;
      existingRecord.last_reported_at = lastReportedAt;
      existingRecord.is_duplicate = true;
      if (isEscalation) existingRecord.severity = newSeverity;
      await fastn.state.set(stateKey, existingRecord);
    }

    if (existingRowIndex > 0) {
      await fastn.connector.googleSheets.updateValues({
        spreadsheetId: SPREADSHEET_ID,
        range: "'ResolveSync Incidents'!J" + existingRowIndex + ':T' + existingRowIndex,
        valueInputOption: 'USER_ENTERED',
        values: [[
          true,
          existingSheetRow?.[COL.resolution_note] || '',
          lastReportedAt, 'ResolveSync',
          existingSheetRow?.[COL.notification_status] || 'SENT',
          existingSheetRow?.[COL.notification_error] || '',
          existingSheetRow?.[COL.github_issue_number] || '',
          existingSheetRow?.[COL.clickup_task_id] || '',
          existingSheetRow?.[COL.clickup_task_url] || '',
          updatedDupCount, lastReportedAt,
        ]],
      });
      if (isEscalation) {
        await fastn.connector.googleSheets.updateValues({
          spreadsheetId: SPREADSHEET_ID,
          range: "'ResolveSync Incidents'!G" + existingRowIndex,
          valueInputOption: 'USER_ENTERED', values: [[newSeverity]],
        });
      }
    }

    let escalationDiscordResult = null;
    if (isEscalation) {
      const existingCid = existingSheetRow?.[COL.complaint_id] || existingRecord?.complaint_id || complaint_id;
      const existingOid = existingSheetRow?.[COL.order_id] || existingRecord?.order_id || order_id;
      escalationDiscordResult = await notifyDiscord(
        'SEVERITY ESCALATED\nComplaint ID: ' + existingCid + '\nOrder: ' + existingOid +
        '\nCategory: ' + triage.category + '\nSeverity: ' + existingSeverity + ' -> ' + newSeverity +
        '\nNew duplicate: ' + complaint_id, false, null);
    }

    return {
      status: 'duplicate', is_duplicate: true, action: 'update',
      complaint_id, customer_name, email, order_id, complaint_text,
      category: triage.category, severity: triage.severity, summary: triage.summary,
      duplicate_count: updatedDupCount, last_reported_at: lastReportedAt,
      severity_escalated: isEscalation, escalation_discord_result: escalationDiscordResult,
      existing_complaint_id: existingSheetRow?.[COL.complaint_id] || existingRecord?.complaint_id,
      clickup_task: null, github_issue: null, sheets_result: null, discord_result: null,
    };
  }

  // NEW COMPLAINT: all destinations independent, failure-isolated
  let clickupResult = null, clickupError = null, clickupTaskId = null, clickupTaskUrl = null;
  const clickupTitle = '[' + triage.severity + '] ' + triage.category + ' - ' + triage.summary;
  const cuAttempt = await createClickUpTaskSafe({
    name: clickupTitle,
    description: [
      'Complaint ID: ' + complaint_id, 'Customer: ' + customer_name,
      'Email: ' + email, 'Order ID: ' + order_id,
      'Original Complaint: ' + complaint_text,
      'Category: ' + triage.category, 'Severity: ' + triage.severity,
      'Summary: ' + triage.summary, 'Current Status: OPEN',
    ].join('\n'),
  }, Boolean(input?.force_clickup_failure));

  if (cuAttempt.success) {
    clickupResult = cuAttempt.task; clickupTaskId = cuAttempt.id; clickupTaskUrl = cuAttempt.url;
  } else { clickupError = cuAttempt.error; }

  let githubResult = null, githubError = null;
  try {
    if (input?.force_github_failure) throw new Error('Forced GitHub failure for testing');
    const ghOwner = input?.github_owner || 'syed-haseeb-badshah';
    const ghRepo = input?.github_repo || 'AIHackathon';
    const issueTitle = '[' + triage.severity + '] ' + triage.category + ' - ' + triage.summary;
    const bodyParts = [
      '**Complaint ID:** ' + complaint_id, '**Customer:** ' + customer_name,
      '**Email:** ' + email, '**Order ID:** ' + order_id,
      '**Original Complaint:** ' + complaint_text,
      '**Category:** ' + triage.category, '**Severity:** ' + triage.severity, '**Status:** OPEN',
    ];
    if (clickupTaskUrl) bodyParts.push('**ClickUp Task:** ' + clickupTaskUrl);
    const ghRes = await fastn.connector.github.createIssue({
      owner: ghOwner, repo: ghRepo, title: issueTitle, body: bodyParts.join('\n'),
    });
    githubResult = ghRes?.output || ghRes;
  } catch (ghErr) { githubError = ghErr.message || String(ghErr); }

  const ghIssueNumber = githubResult?.number || null;
  const ghIssueUrl = githubResult?.html_url || null;
  const ghIssueId = githubResult?.id || null;

  let discordResult = null;
  const isUrgent = triage.severity === 'HIGH' || triage.severity === 'CRITICAL';
  const header = isUrgent ? '🚨 URGENT CUSTOMER COMPLAINT' : '📩 NEW CUSTOMER COMPLAINT';
  discordResult = await notifyDiscord(
    header + '\nComplaint ID: ' + complaint_id + '\nCustomer: ' + customer_name +
    '\nOrder: ' + order_id + '\nCategory: ' + triage.category +
    '\nSeverity: ' + triage.severity + '\nSummary: ' + triage.summary,
    Boolean(input?.force_discord_failure), input?.discord_webhook_url);

  const lastUpdatedAt = new Date().toISOString();
  const rowValues = [
    complaint_id, customer_name, email, order_id, complaint_text,
    triage.category, triage.severity, triage.summary,
    'OPEN', false, '',
    lastUpdatedAt, 'ResolveSync',
    discordResult?.notification_status || 'SENT',
    discordResult?.notification_error || '',
    ghIssueNumber || '', clickupTaskId || '', clickupTaskUrl || '',
    0, lastUpdatedAt, ghIssueUrl || '',
  ];

  let sheetsResult = null, sheetsError = null;
  try {
    if (input?.force_sheets_failure) throw new Error('Forced Google Sheets failure for testing');
    sheetsResult = await fastn.connector.googleSheets.appendValues({
      spreadsheetId: SPREADSHEET_ID,
      range: "'ResolveSync Incidents'!A:U",
      valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
      values: [rowValues],
    });
  } catch (shErr) { sheetsError = shErr.message || String(shErr); }

  const incidentRecord = {
    complaint_id, customer_name, email, order_id, complaint_text,
    category: triage.category, severity: triage.severity, summary: triage.summary,
    status: 'OPEN', is_duplicate: false, duplicate_count: 0,
    last_reported_at: lastUpdatedAt, firstSeenAt: lastUpdatedAt,
    last_updated_at: lastUpdatedAt, last_updated_by: 'ResolveSync',
    github_issue_number: ghIssueNumber, github_issue_id: ghIssueId, github_issue_url: ghIssueUrl,
    clickup_task_id: clickupTaskId, clickup_task_url: clickupTaskUrl, clickup_task: clickupResult,
  };

  await fastn.state.set(stateKey, incidentRecord);
  if (clickupTaskId) await fastn.state.set('clickup_task:' + clickupTaskId, incidentRecord);

  return {
    status: 'new', is_duplicate: false, action: 'create',
    complaint_id, customer_name, email, order_id, complaint_text,
    category: triage.category, severity: triage.severity, summary: triage.summary,
    clickup_task: clickupResult, clickup_task_id: clickupTaskId, clickup_task_url: clickupTaskUrl,
    clickup_error: clickupError,
    sheets_result: sheetsResult?.output || sheetsResult, sheets_error: sheetsError,
    notification_status: discordResult ? discordResult.notification_status : null,
    notification_error: discordResult ? discordResult.notification_error : null,
    discord_result: discordResult,
    github_issue: githubResult, github_issue_number: ghIssueNumber, github_issue_url: ghIssueUrl,
    github_error: githubError, notion_result: null,
  };
}
