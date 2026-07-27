document.addEventListener('DOMContentLoaded', () => {
  // 0. Save to Recently Viewed
  try {
    let recentlyViewed = JSON.parse(localStorage.getItem('hanazRecentlyViewed')) || [];
    const currentProduct = {
      id: 'hanaz-vit-c-serum',
      name: 'Hanaz Vitamin C Serum',
      price: 1599,
      image: 'images/vitamin-c-serum.png',
      link: 'product-detail.html'
    };
    
    // Remove if already exists so we can bump it to the front
    recentlyViewed = recentlyViewed.filter(p => p.id !== currentProduct.id);
    recentlyViewed.unshift(currentProduct);
    
    // Keep max 4 items
    if (recentlyViewed.length > 4) {
      recentlyViewed.pop();
    }
    
    localStorage.setItem('hanazRecentlyViewed', JSON.stringify(recentlyViewed));
  } catch (e) {
    console.error("Could not save recently viewed", e);
  }

  // 1. Thumbnail Image Swap
  const mainImage = document.getElementById('main-product-image');
  const thumbnails = document.querySelectorAll('.thumbnail');

  thumbnails.forEach(thumb => {
    thumb.addEventListener('click', () => {
      // Remove active class from all
      thumbnails.forEach(t => t.classList.remove('active'));
      // Add active class to clicked
      thumb.classList.add('active');
      // Swap image
      const newSrc = thumb.querySelector('img').src;
      mainImage.style.opacity = 0;
      setTimeout(() => {
        mainImage.src = newSrc;
        mainImage.style.opacity = 1;
      }, 150);
    });
  });

  // 2. Quantity Selector
  const qtyInput = document.getElementById('qty-input');
  const btnMinus = document.getElementById('qty-minus');
  const btnPlus = document.getElementById('qty-plus');

  btnMinus.addEventListener('click', () => {
    let val = parseInt(qtyInput.value) || 1;
    if (val > 1) qtyInput.value = val - 1;
  });

  btnPlus.addEventListener('click', () => {
    let val = parseInt(qtyInput.value) || 1;
    qtyInput.value = val + 1;
  });

  qtyInput.addEventListener('change', () => {
    let val = parseInt(qtyInput.value);
    if (isNaN(val) || val < 1) qtyInput.value = 1;
  });

  // 3. Add to Cart
  const btnAddCart = document.getElementById('btn-add-cart');
  btnAddCart.addEventListener('click', () => {
    const qty = parseInt(qtyInput.value) || 1;
    const product = {
      id: 'hanaz-vit-c-serum',
      name: 'Hanaz Vitamin C Serum',
      price: 1599,
      image: 'images/vitamin-c-serum.png',
      quantity: qty
    };

    if (window.HanazCart && window.HanazCart.add) {
      window.HanazCart.add(product);
      // Open cart drawer if method available, else rely on main.js toast
      if (window.HanazCart.refresh) {
        document.querySelector('.cart-drawer').classList.add('active');
        document.querySelector('.cart-overlay').classList.add('active');
        document.body.classList.add('drawer-open');
      }
    } else {
      console.error("Cart system not loaded");
    }
  });

  // 4. Accordions
  const accordions = document.querySelectorAll('.accordion-item');
  accordions.forEach(acc => {
    const header = acc.querySelector('.accordion-header');
    header.addEventListener('click', () => {
      // Toggle current
      acc.classList.toggle('active');
    });
  });

  // 5. Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active to current
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // 6. Review Form Stars
  const reviewStars = document.querySelectorAll('.star-rating-select svg');
  let currentRating = 0;
  
  reviewStars.forEach(star => {
    star.addEventListener('mouseover', function() {
      const val = parseInt(this.getAttribute('data-val'));
      highlightStars(val);
    });
    
    star.addEventListener('mouseout', function() {
      highlightStars(currentRating);
    });
    
    star.addEventListener('click', function() {
      currentRating = parseInt(this.getAttribute('data-val'));
      highlightStars(currentRating);
    });
  });

  function highlightStars(val) {
    reviewStars.forEach(s => {
      const sVal = parseInt(s.getAttribute('data-val'));
      if (sVal <= val) {
        s.style.fill = '#fbbf24';
        s.style.color = '#fbbf24';
      } else {
        s.style.fill = 'none';
        s.style.color = '#e5e7eb';
      }
    });
  }
});
