/* ==========================================================================
   CONSULTATION DRAWER — JavaScript Module
   Hanaz Official | Vanilla JS, no dependencies
   
   Screens:
     0 — Info (ConsultationInfo)
     1 — Booking Form (ConsultationForm)
     2 — Success (ConsultationSuccess)
   ========================================================================== */

(function () {
  'use strict';

  /* ── State ──────────────────────────────────────────────────── */
  let drawerOpen = false;
  let currentScreen = 0;
  let previousFocus = null;

  /* ── Elements ───────────────────────────────────────────────── */
  const overlay  = document.getElementById('cd-overlay');
  const drawer   = document.getElementById('cd-drawer');
  const closeBtn = document.getElementById('cd-close-btn');
  const triggerBtn = document.getElementById('btn-book-consultation');

  const screens = {
    info:    document.getElementById('cd-screen-info'),
    form:    document.getElementById('cd-screen-form'),
    success: document.getElementById('cd-screen-success'),
  };

  const footerEl = document.getElementById('cd-footer');

  /* ── Open / Close ───────────────────────────────────────────── */
  function openDrawer() {
    if (drawerOpen) return;
    drawerOpen = true;
    previousFocus = document.activeElement;

    showScreen('info');

    overlay.classList.add('cd-open');
    document.body.style.overflow = 'hidden';

    // Animate content in after slide completes
    setTimeout(() => {
      const activeScreen = overlay.querySelector('.cd-screen.cd-active');
      if (activeScreen) activeScreen.classList.add('cd-visible');
    }, 320);

    // Focus close button
    setTimeout(() => closeBtn && closeBtn.focus(), 350);
  }

  function closeDrawer() {
    if (!drawerOpen) return;
    drawerOpen = false;

    overlay.classList.remove('cd-open');

    // Remove visible from all screens immediately (so re-open animates fresh)
    Object.values(screens).forEach(s => s && s.classList.remove('cd-visible'));

    overlay.addEventListener('transitionend', function handler() {
      overlay.removeEventListener('transitionend', handler);
      document.body.style.overflow = '';
      if (previousFocus) previousFocus.focus();
    });
  }

  /* ── Screen switching ───────────────────────────────────────── */
  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      if (!el) return;
      el.classList.remove('cd-active', 'cd-visible');
    });

    const target = screens[name];
    if (!target) return;

    target.classList.add('cd-active');

    // Show footer only on info screen
    if (footerEl) {
      footerEl.style.display = name === 'info' ? '' : 'none';
    }

    // Animate in after a paint frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        target.classList.add('cd-visible');
      });
    });

    currentScreen = ['info', 'form', 'success'].indexOf(name);

    // Scroll body to top
    const bodyEl = document.getElementById('cd-body');
    if (bodyEl) bodyEl.scrollTop = 0;
  }

  /* ── Form submission ─────────────────────────────────────────── */
  function handleFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('.cd-submit-btn');
    const checkbox = document.getElementById('cd-agree');

    if (!checkbox || !checkbox.checked) {
      if (checkbox) {
        checkbox.closest('.cd-checkbox-row').style.outline = '2px solid #c0392b';
        setTimeout(() => {
          checkbox.closest('.cd-checkbox-row').style.outline = '';
        }, 2000);
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
    }

    // Simulate async submit (replace with real API call)
    setTimeout(() => {
      form.reset();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Book Consultation';
      }
      showScreen('success');

      // Re-trigger checkmark animation by cloning SVG
      const icon = document.querySelector('.cd-success-icon');
      if (icon) {
        const fresh = icon.cloneNode(true);
        icon.parentNode.replaceChild(fresh, icon);
      }
    }, 800);
  }

  /* ── Focus trap ─────────────────────────────────────────────── */
  function trapFocus(e) {
    if (e.key !== 'Tab' || !drawerOpen) return;

    const focusable = drawer.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }

  /* ── Event bindings ─────────────────────────────────────────── */
  function bindEvents() {
    // Trigger open
    if (triggerBtn) {
      triggerBtn.addEventListener('click', openDrawer);
    }

    // Close button
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer);
    }

    // Overlay click (outside drawer)
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeDrawer();
      });
    }

    // ESC key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawerOpen) closeDrawer();
    });

    // Focus trap
    document.addEventListener('keydown', trapFocus);

    // "Book My Consultation" CTA inside info screen
    const bookBtn = document.getElementById('cd-book-btn');
    if (bookBtn) {
      bookBtn.addEventListener('click', () => showScreen('form'));
    }

    // Back button in form
    const backBtn = document.getElementById('cd-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => showScreen('info'));
    }

    // Form submit
    const consultForm = document.getElementById('cd-booking-form');
    if (consultForm) {
      consultForm.addEventListener('submit', handleFormSubmit);
    }

    // Return to product (success screen)
    const returnBtn = document.getElementById('cd-return-btn');
    if (returnBtn) {
      returnBtn.addEventListener('click', closeDrawer);
    }
  }

  /* ── Init ───────────────────────────────────────────────────── */
  function init() {
    if (!overlay || !drawer) return;
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
