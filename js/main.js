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
    subtotal: 0,
    view: 'cart',
    lastPhone: ''
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

    if (cartState.view === 'checkout') {
      body.innerHTML = `
        <button class="cart-back-btn" style="text-decoration:underline; font-size:13px; margin-bottom:16px;">&larr; Back to cart</button>
        <form id="checkout-form" class="checkout-form" style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="font-size:12px; margin-bottom:4px; display:block; font-weight:500;">Full Name</label>
            <input type="text" id="co-name" required style="width:100%; padding:10px; border:1px solid var(--border); border-radius:var(--radius); font-family:inherit;">
            <div class="err-msg" style="color:#d93025; font-size:11px; display:none; margin-top:4px;">This field is required</div>
          </div>
          <div>
            <label style="font-size:12px; margin-bottom:4px; display:block; font-weight:500;">Phone Number</label>
            <input type="tel" id="co-phone" required style="width:100%; padding:10px; border:1px solid var(--border); border-radius:var(--radius); font-family:inherit;">
            <div class="err-msg" style="color:#d93025; font-size:11px; display:none; margin-top:4px;">This field is required</div>
          </div>
          <div>
            <label style="font-size:12px; margin-bottom:4px; display:block; font-weight:500;">Address</label>
            <input type="text" id="co-address" required style="width:100%; padding:10px; border:1px solid var(--border); border-radius:var(--radius); font-family:inherit;">
            <div class="err-msg" style="color:#d93025; font-size:11px; display:none; margin-top:4px;">This field is required</div>
          </div>
          <div>
            <label style="font-size:12px; margin-bottom:4px; display:block; font-weight:500;">City</label>
            <input type="text" id="co-city" required style="width:100%; padding:10px; border:1px solid var(--border); border-radius:var(--radius); font-family:inherit;">
            <div class="err-msg" style="color:#d93025; font-size:11px; display:none; margin-top:4px;">This field is required</div>
          </div>
        </form>
        <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--border);">
          <h4 style="font-size:14px; margin-bottom:12px;">Order Summary</h4>
          ${cartState.items.map(i => `<div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px; color:var(--text-body);"><span>${i.qty}x ${i.name}</span><span>Rs. ${(i.qty * i.price).toLocaleString()}</span></div>`).join('')}
        </div>
      `;
      if (footer) {
        footer.style.display = 'block';
        footer.innerHTML = `
          <div class="cart-subtotal"><span>Total</span><strong>Rs. ${cartState.subtotal.toLocaleString()}</strong></div>
          <button class="btn btn-primary btn-block" id="btn-place-order">Place Order (COD)</button>
        `;
        
        document.getElementById('btn-place-order').addEventListener('click', () => {
          const form = document.getElementById('checkout-form');
          let valid = true;
          ['name', 'phone', 'address', 'city'].forEach(f => {
            const el = document.getElementById('co-' + f);
            const err = el.nextElementSibling;
            if (!el.value.trim()) {
              valid = false;
              err.style.display = 'block';
              el.style.borderColor = '#d93025';
            } else {
              err.style.display = 'none';
              el.style.borderColor = 'var(--border)';
            }
          });
          
          if (valid) {
            const name = document.getElementById('co-name').value.trim();
            const phone = document.getElementById('co-phone').value.trim();
            const address = document.getElementById('co-address').value.trim();
            const city = document.getElementById('co-city').value.trim();
            
            let msg = `*New Order (Cash on Delivery)*%0A`;
            msg += `Name: ${name}%0A`;
            msg += `Phone: ${phone}%0A`;
            msg += `Address: ${address}, ${city}%0A%0A`;
            msg += `*Items:*%0A`;
            cartState.items.forEach(i => {
              msg += `- ${i.qty}x ${i.name} (Rs. ${i.price})%0A`;
            });
            msg += `%0A*Total: Rs. ${cartState.subtotal.toLocaleString()}*`;
            
            window.open(`https://wa.me/923225386807?text=${msg}`, '_blank');
            
            cartState.items = [];
            localStorage.removeItem('hanazCart');
            cartState.lastPhone = phone;
            cartState.view = 'success';
            renderCart();
          }
        });
      }
      
      body.querySelector('.cart-back-btn').addEventListener('click', () => {
        cartState.view = 'cart';
        renderCart();
      });
      return;
    }

    if (cartState.view === 'success') {
      body.innerHTML = `
        <div class="cart-empty" style="padding-top:48px;">
          <svg viewBox="0 0 24 24" style="stroke:var(--accent);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <h3 style="margin:16px 0 8px;">Order Received!</h3>
          <p style="font-size:14px; margin-bottom:24px; color:var(--text-body);">Thank you \u2014 your order has been received. We'll contact you on ${cartState.lastPhone} to confirm delivery.</p>
          <button class="btn btn-primary" id="btn-continue-shop">Continue Shopping</button>
        </div>
      `;
      if (footer) footer.style.display = 'none';
      
      document.getElementById('btn-continue-shop').addEventListener('click', () => {
        cartState.view = 'cart';
        const drawer = document.getElementById('cart-drawer');
        const overlay = document.getElementById('cart-overlay');
        if (drawer) drawer.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
        renderCart();
      });
      return;
    }

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
      if (footer) {
        footer.style.display = 'block';
        footer.innerHTML = `
          <div class="cart-subtotal"><span>Subtotal</span><strong>Rs. ${cartState.subtotal.toLocaleString()}</strong></div>
          <p class="cart-note">Shipping & taxes calculated at checkout</p>
          <button class="btn btn-primary btn-block" style="margin-bottom:var(--space-sm);" id="cart-checkout-btn">Check out</button>
          <button class="btn btn-secondary btn-block" id="cart-continue-btn">Continue Shopping</button>
        `;
        document.getElementById('cart-checkout-btn').addEventListener('click', () => {
          cartState.view = 'checkout';
          renderCart();
        });
        document.getElementById('cart-continue-btn').addEventListener('click', () => {
          const drawer = document.getElementById('cart-drawer');
          const overlay = document.getElementById('cart-overlay');
          if (drawer) drawer.classList.remove('open');
          if (overlay) overlay.classList.remove('open');
        });
      }

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
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    renderCart();
    initUI();
  });

})();
