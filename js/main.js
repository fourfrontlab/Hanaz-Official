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
     2. CART LOGIC
     ======================================================================== */
  const cartState = {
    items: [],
    subtotal: 0
  };

  function loadCart() {
    try {
      const stored = localStorage.getItem('hanazCart');
      if (stored) {
        cartState.items = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Cart load failed', e);
    }
  }

  function saveCart() {
    localStorage.setItem('hanazCart', JSON.stringify(cartState.items));
    renderCart();
  }

  function renderCart() {
    const badge = document.getElementById('cart-badge-nav');
    const body = document.querySelector('.cart-drawer-body');
    const subtotalEl = document.querySelector('.cart-subtotal strong');
    const footer = document.querySelector('.cart-drawer-footer');

    let totalQty = 0;
    cartState.subtotal = 0;

    cartState.items.forEach(item => {
      totalQty += item.qty;
      cartState.subtotal += item.qty * item.price;
    });

    if (badge) {
      badge.textContent = totalQty;
      badge.style.display = totalQty > 0 ? 'flex' : 'none';
    }

    if (subtotalEl) {
      subtotalEl.textContent = 'Rs. ' + cartState.subtotal.toLocaleString();
    }

    if (!body) return;

    if (cartState.items.length === 0) {
      body.innerHTML = `
        <div class="cart-empty">
          <svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <p>Your cart is currently empty</p>
          <a href="products.html" class="btn btn-primary" style="margin-top:24px">Continue Shopping</a>
        </div>
      `;
      if (footer) footer.style.display = 'none';
    } else {
      let html = '';
      cartState.items.forEach((item, index) => {
        html += `
          <div class="cart-item">
            <div class="cart-item-img">
              <img src="${item.image}" alt="${item.name}">
            </div>
            <div class="cart-item-info">
              <h4>${item.name}</h4>
              <div class="cart-item-price">Rs. ${item.price.toLocaleString()}</div>
              <div class="cart-item-actions">
                <div class="qty-stepper">
                  <button data-action="minus" data-index="${index}" aria-label="Decrease quantity">−</button>
                  <span class="qty-stepper-val">${item.qty}</span>
                  <button data-action="plus" data-index="${index}" aria-label="Increase quantity">+</button>
                </div>
                <button class="cart-item-remove" data-index="${index}">Remove</button>
              </div>
            </div>
          </div>
        `;
      });
      body.innerHTML = html;
      if (footer) footer.style.display = 'block';

      // Bind cart row events
      body.querySelectorAll('.qty-stepper button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.index);
          const action = e.target.dataset.action;
          const valEl = e.target.parentElement.querySelector('.qty-stepper-val');
          
          if (action === 'plus') {
            cartState.items[idx].qty++;
          } else {
            if (cartState.items[idx].qty > 1) {
              cartState.items[idx].qty--;
            } else {
              return;
            }
          }
          
          // Crossfade number animation
          valEl.style.opacity = '0';
          setTimeout(() => {
            valEl.textContent = cartState.items[idx].qty;
            valEl.style.opacity = '1';
            saveCart();
          }, 150);
        });
      });

      body.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.index);
          cartState.items.splice(idx, 1);
          saveCart();
        });
      });
    }
  }

  window.HanazCart = {
    add: function (item) {
      const existing = cartState.items.find(i => i.id === item.id);
      if (existing) {
        existing.qty += item.qty;
      } else {
        cartState.items.push(item);
      }
      saveCart();
      window.HanazToast("Item added to cart");
      this.open();
    },
    open: function () {
      const drawer = document.getElementById('cart-drawer');
      const overlay = document.getElementById('cart-overlay');
      if (drawer) drawer.classList.add('open');
      if (overlay) overlay.classList.add('open');
    }
  };

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

    // Cart Drawer Toggle
    const cartToggleBtns = document.querySelectorAll('[data-open-cart]');
    const cartCloseBtn = document.querySelector('.cart-close-btn');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartDrawer = document.getElementById('cart-drawer');

    cartToggleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.HanazCart.open();
      });
    });

    if (cartCloseBtn && cartDrawer && cartOverlay) {
      cartCloseBtn.addEventListener('click', () => {
        cartDrawer.classList.remove('open');
        cartOverlay.classList.remove('open');
      });
      cartOverlay.addEventListener('click', () => {
        cartDrawer.classList.remove('open');
        cartOverlay.classList.remove('open');
      });
    }

    // Mobile Nav Toggle
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
        window.HanazToast("Thank you for subscribing!");
        footerForm.reset();
      });
    }

    // Checkout button toast
    const checkoutBtn = document.querySelector('.btn-checkout');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.HanazToast("Cash on Delivery — we'll contact you to confirm your order");
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    renderCart();
    initUI();
  });

})();
