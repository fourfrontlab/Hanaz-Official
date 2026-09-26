export default async function (ctx) {
  const { input } = ctx;
  const {
    complaint_id,
    customer_name,
    email,
    order_id,
    complaint_text,
    status: inputStatus,
    resolution_note,
    task_id,
    taskId,
    clickup_task_id,
    history_items,
    event,
    webhook_id,
    source,
    last_updated_by: inputLastUpdatedBy,
  } = input || {};

  // Locked Spreadsheet & Sheet Tab Configuration
  const SPREADSHEET_ID = "1y0-ZimyPt0G-h4z05eYmVCycnPe5A_38vHL3uAOwZvc";
  const SHEET_NAME = "ResolveSync Incidents";
  const CLICKUP_LIST_ID = "1100360000060397"; // IT Command Center list

  const isEmpty = (val) =>
    val === undefined ||
    val === null ||
    (typeof val === "string" && val.trim() === "");

  // Status Normalizer & ClickUp Mapper
  function normalizeStatus(rawStatus) {
    if (!rawStatus) return "OPEN";
    const s = String(rawStatus).trim().toLowerCase();
    if (s === "open" || s === "to do" || s === "todo") {
      return "OPEN";
    }
    if (s === "in progress" || s === "in_progress" || s === "inprogress") {
      return "IN_PROGRESS";
    }
    if (
      s === "complete" ||
      s === "completed" ||
      s === "closed" ||
      s === "resolved" ||
      s === "done"
    ) {
      return "RESOLVED";
    }
    return String(rawStatus).trim().toUpperCase();
  }

  // ClickUp status mapper (ResolveSync status -> ClickUp status string)
  function toClickUpStatus(rsStatus) {
    const s = String(rsStatus).trim().toUpperCase();
    if (s === "IN_PROGRESS") return "in progress";
    if (s === "RESOLVED") return "completed";
    return "to do";
  }

  // Severity rank for escalation: LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4
  function severityRank(s) {
    const ranks = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    return ranks[String(s || "LOW").trim().toUpperCase()] || 0;
  }

  // Discord Notifier with 1 retry (maxAttempts = 2)
  async function notifyDiscord(content, forceFail, customUrl) {
    let discordWebhookUrl = customUrl || null;
    if (!discordWebhookUrl) {
      if (forceFail) {
        discordWebhookUrl = "https://discord.com/api/webhooks/00000000/invalid_force_fail";
      } else {
        try {
          discordWebhookUrl = await fastn.secrets.get("DISCORD_WEBHOOK_URL");
        } catch (secErr) {
          console.warn("Could not read DISCORD_WEBHOOK_URL secret:", secErr);
        }
        if (!discordWebhookUrl) {
          discordWebhookUrl = "https://discord.com/api/webhooks/1550744812716691457/XcSSVvF-B7byzxHoRcQGMrC25TbJVjxi3aqLvX1B_-wqm_Jtj1NgqTBV1NUw_LcRmeVm";
        }
      }
    }

    let attempts = 0;
    const maxAttempts = 2; // 1 initial attempt + 1 retry
    let lastError = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch(discordWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        });

        if (!res.ok) {
          let errText = "";
          try { errText = await res.text(); } catch (e) {}
          throw new Error(`Discord returned HTTP ${res.status}: ${errText || res.statusText}`);
        }

        return {
          notification_status: "SENT",
          notification_error: null,
          attempts,
        };
      } catch (err) {
        lastError = err.message || String(err);
        console.warn(`Discord attempt ${attempts} failed:`, lastError);
      }
    }

    return {
      notification_status: "FAILED",
      notification_error: lastError,
      attempts,
    };
  }

  // Helper: Read Google Sheets
  async function readAllSheetRows() {
    try {
      const readRes = await fastn.connector.googleSheets.getValues({
        spreadsheetId: SPREADSHEET_ID,
        range: "'ResolveSync Incidents'!A:U",
      });
      return readRes?.output?.values || readRes?.values || [];
    } catch (err) {
      console.warn("Failed to read Google Sheet:", err);
      return [];
    }
  }

  // Helper: Create ClickUp Task with Failure Isolation
  async function createClickUpTaskSafe(taskData, forceFail) {
    if (forceFail) {
      return { success: false, error: "Forced ClickUp failure for testing" };
    }
    try {
      const cuRes = await fastn.connector.clickup.createTask({
        listId: CLICKUP_LIST_ID,
        name: taskData.name,
        description: taskData.description,
        status: "to do",
      });
      const data = cuRes?.output || cuRes?.response || cuRes;
      const taskId = data?.id || data?.taskId || null;
      const taskUrl = data?.url || (taskId ? `https://app.clickup.com/t/${taskId}` : null);
      return { success: true, task: data, id: taskId, url: taskUrl };
    } catch (err) {
      console.warn("ClickUp createTask failed:", err);
      return { success: false, error: err.message || String(err) };
    }
  }

  // Helper: Update ClickUp Task Status with Failure Isolation
  async function updateClickUpTaskStatusSafe(taskId, statusName) {
    if (!taskId) return null;
    try {
      const cuRes = await fastn.connector.clickup.updateTask({
        taskId,
        status: statusName,
      });
      return cuRes?.output || cuRes?.response || cuRes;
    } catch (err) {
      console.warn(`ClickUp updateTask for ${taskId} failed:`, err);
      return null;
    }
  }

  // -------------------------------------------------------------
  // FLOW 1: ClickUp Status Change Event / Webhook Trigger
  // -------------------------------------------------------------
  const incomingClickUpTaskId =
    clickup_task_id ||
    task_id ||
    taskId ||
    (history_items && history_items[0]?.task_id) ||
    null;

  const isClickUpStatusEvent =
    event === "taskStatusUpdated" ||
    Boolean(webhook_id) ||
    (Boolean(incomingClickUpTaskId) && isEmpty(complaint_text) && (inputStatus !== undefined || input?.status !== undefined || Boolean(history_items)));

  if (isClickUpStatusEvent) {
    let rawStatus = null;
    if (history_items && history_items.length > 0) {
      const statusItem = history_items.find((h) => h.field === "status") || history_items[0];
      rawStatus = statusItem?.after?.status || statusItem?.after;
    }
    if (!rawStatus) {
      rawStatus = inputStatus !== undefined ? inputStatus : input?.status;
    }

    const targetStatus = normalizeStatus(rawStatus);
    const targetClickUpId = incomingClickUpTaskId;

    // Locate complaint: First by clickup_task_id, fallback to complaint_id
    let complaintRecord = null;
    let foundComplaintId = complaint_id || null;

    if (targetClickUpId) {
      complaintRecord = await fastn.state.get(`clickup_task:${targetClickUpId}`);
      if (complaintRecord?.complaint_id) {
        foundComplaintId = complaintRecord.complaint_id;
      }
    }

    if (!complaintRecord && foundComplaintId) {
      complaintRecord = await fastn.state.get(`complaint:${foundComplaintId}`);
    }

    // Lookup in Google Sheets to find row index & data
    const rows = await readAllSheetRows();
    let foundRowIndex = -1;
    let existingRow = null;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      // Col Q (index 16) is clickup_task_id, Col A (index 0) is complaint_id
      if (targetClickUpId && r[16] === targetClickUpId) {
        foundRowIndex = i + 1;
        existingRow = r;
        if (!foundComplaintId) foundComplaintId = r[0];
        break;
      }
      if (foundComplaintId && r[0] === foundComplaintId) {
        foundRowIndex = i + 1;
        existingRow = r;
        break;
      }
    }

    if (!existingRow && !complaintRecord) {
      return {
        error: "Complaint not found for ClickUp task",
        clickup_task_id: targetClickUpId,
      };
    }

    const complaintIdFinal = foundComplaintId || existingRow?.[0] || complaintRecord?.complaint_id;
    const orderIdFinal = existingRow?.[3] || complaintRecord?.order_id || "";
    const currentStatus = (existingRow?.[8] || complaintRecord?.status || "OPEN").trim().toUpperCase();

    // CONFLICT RULE:
    // If a complaint is already RESOLVED, do not automatically allow another source to move it back to OPEN.
    if (currentStatus === "RESOLVED" && targetStatus === "OPEN") {
      return "Conflict detected: resolved complaint cannot be reopened automatically";
    }

    const lastUpdatedAt = new Date().toISOString();
    const lastUpdatedBy = "ClickUp";
    const noteVal = resolution_note !== undefined && resolution_note !== null
      ? String(resolution_note)
      : (existingRow?.[10] || complaintRecord?.resolution_note || "");

    // 1. Google Sheets Update:
    // Update existing row only, never create new row
    if (foundRowIndex > 0) {
      const isDupVal = existingRow[9] !== undefined ? existingRow[9] : false;
      await fastn.connector.googleSheets.updateValues({
        spreadsheetId: SPREADSHEET_ID,
        range: `'ResolveSync Incidents'!I${foundRowIndex}:M${foundRowIndex}`,
        valueInputOption: "USER_ENTERED",
        values: [[targetStatus, isDupVal, noteVal, lastUpdatedAt, lastUpdatedBy]],
      });
    }

    // 2. Discord Notification based on ClickUp status
    let discordResult = null;
    if (targetStatus === "IN_PROGRESS") {
      const content = `🔄 COMPLAINT IN PROGRESS\nComplaint ID: ${complaintIdFinal}\nOrder: ${orderIdFinal}\nStatus: IN PROGRESS`;
      discordResult = await notifyDiscord(content, Boolean(input?.force_discord_failure), input?.discord_webhook_url);
    } else if (targetStatus === "RESOLVED") {
      const resText = noteVal ? `\nResolution: ${noteVal}` : "";
      const content = `✅ COMPLAINT RESOLVED\nComplaint ID: ${complaintIdFinal}\nOrder: ${orderIdFinal}${resText}`;
      discordResult = await notifyDiscord(content, Boolean(input?.force_discord_failure), input?.discord_webhook_url);
    }

    // 3. GitHub Issue Sync:
    // When ClickUp becomes RESOLVED/CLOSED, close the SAME GitHub issue. Never create a second GitHub issue.
    let githubUpdateResult = null;
    let githubUpdateError = null;
    if (targetStatus === "RESOLVED") {
      const issueNum = complaintRecord?.github_issue_number || existingRow?.[15] || input?.github_issue_number;
      if (issueNum) {
        try {
          if (input?.force_github_failure) {
            throw new Error("Forced GitHub failure for testing");
          }
          const ghOwner = input?.github_owner || "syed-haseeb-badshah";
          const ghRepo = input?.github_repo || "AIHackathon";
          const ghRes = await fastn.connector.github.updateIssue({
            owner: ghOwner,
            repo: ghRepo,
            issue_number: Number(issueNum),
            state: "closed",
            state_reason: "completed",
          });
          githubUpdateResult = ghRes?.output || ghRes;
        } catch (ghErr) {
          githubUpdateError = ghErr.message || String(ghErr);
          console.warn("GitHub issue close failed:", githubUpdateError);
        }
      }
    }

    // 4. Notion Entry Sync:
    // Only when status becomes RESOLVED; create/update resolved incident entry, avoid duplicates.
    let notionResult = null;
    let notionError = null;
    if (targetStatus === "RESOLVED" && !complaintRecord?.notion_page_id) {
      try {
        if (input?.force_notion_failure) {
          throw new Error("Forced Notion failure for testing");
        }
        const catVal = complaintRecord?.category || existingRow?.[5] || "Other";
        const sevVal = (complaintRecord?.severity || existingRow?.[6] || "LOW").trim().toUpperCase();
        const sumVal = complaintRecord?.summary || existingRow?.[7] || "";
        const validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
        const finalSev = validSeverities.includes(sevVal) ? sevVal : "LOW";

        const notionProperties = {
          Name: {
            title: [{ text: { content: complaintIdFinal } }],
          },
          category: {
            rich_text: [{ text: { content: String(catVal) } }],
          },
          severity: {
            select: { name: finalSev },
          },
          summary: {
            rich_text: [{ text: { content: String(sumVal) } }],
          },
          status: {
            select: { name: "RESOLVED" },
          },
          resolution_note: {
            rich_text: [{ text: { content: String(noteVal || "Resolved via ClickUp") } }],
          },
          resolved_at: {
            date: { start: lastUpdatedAt },
          },
        };

        let notionRes = null;
        try {
          notionRes = await fastn.connector.notion.createPageRaw({
            parent: { data_source_id: "3e0b4ad5-cb6b-81c0-a30b-000b1de6b000" },
            properties: notionProperties,
          });
        } catch (dsErr) {
          notionRes = await fastn.connector.notion.createPageRaw({
            parent: { database_id: "3e0b4ad5-cb6b-819b-89bf-f9deb1ff81be" },
            properties: notionProperties,
          });
        }
        notionResult = notionRes?.output || notionRes;
      } catch (nErr) {
        notionError = nErr.message || String(nErr);
        console.warn("Notion entry creation failed:", notionError);
      }
    }

    // Update state records
    if (complaintRecord) {
      complaintRecord.status = targetStatus;
      complaintRecord.resolution_note = noteVal;
      complaintRecord.last_updated_at = lastUpdatedAt;
      complaintRecord.last_updated_by = lastUpdatedBy;
      if (notionResult?.id) {
        complaintRecord.notion_page_id = notionResult.id;
      }
      await fastn.state.set(`complaint:${complaintIdFinal}`, complaintRecord);
      if (targetClickUpId) {
        await fastn.state.set(`clickup_task:${targetClickUpId}`, complaintRecord);
      }
    }

    return {
      status: targetStatus,
      complaint_id: complaintIdFinal,
      clickup_task_id: targetClickUpId,
      order_id: orderIdFinal,
      resolution_note: noteVal,
      last_updated_at: lastUpdatedAt,
      last_updated_by: lastUpdatedBy,
      sheets_synced: true,
      discord_result: discordResult,
      github_update_result: githubUpdateResult,
      github_update_error: githubUpdateError,
      notion_result: notionResult,
      notion_error: notionError,
    };
  }

  // -------------------------------------------------------------
  // FLOW 2: Manual / API Resolution or Status Update
  // -------------------------------------------------------------
  const isUpdateRequest =
    inputStatus !== undefined ||
    (resolution_note !== undefined && isEmpty(complaint_text));

  if (isUpdateRequest) {
    if (isEmpty(complaint_id)) {
      return "Complaint not found";
    }

    const rows = await readAllSheetRows();
    let foundRowIndex = -1;
    let existingRow = null;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === complaint_id) {
        foundRowIndex = i + 1;
        existingRow = rows[i];
        break;
      }
    }

    const stateKey = `complaint:${complaint_id}`;
    const stateRecord = await fastn.state.get(stateKey);

    if (foundRowIndex === -1 && !stateRecord) {
      return "Complaint not found";
    }

    const currentStatus = (existingRow?.[8] || stateRecord?.status || "OPEN").trim().toUpperCase();
    const targetStatus = inputStatus !== undefined ? normalizeStatus(inputStatus) : currentStatus;

    // CONFLICT RULE:
    // If a complaint is already RESOLVED, do not automatically allow another source to move it back to OPEN.
    if (currentStatus === "RESOLVED" && targetStatus === "OPEN") {
      return "Conflict detected: resolved complaint cannot be reopened automatically";
    }

    const finalStatus = targetStatus;
    const isDupVal = existingRow?.[9] !== undefined ? existingRow[9] : false;
    const noteVal = resolution_note !== undefined && resolution_note !== null
      ? String(resolution_note)
      : (existingRow?.[10] || stateRecord?.resolution_note || "");
    const lastUpdatedAt = new Date().toISOString();
    const lastUpdatedBy = inputLastUpdatedBy || "ResolveSync";

    // Update ClickUp task status to stay in sync
    const linkedClickUpId = stateRecord?.clickup_task_id || existingRow?.[16] || null;
    if (linkedClickUpId) {
      await updateClickUpTaskStatusSafe(linkedClickUpId, toClickUpStatus(finalStatus));
    }

    // Update Google Sheet row
    if (foundRowIndex > 0) {
      await fastn.connector.googleSheets.updateValues({
        spreadsheetId: SPREADSHEET_ID,
        range: `'ResolveSync Incidents'!I${foundRowIndex}:M${foundRowIndex}`,
        valueInputOption: "USER_ENTERED",
        values: [[finalStatus, isDupVal, noteVal, lastUpdatedAt, lastUpdatedBy]],
      });
    }

    if (stateRecord) {
      stateRecord.status = finalStatus;
      stateRecord.resolution_note = noteVal;
      stateRecord.last_updated_at = lastUpdatedAt;
      stateRecord.last_updated_by = lastUpdatedBy;
      await fastn.state.set(stateKey, stateRecord);
      if (linkedClickUpId) {
        await fastn.state.set(`clickup_task:${linkedClickUpId}`, stateRecord);
      }
    }

    let discordResult = null;
    let githubUpdateResult = null;
    let githubUpdateError = null;
    let notionResult = null;
    let notionError = null;

    if (finalStatus === "RESOLVED") {
      const resText = noteVal ? `\nResolution: ${noteVal}` : "";
      const content = `✅ COMPLAINT RESOLVED\nComplaint ID: ${complaint_id}\nOrder: ${existingRow?.[3] || stateRecord?.order_id || ""}${resText}`;
      discordResult = await notifyDiscord(content, Boolean(input?.force_discord_failure), input?.discord_webhook_url);

      const issueNum = stateRecord?.github_issue_number || stateRecord?.github_issue?.number || existingRow?.[15] || input?.github_issue_number;
      if (issueNum) {
        try {
          if (input?.force_github_failure) {
            throw new Error("Forced GitHub failure for testing");
          }
          const ghOwner = input?.github_owner || "syed-haseeb-badshah";
          const ghRepo = input?.github_repo || "AIHackathon";
          const ghRes = await fastn.connector.github.updateIssue({
            owner: ghOwner,
            repo: ghRepo,
            issue_number: Number(issueNum),
            state: "closed",
            state_reason: "completed",
          });
          githubUpdateResult = ghRes?.output || ghRes;
        } catch (ghErr) {
          githubUpdateError = ghErr.message || String(ghErr);
          console.warn("GitHub issue close failed:", githubUpdateError);
        }
      }

      if (!stateRecord?.notion_page_id) {
        try {
          if (input?.force_notion_failure) {
            throw new Error("Forced Notion failure for testing");
          }
          const catVal = stateRecord?.category || existingRow?.[5] || "Other";
          const sevVal = (stateRecord?.severity || existingRow?.[6] || "LOW").trim().toUpperCase();
          const sumVal = stateRecord?.summary || existingRow?.[7] || "";
          const validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
          const finalSev = validSeverities.includes(sevVal) ? sevVal : "LOW";

          const notionProperties = {
            Name: {
              title: [{ text: { content: complaint_id } }],
            },
            category: {
              rich_text: [{ text: { content: String(catVal) } }],
            },
            severity: {
              select: { name: finalSev },
            },
            summary: {
              rich_text: [{ text: { content: String(sumVal) } }],
            },
            status: {
              select: { name: "RESOLVED" },
            },
            resolution_note: {
              rich_text: [{ text: { content: String(noteVal) } }],
            },
            resolved_at: {
              date: { start: lastUpdatedAt },
            },
          };

          let notionRes = null;
          try {
            notionRes = await fastn.connector.notion.createPageRaw({
              parent: { data_source_id: "3e0b4ad5-cb6b-81c0-a30b-000b1de6b000" },
              properties: notionProperties,
            });
          } catch (dsErr) {
            notionRes = await fastn.connector.notion.createPageRaw({
              parent: { database_id: "3e0b4ad5-cb6b-819b-89bf-f9deb1ff81be" },
              properties: notionProperties,
            });
          }
          notionResult = notionRes?.output || notionRes;
          if (stateRecord) {
            stateRecord.notion_page_id = notionResult?.id || true;
            stateRecord.notion_page_url = notionResult?.url || null;
            await fastn.state.set(stateKey, stateRecord);
          }
        } catch (nErr) {
          notionError = nErr.message || String(nErr);
          console.warn("Notion entry creation failed:", notionError);
        }
      }
    } else if (finalStatus === "IN_PROGRESS") {
      const content = `🔄 COMPLAINT IN PROGRESS\nComplaint ID: ${complaint_id}\nOrder: ${existingRow?.[3] || stateRecord?.order_id || ""}\nStatus: IN PROGRESS`;
      discordResult = await notifyDiscord(content, Boolean(input?.force_discord_failure), input?.discord_webhook_url);
    }

    return {
      status: finalStatus,
      complaint_id,
      resolution_note: noteVal,
      last_updated_at: lastUpdatedAt,
      last_updated_by: lastUpdatedBy,
      notification_status: discordResult ? discordResult.notification_status : null,
      notification_error: discordResult ? discordResult.notification_error : null,
      updated_row: foundRowIndex,
      discord_result: discordResult,
      github_update_result: githubUpdateResult,
      github_update_error: githubUpdateError,
      notion_result: notionResult,
      notion_error: notionError,
      clickup_task_id: linkedClickUpId,
    };
  }

  // -------------------------------------------------------------
  // FLOW 3: New Complaint Intake & Triage
  // -------------------------------------------------------------
  // 1. Validation Step
  if (
    isEmpty(complaint_id) ||
    isEmpty(customer_name) ||
    isEmpty(email) ||
    isEmpty(order_id) ||
    isEmpty(complaint_text)
  ) {
    return "Invalid complaint data";
  }

  // 2. AI Triage Step
  function triageComplaint(text) {
    const lower = (text || "").toLowerCase();

    // Categories: Payment, Login/Auth, Delivery, Product Bug, Account, Refund, Other
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

    // Severity: LOW, MEDIUM, HIGH, CRITICAL
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

    // Keep summary strictly under 20 words
    const clean = (text || "").replace(/[\r\n\t]+/g, " ").trim();
    const words = clean.split(/\s+/);
    let summary = words.length <= 18 ? clean : words.slice(0, 18).join(" ") + "...";
    if (summary.split(/\s+/).length >= 20) {
      summary = summary.split(/\s+/).slice(0, 19).join(" ");
    }

    return {
      category,
      severity,
      summary,
    };
  }

  const triage = triageComplaint(complaint_text);

  // 3. Duplicate Detection Step
  // Check A: complaint_id already exists
  // Check B: same order_id + same category + OPEN or IN_PROGRESS
  const stateKey = `complaint:${complaint_id}`;
  let existingRecord = await fastn.state.get(stateKey);

  const rows = await readAllSheetRows();
  let existingRowIndex = -1;
  let existingSheetRow = null;

  // Check A
  for (let i = 1; i < rows.length; i++) {
    if (rows[i] && rows[i][0] === complaint_id) {
      existingRowIndex = i + 1;
      existingSheetRow = rows[i];
      break;
    }
  }

  // Check B: same order_id + same category + status OPEN or IN_PROGRESS
  if (!existingSheetRow && !existingRecord) {
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const rowOrderId = r[3];
      const rowCategory = r[5];
      const rowStatus = (r[8] || "OPEN").trim().toUpperCase();
      if (rowOrderId === order_id && rowCategory === triage.category &&
          (rowStatus === "OPEN" || rowStatus === "IN_PROGRESS")) {
        existingRowIndex = i + 1;
        existingSheetRow = r;
        const altCid = r[0];
        if (altCid) {
          const altRecord = await fastn.state.get(`complaint:${altCid}`);
          if (altRecord) existingRecord = altRecord;
        }
        break;
      }
    }
  }

  const isDuplicate = Boolean(existingRecord || existingSheetRow);
  const status = isDuplicate ? "duplicate" : "new";
  const action = isDuplicate ? "update" : "create";

  if (isDuplicate) {
    const lastReportedAt = new Date().toISOString();
    const existingSeverity = existingSheetRow?.[6] || existingRecord?.severity || "LOW";
    const newSeverity = triage.severity;
    const isEscalation = severityRank(newSeverity) > severityRank(existingSeverity);

    const currentDupCount = Number(
      existingRecord?.duplicate_count != null
        ? existingRecord.duplicate_count
        : (existingSheetRow?.[18] ?? 0)
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
        range: `'ResolveSync Incidents'!J${existingRowIndex}:T${existingRowIndex}`,
        valueInputOption: "USER_ENTERED",
        values: [[
          true,
          existingSheetRow?.[10] || "",
          lastReportedAt,
          "ResolveSync",
          existingSheetRow?.[13] || "SENT",
          existingSheetRow?.[14] || "",
          existingSheetRow?.[15] || "",
          existingSheetRow?.[16] || "",
          existingSheetRow?.[17] || "",
          updatedDupCount,
          lastReportedAt,
        ]],
      });
      if (isEscalation) {
        await fastn.connector.googleSheets.updateValues({
          spreadsheetId: SPREADSHEET_ID,
          range: `'ResolveSync Incidents'!G${existingRowIndex}`,
          valueInputOption: "USER_ENTERED",
          values: [[newSeverity]],
        });
      }
    }

    let escalationDiscordResult = null;
    if (isEscalation) {
      const existingCid = existingSheetRow?.[0] || existingRecord?.complaint_id || complaint_id;
      const existingOid = existingSheetRow?.[3] || existingRecord?.order_id || order_id;
      escalationDiscordResult = await notifyDiscord(
        "SEVERITY ESCALATED\nComplaint ID: " + existingCid + "\nOrder: " + existingOid +
        "\nCategory: " + triage.category + "\nSeverity: " + existingSeverity + " -> " + newSeverity +
        "\nNew duplicate complaint: " + complaint_id,
        false, null
      );
    }

    return {
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
      duplicate_count: updatedDupCount,
      last_reported_at: lastReportedAt,
      severity_escalated: isEscalation,
      escalation_discord_result: escalationDiscordResult,
      existing_complaint_id: existingSheetRow?.[0] || existingRecord?.complaint_id,
      clickup_task: null,
      github_issue: null,
      sheets_result: null,
      discord_result: null,
    };
  }

  // -------------------------------------------------------------
  // NEW COMPLAINT FLOW
  // -------------------------------------------------------------
  let clickupResult = null;
  let clickupError = null;
  let clickupTaskId = null;
  let clickupTaskUrl = null;

  // FOR NEW COMPLAINTS: Create exactly ONE ClickUp task
  // Task title: [severity] category - summary
  // Task description must include:
  // complaint_id, customer_name, email, order_id, complaint_text, category, severity, summary, status
  // Initial ClickUp status: OPEN or equivalent (to do)
  const clickupTitle = `[${triage.severity}] ${triage.category} - ${triage.summary}`;
  const clickupDescription = [
    `complaint_id: ${complaint_id}`,
    `customer_name: ${customer_name}`,
    `email: ${email}`,
    `order_id: ${order_id}`,
    `complaint_text: ${complaint_text}`,
    `category: ${triage.category}`,
    `severity: ${triage.severity}`,
    `summary: ${triage.summary}`,
    `status: OPEN`,
  ].join("\n");

  const cuAttempt = await createClickUpTaskSafe(
    {
      name: clickupTitle,
      description: clickupDescription,
    },
    Boolean(input?.force_clickup_failure)
  );

  if (cuAttempt.success) {
    clickupResult = cuAttempt.task;
    clickupTaskId = cuAttempt.id;
    clickupTaskUrl = cuAttempt.url;
  } else {
    clickupError = cuAttempt.error;
  }

  // GitHub Issue Creation (failure isolated)
  let githubResult = null;
  let githubError = null;
  try {
    if (input?.force_github_failure) {
      throw new Error("Forced GitHub failure for testing");
    }
    const ghOwner = input?.github_owner || "syed-haseeb-badshah";
    const ghRepo = input?.github_repo || "AIHackathon";
    const issueTitle = `[${triage.severity}] ${triage.category} - ${triage.summary}`;
    const issueBody = `Complaint ID: ${complaint_id}\nCustomer Name: ${customer_name}\nEmail: ${email}\nOrder ID: ${order_id}\nComplaint Text: ${complaint_text}\nCategory: ${triage.category}\nSeverity: ${triage.severity}\nStatus: OPEN`;

    const ghRes = await fastn.connector.github.createIssue({
      owner: ghOwner,
      repo: ghRepo,
      title: issueTitle,
      body: issueBody,
    });
    githubResult = ghRes?.output || ghRes;
  } catch (ghErr) {
    githubError = ghErr.message || String(ghErr);
    console.warn("GitHub issue creation failed:", githubError);
  }

  const ghIssueNumber = githubResult?.number || null;
  const ghIssueUrl = githubResult?.html_url || null;
  const ghIssueId = githubResult?.id || null;

  // Discord Notification (only for new complaints)
  let discordResult = null;
  const isUrgent = triage.severity === "HIGH" || triage.severity === "CRITICAL";
  const header = isUrgent
    ? "🚨 URGENT CUSTOMER COMPLAINT"
    : "📩 NEW CUSTOMER COMPLAINT";

  const content = `${header}\nComplaint ID: ${complaint_id}\nCustomer: ${customer_name}\nOrder: ${order_id}\nCategory: ${triage.category}\nSeverity: ${triage.severity}\nSummary: ${triage.summary}`;

  discordResult = await notifyDiscord(
    content,
    Boolean(input?.force_discord_failure),
    input?.discord_webhook_url
  );

  // Google Sheets Incident Creation: Save ClickUp task ID and task URL
  const lastUpdatedAt = new Date().toISOString();
  const rowValues = [
    complaint_id,                            // A (0)
    customer_name,                           // B (1)
    email,                                   // C (2)
    order_id,                                // D (3)
    complaint_text,                          // E (4)
    triage.category,                         // F (5)
    triage.severity,                         // G (6)
    triage.summary,                          // H (7)
    "OPEN",                                  // I (8)
    false,                                   // J (9) is_duplicate
    "",                                      // K (10) resolution_note
    lastUpdatedAt,                           // L (11) last_updated_at
    "ResolveSync",                           // M (12) last_updated_by
    discordResult?.notification_status || "SENT", // N (13)
    discordResult?.notification_error || "",      // O (14)
    ghIssueNumber || "",                     // P (15) github_issue
    clickupTaskId || "",                     // Q (16) clickup_task_id
    clickupTaskUrl || "",                    // R (17) clickup_task_url
    0,                                       // S (18) duplicate_count (0 for new)
    lastUpdatedAt,                           // T (19) last_reported_at
    ghIssueUrl || "",                        // U (20) github_issue_url
  ];

  let sheetsResult = null;
  let sheetsError = null;
  try {
    if (input?.force_sheets_failure) {
      throw new Error("Forced Google Sheets failure for testing");
    }
    sheetsResult = await fastn.connector.googleSheets.appendValues({
      spreadsheetId: SPREADSHEET_ID,
      range: "'ResolveSync Incidents'!A:U",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      values: [rowValues],
    });
  } catch (shErr) {
    sheetsError = shErr.message || String(shErr);
    console.warn("Google Sheets append failed:", sheetsError);
  }

  // Persist State
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
    is_duplicate: false,
    duplicate_count: 0,
    last_reported_at: lastUpdatedAt,
    firstSeenAt: lastUpdatedAt,
    last_updated_at: lastUpdatedAt,
    last_updated_by: "ResolveSync",
    github_issue_number: ghIssueNumber,
    github_issue_id: ghIssueId,
    github_issue_url: ghIssueUrl,
    clickup_task_id: clickupTaskId,
    clickup_task_url: clickupTaskUrl,
    clickup_task: clickupResult,
  };

  await fastn.state.set(stateKey, incidentRecord);
  if (clickupTaskId) {
    await fastn.state.set(`clickup_task:${clickupTaskId}`, incidentRecord);
  }

  return {
    status,
    is_duplicate: false,
    action,
    complaint_id,
    customer_name,
    email,
    order_id,
    complaint_text,
    category: triage.category,
    severity: triage.severity,
    summary: triage.summary,
    clickup_task: clickupResult,
    clickup_task_id: clickupTaskId,
    clickup_task_url: clickupTaskUrl,
    clickup_error: clickupError,
    sheets_result: sheetsResult?.output || sheetsResult,
    sheets_error: sheetsError,
    notification_status: discordResult ? discordResult.notification_status : null,
    notification_error: discordResult ? discordResult.notification_error : null,
    discord_result: discordResult,
    github_issue: githubResult,
    github_issue_number: ghIssueNumber,
    github_issue_url: ghIssueUrl,
    github_error: githubError,
    notion_result: null,
  };
}
