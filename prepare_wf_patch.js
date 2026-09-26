const fs = require('fs');

const currentCode = fs.readFileSync('c:/Users/HP/Downloads/hanaz/current_live_wf.js', 'utf8');

const t1_old = `  const triage = triageComplaint(complaint_text);`;
const t1_new = `  // 2b. Smart Router
  function routeComplaint(category, text, severity, summary) {
    const lower = ((category || "") + " " + (text || "")).toLowerCase();

    const isPhysicalProduct = /\\b(serum|bottle|cream|item|package|parcel|box|arrived|shipped|delivery|delivered|received|product quality|damaged|broken|shattered|leaking|leak|wrong product|missing product|missing item|replacement|replace|reship|reshipment|defective product)\\b/.test(lower);

    const isFinance =
      category === "Refund" ||
      category === "Payment" ||
      /\\b(refund|payment|duplicate payment|charged|deducted|double charged|double charge|overcharged|billing|invoice|transaction|charged but|payment issue|finance complaint)\\b/.test(lower);

    const isEngineering =
      category === "Login/Auth" ||
      /\\b(login|log in|signin|sign in|auth|authentication|password|2fa|mfa|otp|website bug|checkout bug|api|api issue|technical error|server error|500 error|404|crash|freeze|syntax|cannot access|unable to access|access my account)\\b/.test(lower) ||
      (!isPhysicalProduct && (category === "Product Bug" || /\\b(bug|glitch|software error)\\b/.test(lower)));

    if (isPhysicalProduct && !isEngineering) {
      let recAction = "Replace Product";
      let reason = "Product damaged or missing upon arrival.";
      if (/broken|damaged|shattered|leaking/i.test(lower)) {
        recAction = "Replace Product";
        reason = "Product arrived damaged/broken; replacement recommended.";
      } else if (/missing|never arrived/i.test(lower)) {
        recAction = "Reship Product";
        reason = "Item reported missing from delivery; reshipment recommended.";
      } else if (/wrong product/i.test(lower)) {
        recAction = "Reship Product";
        reason = "Incorrect item received; reship correct item.";
      } else {
        recAction = "Contact Customer";
        reason = "Product or delivery issue requires customer coordination.";
      }
      return {
        department: "Product / Support",
        recommended_action: recAction,
        reason,
        target_system: "Admin Portal",
        approval_status: "PENDING",
        approval_location: "Admin Portal",
      };
    }

    if (isFinance && !isEngineering) {
      let recAction = "REFUND";
      let reason = "Customer reported payment dispute or refund request.";
      if (/charged.*not created|order not created|charged but/i.test(lower)) {
        reason = "Payment succeeded but order creation failed.";
        recAction = "REFUND";
      } else if (/duplicate|twice|double charge/i.test(lower)) {
        reason = "Customer charged multiple times for the same transaction.";
        recAction = "REFUND";
      } else {
        recAction = "REFUND / PAYMENT REVIEW";
        reason = "Customer requested refund or reported payment discrepancy.";
      }
      return {
        department: "Finance",
        recommended_action: recAction,
        reason,
        target_system: "Admin Portal",
        approval_status: "PENDING",
        approval_location: "Admin Portal",
      };
    }

    if (isEngineering) {
      let recAction = "Investigate Authentication Issue";
      let reason = "User unable to access account or authentication error.";
      if (!/login|auth|password|access/i.test(lower)) {
        recAction = "Fix Technical Bug";
        reason = "Technical glitch or bug affecting site functionality.";
      }
      return {
        department: "Engineering",
        recommended_action: recAction,
        reason,
        target_system: "ClickUp & GitHub",
        approval_status: "PENDING",
        approval_location: "ClickUp",
      };
    }

    return {
      department: "MANUAL_REVIEW",
      recommended_action: "Manual Review",
      reason: "Smart Router could not determine department with high confidence.",
      target_system: "Admin Portal",
      approval_status: "PENDING",
      approval_location: "Admin Portal",
    };
  }

  const triage = triageComplaint(complaint_text);
  const routing = routeComplaint(triage.category, complaint_text, triage.severity, triage.summary);`;

console.log('t1 match:', currentCode.includes(t1_old));

let patched = currentCode.replace(t1_old, t1_new);

// Target 2: New complaint ClickUp and GitHub conditional creation
const t2_start = `  // -------------------------------------------------------------\n  // NEW COMPLAINT FLOW\n  // -------------------------------------------------------------`;
const t2_end = `  // Google Sheets Incident Creation: Save ClickUp task ID and task URL`;

const idxStart = patched.indexOf(t2_start);
const idxEnd = patched.indexOf(t2_end);

console.log('t2 indices:', idxStart, idxEnd);

if (idxStart !== -1 && idxEnd !== -1) {
  const t2_old = patched.substring(idxStart, idxEnd);
  const t2_new = `  // -------------------------------------------------------------
  // NEW COMPLAINT FLOW (Smart Router Integration)
  // -------------------------------------------------------------
  let clickupResult = null;
  let clickupError = null;
  let clickupTaskId = null;
  let clickupTaskUrl = null;
  let githubResult = null;
  let githubError = null;
  let ghIssueNumber = null;
  let ghIssueUrl = null;
  let ghIssueId = null;

  // ROUTE 1: ENGINEERING -> Existing ClickUp Task + Existing GitHub Issue
  if (routing.department === "Engineering") {
    const clickupTitle = \`[\${triage.severity}] \${triage.category} - \${triage.summary}\`;
    const clickupDescription = [
      \`complaint_id: \${complaint_id}\`,
      \`customer_name: \${customer_name}\`,
      \`email: \${email}\`,
      \`order_id: \${order_id}\`,
      \`complaint_text: \${complaint_text}\`,
      \`category: \${triage.category}\`,
      \`severity: \${triage.severity}\`,
      \`summary: \${triage.summary}\`,
      \`department: \${routing.department}\`,
      \`recommended_action: \${routing.recommended_action}\`,
      \`status: OPEN\`,
      \`approval_status: PENDING\`,
    ].join("\\n");

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

    try {
      if (input?.force_github_failure) {
        throw new Error("Forced GitHub failure for testing");
      }
      const ghOwner = input?.github_owner || "syed-haseeb-badshah";
      const ghRepo = input?.github_repo || "AIHackathon";
      const issueTitle = \`[\${triage.severity}] \${triage.category} - \${triage.summary}\`;
      const issueBody = \`Complaint ID: \${complaint_id}\\nCustomer Name: \${customer_name}\\nEmail: \${email}\\nOrder ID: \${order_id}\\nComplaint Text: \${complaint_text}\\nCategory: \${triage.category}\\nSeverity: \${triage.severity}\\nDepartment: \${routing.department}\\nRecommended Action: \${routing.recommended_action}\\nStatus: OPEN\`;

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

    ghIssueNumber = githubResult?.number || null;
    ghIssueUrl = githubResult?.html_url || null;
    ghIssueId = githubResult?.id || null;
  }
  // ROUTES 2 & 3: PRODUCT/SUPPORT & FINANCE -> No ClickUp task created by default; approval happens in Admin Portal.

  // Discord Notification (for all new complaints with department & recommended action)
  let discordResult = null;
  const isUrgent = triage.severity === "HIGH" || triage.severity === "CRITICAL";
  const header = isUrgent
    ? "🚨 URGENT CUSTOMER COMPLAINT"
    : "📩 NEW CUSTOMER COMPLAINT";

  const content = \`\${header}\\nComplaint ID: \${complaint_id}\\nCustomer: \${customer_name}\\nOrder: \${order_id}\\nDepartment: \${routing.department}\\nCategory: \${triage.category}\\nSeverity: \${triage.severity}\\nRecommended Action: \${routing.recommended_action}\\nSummary: \${triage.summary}\`;

  discordResult = await notifyDiscord(
    content,
    Boolean(input?.force_discord_failure),
    input?.discord_webhook_url
  );

`;
  patched = patched.substring(0, idxStart) + t2_new + patched.substring(idxEnd);
}

// Target 3: Update rowValues to set status based on department
const t3_old = `    "OPEN",                                  // I (8)`;
const t3_new = `    (routing.department === "Engineering" ? "OPEN" : "APPROVAL_PENDING"), // I (8)`;
console.log('t3 match:', patched.includes(t3_old));
patched = patched.replace(t3_old, t3_new);

// Target 4: Update incidentRecord to store routing metadata
const t4_old = `    clickup_task: clickupResult,
  };`;
const t4_new = `    clickup_task: clickupResult,
    department: routing.department,
    recommended_action: routing.recommended_action,
    reason: routing.reason,
    target_system: routing.target_system,
    approval_status: routing.approval_status,
    approval_location: routing.approval_location,
  };`;
console.log('t4 match:', patched.includes(t4_old));
patched = patched.replace(t4_old, t4_new);

// Target 5: Update return object in Flow 3
const t5_old = `    github_error: githubError,
    notion_result: null,
  };
}`;
const t5_new = `    github_error: githubError,
    notion_result: null,
    department: routing.department,
    recommended_action: routing.recommended_action,
    reason: routing.reason,
    target_system: routing.target_system,
    approval_status: routing.approval_status,
    approval_location: routing.approval_location,
  };
}`;
console.log('t5 match:', patched.includes(t5_old));
patched = patched.replace(t5_old, t5_new);

// Target 6: Update Flow 2 (Manual/API update) Discord for MANUAL_REVIEW
const t6_old = `    } else if (finalStatus === "IN_PROGRESS") {
      const content = \`🔄 COMPLAINT IN PROGRESS\\nComplaint ID: \${complaint_id}\\nOrder: \${existingRow?.[3] || stateRecord?.order_id || ""}\\nStatus: IN PROGRESS\`;
      discordResult = await notifyDiscord(content, Boolean(input?.force_discord_failure), input?.discord_webhook_url);
    }`;

const t6_new = `    } else if (finalStatus === "IN_PROGRESS") {
      const content = \`🔄 COMPLAINT IN PROGRESS\\nComplaint ID: \${complaint_id}\\nOrder: \${existingRow?.[3] || stateRecord?.order_id || ""}\\nStatus: IN PROGRESS\`;
      discordResult = await notifyDiscord(content, Boolean(input?.force_discord_failure), input?.discord_webhook_url);
    } else if (finalStatus === "MANUAL_REVIEW") {
      const content = \`⚠️ COMPLAINT SENT TO MANUAL REVIEW\\nComplaint ID: \${complaint_id}\\nOrder: \${existingRow?.[3] || stateRecord?.order_id || ""}\\nNote: \${noteVal}\`;
      discordResult = await notifyDiscord(content, Boolean(input?.force_discord_failure), input?.discord_webhook_url);
    }`;
console.log('t6 match:', patched.includes(t6_old));
patched = patched.replace(t6_old, t6_new);

// Target 7: Update Flow 2 state update with approval info
const t7_old = `      stateRecord.last_updated_by = lastUpdatedBy;
      await fastn.state.set(stateKey, stateRecord);`;
const t7_new = `      stateRecord.last_updated_by = lastUpdatedBy;
      if (input?.approval_status) stateRecord.approval_status = input.approval_status;
      if (input?.approved_by) stateRecord.approved_by = input.approved_by;
      if (input?.approved_at) stateRecord.approved_at = input.approved_at;
      await fastn.state.set(stateKey, stateRecord);`;
console.log('t7 match:', patched.includes(t7_old));
patched = patched.replace(t7_old, t7_new);

fs.writeFileSync('c:/Users/HP/Downloads/hanaz/proposed_wf.js', patched);
console.log('Patched file written to proposed_wf.js. Checking syntax...');
