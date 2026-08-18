document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('track-form');
  const errorMsg = document.getElementById('track-error');
  const resultDiv = document.getElementById('track-result');
  const listResultDiv = document.getElementById('track-list-result');
  const submitBtn = document.getElementById('track-submit-btn');

  // Check URL params for pre-filled order number
  const urlParams = new URLSearchParams(window.location.search);
  const orderParam = urlParams.get('order');
  if (orderParam) {
    document.getElementById('track-order-number').value = orderParam;
  }

  // Handle Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const orderNumber = document.getElementById('track-order-number').value.trim();
    const phone = document.getElementById('track-phone').value.trim();

    if (!phone) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Looking up...';
    errorMsg.style.display = 'none';

    try {
      if (orderNumber) {
        await doExactLookup(orderNumber, phone);
      } else {
        await doPhoneOnlyLookup(phone);
      }
    } catch (err) {
      console.error('Tracking Error:', err);
      errorMsg.textContent = err.message === 'Not found' ? 
        (orderNumber ? "We couldn't find an order matching those details. Please check your order number and phone number." : "No orders found for this phone number.") : 
        "An error occurred while looking up your order. Please try again later.";
      errorMsg.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Track Order';
    }
  });

  async function doExactLookup(orderNumber, phone) {
    // 1. Fetch Order Details via RPC
    const { data: orderData, error: orderError } = await window.supabase.rpc('get_order_by_number_and_phone', {
      p_order_number: orderNumber,
      p_phone: phone
    });

    if (orderError) throw orderError;
    
    if (!orderData || orderData.length === 0) {
      throw new Error('Not found');
    }

    const order = orderData[0];

    // 2. Fetch Order Items via RPC
    const { data: itemsData, error: itemsError } = await window.supabase.rpc('get_order_items_by_number_and_phone', {
      p_order_number: orderNumber,
      p_phone: phone
    });

    if (itemsError) throw itemsError;

    // Update UI with Order Data
    document.getElementById('res-order-number').textContent = `Order ${order.order_number}`;
    
    const statusBadge = document.getElementById('res-status');
    statusBadge.textContent = order.status;
    statusBadge.className = 'status-badge ' + order.status.toLowerCase();
    
    document.getElementById('res-date').textContent = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    document.getElementById('res-total').textContent = `Rs. ${order.total_amount.toLocaleString()}`;
    document.getElementById('res-courier').textContent = order.courier || 'Pending';
    document.getElementById('res-tracking').textContent = order.tracking_number || 'Pending';

    // Update UI with Items
    const itemsContainer = document.getElementById('res-items');
    if (itemsData && itemsData.length > 0) {
      itemsContainer.innerHTML = itemsData.map(item => `
        <div class="order-item-row">
          <div>
            <div class="order-item-title">${item.title_snapshot}</div>
            <div class="order-item-qty">Qty: ${item.qty}</div>
          </div>
          <div class="order-item-price">Rs. ${(item.price_at_order * item.qty).toLocaleString()}</div>
        </div>
      `).join('');
    } else {
      itemsContainer.innerHTML = '<p>No items found.</p>';
    }

    // Show Result
    form.style.display = 'none';
    listResultDiv.style.display = 'none';
    resultDiv.style.display = 'block';
  }

  async function doPhoneOnlyLookup(phone) {
    const { data: ordersData, error } = await window.supabase.rpc('get_orders_by_phone', {
      p_phone: phone
    });

    if (error) throw error;

    if (!ordersData || ordersData.length === 0) {
      throw new Error('Not found');
    }

    const listContainer = document.getElementById('res-orders-list');
    listContainer.innerHTML = ordersData.map(order => `
      <div class="order-list-item" onclick="triggerExactLookup('${order.order_number}', '${phone}')" style="cursor:pointer; border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; transition: border-color 0.2s;">
        <div>
          <h4 style="margin: 0 0 4px 0; font-size: 16px;">Order ${order.order_number}</h4>
          <div style="font-size: 14px; color: var(--text-muted);">
            ${new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} 
            &bull; Rs. ${order.total_amount.toLocaleString()}
          </div>
        </div>
        <div>
          <span class="status-badge ${order.status.toLowerCase()}">${order.status}</span>
        </div>
      </div>
    `).join('');

    // Show List Result
    form.style.display = 'none';
    resultDiv.style.display = 'none';
    listResultDiv.style.display = 'block';
  }

});

// Global helper for the onclick handler in the list view
window.triggerExactLookup = function(orderNumber, phone) {
  document.getElementById('track-order-number').value = orderNumber;
  document.getElementById('track-phone').value = phone;
  // Trigger form submission
  document.getElementById('track-submit-btn').click();
};

// Exposed function to reset the UI state
window.resetTracking = function() {
  document.getElementById('track-result').style.display = 'none';
  document.getElementById('track-list-result').style.display = 'none';
  document.getElementById('track-form').style.display = 'block';
  document.getElementById('track-form').reset();
  document.getElementById('track-error').style.display = 'none';
  
  // Clear URL params without reloading
  if (window.history.replaceState) {
    const url = new URL(window.location);
    url.searchParams.delete('order');
    window.history.replaceState({path:url.href}, '', url.href);
  }
};
