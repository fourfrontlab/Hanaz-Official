/* ==========================================================================
   HANAZ OFFICIAL — Products Page JavaScript
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. VIEW TOGGLE — switch grid columns
     ======================================================================== */
  function initViewToggles() {
    var toggles = document.querySelectorAll('.view-toggle-btn');
    var grid    = document.querySelector('.products-grid');

    if (!toggles.length || !grid) return;

    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.dataset.view;

        toggles.forEach(function (t) { t.classList.remove('active'); });
        btn.classList.add('active');

        grid.className = 'products-grid view-' + view;

        // Save preference
        localStorage.setItem('hanazProductView', view);
      });
    });

    // Restore saved view
    var saved = localStorage.getItem('hanazProductView');
    if (saved) {
      var savedBtn = document.querySelector('.view-toggle-btn[data-view="' + saved + '"]');
      if (savedBtn) savedBtn.click();
    }
  }

  /* ========================================================================
     2. SORT DROPDOWN
     ======================================================================== */
  function initSort() {
    var select = document.getElementById('sort-select');
    if (!select) return;

    select.addEventListener('change', function () {
      // For a static page with 1 product, sorting is a no-op.
      // In production, this would trigger a re-render or page reload.
      var value = select.value;
      console.log('Sort by:', value);
    });
  }

  /* ========================================================================
     3. FILTER SIDEBAR — toggle groups
     ======================================================================== */
  function initFilterGroups() {
    var titles = document.querySelectorAll('.filter-group-title');

    titles.forEach(function (title) {
      title.addEventListener('click', function () {
        var group = title.closest('.filter-group');
        var body  = group.querySelector('.filter-group-body');

        if (group.classList.contains('collapsed')) {
          group.classList.remove('collapsed');
          body.style.maxHeight = body.scrollHeight + 'px';
        } else {
          group.classList.add('collapsed');
          body.style.maxHeight = '0';
        }
      });

      // Set initial max-height for open groups
      var group = title.closest('.filter-group');
      var body  = group.querySelector('.filter-group-body');
      if (!group.classList.contains('collapsed') && body) {
        body.style.maxHeight = body.scrollHeight + 'px';
      }
    });
  }

  /* ========================================================================
     4. MOBILE FILTER DRAWER
     ======================================================================== */
  function initFilterDrawer() {
    var toggleBtn = document.getElementById('filter-toggle-btn');
    var overlay   = document.getElementById('filter-drawer-overlay');
    var drawer    = document.getElementById('filter-drawer');
    var closeBtn  = document.getElementById('filter-drawer-close');
    var applyBtn  = document.getElementById('filter-apply-btn');

    if (!toggleBtn || !drawer) return;

    function open() {
      if (overlay) overlay.classList.add('active');
      drawer.classList.add('active');
      document.body.classList.add('drawer-open');
    }

    function close() {
      if (overlay) overlay.classList.remove('active');
      drawer.classList.remove('active');
      document.body.classList.remove('drawer-open');
    }

    toggleBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay)  overlay.addEventListener('click', close);
    if (applyBtn) applyBtn.addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('active')) close();
    });
  }

  /* ========================================================================
     5. PRICE RANGE FILTER
     ======================================================================== */
  function initPriceFilter() {
    var filterBtn = document.getElementById('btn-filter-price');
    if (!filterBtn) return;

    filterBtn.addEventListener('click', function () {
      var fromInput = document.getElementById('price-from');
      var toInput   = document.getElementById('price-to');

      var from = parseFloat(fromInput ? fromInput.value : 0) || 0;
      var to   = parseFloat(toInput ? toInput.value : Infinity) || Infinity;

      // Filter products by price range
      var cards = document.querySelectorAll('.product-card');
      cards.forEach(function (card) {
        var priceEl = card.querySelector('.price-sale');
        if (!priceEl) return;

        var price = parseFloat(priceEl.textContent.replace(/[^0-9.]/g, ''));
        if (price >= from && price <= to) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });

      if (typeof window.HanazToast === 'function') {
        window.HanazToast('Price filter applied', 'info');
      }
    });
  }

  /* ========================================================================
     6. WISHLIST TOGGLE
     ======================================================================== */
  function initWishlistButtons() {
    var buttons = document.querySelectorAll('.product-wishlist');

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.toggle('active');

        if (btn.classList.contains('active')) {
          if (typeof window.HanazToast === 'function') {
            window.HanazToast('Added to wishlist ❤️', 'success');
          }
        } else {
          if (typeof window.HanazToast === 'function') {
            window.HanazToast('Removed from wishlist', 'info');
          }
        }
      });
    });
  }

  /* ========================================================================
     7. QUICK ADD — expand mini selector, add to cart
     ======================================================================== */
  function initQuickAdd() {
    var quickAddBtns = document.querySelectorAll('.btn-quick-add');

    quickAddBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var card     = btn.closest('.product-card');
        var footer   = card.querySelector('.product-card-footer');
        var expanded = card.querySelector('.quick-add-expanded');

        if (!expanded) return;

        // Hide the Quick Add button, show expanded
        btn.style.display = 'none';
        expanded.classList.add('active');
      });
    });

    // Qty buttons within quick add
    document.querySelectorAll('.quick-add-expanded').forEach(function (expanded) {
      var minusBtn   = expanded.querySelector('.qa-minus');
      var plusBtn    = expanded.querySelector('.qa-plus');
      var qtyDisplay = expanded.querySelector('.qa-qty');
      var confirmBtn = expanded.querySelector('.btn-confirm-add');
      var card       = expanded.closest('.product-card');
      var quickBtn   = card.querySelector('.btn-quick-add');

      var qty = 1;

      if (minusBtn) {
        minusBtn.addEventListener('click', function () {
          if (qty > 1) { qty--; qtyDisplay.textContent = qty; }
        });
      }

      if (plusBtn) {
        plusBtn.addEventListener('click', function () {
          if (qty < 10) { qty++; qtyDisplay.textContent = qty; }
        });
      }

      if (confirmBtn) {
        confirmBtn.addEventListener('click', function () {
          var productId   = card.dataset.productId || 'hanaz-vitamin-c-serum';
          var productName = card.querySelector('.product-card-name a') ?
                            card.querySelector('.product-card-name a').textContent : 'Product';
          var priceEl     = card.querySelector('.price-sale');
          var price       = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) : 0;
          var imgEl       = card.querySelector('.product-card-image img');
          var image       = imgEl ? imgEl.src : '';

          if (typeof window.HanazCart !== 'undefined' && typeof window.HanazCart.add === 'function') {
            window.HanazCart.add({
              id: productId,
              name: productName,
              price: price,
              image: image,
              qty: qty
            });

            if (typeof window.HanazCart.open === 'function') {
              window.HanazCart.open();
            }
          }

          // Reset
          qty = 1;
          qtyDisplay.textContent = '1';
          expanded.classList.remove('active');
          if (quickBtn) quickBtn.style.display = '';
        });
      }
    });
  }

  /* ========================================================================
     8. RECENTLY VIEWED — read from localStorage
     ======================================================================== */
  function initRecentlyViewed() {
    var container = document.getElementById('recently-viewed-scroll');
    var section   = document.getElementById('recently-viewed-section');
    if (!container || !section) return;

    var items = [];
    try {
      items = JSON.parse(localStorage.getItem('hanazRecentlyViewed')) || [];
    } catch (e) {
      items = [];
    }

    if (items.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';

    container.innerHTML = items.map(function (item) {
      return '<a href="' + (item.url || 'product-detail.html') + '" class="recently-viewed-card">' +
        '<div class="product-card-image">' +
          (item.image ? '<img src="' + item.image + '" alt="' + (item.name || 'Product') + '">' : '') +
        '</div>' +
        '<h4>' + (item.name || 'Product') + '</h4>' +
        '<span class="price-sale">Rs. ' + (item.price ? item.price.toLocaleString() : '0') + '</span>' +
      '</a>';
    }).join('');
  }

  /**
   * Add a product to recently viewed (called from product-detail page).
   * @param {{ id: string, name: string, price: number, image: string, url: string }} product
   */
  function addToRecentlyViewed(product) {
    var items = [];
    try {
      items = JSON.parse(localStorage.getItem('hanazRecentlyViewed')) || [];
    } catch (e) {
      items = [];
    }

    // Remove if already exists
    items = items.filter(function (item) { return item.id !== product.id; });

    // Add to front
    items.unshift(product);

    // Keep only last 10
    if (items.length > 10) items = items.slice(0, 10);

    localStorage.setItem('hanazRecentlyViewed', JSON.stringify(items));
  }

  // Expose globally
  window.HanazRecentlyViewed = { add: addToRecentlyViewed };

  /* ========================================================================
     INIT
     ======================================================================== */
  function init() {
    initViewToggles();
    initSort();
    initFilterGroups();
    initFilterDrawer();
    initPriceFilter();
    initWishlistButtons();
    initQuickAdd();
    initRecentlyViewed();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
