/* ==========================================================================
   PRODUCT DETAIL PAGE JS
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. THUMBNAIL GALLERY
     ======================================================================== */
  let galleryEventDelegationBound = false;

  function initGallery() {
    const mainImg = document.getElementById('main-product-image');
    const thumbs = document.querySelectorAll('.pdp-thumb');
    const dotsContainer = document.getElementById('pdp-gallery-dots');
    
    if (!mainImg || !thumbs.length) return;

    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      thumbs.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = `pdp-dot ${i === 0 ? 'active' : ''}`;
        dot.setAttribute('aria-label', `View image ${i + 1}`);
        dotsContainer.appendChild(dot);
      });
    }

    if (galleryEventDelegationBound) return;
    galleryEventDelegationBound = true;

    function goToImage(index) {
      const currentThumbs = document.querySelectorAll('.pdp-thumb');
      const currentDots = document.querySelectorAll('.pdp-dot');
      const currentMainImg = document.getElementById('main-product-image');
      
      if (!currentMainImg || !currentThumbs.length) return;
      if (index < 0 || index >= currentThumbs.length) return;
      
      currentThumbs.forEach((t, i) => {
        t.classList.toggle('active', i === index);
        t.setAttribute('aria-pressed', i === index ? 'true' : 'false');
      });
      
      currentDots.forEach((d, i) => d.classList.toggle('active', i === index));
      
      const imgSrc = currentThumbs[index].querySelector('img')?.src || currentThumbs[index].dataset.img;
      
      currentMainImg.style.opacity = '0';
      setTimeout(() => {
        currentMainImg.src = imgSrc;
        currentMainImg.style.opacity = '1';
      }, 200);
    }

    document.addEventListener('click', (e) => {
      const thumb = e.target.closest('.pdp-thumb');
      if (thumb) {
        const currentThumbs = Array.from(document.querySelectorAll('.pdp-thumb'));
        const index = currentThumbs.indexOf(thumb);
        if (index > -1) goToImage(index);
      }

      const dot = e.target.closest('.pdp-dot');
      if (dot) {
        const currentDots = Array.from(document.querySelectorAll('.pdp-dot'));
        const index = currentDots.indexOf(dot);
        if (index > -1) goToImage(index);
      }
    });

    let touchStartX = 0;
    let touchEndX = 0;
    const SWIPE_THRESHOLD = 50;

    document.addEventListener('touchstart', (e) => {
      if (e.target.closest('#pdp-main-wrap')) {
        touchStartX = e.changedTouches[0].screenX;
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (e.target.closest('#pdp-main-wrap')) {
        touchEndX = e.changedTouches[0].screenX;
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (e.target.closest('#pdp-main-wrap')) {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if (Math.abs(diff) > SWIPE_THRESHOLD) {
          const currentThumbs = document.querySelectorAll('.pdp-thumb');
          const activeThumb = document.querySelector('.pdp-thumb.active');
          let currentIndex = 0;
          if (activeThumb && currentThumbs.length) {
            currentIndex = Array.from(currentThumbs).indexOf(activeThumb);
          }
          if (diff < 0) {
            goToImage(Math.min(currentIndex + 1, currentThumbs.length - 1));
          } else {
            goToImage(Math.max(currentIndex - 1, 0));
          }
        }
      }
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

    if (!valEl || !btnMinus || !btnPlus || btnPlus.dataset.qtyBound) return;
    btnPlus.dataset.qtyBound = "true";

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
        const titleEl = document.getElementById('pdp-title');
        const name = titleEl ? titleEl.textContent : 'Hanaz Vitamin C Serum';
        
        const priceEl = document.getElementById('dynamic-sale-price');
        let price = 1300;
        if (priceEl) {
          const parsed = parseInt(priceEl.textContent.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(parsed)) price = parsed;
        }

        const mainImgEl = document.getElementById('main-product-image');
        const image = mainImgEl ? mainImgEl.getAttribute('src') : 'images/vitamin-c-serum.jpg';
        
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id') || 'hanaz-vitamin-c-serum';

        window.HanazCart.add({
          id: id,
          name: name,
          price: price,
          image: image,
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
      if (header.dataset.accordionBound) return;
      header.dataset.accordionBound = "true";
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
      
      const titleEl = document.querySelector('h1');
      const priceEl = document.querySelector('.pdp-sale-price');
      const imgEl = document.getElementById('main-product-image');
      
      if (!titleEl || !priceEl || !imgEl) return;

      const priceText = priceEl.textContent.replace(/[^0-9]/g, '');
      const priceVal = parseInt(priceText, 10) || 0;
      
      let pageUrl = window.location.pathname.split('/').pop() + window.location.search;
      
      const item = {
        id: pageUrl,
        name: titleEl.textContent.trim(),
        price: priceVal,
        image: imgEl.getAttribute('src'),
        link: pageUrl
      };

      viewed = viewed.filter(i => i.id !== item.id);
      viewed.unshift(item);
      if (viewed.length > 4) viewed.pop();
      
      localStorage.setItem('hanazRecentlyViewed', JSON.stringify(viewed));

      // ViewContent is emitted only after the authoritative product has rendered.
    } catch (e) {}
  }

  /* ========================================================================
     7. STICKY CART BAR
     ======================================================================== */
  function initStickyCart() {
    const stickyBar = document.getElementById('sticky-cart-bar');
    const mainSection = document.querySelector('.pdp-hero');
    
    if (!stickyBar || !mainSection) return;

    const observer = new IntersectionObserver((entries) => {
      // If the pdp-hero section is out of view (scrolled past it)
      if (!entries[0].isIntersecting && entries[0].boundingClientRect.top < 0) {
        stickyBar.classList.add('active');
      } else {
        stickyBar.classList.remove('active');
      }
    }, {
      root: null,
      threshold: 0
    });

    observer.observe(mainSection);
  }

  /* ========================================================================
     8. PDP FAQ ACCORDION
     ======================================================================== */
  function initPdpFaq() {
    const items = document.querySelectorAll('.pdp-faq-item');
    if (!items.length) return;

    items.forEach(item => {
      const trigger = item.querySelector('.pdp-faq-trigger');
      const panel = item.querySelector('.pdp-faq-panel');
      if (!trigger || !panel) return;

      trigger.addEventListener('click', () => {
        const isExpanded = trigger.getAttribute('aria-expanded') === 'true';

        // Close all items in the accordion group
        items.forEach(otherItem => {
          const otherTrigger = otherItem.querySelector('.pdp-faq-trigger');
          const otherPanel = otherItem.querySelector('.pdp-faq-panel');
          if (otherTrigger && otherPanel) {
            otherTrigger.setAttribute('aria-expanded', 'false');
            otherPanel.style.maxHeight = '0';
            otherPanel.setAttribute('hidden', '');
          }
        });

        // Toggle open if it wasn't open
        if (!isExpanded) {
          trigger.setAttribute('aria-expanded', 'true');
          panel.removeAttribute('hidden');
          // Allow reflow before setting maxHeight
          panel.style.maxHeight = panel.scrollHeight + 'px';
        }
      });
    });

    // Recalculate max-height on window resize for any open panel
    window.addEventListener('resize', () => {
      const activeTrigger = document.querySelector('.pdp-faq-trigger[aria-expanded="true"]');
      if (activeTrigger) {
        const activePanel = activeTrigger.closest('.pdp-faq-item')?.querySelector('.pdp-faq-panel');
        if (activePanel) {
          activePanel.style.maxHeight = activePanel.scrollHeight + 'px';
        }
      }
    });
  }

  /* ========================================================================
     9. MOBILE PRODUCT INFORMATION ACCORDION
     Targets .pdp-info-acc-item inside .pdp-mobile-info-accordion
     Completely separate from initAccordions() which handles .accordion-header
     Multiple sections can be open simultaneously (independent, not grouped)
     ======================================================================== */
  function initMobileInfoAccordion() {
    const items = document.querySelectorAll('.pdp-mobile-info-accordion .pdp-info-acc-item');
    if (!items.length) return;

    items.forEach(function(item, index) {
      const header = item.querySelector('.pdp-info-acc-header');
      const body = item.querySelector('.pdp-info-acc-body');
      const inner = item.querySelector('.pdp-info-acc-inner');
      const icon = item.querySelector('.pdp-info-acc-icon');

      if (!header || !body || !inner || header.dataset.pdpAccInit) return;
      header.dataset.pdpAccInit = 'true';

      // Default expand Description (first item or item marked open)
      if (item.classList.contains('pdp-info-acc-open') || index === 0) {
        item.classList.add('pdp-info-acc-open');
        header.setAttribute('aria-expanded', 'true');
        body.style.maxHeight = (inner.scrollHeight + 30) + 'px';
        if (icon) icon.textContent = '−';
      }

      header.addEventListener('click', function() {
        const isOpen = item.classList.contains('pdp-info-acc-open');

        if (isOpen) {
          // Close
          item.classList.remove('pdp-info-acc-open');
          header.setAttribute('aria-expanded', 'false');
          body.style.maxHeight = '0';
          if (icon) icon.textContent = '+';
        } else {
          // Open
          item.classList.add('pdp-info-acc-open');
          header.setAttribute('aria-expanded', 'true');
          body.style.maxHeight = (inner.scrollHeight + 30) + 'px';
          if (icon) icon.textContent = '−';
        }
      });
    });

    // Recalculate maxHeight on resize for open panels
    window.addEventListener('resize', function() {
      const openItems = document.querySelectorAll('.pdp-mobile-info-accordion .pdp-info-acc-item.pdp-info-acc-open');
      openItems.forEach(function(item) {
        const body = item.querySelector('.pdp-info-acc-body');
        const inner = item.querySelector('.pdp-info-acc-inner');
        if (body && inner) {
          body.style.maxHeight = inner.scrollHeight + 'px';
        }
      });
    });
  }

  function init() {
    initGallery();
    initQty();
    
    initAccordions();
    initTabs();
    saveRecentlyViewed();
    initStickyCart();
    initPdpFaq();
    initMobileInfoAccordion();
  }

  window.initPDP = init;


})();

