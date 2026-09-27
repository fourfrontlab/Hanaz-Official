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
    cloudId,
  } = input || {};

  // Locked Spreadsheet & Sheet Tab Configuration (Strictly pinned to active populated sheet)
  const SPREADSHEET_ID = "1y0-ZimyPt0G-h4z05eYmVCycnPe5A_38vHL3uAOwZvc";
  const SHEET_NAME = "ResolveSync Incidents";

  const isEmpty = (val) =>
    val === undefined ||
    val === null ||
    (typeof val === "string" && val.trim() === "");

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

  // Resolution / Update Flow with Conflict Handling
  const isUpdateRequest = inputStatus !== undefined || resolution_note !== undefined;
  if (isUpdateRequest) {
    if (isEmpty(complaint_id)) {
      return "Complaint not found";
    }

    const spreadsheetId = SPREADSHEET_ID;
    const readRes = await fastn.connector.googleSheets.getValues({
      spreadsheetId,
      range: "'ResolveSync Incidents'!A:M",
    });
    const rows = readRes?.output?.values || readRes?.values || [];
    let foundRowIndex = -1;
    let existingRow = null;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === complaint_id) {
        foundRowIndex = i + 1;
        existingRow = rows[i];
        break;
      }
    }

    if (foundRowIndex === -1) {
      return "Complaint not found";
    }

    const currentStatus = (existingRow[8] || "OPEN").trim().toUpperCase();
    const targetStatus = inputStatus !== undefined ? String(inputStatus).trim().toUpperCase() : currentStatus;

    // Conflict Rule: If incoming update tries to change from RESOLVED back to OPEN, do NOT overwrite it
    if (currentStatus === "RESOLVED" && targetStatus === "OPEN") {
      return "Conflict detected: resolved complaint cannot be reopened automatically";
    }

    const finalStatus = inputStatus !== undefined ? String(inputStatus).trim() : (existingRow[8] || "OPEN");
    const isDupVal = existingRow[9] !== undefined ? existingRow[9] : false;
    const noteVal = resolution_note !== undefined && resolution_note !== null ? String(resolution_note) : (existingRow[10] || "");
    const lastUpdatedAt = new Date().toISOString();
    const lastUpdatedBy = "ResolveSync";

    await fastn.connector.googleSheets.updateValues({
      spreadsheetId,
      range: `'ResolveSync Incidents'!I${foundRowIndex}:M${foundRowIndex}`,
      valueInputOption: "USER_ENTERED",
      values: [[finalStatus, isDupVal, noteVal, lastUpdatedAt, lastUpdatedBy]],
    });

    const stateKey = `complaint:${complaint_id}`;
    const stateRecord = await fastn.state.get(stateKey);
    if (stateRecord) {
      stateRecord.status = finalStatus;
      stateRecord.resolution_note = noteVal;
      stateRecord.last_updated_at = lastUpdatedAt;
      stateRecord.last_updated_by = lastUpdatedBy;
      await fastn.state.set(stateKey, stateRecord);
    }

    let discordResult = null;
    let githubUpdateResult = null;
    let githubUpdateError = null;
    let notionResult = null;
    let notionError = null;
    if (finalStatus.toUpperCase() === "RESOLVED") {
      const content = `✅ COMPLAINT RESOLVED\nComplaint ID: ${complaint_id}\nStatus: RESOLVED\nResolution: ${noteVal}`;
      discordResult = await notifyDiscord(content, Boolean(input?.force_discord_failure), input?.discord_webhook_url);

      const issueNum = stateRecord?.github_issue_number || stateRecord?.github_issue?.number || input?.github_issue_number;
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

      // Notion Knowledge Base Entry for RESOLVED complaints
      if (!stateRecord?.notion_page_id) {
        try {
          if (input?.force_notion_failure) {
            throw new Error("Forced Notion failure for testing");
          }
          const catVal = stateRecord?.category || existingRow[5] || "Other";
          const sevVal = (stateRecord?.severity || existingRow[6] || "LOW").trim().toUpperCase();
          const sumVal = stateRecord?.summary || existingRow[7] || "";
          const validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
          const finalSev = validSeverities.includes(sevVal) ? sevVal : "LOW";

          const notionProperties = {
            Name: {
              title: [{ text: { content: complaint_id } }]
            },
            category: {
              rich_text: [{ text: { content: String(catVal) } }]
            },
            severity: {
              select: { name: finalSev }
            },
            summary: {
              rich_text: [{ text: { content: String(sumVal) } }]
            },
            status: {
              select: { name: "RESOLVED" }
            },
            resolution_note: {
              rich_text: [{ text: { content: String(noteVal) } }]
            },
            resolved_at: {
              date: { start: lastUpdatedAt }
            }
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
    };
  }

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
    const lower = text.toLowerCase();

    // Allowed categories: Payment, Login/Auth, Delivery, Product Bug, Account, Refund, Other
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

    // Allowed severity: LOW, MEDIUM, HIGH, CRITICAL
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

    // Keep summary under 20 words
    const clean = text.replace(/[\r\n\t]+/g, " ").trim();
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
  const stateKey = `complaint:${complaint_id}`;
  const existingRecord = await fastn.state.get(stateKey);
  const isDuplicate = Boolean(existingRecord);
  const status = isDuplicate ? "duplicate" : "new";
  const action = isDuplicate ? "update" : "create";

  let sheetsResult = null;
  let discordResult = null;
  let githubResult = null;
  let githubError = null;

  // 4. Google Sheets Incident Creation (only for new complaints)
  if (action === "create") {

    const descriptionText = `Complaint ID: ${complaint_id}\nCustomer Name: ${customer_name}\nEmail: ${email}\nOrder ID: ${order_id}\nComplaint Text: ${complaint_text}`;





    const spreadsheetId = SPREADSHEET_ID;
    const rowValues = [
      complaint_id,
      customer_name,
      email,
      order_id,
      complaint_text,
      triage.category,
      triage.severity,
      triage.summary,
      "OPEN",
      false,
    ];

    sheetsResult = await fastn.connector.googleSheets.appendValues({
      spreadsheetId,
      range: "'ResolveSync Incidents'!A:J",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      values: [rowValues],
    });

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

    await fastn.state.set(stateKey, {
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
      firstSeenAt: new Date().toISOString(),
      github_issue_number: ghIssueNumber,
      github_issue_id: ghIssueId,
      github_issue_url: ghIssueUrl,
    });

    // 5. Discord Notification (only for new complaints)
    const isUrgent = triage.severity === "HIGH" || triage.severity === "CRITICAL";
    const header = isUrgent
      ? "🚨 URGENT CUSTOMER COMPLAINT"
      : "📩 NEW CUSTOMER COMPLAINT";

    const content = `${header}\nComplaint ID: ${complaint_id}\nCustomer: ${customer_name}\nOrder: ${order_id}\nCategory: ${triage.category}\nSeverity: ${triage.severity}\nSummary: ${triage.summary}`;

    discordResult = await notifyDiscord(content, Boolean(input?.force_discord_failure), input?.discord_webhook_url);
  }

  return {
    status,
    is_duplicate: isDuplicate,
    action,
    complaint_id,
    customer_name,
    email,
    order_id,
    complaint_text,
    category: triage.category,
    severity: triage.severity,
    summary: triage.summary,
    sheets_result: sheetsResult?.output || sheetsResult,
    notification_status: discordResult ? discordResult.notification_status : null,
    notification_error: discordResult ? discordResult.notification_error : null,
    discord_result: discordResult,
    github_issue: githubResult,
    github_error: githubError,
    notion_result: null,
  };
}