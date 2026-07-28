/* ==========================================================================
   HOME PAGE JS — "The Ordinary" spec
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. SKIN QUIZ
     ======================================================================== */
  function initQuiz() {
    const startBtn = document.getElementById('quiz-start');
    const retakeBtn = document.getElementById('quiz-retake');
    const intro = document.getElementById('quiz-intro');
    const steps = document.querySelectorAll('.quiz-step');
    const result = document.getElementById('quiz-result');
    if (!startBtn) return;

    let currentStep = 0;

    startBtn.addEventListener('click', () => {
      intro.classList.remove('active');
      intro.classList.add('done');
      steps[0].classList.add('active');
      currentStep = 0;
    });

    steps.forEach((step, index) => {
      const pills = step.querySelectorAll('.quiz-pill');
      pills.forEach(pill => {
        pill.addEventListener('click', () => {
          // Select visual
          pills.forEach(p => p.classList.remove('selected'));
          pill.classList.add('selected');

          // Auto advance
          setTimeout(() => {
            step.classList.remove('active');
            step.classList.add('done');
            
            if (index < steps.length - 1) {
              steps[index + 1].classList.add('active');
              currentStep = index + 1;
            } else {
              result.classList.add('active');
            }
          }, 300);
        });
      });
    });

    retakeBtn.addEventListener('click', () => {
      result.classList.remove('active');
      steps.forEach(s => {
        s.classList.remove('active');
        s.classList.remove('done');
        s.querySelectorAll('.quiz-pill').forEach(p => p.classList.remove('selected'));
      });
      intro.classList.remove('done');
      intro.classList.add('active');
    });
  }

  /* ========================================================================
     2. BEFORE/AFTER SLIDER (Draggable clip-path)
     ======================================================================== */
  function initSliders() {
    const sliders = document.querySelectorAll('.ba-slider');
    
    sliders.forEach(slider => {
      const beforeImg = slider.querySelector('.ba-before');
      const handle = slider.querySelector('.ba-handle');
      let isDragging = false;

      function updateSlider(x) {
        const rect = slider.getBoundingClientRect();
        let percent = ((x - rect.left) / rect.width) * 100;
        // Clamp
        percent = Math.max(0, Math.min(100, percent));
        
        beforeImg.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
        handle.style.left = `${percent}%`;
      }

      slider.addEventListener('pointerdown', (e) => {
        isDragging = true;
        updateSlider(e.clientX);
        slider.setPointerCapture(e.pointerId);
      });

      slider.addEventListener('pointermove', (e) => {
        if (isDragging) {
          updateSlider(e.clientX);
        }
      });

      slider.addEventListener('pointerup', (e) => {
        isDragging = false;
        slider.releasePointerCapture(e.pointerId);
      });
      
      slider.addEventListener('pointercancel', (e) => {
        isDragging = false;
      });
    });
  }

  /* ========================================================================
     3. TRANSFORM TABS
     ======================================================================== */
  function initTabs() {
    const tabs = document.querySelectorAll('.transform-tab');
    const panels = document.querySelectorAll('.transform-panel');
    const underline = document.querySelector('.transform-tab-underline');
    
    if (!tabs.length || !underline) return;

    function updateUnderline(tab) {
      const rect = tab.getBoundingClientRect();
      const containerRect = tab.parentElement.getBoundingClientRect();
      underline.style.width = `${rect.width}px`;
      underline.style.transform = `translateX(${rect.left - containerRect.left}px)`;
    }

    // Init underline
    updateUnderline(document.querySelector('.transform-tab.active'));
    window.addEventListener('resize', () => {
      const active = document.querySelector('.transform-tab.active');
      if (active) updateUnderline(active);
    });

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        const target = document.getElementById('tab-' + tab.dataset.tab);
        if (target) target.classList.add('active');
        
        updateUnderline(tab);
      });
    });
  }

  /* ========================================================================
     4. HERO CAROUSEL (crossfade, 6s auto-advance, pause on hover)
     ======================================================================== */
  function initHeroCarousel() {
    const carousel = document.getElementById('hero-carousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.hero-slide');
    const dots = carousel.querySelectorAll('.hero-dot');
    const prevBtn = document.getElementById('hero-prev');
    const nextBtn = document.getElementById('hero-next');
    const totalSlides = slides.length;

    let current = 0;
    let autoTimer = null;
    const INTERVAL = 6000; // 6 seconds

    function goTo(index) {
      // Wrap around
      if (index < 0) index = totalSlides - 1;
      if (index >= totalSlides) index = 0;

      // Deactivate current
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');

      // Activate new
      current = index;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
    }

    function nextSlide() {
      goTo(current + 1);
    }

    function prevSlide() {
      goTo(current - 1);
    }

    // Auto-advance
    function startAuto() {
      stopAuto();
      autoTimer = setInterval(nextSlide, INTERVAL);
    }

    function stopAuto() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    // Arrow buttons
    nextBtn.addEventListener('click', () => {
      nextSlide();
      startAuto(); // Reset timer on manual interaction
    });

    prevBtn.addEventListener('click', () => {
      prevSlide();
      startAuto();
    });

    // Dot buttons
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        goTo(parseInt(dot.dataset.dot, 10));
        startAuto();
      });
    });

    // Pause on hover, resume on leave
    carousel.addEventListener('mouseenter', stopAuto);
    carousel.addEventListener('mouseleave', startAuto);

    // Start auto-advance
    startAuto();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeroCarousel();
    initQuiz();
    initSliders();
    initTabs();
  });

})();
