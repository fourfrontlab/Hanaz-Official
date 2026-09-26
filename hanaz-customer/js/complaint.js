/**
 * Hanaz Complaint Form Logic
 * - Auto-generates complaint_id and order_id
 * - Submits to /api/complaints (ResolveSync backend)
 * - Handles success/error states
 */
(function () {
  'use strict';

  const COMPLAINT_API = '/api/complaints';

  // DOM elements
  const form = document.getElementById('complaint-form');
  const successEl = document.getElementById('complaint-success');
  const errorEl = document.getElementById('complaint-error');
  const submitBtn = document.getElementById('complaint-submit-btn');
  const refIdEl = document.getElementById('complaint-ref-id');
  const errorMsgEl = document.getElementById('complaint-error-msg');
  const anotherBtn = document.getElementById('complaint-another-btn');

  if (!form) return;

  // Generate unique complaint ID: CMP-XXXX (matches backend expectation)
  function generateComplaintId() {
    return 'CMP-' + Math.floor(1000 + Math.random() * 9000);
  }

  // Generate order ID: HNZ-YYYYMMDD-XXXX
  function generateOrderId() {
    const d = new Date();
    const date = d.getFullYear().toString() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return 'HNZ-' + date + '-' + rand;
  }

  // Show/hide states
  function showSuccess(complaintId) {
    form.style.display = 'none';
    errorEl.style.display = 'none';
    if (refIdEl) refIdEl.textContent = complaintId;
    successEl.style.display = 'block';
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showError(message) {
    errorMsgEl.textContent = message;
    errorEl.style.display = 'block';
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetForm() {
    successEl.style.display = 'none';
    errorEl.style.display = 'none';
    form.style.display = '';
    form.reset();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Validate client-side
  function validateForm() {
    const name = document.getElementById('complaint-name').value.trim();
    const email = document.getElementById('complaint-email').value.trim();
    const text = document.getElementById('complaint-text').value.trim();

    if (!name) return 'Please enter your full name.';
    if (!email) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
    if (!text) return 'Please describe your issue.';
    if (text.length < 10) return 'Please provide more detail about your issue (at least 10 characters).';
    return null;
  }

  // Submit
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    // Prevent double submission
    if (submitBtn.disabled) return;

    // Client validation
    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      return;
    }

    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    const complaintId = generateComplaintId();
    const orderIdInput = document.getElementById('complaint-order-id');
    const orderId = (orderIdInput && orderIdInput.value.trim()) ? orderIdInput.value.trim() : generateOrderId();

    const payload = {
      complaint_id: complaintId,
      customer_name: document.getElementById('complaint-name').value.trim(),
      email: document.getElementById('complaint-email').value.trim(),
      order_id: orderId,
      complaint_text: document.getElementById('complaint-text').value.trim()
    };

    async function submitComplaint(payload) {
      try {
        const res = await fetch(COMPLAINT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.status === 404 && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          return fetch('http://localhost:3001/api/complaints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
        return res;
      } catch (err) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          return fetch('http://localhost:3001/api/complaints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
        throw err;
      }
    }

    try {
      const res = await submitComplaint(payload);

      if (!res.ok) {
        const errData = await res.text();
        let errMsg;
        try {
          const parsed = JSON.parse(errData);
          errMsg = parsed.error || parsed.message || errData;
        } catch {
          errMsg = errData;
        }
        throw new Error(errMsg || `Server responded with status ${res.status}`);
      }

      const data = await res.json();

      // Handle duplicate
      if (data.is_duplicate) {
        showError('This complaint appears to have been submitted already. If you need further help, please contact us via WhatsApp.');
        return;
      }

      // Success
      showSuccess(data.complaint_id || complaintId);

    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        showError('Unable to reach our servers. Please check your internet connection and try again.');
      } else {
        showError(err.message || 'Something went wrong. Please try again later.');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Complaint';
    }
  });

  // File another complaint
  if (anotherBtn) {
    anotherBtn.addEventListener('click', resetForm);
  }
})();
