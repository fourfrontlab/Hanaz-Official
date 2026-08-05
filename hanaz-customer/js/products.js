/* ==========================================================================
   PRODUCTS PAGE — JS
   ========================================================================== */
(function () {
  'use strict';

  /* Add to Cart buttons */
  document.querySelectorAll('.btn-add-to-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id    = btn.dataset.id;
      const name  = btn.dataset.name;
      const price = parseInt(btn.dataset.price, 10);
      const image = btn.dataset.image;

      if (window.HanazCart) {
        window.HanazCart.add({ id, name, price, image, qty: 1 });
      }
    });
  });

  /* Sort links */
  const sortLinks = document.querySelectorAll('.sort-link');
  const grid = document.getElementById('shop-grid');

  sortLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      sortLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const sortType = link.dataset.sort;
      const cards = [...grid.querySelectorAll('.shop-product-card')];

      cards.sort((a, b) => {
        const priceA = parseInt(a.dataset.price, 10);
        const priceB = parseInt(b.dataset.price, 10);
        const nameA  = (a.dataset.name || '').toLowerCase();
        const nameB  = (b.dataset.name || '').toLowerCase();

        switch (sortType) {
          case 'price-asc':  return priceA - priceB;
          case 'price-desc': return priceB - priceA;
          case 'name-asc':   return nameA.localeCompare(nameB);
          default:           return 0;
        }
      });

      cards.forEach(card => grid.appendChild(card));
    });
  });
})();
