/* ==========================================================================
   GLOBAL JS — "The Ordinary" spec
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. TOAST NOTIFICATIONS — defined in cart.js (loads first via defer order)
     ======================================================================== */

  /* ========================================================================
     3. UI INTERACTIONS
     ======================================================================== */
  function initUI() {
    // Nav shrink on scroll
    const navbar = document.getElementById('navbar');
    if (navbar) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
          navbar.classList.add('scrolled');
        } else {
          navbar.classList.remove('scrolled');
        }
      }, { passive: true });
    }

    // Active nav underline
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .mobile-nav-links a').forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPath || (currentPath === '' && href === 'index.html')) {
        link.classList.add('active');
      }
    });

    const cartToggleBtns = document.querySelectorAll('[data-open-cart]');
    
    cartToggleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.HanazCart) window.HanazCart.openDrawer();
      });
    });

    const cartCloseBtns = document.querySelectorAll('.cart-close-btn');
    const cartOverlay = document.getElementById('cart-overlay');

    cartCloseBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.HanazCart) window.HanazCart.closeDrawer();
      });
    });

    if (cartOverlay) {
      cartOverlay.addEventListener('click', () => {
        if (window.HanazCart) window.HanazCart.closeDrawer();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && window.HanazCart) {
        window.HanazCart.closeDrawer();
      }
    });    // Mobile Nav Toggle
    const mobileBtn = document.getElementById('hamburger-btn');
    const mobileClose = document.getElementById('mobile-nav-close');
    const mobileOverlay = document.getElementById('mobile-nav-overlay');
    const mobileDrawer = document.getElementById('mobile-nav-drawer');

    if (mobileBtn && mobileDrawer && mobileOverlay && mobileClose) {
      mobileBtn.addEventListener('click', () => {
        mobileDrawer.classList.add('open');
        mobileOverlay.classList.add('open');
      });
      mobileClose.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
        mobileOverlay.classList.remove('open');
      });
      mobileOverlay.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
        mobileOverlay.classList.remove('open');
      });
    }

    // Scroll Fade In Observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Footer Newsletter
    const footerForm = document.getElementById('footer-newsletter-form');
    if (footerForm) {
      footerForm.addEventListener('submit', async (e) => {
        e.preventDefault();if(footerForm.dataset.submitting==='true'||!footerForm.reportValidity())return;
        footerForm.dataset.submitting='true';const btn=footerForm.querySelector('button');if(btn)btn.disabled=true;
        let status=footerForm.querySelector('.form-status');if(!status){status=document.createElement('p');status.className='form-status';status.setAttribute('role','status');footerForm.appendChild(status);}
        status.textContent='Submitting…';
        try{const request={kind:'newsletter',email:footerForm.querySelector('input[type=email]').value};const key=await window.HanazTracking.requestKey('newsletter',request);const result=await window.HanazTracking.submit('lead',request,key);try{window.HanazTracking.confirmed(result);}catch{}window.HanazTracking.clearRequest('newsletter');status.textContent='Your subscription request has been received.';footerForm.reset();}
        catch(err){status.textContent=err.message||'Unable to save your request. Please retry.';}
        finally{footerForm.dataset.submitting='false';if(btn)btn.disabled=false;}
      });
    }
  }

  /* ========================================================================
     4. WISHLIST LOGIC
     ======================================================================== */
  window.initWishlist = function() {
    const btns = document.querySelectorAll('.wishlist-btn');
    if (!btns.length) return;

    let wishlist = [];
    try {
      const stored = localStorage.getItem('hanazWishlist');
      if (stored) wishlist = JSON.parse(stored);
    } catch (e) {}

    btns.forEach(btn => {
      const id = btn.dataset.productId;
      if (wishlist.includes(id)) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (btn.classList.contains('active')) {
          btn.classList.remove('active');
          wishlist = wishlist.filter(item => item !== id);
        } else {
          btn.classList.add('active');
          if (!wishlist.includes(id)) wishlist.push(id);
        }
        
        localStorage.setItem('hanazWishlist', JSON.stringify(wishlist));
      });
    });
  }

  /* ========================================================================
     5. SEARCH LOGIC
     ======================================================================== */
  function initSearch() {
    const searchHTML = `
      <div class="overlay" id="search-overlay" style="z-index: 1999; transition: opacity 0.3s ease;"></div>
      <div class="search-modal" id="search-modal" style="position:fixed; top:0; left:0; width:100%; padding: var(--space-lg) 0; background:var(--bg-primary, #fff); z-index:2000; transform:translateY(-100%); transition:transform 0.3s ease; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div class="container" style="position:relative; display:flex; flex-direction:column; align-items:center;">
          <form id="search-form" style="display:flex; align-items:center; width:100%; border-bottom:2px solid var(--border); padding-bottom:8px; position:relative;">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--text-muted)" stroke-width="2" fill="none" style="margin-right:12px; flex-shrink:0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" name="q" placeholder="Search for products, categories..." style="flex:1; border:none; background:transparent; font-size:1.1rem; outline:none; font-family:inherit; color:var(--text-heading);" autocomplete="off" required>
            <button type="button" id="search-close" style="background:none; border:none; cursor:pointer; color:var(--text-heading); display:flex; align-items:center; justify-content:center; padding:8px; margin-left:12px; flex-shrink:0;"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </form>
          <div id="search-results-dropdown" style="width:100%; max-height:60vh; overflow-y:auto; background:var(--bg-primary, #fff); margin-top:16px; display:none; flex-direction:column; gap:12px; padding-bottom:12px;"></div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', searchHTML);

    const searchOverlay = document.getElementById('search-overlay');
    const searchModal = document.getElementById('search-modal');
    const searchBtns = document.querySelectorAll('.nav-icon-btn[aria-label="Search"]');
    const searchClose = document.getElementById('search-close');
    const searchForm = document.getElementById('search-form');
    const searchInput = searchForm.querySelector('input');
    const searchResultsDropdown = document.getElementById('search-results-dropdown');

    function openSearch() {
      searchOverlay.classList.add('active');
      searchModal.style.transform = 'translateY(0)';
      setTimeout(() => searchInput.focus(), 300);
    }

    function closeSearch() {
      searchOverlay.classList.remove('active');
      searchModal.style.transform = 'translateY(-100%)';
      setTimeout(() => {
        searchInput.value = '';
        searchResultsDropdown.style.display = 'none';
        searchResultsDropdown.innerHTML = '';
      }, 300);
    }

    searchBtns.forEach(btn => btn.addEventListener('click', (e) => {
      e.preventDefault();
      openSearch();
    }));
    searchClose.addEventListener('click', closeSearch);
    searchOverlay.addEventListener('click', closeSearch);

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(searchTimeout);
      
      if (!q) {
        searchResultsDropdown.style.display = 'none';
        searchResultsDropdown.innerHTML = '';
        return;
      }
      
      searchResultsDropdown.style.display = 'flex';
      searchResultsDropdown.innerHTML = '<div style="padding:16px; color:var(--text-muted); text-align:center;">Searching...</div>';
      
      searchTimeout = setTimeout(async () => {
        try {
          if (!window.supabase) throw new Error('Supabase client not loaded');
          
          const { data, error } = await supabase
            .from('products')
            .select('id, title, image_urls, sale_price, base_price, category, size')
            .or(`title.ilike.%${q}%,category.ilike.%${q}%,benefit.ilike.%${q}%`)
            .eq('in_stock', true)
            .limit(5);
            
          if (error) throw error;
          
          if (!data || data.length === 0) {
            searchResultsDropdown.innerHTML = '<div style="padding:16px; color:var(--text-muted); text-align:center;">No products found for "' + q + '"</div>';
            return;
          }
          
          let html = '';
          data.forEach(p => {
            let imgUrl = 'images/placeholder.jpg';
            if (p.image_urls) {
               if (Array.isArray(p.image_urls) && p.image_urls.length > 0) imgUrl = p.image_urls[0];
               else if (typeof p.image_urls === 'string' && p.image_urls.startsWith('[')) {
                 try { const parsed = JSON.parse(p.image_urls); if (parsed.length>0) imgUrl = parsed[0]; } catch(e){}
               }
            }
            const pdpLink = p.id === '0aa58f95-83d6-45f6-a7f3-2c1ed3b3ac39' ? 'pdp-face-wash.html' : 'pdp-vitamin-c.html';
            html += `
              <a href="${pdpLink}?id=${p.id}" style="display:flex; align-items:center; gap:16px; padding:12px; border-radius:8px; transition:background 0.2s; text-decoration:none;" onmouseover="this.style.background='rgba(0,0,0,0.03)'" onmouseout="this.style.background='transparent'">
                <img src="${imgUrl}" alt="${p.title}" style="width:60px; height:60px; object-fit:cover; border-radius:6px; background:var(--bg-secondary);">
                <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                  <span style="font-weight:600; color:var(--text-heading); font-size:1rem;">${p.title}</span>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:600; color:var(--text-heading);">Rs. ${p.sale_price.toLocaleString()}</span>
                    ${p.base_price > p.sale_price ? `<span style="text-decoration:line-through; color:var(--text-muted); font-size:0.9rem;">Rs. ${p.base_price.toLocaleString()}</span>` : ''}
                  </div>
                </div>
              </a>
            `;
          });
          
          html += `
            <a href="products.html?q=${encodeURIComponent(q)}" style="margin-top:8px; padding:12px; text-align:center; color:var(--text-heading); font-weight:500; border-top:1px solid var(--border); text-decoration:underline;">
              View all results
            </a>
          `;
          searchResultsDropdown.innerHTML = html;
        } catch (err) {
          console.error('Search error:', err);
          searchResultsDropdown.innerHTML = '<div style="padding:16px; color:var(--text-muted); text-align:center;">Error searching products. Please try again.</div>';
        }
      }, 300);
    });

    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      if (q) {
        window.location.href = `products.html?q=${encodeURIComponent(q)}`;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {

    initUI();
    window.initWishlist();
    initSearch();
  });

})();
