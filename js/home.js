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

  /* ========================================================================
     5. VIDEO CAROUSEL
     Replicates The Ordinary's horizontal video showcase:
     - CSS scroll-snap for native-feeling snapping
     - IntersectionObserver to detect the centred card
     - Only the centred card autoplays (muted by browser policy)
     - Mute/unmute per-card toggle
     - Mouse drag + touch swipe
     - Prev/Next arrows + dot indicators
     - Chevron expand/collapse for card descriptions
     ======================================================================== */
  function initVideoCarousel() {
    const outer  = document.getElementById('vc-outer');
    const track  = document.getElementById('vc-track');
    const originalCards = track ? Array.from(track.querySelectorAll('.vc-card')) : [];
    const dots   = document.querySelectorAll('[data-vc-dot]');
    const prevBtn = document.getElementById('vc-prev');
    const nextBtn = document.getElementById('vc-next');

    if (!track || !originalCards.length) return;

    const numCards = originalCards.length;

    // 1. Clone cards for infinite loop
    originalCards.forEach(c => {
        const preClone = c.cloneNode(true);
        preClone.dataset.clone = 'true';
        track.insertBefore(preClone, originalCards[0]);
    });
    originalCards.forEach(c => {
        const postClone = c.cloneNode(true);
        postClone.dataset.clone = 'true';
        track.appendChild(postClone);
    });

    const allCards = Array.from(track.querySelectorAll('.vc-card'));

    // 2. Setup variables
    let currentDomIndex = numCards; // Starts at first real card
    let activeRealIndex = 0;
    let isPointerDown = false;
    let dragStartX = 0;
    let dragStartScroll = 0;

    // 3. Helpers
    function getCardWidth() {
      return allCards[0].offsetWidth;
    }
    function getGap() {
      return 16;
    }

    // Scroll to a specific DOM index smoothly (for arrows/dots)
    function scrollToDomIndex(domIndex, animated = true) {
      if (domIndex < 0 || domIndex >= allCards.length) return;
      const card = allCards[domIndex];
      // Target scroll positions the card's center at the track's center
      const targetScroll = card.offsetLeft + (card.offsetWidth / 2) - (track.clientWidth / 2);

      track.style.scrollBehavior = animated ? 'smooth' : 'auto';
      track.scrollLeft = targetScroll;
      
      if (animated) {
          setTimeout(() => { track.style.scrollBehavior = 'auto'; }, 500);
      }
    }

    // Initialize position without animation
    setTimeout(() => {
        track.style.scrollBehavior = 'auto';
        scrollToDomIndex(currentDomIndex, false);
        updateActiveCard();
    }, 100);

    // 4. Update active card (Play/Pause)
    function updateActiveCard() {
      const trackCenter = track.scrollLeft + (track.clientWidth / 2);

      // Find the card whose center is closest to trackCenter
      let closestIdx = 0;
      let minDiff = Infinity;

      allCards.forEach((card, idx) => {
        const cardCenter = card.offsetLeft + (card.offsetWidth / 2);
        const diff = Math.abs(cardCenter - trackCenter);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      if (currentDomIndex !== closestIdx) {
        currentDomIndex = closestIdx;
      }
      
      const realIndex = parseInt(allCards[closestIdx].dataset.index, 10);

      // Play/Pause logic
      allCards.forEach((card, i) => {
        const video = card.querySelector('.vc-video');
        const isCurrentlyActive = (i === closestIdx);
        
        card.classList.toggle('is-active', isCurrentlyActive);

        if (!video) return;

        if (isCurrentlyActive) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {});
          }
        } else {
          video.pause();
          video.currentTime = 0;
        }
      });

      if (activeRealIndex !== realIndex) {
        activeRealIndex = realIndex;
        // Update dots
        dots.forEach((dot, i) => {
          dot.classList.toggle('active', i === activeRealIndex);
          dot.setAttribute('aria-selected', i === activeRealIndex ? 'true' : 'false');
        });
      }
    }

    // 5. Infinite scroll jump logic
    function handleScroll() {
      const blockWidth = numCards * (getCardWidth() + getGap());
      const maxScroll = track.scrollWidth - track.clientWidth;
      
      // If screen is extremely wide (wider than 2 full blocks), looping is visually unsafe
      if (maxScroll <= blockWidth) return;
      
      // Center the jump window in the available scroll range
      const leftThreshold = (maxScroll - blockWidth) / 2;
      const rightThreshold = leftThreshold + blockWidth;
      
      if (track.scrollLeft < leftThreshold) {
        track.style.scrollBehavior = 'auto';
        track.scrollLeft += blockWidth;
      } else if (track.scrollLeft > rightThreshold) {
        track.style.scrollBehavior = 'auto';
        track.scrollLeft -= blockWidth;
      }
    }

    let scrollTimeout;
    track.addEventListener('scroll', () => {
      handleScroll();
      
      // Debounce video play/pause to prevent thrashing
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        updateActiveCard();
      }, 50);
    });

    // 6. Navigation
    prevBtn && prevBtn.addEventListener('click', () => {
      scrollToDomIndex(currentDomIndex - 1);
    });

    nextBtn && nextBtn.addEventListener('click', () => {
      scrollToDomIndex(currentDomIndex + 1);
    });

    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const targetReal = parseInt(dot.dataset.vcDot, 10);
        scrollToDomIndex(numCards + targetReal);
      });
    });

    let isDragging = false;

    // 7. Event Delegation for Mute & Chevron (handles clones seamlessly)
    track.addEventListener('click', (e) => {
      // Prevent click if dragging
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const muteBtn = e.target.closest('.vc-mute-btn');
      if (muteBtn) {
        e.stopPropagation();
        const card = muteBtn.closest('.vc-card');
        const video = card.querySelector('.vc-video');
        if (video) {
          // Toggle global mute state based on this video's current state
          const newMutedState = !video.muted;
          const isMutedStr = newMutedState ? 'true' : 'false';
          const ariaLabel = newMutedState ? 'Unmute' : 'Mute';
          
          // Sync ALL videos in the carousel to match the new state
          allCards.forEach(c => {
             const v = c.querySelector('.vc-video');
             const btn = c.querySelector('.vc-mute-btn');
             if (v) v.muted = newMutedState;
             if (btn) {
                 btn.dataset.muted = isMutedStr;
                 btn.setAttribute('aria-label', ariaLabel);
             }
          });
          
          // If the clicked card is not active, scroll it to the center so it plays
          if (!card.classList.contains('is-active')) {
              const domIdx = allCards.indexOf(card);
              scrollToDomIndex(domIdx);
          }
        }
      }

      const chevronBtn = e.target.closest('.vc-chevron-btn');
      if (chevronBtn) {
        e.stopPropagation();
        const card = chevronBtn.closest('.vc-card');
        const expand = card.querySelector('.vc-card-expand');
        if (expand) {
          const isOpen = expand.classList.toggle('open');
          const expandedStr = isOpen ? 'true' : 'false';
          
          // Sync all clones
          const realIdx = card.dataset.index;
          allCards.forEach(c => {
             if (c.dataset.index === realIdx) {
                 const exp = c.querySelector('.vc-card-expand');
                 const btn = c.querySelector('.vc-chevron-btn');
                 if (isOpen) {
                     exp.classList.add('open');
                 } else {
                     exp.classList.remove('open');
                 }
                 btn.setAttribute('aria-expanded', expandedStr);
             }
          });
        }
      }
    });

    // 8. Mouse drag
    track.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.vc-mute-btn') || e.target.closest('.vc-chevron-btn')) return;
      isPointerDown = true;
      isDragging = false; // Reset on down
      dragStartX = e.clientX;
      dragStartScroll = track.scrollLeft;
      track.classList.add('dragging');
      track.setPointerCapture(e.pointerId);
    });

    track.addEventListener('pointermove', (e) => {
      if (!isPointerDown) return;
      e.preventDefault();
      const dx = e.clientX - dragStartX;
      if (Math.abs(dx) > 5) {
        isDragging = true; // Mark as dragging
      }
      track.style.scrollBehavior = 'auto';
      track.scrollLeft = dragStartScroll - dx;
    });

    function endDrag() {
      if (!isPointerDown) return;
      isPointerDown = false;
      track.classList.remove('dragging');
      
      // Snap to nearest card
      const trackCenter = track.scrollLeft + (track.clientWidth / 2);
      
      let closestIdx = 0;
      let minDiff = Infinity;
      allCards.forEach((card, idx) => {
        const cardCenter = card.offsetLeft + (card.offsetWidth / 2);
        const diff = Math.abs(cardCenter - trackCenter);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      
      scrollToDomIndex(closestIdx);
    }

    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeroCarousel();
    initQuiz();
    initSliders();
    initTabs();
    initVideoCarousel();
  });

})();
