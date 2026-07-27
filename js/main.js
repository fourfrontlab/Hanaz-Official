/* ==========================================================================
   HANAZ OFFICIAL — Shared JavaScript
   "The Ordinary" Minimalist Aesthetic
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. DOM REFERENCES
     ======================================================================== */
  const DOM = {
    body:             document.body,
    navbar:           document.querySelector('.navbar'),
    hamburgerBtn:     document.querySelector('.hamburger-btn'),
    mobileNavOverlay: document.querySelector('.mobile-nav-overlay'),
    mobileNavDrawer:  document.querySelector('.mobile-nav-drawer'),
    mobileNavClose:   document.querySelector('.mobile-nav-close'),
    cartOverlay:      document.querySelector('.cart-overlay'),
    cartDrawer:       document.querySelector('.cart-drawer'),
    cartOpenBtns:     document.querySelectorAll('[data-open-cart]'),
    cartCloseBtn:     document.querySelector('.cart-close-btn'),
    cartBadges:       document.querySelectorAll('.cart-badge'),
    cartBody:         document.querySelector('.cart-drawer-body'),
    cartSubtotalEl:   document.querySelector('.cart-subtotal strong'),
    newsletterForms:  document.querySelectorAll('.newsletter-form'),
    toastContainer:   document.querySelector('.toast-container'),
  };

  /* ========================================================================
     2. STICKY NAV
     ======================================================================== */
  function initStickyNav() {
    if (!DOM.navbar) return;
    // Navbar always has a bottom border — no scroll-based shadow changes needed
  }

  /* ========================================================================
     3. MOBILE NAV DRAWER
     ======================================================================== */
  function initMobileNav() {
    const { hamburgerBtn, mobileNavOverlay, mobileNavDrawer, mobileNavClose } = DOM;
    if (!hamburgerBtn || !mobileNavDrawer) return;

    function open() {
      mobileNavDrawer.classList.add('active');
      if (mobileNavOverlay) mobileNavOverlay.classList.add('active');
      hamburgerBtn.classList.add('active');
      DOM.body.classList.add('drawer-open');
    }

    function close() {
      mobileNavDrawer.classList.remove('active');
      if (mobileNavOverlay) mobileNavOverlay.classList.remove('active');
      hamburgerBtn.classList.remove('active');
      if (!DOM.cartDrawer || !DOM.cartDrawer.classList.contains('active')) {
        DOM.body.classList.remove('drawer-open');
      }
    }

    hamburgerBtn.addEventListener('click', () => {
      mobileNavDrawer.classList.contains('active') ? close() : open();
    });

    if (mobileNavClose)   mobileNavClose.addEventListener('click', close);
    if (mobileNavOverlay) mobileNavOverlay.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNavDrawer.classList.contains('active')) close();
    });

    mobileNavDrawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', close);
    });
  }

  /* ========================================================================
     4. CART DRAWER
     ======================================================================== */
  function initCartDrawer() {
    const { cartOverlay, cartDrawer, cartOpenBtns, cartCloseBtn } = DOM;
    if (!cartDrawer) return;

    function open() {
      cartDrawer.classList.add('active');
      if (cartOverlay) cartOverlay.classList.add('active');
      DOM.body.classList.add('drawer-open');
      renderCart();
    }

    function close() {
      cartDrawer.classList.remove('active');
      if (cartOverlay) cartOverlay.classList.remove('active');
      if (!DOM.mobileNavDrawer || !DOM.mobileNavDrawer.classList.contains('active')) {
        DOM.body.classList.remove('drawer-open');
      }
    }

    cartOpenBtns.forEach((btn) => btn.addEventListener('click', open));
    if (cartCloseBtn) cartCloseBtn.addEventListener('click', close);
    if (cartOverlay)  cartOverlay.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && cartDrawer.classList.contains('active')) close();
    });

    window.HanazCart = window.HanazCart || {};
    window.HanazCart.open = open;
    window.HanazCart.close = close;
    window.HanazCart.refresh = renderCart;
  }

  /* ========================================================================
     5. CART DATA — localStorage
     ======================================================================== */
  const CART_KEY = 'hanazCart';

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateBadge();
    renderCart();
  }

  function addToCart(item) {
    const cart = getCart();
    const existing = cart.find((c) => c.id === item.id);
    if (existing) {
      existing.qty += item.qty || 1;
    } else {
      cart.push({ ...item, qty: item.qty || 1 });
    }
    saveCart(cart);
    showToast(`Added to cart`);
  }

  function removeFromCart(id) {
    const cart = getCart().filter((c) => c.id !== id);
    saveCart(cart);
  }

  function updateCartQty(id, delta) {
    const cart = getCart();
    const item = cart.find((c) => c.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      saveCart(cart.filter((c) => c.id !== id));
    } else {
      saveCart(cart);
    }
  }

  function getCartTotal() {
    return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function getCartCount() {
    return getCart().reduce((sum, item) => sum + item.qty, 0);
  }

  /* ========================================================================
     6. CART BADGE
     ======================================================================== */
  function updateBadge() {
    const count = getCartCount();
    DOM.cartBadges.forEach((badge) => {
      badge.textContent = count;
      badge.classList.toggle('visible', count > 0);
    });
  }

  /* ========================================================================
     7. CART DRAWER RENDER
     ======================================================================== */
  function renderCart() {
    const { cartBody, cartSubtotalEl } = DOM;
    if (!cartBody) return;

    const cart = getCart();

    if (cart.length === 0) {
      cartBody.innerHTML = `
        <div class="cart-empty">
          <svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <p>Your cart is currently empty</p>
          <a href="products.html" class="btn-continue">Continue Shopping</a>
        </div>
      `;
      if (cartSubtotalEl) cartSubtotalEl.textContent = 'Rs. 0';
      return;
    }

    cartBody.innerHTML = cart
      .map(
        (item) => `
      <div class="cart-item" data-id="${item.id}">
        <div class="cart-item-image">
          ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
        </div>
        <div class="cart-item-details">
          <span class="cart-item-name">${item.name}</span>
          ${item.variant ? `<span class="cart-item-variant">${item.variant}</span>` : ''}
          <span class="cart-item-price">Rs. ${item.price.toLocaleString()}</span>
          <div class="cart-item-qty">
            <button onclick="HanazCart.updateQty('${item.id}', -1)" aria-label="Decrease quantity">−</button>
            <span>${item.qty}</span>
            <button onclick="HanazCart.updateQty('${item.id}', 1)" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="HanazCart.remove('${item.id}')" aria-label="Remove item">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `
      )
      .join('');

    if (cartSubtotalEl) {
      cartSubtotalEl.textContent = `Rs. ${getCartTotal().toLocaleString()}`;
    }
  }

  // Expose cart methods globally
  window.HanazCart = window.HanazCart || {};
  Object.assign(window.HanazCart, {
    get:       getCart,
    add:       addToCart,
    remove:    removeFromCart,
    updateQty: updateCartQty,
    total:     getCartTotal,
    count:     getCartCount,
    save:      saveCart,
    refresh:   renderCart,
  });

  /* ========================================================================
     8. NEWSLETTER
     ======================================================================== */
  function initNewsletter() {
    DOM.newsletterForms.forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="email"]');
        if (!input || !input.value.trim()) {
          showToast('Please enter a valid email address.', 'error');
          return;
        }
        showToast('Thanks for subscribing!', 'success');
        input.value = '';
      });
    });
  }

  /* ========================================================================
     9. TOAST NOTIFICATIONS
     ======================================================================== */
  function showToast(message, type = 'success', duration = 3000) {
    let container = DOM.toastContainer;
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
      DOM.toastContainer = container;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('show');
      });
    });

    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      setTimeout(() => toast.remove(), 500);
    }, duration);
  }

  window.HanazToast = showToast;

  /* ========================================================================
     10. SMOOTH SCROLL
     ======================================================================== */
  function initSmoothScroll() {
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a[href^="#"]');
      if (!anchor) return;

      const hash = anchor.getAttribute('href');
      if (hash === '#' || hash.length < 2) return;

      const target = document.querySelector(hash);
      if (!target) return;

      e.preventDefault();

      const announcementH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--announcement-h')) || 0;
      const navH           = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height'))    || 0;
      const offset         = announcementH + navH + 16;

      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
      history.pushState(null, '', hash);
    });
  }

  /* ========================================================================
     11. SCROLL REVEAL
     ======================================================================== */
  function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    reveals.forEach((el) => observer.observe(el));
  }

  /* ========================================================================
     12. ACTIVE NAV LINK
     ======================================================================== */
  function initActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Remove all hardcoded active classes first
    document.querySelectorAll('.nav-links a, .mobile-nav-links a').forEach((link) => {
      link.classList.remove('active');
    });

    document.querySelectorAll('.nav-links a, .mobile-nav-links a').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      const linkPage = href.split('/').pop().split('#')[0];
      if (linkPage === currentPage) {
        link.classList.add('active');
      }
    });
  }

  /* ========================================================================
     13. WHATSAPP FLOATING BUTTON — monochrome outlined
     ======================================================================== */
  function initWhatsAppButton() {
    const waBtn = document.createElement('a');
    waBtn.href = "https://wa.me/923225386807";
    waBtn.target = "_blank";
    waBtn.rel = "noopener";
    waBtn.className = "floating-whatsapp";
    waBtn.setAttribute('aria-label', 'Chat on WhatsApp');
    waBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
    document.body.appendChild(waBtn);
  }

  /* ========================================================================
     14. CHECKOUT ALERT
     ======================================================================== */
  function initCheckoutAlert() {
    const checkoutBtn = document.querySelector('.btn-checkout');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const cart = getCart();
        if (cart.length === 0) {
          showToast('Your cart is empty', 'error');
          return;
        }
        alert("Cash on Delivery — We'll contact you to confirm your order.");
      });
    }
  }

  /* ========================================================================
     15. RECENTLY VIEWED (RENDER)
     ======================================================================== */
  function renderRecentlyViewed() {
    const container = document.getElementById('recently-viewed-scroll');
    const section = document.getElementById('recently-viewed-section');
    if (!container || !section) return;

    let recentlyViewed = [];
    try {
      recentlyViewed = JSON.parse(localStorage.getItem('hanazRecentlyViewed')) || [];
    } catch (e) {}

    if (recentlyViewed.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    container.innerHTML = recentlyViewed.map(item => `
      <div class="product-card" data-product-id="${item.id}">
        <a href="${item.link}" class="product-card-image">
          <img src="${item.image}" alt="${item.name}">
        </a>
        <div class="product-card-body">
          <h3 class="product-card-name">
            <a href="${item.link}">${item.name}</a>
          </h3>
          <div class="product-card-price">
            <span class="price-current">Rs. ${item.price.toLocaleString()}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  /* ========================================================================
     16. ACCORDION TOGGLES
     ======================================================================== */
  function initAccordions() {
    document.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const accordion = header.closest('.accordion') || header.closest('.accordion-item');
        if (!accordion) return;

        const body = accordion.querySelector('.accordion-body');
        if (!body) return;

        const isOpen = accordion.classList.contains('open');

        if (isOpen) {
          body.style.maxHeight = '0';
          accordion.classList.remove('open');
        } else {
          body.style.maxHeight = body.scrollHeight + 'px';
          accordion.classList.add('open');
        }
      });
    });
  }

  /* ========================================================================
     17. INIT
     ======================================================================== */
  function init() {
    initStickyNav();
    initMobileNav();
    initCartDrawer();
    updateBadge();
    renderCart();
    initNewsletter();
    initSmoothScroll();
    initScrollReveal();
    initActiveNavLink();
    initWhatsAppButton();
    initCheckoutAlert();
    renderRecentlyViewed();
    initAccordions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
