/* ==========================================================================
   HANAZ AUTH — Shared authentication logic
   Uses Supabase Auth (already configured via supabase-client.js)
   Loaded on every page via a <script> tag.
   ========================================================================== */

(function () {
  'use strict';

  /* -------------------------------------------------------------------------
     initAuthNav()
     Reads the current Supabase session and dynamically updates the Login /
     Account nav item on both desktop (.nav-links) and mobile (.mobile-nav-links).
  --------------------------------------------------------------------------- */
  async function initAuthNav() {
    // Wait for supabase client to be ready (deferred scripts load order)
    if (!window.supabase) return;

    let session = null;
    try {
      const { data } = await window.supabase.auth.getSession();
      session = data.session;
    } catch (e) {
      console.warn('[HanazAuth] getSession error:', e);
      return;
    }

    // Desktop nav item
    const desktopAuthItem = document.getElementById('nav-auth-item');
    const desktopAuthLink = document.getElementById('nav-auth-link');

    // Mobile nav link
    const mobileAuthLink = document.getElementById('mobile-nav-auth-link');

    if (session && session.user) {
      const user = session.user;
      const name = (user.user_metadata && user.user_metadata.full_name)
        ? user.user_metadata.full_name
        : user.email;
      const initial = name.charAt(0).toUpperCase();

      // Desktop: show "Account" with avatar
      if (desktopAuthLink) {
        desktopAuthLink.href = 'account.html';
        desktopAuthLink.classList.add('nav-auth-link');
        desktopAuthLink.innerHTML = `
          <span class="nav-auth-avatar" aria-hidden="true">${initial}</span>
          <span>Account</span>
        `;
        desktopAuthLink.setAttribute('aria-label', 'My Account');
      }

      // Mobile: show "Account"
      if (mobileAuthLink) {
        mobileAuthLink.href = 'account.html';
        mobileAuthLink.textContent = 'Account';
      }
    } else {
      // Logged out — ensure links point to login (they already do in HTML)
      if (desktopAuthLink) {
        desktopAuthLink.href = 'login.html';
        desktopAuthLink.textContent = 'Login';
      }
      if (mobileAuthLink) {
        mobileAuthLink.href = 'login.html';
        mobileAuthLink.textContent = 'Login';
      }
    }
  }

  /* -------------------------------------------------------------------------
     Auth state change listener
     Updates the nav in real-time when sign-in / sign-out happens
  --------------------------------------------------------------------------- */
  function listenAuthChanges() {
    if (!window.supabase) return;
    window.supabase.auth.onAuthStateChange((_event, session) => {
      initAuthNav();
    });
  }

  /* -------------------------------------------------------------------------
     requireAuth(redirectTo)
     Redirects unauthenticated users. Call on protected pages (account.html).
  --------------------------------------------------------------------------- */
  window.HanazAuth = window.HanazAuth || {};
  window.HanazAuth.requireAuth = async function (redirectTo) {
    if (!window.supabase) return null;
    try {
      const { data } = await window.supabase.auth.getSession();
      if (!data.session) {
        window.location.href = redirectTo || 'login.html';
        return null;
      }
      return data.session;
    } catch (e) {
      window.location.href = redirectTo || 'login.html';
      return null;
    }
  };

  /* -------------------------------------------------------------------------
     Logout handler
     Signs out, clears session, redirects to homepage.
  --------------------------------------------------------------------------- */
  window.HanazAuth.logout = async function () {
    if (!window.supabase) return;
    try {
      await window.supabase.auth.signOut();
    } catch (e) {
      console.warn('[HanazAuth] signOut error:', e);
    }
    window.location.href = 'index.html';
  };

  /* -------------------------------------------------------------------------
     Friendly error message mapper
     Converts raw Supabase error messages to user-facing strings.
  --------------------------------------------------------------------------- */
  window.HanazAuth.friendlyError = function (err) {
    if (!err) return 'Something went wrong. Please try again.';
    const msg = (err.message || '').toLowerCase();

    if (msg.includes('invalid login credentials') || msg.includes('invalid email or password'))
      return 'Invalid email or password. Please try again.';
    if (msg.includes('email not confirmed'))
      return 'Please verify your email before logging in.';
    if (msg.includes('user already registered') || msg.includes('already been registered'))
      return 'An account with this email already exists. Please log in instead.';
    if (msg.includes('password should be at least'))
      return 'Your password must be at least 8 characters long.';
    if (msg.includes('rate limit') || msg.includes('too many requests'))
      return 'Too many attempts. Please wait a moment before trying again.';
    if (msg.includes('network') || msg.includes('failed to fetch'))
      return 'Network error. Please check your connection and try again.';
    if (msg.includes('weak password'))
      return 'Please choose a stronger password (min. 8 characters).';

    return 'Something went wrong. Please try again.';
  };

  /* -------------------------------------------------------------------------
     Initialise on DOMContentLoaded
  --------------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    // Small delay to ensure supabase CDN script (deferred) has run
    setTimeout(function () {
      initAuthNav();
      listenAuthChanges();
    }, 50);
  });

})();
