/* ==========================================================================
   CART MODULE
   ========================================================================== */

(function () {
  'use strict';

  // 1. Toast Notification for Cart
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

  // 2. Central Cart State
  const cartState = {
    items: [],
    subtotal: 0
  };

  // Load from localStorage immediately
  try {
    const stored = localStorage.getItem('hanaz_cart');
    if (stored) {
      cartState.items = JSON.parse(stored);
      // Hotfix: Ensure legacy images are correctly formatted
      cartState.items.forEach(item => {
        if (!item.image) {
          item.image = item.imageUrl || item.productImage || 'images/placeholder.jpg';
        }
        if (item.image && typeof item.image === 'string') {
          if (item.image.includes('.png') && item.image.includes('vitamin-c-serum')) {
            item.image = item.image.replace('.png', '.jpg');
          }
          if (item.image === '[' || item.image === '"') {
             item.image = 'images/placeholder.jpg';
          }
          if (!item.image.includes('/') && !item.image.startsWith('http') && item.image.trim() !== '') {
            item.image = 'images/' + item.image;
          }
        }
      });
    }
  } catch (e) {
    console.error('Cart load failed', e);
  }

  function saveCart() {
    // Calculate subtotal whenever saving
    cartState.subtotal = cartState.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    localStorage.setItem('hanaz_cart', JSON.stringify(cartState.items));
    
    // Dispatch event so all UI components (drawer, checkout page) can update
    window.dispatchEvent(new CustomEvent('hanazCartUpdated', { detail: cartState }));
  }

  // Initial calculation
  cartState.subtotal = cartState.items.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // 3. Public API
  window.HanazCart = {
    isLoaded: true, // It loads synchronously now
    
    add: function (item) {
      const existing = cartState.items.find(i => i.id === item.id);
      if (existing) {
        existing.qty += item.qty;
      } else {
        cartState.items.push(item);
      }
      saveCart();
      if (window.HanazToast) window.HanazToast("Item added to cart");
      this.openDrawer();
    },
    
    updateQty: function (index, newQty) {
      if (index >= 0 && index < cartState.items.length) {
        if (newQty > 0) {
          cartState.items[index].qty = newQty;
        } else {
          cartState.items.splice(index, 1);
        }
        saveCart();
      }
    },
    
    remove: function (index) {
      if (index >= 0 && index < cartState.items.length) {
        cartState.items.splice(index, 1);
        saveCart();
      }
    },
    
    getItems: function () {
      return [...cartState.items];
    },
    
    getSubtotal: function () {
      return cartState.subtotal;
    },
    
    clear: function () {
      cartState.items = [];
      saveCart();
    },

    openDrawer: function () {
      const drawer = document.getElementById('cart-drawer');
      const overlay = document.getElementById('cart-overlay');
      if (drawer) drawer.classList.add('open');
      if (overlay) overlay.classList.add('open');
    },
    
    closeDrawer: function () {
      const drawer = document.getElementById('cart-drawer');
      const overlay = document.getElementById('cart-overlay');
      if (drawer) drawer.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
    }
  };

  // 4. Cart Drawer Renderer
  function renderCartDrawer() {
    const badge = document.getElementById('cart-badge-nav');
    const body = document.querySelector('.cart-drawer-body');
    const subtotalEl = document.querySelector('.cart-subtotal strong');
    const footer = document.querySelector('.cart-drawer-footer');

    const items = window.HanazCart.getItems();
    const subtotal = window.HanazCart.getSubtotal();
    const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

    if (badge) {
      badge.textContent = totalQty;
      badge.style.display = totalQty > 0 ? 'flex' : 'none';
    }

    if (subtotalEl) {
      subtotalEl.textContent = 'Rs. ' + subtotal.toLocaleString();
    }

    if (!body) return;

    if (items.length === 0) {
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
      items.forEach((item, index) => {
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
          <div class="cart-subtotal"><span>Subtotal</span><strong>Rs. ${subtotal.toLocaleString()}</strong></div>
          <p class="cart-note">Shipping & taxes calculated at checkout</p>
          <a href="checkout.html" class="btn btn-primary btn-block" style="margin-bottom:var(--space-sm);">Check out</a>
          <button class="btn btn-secondary btn-block" id="cart-continue-btn">Continue Shopping</button>
        `;
        document.getElementById('cart-continue-btn').addEventListener('click', () => {
          window.HanazCart.closeDrawer();
        });
      }

      // Bind cart row events
      body.querySelectorAll('.qty-stepper button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.index);
          const action = e.target.dataset.action;
          const currentItem = window.HanazCart.getItems()[idx];
          
          if (action === 'plus') {
            window.HanazCart.updateQty(idx, currentItem.qty + 1);
          } else {
            if (currentItem.qty > 1) {
              window.HanazCart.updateQty(idx, currentItem.qty - 1);
            }
          }
        });
      });

      body.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.index);
          window.HanazCart.remove(idx);
        });
      });
    }
  }

  // Render on initial load and on every update
  document.addEventListener('DOMContentLoaded', renderCartDrawer);
  window.addEventListener('hanazCartUpdated', renderCartDrawer);

})();
