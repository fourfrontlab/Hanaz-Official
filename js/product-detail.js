/* ==========================================================================
   PRODUCT DETAIL PAGE — JS
   ========================================================================== */
(function () {
  'use strict';

  const mainImg  = document.getElementById('main-product-image');
  const thumbs   = document.querySelectorAll('.pdp-thumb');
  const qtyMinus = document.getElementById('qty-minus');
  const qtyPlus  = document.getElementById('qty-plus');
  const qtyValue = document.getElementById('qty-value');
  const addBtn   = document.getElementById('btn-add-cart');
  const tabBtns  = document.querySelectorAll('.pdp-tab-btn');
  const tabContents = document.querySelectorAll('.pdp-tab-content');

  let qty = 1;

  /* Thumbnail switching */
  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      const src = thumb.querySelector('img').src;
      if (mainImg) {
        mainImg.style.opacity = '0';
        setTimeout(() => {
          mainImg.src = src;
          mainImg.style.opacity = '1';
        }, 200);
      }
    });
  });

  /* Quantity */
  if (qtyMinus) {
    qtyMinus.addEventListener('click', () => {
      if (qty > 1) {
        qty--;
        qtyValue.textContent = qty;
      }
    });
  }

  if (qtyPlus) {
    qtyPlus.addEventListener('click', () => {
      if (qty < 10) {
        qty++;
        qtyValue.textContent = qty;
      }
    });
  }

  /* Add to Cart */
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (window.HanazCart) {
        window.HanazCart.add({
          id: 'hanaz-vitamin-c-serum',
          name: 'Vitamin C Serum',
          price: 1599,
          image: 'images/vitamin-c-serum.png',
          qty: qty
        });
      }
    });
  }

  /* Tabs */
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  /* Track recently viewed */
  function trackRecentlyViewed() {
    const item = {
      id: 'hanaz-vitamin-c-serum',
      name: 'Vitamin C Serum',
      price: 1599,
      image: 'images/vitamin-c-serum.png',
      link: 'product-detail.html'
    };

    let recent = [];
    try {
      recent = JSON.parse(localStorage.getItem('hanazRecentlyViewed')) || [];
    } catch (e) {}

    recent = recent.filter(r => r.id !== item.id);
    recent.unshift(item);
    if (recent.length > 6) recent = recent.slice(0, 6);
    localStorage.setItem('hanazRecentlyViewed', JSON.stringify(recent));
  }

  trackRecentlyViewed();
})();
