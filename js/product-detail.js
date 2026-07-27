/* ==========================================================================
   PRODUCT DETAIL PAGE JS
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. THUMBNAIL GALLERY
     ======================================================================== */
  function initGallery() {
    const mainImg = document.getElementById('main-product-image');
    const thumbs = document.querySelectorAll('.pdp-thumb');
    
    if (!mainImg || !thumbs.length) return;

    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        thumbs.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        
        const imgSrc = thumb.querySelector('img').src;
        
        mainImg.style.opacity = '0';
        setTimeout(() => {
          mainImg.src = imgSrc;
          mainImg.style.opacity = '1';
        }, 200);
      });
    });
  }

  /* ========================================================================
     2. QUANTITY STEPPER
     ======================================================================== */
  let currentQty = 1;
  function initQty() {
    const valEl = document.getElementById('qty-value');
    const btnMinus = document.getElementById('qty-minus');
    const btnPlus = document.getElementById('qty-plus');

    if (!valEl || !btnMinus || !btnPlus) return;

    function updateVal() {
      valEl.style.opacity = '0';
      setTimeout(() => {
        valEl.textContent = currentQty;
        valEl.style.opacity = '1';
      }, 150);
    }

    btnMinus.addEventListener('click', () => {
      if (currentQty > 1) {
        currentQty--;
        updateVal();
      }
    });

    btnPlus.addEventListener('click', () => {
      if (currentQty < 10) {
        currentQty++;
        updateVal();
      }
    });
  }

  /* ========================================================================
     3. ADD TO CART
     ======================================================================== */
  function initAddToCart() {
    const btn = document.getElementById('btn-add-cart');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (window.HanazCart && window.HanazCart.add) {
        window.HanazCart.add({
          id: 'hanaz-vitamin-c-serum',
          name: 'Hanaz Vitamin C Serum',
          price: 1599,
          image: 'images/vitamin-c-serum.png',
          qty: currentQty
        });
      }
    });
  }

  /* ========================================================================
     4. ACCORDIONS
     ======================================================================== */
  function initAccordions() {
    const headers = document.querySelectorAll('.accordion-header');
    
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const acc = header.closest('.accordion');
        const body = acc.querySelector('.accordion-body');
        const inner = acc.querySelector('.accordion-inner');

        if (acc.classList.contains('active')) {
          acc.classList.remove('active');
          body.style.maxHeight = '0';
        } else {
          // Close others
          const group = acc.closest('.accordion-group');
          if (group) {
            group.querySelectorAll('.accordion').forEach(other => {
              other.classList.remove('active');
              other.querySelector('.accordion-body').style.maxHeight = '0';
            });
          }
          acc.classList.add('active');
          body.style.maxHeight = inner.scrollHeight + 'px';
        }
      });
    });
  }

  /* ========================================================================
     5. TABS
     ======================================================================== */
  function initTabs() {
    const tabs = document.querySelectorAll('.pdp-tab');
    const panels = document.querySelectorAll('.pdp-tab-content');
    const underline = document.querySelector('.pdp-tab-underline');
    
    if (!tabs.length || !underline) return;

    function updateUnderline(tab) {
      const rect = tab.getBoundingClientRect();
      const containerRect = tab.parentElement.getBoundingClientRect();
      underline.style.width = `${rect.width}px`;
      underline.style.transform = `translateX(${rect.left - containerRect.left}px)`;
    }

    updateUnderline(document.querySelector('.pdp-tab.active'));
    window.addEventListener('resize', () => {
      const active = document.querySelector('.pdp-tab.active');
      if (active) updateUnderline(active);
    });

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        const target = document.getElementById('tab-' + tab.dataset.target);
        if (target) target.classList.add('active');
        
        updateUnderline(tab);
      });
    });
  }

  /* ========================================================================
     6. RECENTLY VIEWED STORAGE
     ======================================================================== */
  function saveRecentlyViewed() {
    try {
      let viewed = localStorage.getItem('hanazRecentlyViewed');
      viewed = viewed ? JSON.parse(viewed) : [];
      
      const item = {
        id: 'hanaz-vitamin-c-serum',
        name: 'Hanaz Vitamin C Serum',
        price: 1599,
        image: 'images/vitamin-c-serum.png',
        link: 'product-detail.html'
      };

      viewed = viewed.filter(i => i.id !== item.id);
      viewed.unshift(item);
      if (viewed.length > 4) viewed.pop();
      
      localStorage.setItem('hanazRecentlyViewed', JSON.stringify(viewed));
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    initGallery();
    initQty();
    initAddToCart();
    initAccordions();
    initTabs();
    saveRecentlyViewed();
  });

})();
