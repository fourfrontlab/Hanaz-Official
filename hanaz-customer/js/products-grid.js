window.renderProductGrid = function(products, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; color:var(--text-muted); font-size:14px; text-align: center; padding: 40px;">No products found.</div>';
    return;
  }

  let html = '';
  products.forEach(product => {
    const imageUrlFront = product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : 'images/placeholder.jpg';
    const imageUrlBack = product.image_urls && product.image_urls.length > 1 ? product.image_urls[1] : imageUrlFront;
    const category = product.category || 'skincare';
    const title = product.title;
    const salePrice = product.sale_price || 0;
    const basePrice = product.base_price || 0;
    const isBestseller = product.is_bestseller;
    const discountPct = product.discount_pct;
    const benefit = product.benefit || '';
    const size = product.size || '30ml';
    const safeTitle = title.replace(/'/g, "\\'");

    let priceHtml = `<strong>Rs. ${salePrice.toLocaleString()}</strong>`;
    if (basePrice > salePrice) {
      priceHtml += ` <span class="price-strikethrough">Rs. ${basePrice.toLocaleString()}</span>`;
    }
    if (discountPct) {
      priceHtml += ` <span class="price-save">Save ${discountPct}%</span>`;
    }

    html += `
      <a href="product-detail.html?id=${product.id}" class="product-card" data-category="${category}">
        <div class="product-card-image hover-swap">
          <div class="icon-actions">
            <button class="icon-btn wishlist-btn" aria-label="Add to wishlist" data-product-id="${product.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <button class="icon-btn quickview-btn" aria-label="Quick view" onclick="event.preventDefault(); window.location.href='product-detail.html?id=${product.id}'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
          ${isBestseller ? '<span class="product-badge">Bestseller</span>' : ''}
          <img src="${imageUrlFront}" alt="${title}" class="img-front">
          <img src="${imageUrlBack}" alt="${title} Texture" class="img-back">
        </div>
        <div class="product-card-info">
          <h3>${title}</h3>
          <div class="product-rating">
            <span class="stars">★★★★★</span>
            <span class="rating-value">4.9</span>
          </div>
          <p class="product-benefit">${benefit}</p>
          <div class="size-chips">
            <span class="size-chip active">${size}</span>
          </div>
          <div class="price">
            ${priceHtml}
          </div>
          <button class="btn btn-primary btn-sm btn-add-cart" onclick="event.preventDefault(); window.HanazCart && window.HanazCart.add({id:'${product.id}',name:'${safeTitle}',price:${salePrice},image:'${imageUrlFront}',qty:1, cost_price:${product.cost_price}})">Add to Cart</button>
        </div>
      </a>
    `;
  });

  // Always keep the "Coming Soon" card at the end
  html += `
    <div class="product-card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg); text-align: center; padding: 40px; border: 1px dashed var(--border); min-height: 380px;">
      <svg viewBox="0 0 24 24" width="48" height="48" stroke="var(--text-muted)" stroke-width="1.5" fill="none" style="margin-bottom:16px;">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <h3 style="color:var(--text-heading); margin-bottom: 8px;">More Products Coming Soon</h3>
      <p style="color:var(--text-muted); font-size: 14px; max-width: 200px; margin: 0 auto;">We're formulating something special for your skin.</p>
    </div>
  `;

  container.innerHTML = html;

  // Re-attach wishlist functionality
  if (window.initWishlist) {
    window.initWishlist();
  }
};

