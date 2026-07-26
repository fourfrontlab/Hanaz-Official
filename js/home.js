/* ==========================================================================
   HANAZ OFFICIAL — Home Page JavaScript
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. COUNTDOWN TIMER — 7 days from now
     ======================================================================== */
  function initCountdown() {
    const daysEl   = document.getElementById('cd-days');
    const hoursEl  = document.getElementById('cd-hours');
    const minsEl   = document.getElementById('cd-mins');
    const secsEl   = document.getElementById('cd-secs');

    if (!daysEl || !hoursEl || !minsEl || !secsEl) return;

    // 7 days from now
    const target = new Date();
    target.setDate(target.getDate() + 7);

    // Use the global countdown utility from main.js
    if (typeof window.HanazCountdown === 'function') {
      window.HanazCountdown(target, function (t) {
        daysEl.textContent  = String(t.days).padStart(2, '0');
        hoursEl.textContent = String(t.hours).padStart(2, '0');
        minsEl.textContent  = String(t.mins).padStart(2, '0');
        secsEl.textContent  = String(t.secs).padStart(2, '0');
      });
    }
  }

  /* ========================================================================
     2. PRODUCT THUMBNAIL SWITCHING
     ======================================================================== */
  function initThumbnails() {
    const mainImage  = document.getElementById('quickbuy-main-img');
    const thumbs     = document.querySelectorAll('.quickbuy-thumb');

    if (!mainImage || !thumbs.length) return;

    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        // Update active state
        thumbs.forEach(function (t) { t.classList.remove('active'); });
        thumb.classList.add('active');

        // Swap main image
        var img = thumb.querySelector('img');
        if (img) {
          mainImage.style.opacity = '0';
          setTimeout(function () {
            mainImage.src = img.src;
            mainImage.alt = img.alt;
            mainImage.style.opacity = '1';
          }, 200);
        }
      });
    });
  }

  /* ========================================================================
     3. QUANTITY SELECTOR
     ======================================================================== */
  function initQtySelector() {
    var qtyValue = document.getElementById('qty-value');
    var qtyMinus = document.getElementById('qty-minus');
    var qtyPlus  = document.getElementById('qty-plus');

    if (!qtyValue || !qtyMinus || !qtyPlus) return;

    var qty = 1;

    qtyMinus.addEventListener('click', function () {
      if (qty > 1) {
        qty--;
        qtyValue.textContent = qty;
      }
    });

    qtyPlus.addEventListener('click', function () {
      if (qty < 10) {
        qty++;
        qtyValue.textContent = qty;
      }
    });

    // Expose getter for add-to-cart
    window._getQty = function () { return qty; };
  }

  /* ========================================================================
     4. ADD TO CART (Featured Product)
     ======================================================================== */
  function initAddToCart() {
    var addBtn = document.getElementById('btn-add-featured');
    if (!addBtn) return;

    addBtn.addEventListener('click', function () {
      var qty = typeof window._getQty === 'function' ? window._getQty() : 1;

      if (typeof window.HanazCart !== 'undefined' && typeof window.HanazCart.add === 'function') {
        window.HanazCart.add({
          id: 'hanaz-vitamin-c-serum',
          name: 'Hanaz Vitamin C Serum',
          price: 1599,
          image: 'images/vitamin-c-serum.png',
          variant: '30ml',
          qty: qty
        });

        // Open cart drawer
        if (typeof window.HanazCart.open === 'function') {
          window.HanazCart.open();
        }
      }
    });
  }

  /* ========================================================================
     5. ACCORDION TOGGLE
     ======================================================================== */
  function initAccordions() {
    var headers = document.querySelectorAll('.accordion-header');

    headers.forEach(function (header) {
      header.addEventListener('click', function () {
        var accordion = header.closest('.accordion');
        var body      = accordion.querySelector('.accordion-body');
        var inner     = accordion.querySelector('.accordion-body-inner');

        if (accordion.classList.contains('active')) {
          accordion.classList.remove('active');
          body.style.maxHeight = '0';
        } else {
          // Close any other open accordions in the same container
          var siblings = accordion.parentElement.querySelectorAll('.accordion');
          siblings.forEach(function (sib) {
            sib.classList.remove('active');
            sib.querySelector('.accordion-body').style.maxHeight = '0';
          });

          accordion.classList.add('active');
          body.style.maxHeight = inner.scrollHeight + 'px';
        }
      });
    });
  }

  /* ========================================================================
     6. REVIEWS CAROUSEL
     ======================================================================== */
  function initReviewsCarousel() {
    var track     = document.querySelector('.reviews-track');
    var cards     = document.querySelectorAll('.review-card');
    var prevBtn   = document.getElementById('reviews-prev');
    var nextBtn   = document.getElementById('reviews-next');
    var dotsWrap  = document.querySelector('.carousel-dots');

    if (!track || cards.length === 0) return;

    var currentIndex = 0;
    var autoPlayInterval;
    var cardsPerView = getCardsPerView();

    function getCardsPerView() {
      if (window.innerWidth <= 768) return 1;
      if (window.innerWidth <= 1024) return 2;
      return 3;
    }

    var totalSlides = Math.ceil(cards.length / cardsPerView);

    // Build dots
    function buildDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      cardsPerView = getCardsPerView();
      totalSlides = Math.ceil(cards.length / cardsPerView);

      for (var i = 0; i < totalSlides; i++) {
        var dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === currentIndex ? ' active' : '');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.dataset.index = i;
        dot.addEventListener('click', function () {
          goTo(parseInt(this.dataset.index));
        });
        dotsWrap.appendChild(dot);
      }
    }

    function goTo(index) {
      cardsPerView = getCardsPerView();
      totalSlides = Math.ceil(cards.length / cardsPerView);

      if (index < 0) index = totalSlides - 1;
      if (index >= totalSlides) index = 0;

      currentIndex = index;

      // Calculate offset: each card has margin 0 8px, so effective width includes margins
      var cardEl = cards[0];
      var cardWidth = cardEl.offsetWidth + 16; // 8px margin on each side
      var offset = currentIndex * cardsPerView * cardWidth;

      track.style.transform = 'translateX(-' + offset + 'px)';

      // Update dots
      if (dotsWrap) {
        dotsWrap.querySelectorAll('.carousel-dot').forEach(function (d, i) {
          d.classList.toggle('active', i === currentIndex);
        });
      }
    }

    function next() { goTo(currentIndex + 1); }
    function prev() { goTo(currentIndex - 1); }

    if (prevBtn) prevBtn.addEventListener('click', function () { prev(); resetAutoPlay(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { next(); resetAutoPlay(); });

    // Auto-play every 4 seconds
    function startAutoPlay() {
      autoPlayInterval = setInterval(next, 4000);
    }

    function resetAutoPlay() {
      clearInterval(autoPlayInterval);
      startAutoPlay();
    }

    // Pause on hover
    track.addEventListener('mouseenter', function () { clearInterval(autoPlayInterval); });
    track.addEventListener('mouseleave', function () { startAutoPlay(); });

    // Handle resize
    var resizeTimeout;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function () {
        var newPerView = getCardsPerView();
        if (newPerView !== cardsPerView) {
          cardsPerView = newPerView;
          currentIndex = 0;
          buildDots();
          goTo(0);
        }
      }, 200);
    });

    buildDots();
    startAutoPlay();
  }

  /* ========================================================================
     7. SKIN QUIZ — Multi-Step
     ======================================================================== */
  function initSkinQuiz() {
    var startBtn   = document.getElementById('quiz-start-btn');
    var container  = document.getElementById('quiz-container');
    var introEl    = document.getElementById('quiz-intro');
    var steps      = document.querySelectorAll('.quiz-step');
    var progressFill = document.querySelector('.quiz-progress-fill');
    var progressText = document.getElementById('quiz-progress-text');
    var resultEl   = document.getElementById('quiz-result');
    var retakeBtn  = document.getElementById('quiz-retake');

    if (!startBtn || !container) return;

    var currentStep = 0;
    var answers = {};
    var totalSteps = steps.length;

    // Start Quiz
    startBtn.addEventListener('click', function () {
      introEl.style.display = 'none';
      container.classList.add('active');
      showStep(0);
    });

    // Option clicks
    container.querySelectorAll('.quiz-option').forEach(function (option) {
      option.addEventListener('click', function () {
        var step = option.closest('.quiz-step');
        var stepIndex = parseInt(step.dataset.step);

        // Mark selected
        step.querySelectorAll('.quiz-option').forEach(function (o) { o.classList.remove('selected'); });
        option.classList.add('selected');

        // Save answer
        answers[stepIndex] = option.dataset.value;

        // Auto-advance after brief delay
        setTimeout(function () {
          if (stepIndex < totalSteps - 1) {
            showStep(stepIndex + 1);
          } else {
            showResult();
          }
        }, 400);
      });
    });

    // Back buttons
    container.querySelectorAll('.quiz-back').forEach(function (backBtn) {
      backBtn.addEventListener('click', function () {
        if (currentStep > 0) {
          showStep(currentStep - 1);
        }
      });
    });

    // Retake
    if (retakeBtn) {
      retakeBtn.addEventListener('click', function () {
        answers = {};
        resultEl.classList.remove('active');
        steps.forEach(function (s) {
          s.querySelectorAll('.quiz-option').forEach(function (o) { o.classList.remove('selected'); });
        });
        showStep(0);
      });
    }

    function showStep(index) {
      currentStep = index;
      steps.forEach(function (s) { s.classList.remove('active'); });
      if (resultEl) resultEl.classList.remove('active');

      steps[index].classList.add('active');

      // Update progress
      var progress = ((index + 1) / totalSteps) * 100;
      if (progressFill) progressFill.style.width = progress + '%';
      if (progressText) progressText.textContent = 'Step ' + (index + 1) + ' of ' + totalSteps;
    }

    function showResult() {
      steps.forEach(function (s) { s.classList.remove('active'); });
      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = 'Complete!';
      if (resultEl) resultEl.classList.add('active');
    }
  }

  /* ========================================================================
     8. SKIN CONCERN TABS
     ======================================================================== */
  function initTreatmentTabs() {
    var tabs   = document.querySelectorAll('.treatment-tab');
    var panels = document.querySelectorAll('.treatment-panel');

    if (!tabs.length || !panels.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.dataset.tab;

        tabs.forEach(function (t) { t.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('active'); });

        tab.classList.add('active');
        var panel = document.getElementById('panel-' + target);
        if (panel) panel.classList.add('active');

        // Re-initialize before/after sliders in the new panel
        initBeforeAfterSliders();
      });
    });
  }

  /* ========================================================================
     9. BEFORE / AFTER IMAGE SLIDER
     ======================================================================== */
  function initBeforeAfterSliders() {
    var sliders = document.querySelectorAll('.ba-slider-container');

    sliders.forEach(function (slider) {
      // Skip if already initialized and active
      if (slider.dataset.initialized && slider.closest('.treatment-panel.active')) return;

      var beforeImg = slider.querySelector('.ba-image-before');
      var divider   = slider.querySelector('.ba-divider');
      var handle    = slider.querySelector('.ba-divider-handle');
      var isDragging = false;

      function updateSlider(x) {
        var rect = slider.getBoundingClientRect();
        var percent = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));

        if (beforeImg) beforeImg.style.clipPath = 'inset(0 ' + (100 - percent) + '% 0 0)';
        if (divider)   divider.style.left = percent + '%';
        if (handle)    handle.style.left  = percent + '%';
      }

      slider.addEventListener('mousedown', function (e) {
        isDragging = true;
        updateSlider(e.clientX);
        e.preventDefault();
      });

      document.addEventListener('mousemove', function (e) {
        if (isDragging) updateSlider(e.clientX);
      });

      document.addEventListener('mouseup', function () {
        isDragging = false;
      });

      // Touch events
      slider.addEventListener('touchstart', function (e) {
        isDragging = true;
        updateSlider(e.touches[0].clientX);
      }, { passive: true });

      slider.addEventListener('touchmove', function (e) {
        if (isDragging) updateSlider(e.touches[0].clientX);
      }, { passive: true });

      slider.addEventListener('touchend', function () {
        isDragging = false;
      });

      slider.dataset.initialized = 'true';
    });
  }

  /* ========================================================================
     10. QUIZ RESULT — ADD TO CART
     ======================================================================== */
  function initQuizAddToCart() {
    var btn = document.getElementById('quiz-add-cart');
    if (!btn) return;

    btn.addEventListener('click', function () {
      if (typeof window.HanazCart !== 'undefined' && typeof window.HanazCart.add === 'function') {
        window.HanazCart.add({
          id: 'hanaz-vitamin-c-serum',
          name: 'Hanaz Vitamin C Serum',
          price: 1599,
          image: 'images/vitamin-c-serum.png',
          variant: '30ml',
          qty: 1
        });

        if (typeof window.HanazCart.open === 'function') {
          window.HanazCart.open();
        }
      }
    });
  }

  /* ========================================================================
     INIT — Run all home page features
     ======================================================================== */
  function init() {
    initCountdown();
    initThumbnails();
    initQtySelector();
    initAddToCart();
    initAccordions();
    initReviewsCarousel();
    initSkinQuiz();
    initTreatmentTabs();
    initBeforeAfterSliders();
    initQuizAddToCart();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
