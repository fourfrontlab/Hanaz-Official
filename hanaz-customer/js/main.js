/* ==========================================================================
   GLOBAL JS — "The Ordinary" spec
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. TOAST NOTIFICATIONS
     ======================================================================== */
  window.HanazToast = function (message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>${message}</span>`;
    
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      toast.addEventListener('animationend', () => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      });
    }, 3000);
  };

  /* ========================================================================


  /* ========================================================================
     3. UI INTERACTIONS
     ======================================================================== */
  function initUI() {
    // Nav shrink on scroll
    const navbar = document.getElementById('navbar');
    if (navbar) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
          navbar.classList.add('scrolled');
        } else {
          navbar.classList.remove('scrolled');
        }
      }, { passive: true });
    }

    // Active nav underline
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .mobile-nav-links a').forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPath || (currentPath === '' && href === 'index.html')) {
        link.classList.add('active');
      }
    });

    const cartToggleBtns = document.querySelectorAll('[data-open-cart]');
    
    cartToggleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.HanazCart) window.HanazCart.openDrawer();
      });
    });

    const cartCloseBtns = document.querySelectorAll('.cart-close-btn');
    const cartOverlay = document.getElementById('cart-overlay');

    cartCloseBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.HanazCart) window.HanazCart.closeDrawer();
      });
    });

    if (cartOverlay) {
      cartOverlay.addEventListener('click', () => {
        if (window.HanazCart) window.HanazCart.closeDrawer();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && window.HanazCart) {
        window.HanazCart.closeDrawer();
      }
    });    // Mobile Nav Toggle
    const mobileBtn = document.getElementById('hamburger-btn');
    const mobileClose = document.getElementById('mobile-nav-close');
    const mobileOverlay = document.getElementById('mobile-nav-overlay');
    const mobileDrawer = document.getElementById('mobile-nav-drawer');

    if (mobileBtn && mobileDrawer && mobileOverlay && mobileClose) {
      mobileBtn.addEventListener('click', () => {
        mobileDrawer.classList.add('open');
        mobileOverlay.classList.add('open');
      });
      mobileClose.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
        mobileOverlay.classList.remove('open');
      });
      mobileOverlay.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
        mobileOverlay.classList.remove('open');
      });
    }

    // Scroll Fade In Observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Footer Newsletter
    const footerForm = document.getElementById('footer-newsletter-form');
    if (footerForm) {
      footerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const originalHTML = footerForm.innerHTML;
        
        footerForm.style.transition = 'opacity 0.3s ease';
        footerForm.style.opacity = '0';
        
        setTimeout(() => {
          footerForm.innerHTML = `<div style="display:flex; align-items:center; gap:8px; color:var(--bg-card);"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> <span>You're subscribed</span></div>`;
          footerForm.style.opacity = '1';
          
          setTimeout(() => {
            footerForm.style.opacity = '0';
            setTimeout(() => {
              footerForm.innerHTML = originalHTML;
              footerForm.reset();
              footerForm.style.opacity = '1';
            }, 300);
          }, 4000);
        }, 300);
      });
    }
  }

  /* ========================================================================
     4. WISHLIST LOGIC
     ======================================================================== */
  window.initWishlist = function() {
    const btns = document.querySelectorAll('.wishlist-btn');
    if (!btns.length) return;

    let wishlist = [];
    try {
      const stored = localStorage.getItem('hanazWishlist');
      if (stored) wishlist = JSON.parse(stored);
    } catch (e) {}

    btns.forEach(btn => {
      const id = btn.dataset.productId;
      if (wishlist.includes(id)) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (btn.classList.contains('active')) {
          btn.classList.remove('active');
          wishlist = wishlist.filter(item => item !== id);
        } else {
          btn.classList.add('active');
          if (!wishlist.includes(id)) wishlist.push(id);
        }
        
        localStorage.setItem('hanazWishlist', JSON.stringify(wishlist));
      });
    });
  }

  /* ========================================================================
     5. SEARCH LOGIC
     ======================================================================== */
  function initSearch() {
    const searchHTML = `
      <div class="overlay" id="search-overlay" style="z-index: 1999;"></div>
      <div class="search-modal" id="search-modal" style="position:fixed; top:0; left:0; width:100%; padding:24px; background:var(--bg-primary); z-index:2000; transform:translateY(-100%); transition:transform 0.3s ease; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <div class="container" style="position:relative; max-width:600px;">
          <button id="search-close" style="position:absolute; right:0; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--text-heading);"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          <form id="search-form" style="display:flex; border-bottom:1px solid var(--border); padding-bottom:8px; margin-right:40px;">
            <input type="text" name="q" placeholder="Search for products, categories..." style="flex:1; border:none; background:transparent; font-size:18px; outline:none; font-family:inherit; color:var(--text-heading);" required>
            <button type="submit" style="background:none; border:none; cursor:pointer; color:var(--text-heading);"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', searchHTML);

    const searchOverlay = document.getElementById('search-overlay');
    const searchModal = document.getElementById('search-modal');
    const searchBtns = document.querySelectorAll('.nav-icon-btn[aria-label="Search"]');
    const searchClose = document.getElementById('search-close');
    const searchForm = document.getElementById('search-form');
    const searchInput = searchForm.querySelector('input');

    function openSearch() {
      searchOverlay.classList.add('active');
      searchModal.style.transform = 'translateY(0)';
      setTimeout(() => searchInput.focus(), 300);
    }

    function closeSearch() {
      searchOverlay.classList.remove('active');
      searchModal.style.transform = 'translateY(-100%)';
    }

    searchBtns.forEach(btn => btn.addEventListener('click', (e) => {
      e.preventDefault();
      openSearch();
    }));
    searchClose.addEventListener('click', closeSearch);
    searchOverlay.addEventListener('click', closeSearch);

    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      if (q) {
        window.location.href = `products.html?q=${encodeURIComponent(q)}`;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {

    initUI();
    window.initWishlist();
    initSearch();
  });

})();
