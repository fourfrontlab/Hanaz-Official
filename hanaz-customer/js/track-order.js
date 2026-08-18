document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('track-form');
  const errorMsg = document.getElementById('track-error');
  const resultDiv = document.getElementById('track-result');
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

    if (!orderNumber || !phone) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Looking up...';
    errorMsg.style.display = 'none';

    try {
      // 1. Fetch Order Details via RPC
      const { data: orderData, error: orderError } = await window.supabase.rpc('get_order_by_number_and_phone', {
        p_order_number: orderNumber,
        p_phone: phone
      });

      if (orderError) throw orderError;
      
      // If no data returned from RPC (or empty array)
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
      resultDiv.style.display = 'block';

    } catch (err) {
      console.error('Tracking Error:', err);
      errorMsg.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Track Order';
    }
  });

});

// Exposed function to reset the UI state
window.resetTracking = function() {
  document.getElementById('track-result').style.display = 'none';
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
