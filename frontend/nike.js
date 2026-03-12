// ===== STOCKPRO MAIN APP (nike.js) =====
const API_BASE = '';
let products = [], analytics = {}, currentUser = null;
let cameraStream = null;
let charts = {};

// ===== AUTH =====
function getToken() { return localStorage.getItem('token'); }
function checkAuth() {
  if (!getToken()) { window.location.href = 'login.html'; return false; }
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  currentUser = user;
  document.getElementById('welcomeName').textContent = user.name || 'User';
  document.getElementById('userAvatar').textContent = (user.name || 'U')[0].toUpperCase();
  document.getElementById('shopNameDisplay').textContent = user.shopName || 'My Shop';
  document.getElementById('set-name').value = user.name || '';
  document.getElementById('set-shop').value = user.shopName || '';
  document.getElementById('set-phone').value = user.phone || '';
  document.getElementById('set-email').value = user.email || '';
  document.getElementById('inv-shopname').textContent = user.shopName || 'My Shop';
  return true;
}
function logout() { localStorage.clear(); window.location.href = 'login.html'; }

// ===== API CALLS =====
async function api(method, url, data = null, isFormData = false) {
  try {
    const opts = {
      method,
      headers: { 'Authorization': `Bearer ${getToken()}` }
    };
    if (data) {
      if (isFormData) opts.body = data;
      else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(data); }
    }
    const res = await fetch(API_BASE + url, opts);
    const json = await res.json();
    if (res.status === 401) { logout(); return null; }
    return json;
  } catch (e) { showToast('Connection error: ' + e.message, 'error'); return null; }
}

// ===== TOAST =====
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  t.innerHTML = `${icons[type] || 'ℹ️'} ${msg}`;
  t.className = `toast show ${type}`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ===== NAVIGATION =====
const pageTitles = {
  dashboard: '🏠 Dashboard', stockgrid: '📦 Stock Grid', products: '🛍️ Products',
  categories: '🗂️ Categories', addproduct: '➕ Add Product', bookings: '📋 Bookings',
  returns: '🔄 Returns & RTO', analytics: '📊 Analytics', heatmap: '🔥 Heat Map',
  popular: '⭐ Popular Products', profit: '💰 Profit Calculator', qrgen: '🔲 QR Generator',
  scanner: '📷 Scanner', invoice: '🧾 Invoice', settings: '⚙️ Settings'
};
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');
  const nav = document.querySelector(`[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[page] || page;
  // Close sidebar on mobile/tablet after navigation
  if (window.innerWidth < 1024) closeSidebar();
  // Trigger page-specific loads
  const loaders = {
    dashboard: loadDashboard, stockgrid: loadStockGrid, products: loadProducts,
    categories: loadCategories, bookings: loadBookings, returns: loadReturns,
    analytics: loadAnalytics, heatmap: loadHeatmap, popular: loadPopular,
    qrgen: loadQRPage, invoice: () => generateInvoice('daily'),
    settings: () => {}
  };
  if (loaders[page]) loaders[page]();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const mainWrap = document.querySelector('.main-wrap');
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    if (window.innerWidth >= 1024) mainWrap.classList.remove('sidebar-open');
  } else {
    sidebar.classList.add('open');
    if (window.innerWidth < 1024) overlay.classList.add('show'); // blur only on mobile
    if (window.innerWidth >= 1024) mainWrap.classList.add('sidebar-open');
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
  if (window.innerWidth >= 1024) {
    // keep it open on desktop — only close on mobile
  }
}

// ===== MODAL =====
function openModal(id) {
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById(id).classList.add('show');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
}

// ===== LOAD PRODUCTS =====
async function loadProducts() {
  const res = await api('GET', '/api/products');
  if (res?.success) {
    products = res.products;
    renderProductsTable(products);
    populateCategoryFilters();
    populateProductSelects();
  }
}

function renderProductsTable(data) {
  const body = document.getElementById('productsBody');
  if (!data.length) {
    body.innerHTML = '<tr><td colspan="14"><div class="empty-state"><i class="fas fa-boxes"></i><p>No products yet. Add your first product!</p></div></td></tr>';
    return;
  }
  body.innerHTML = data.map((p, i) => {
    const stock = p.currentStock;
    const stockClass = stock === 0 ? 'red' : stock <= p.minimumStock ? 'yellow' : 'green';
    const stockLabel = stock === 0 ? '❌ Out of Stock' : stock <= p.minimumStock ? '⚠️ Low' : '✅ ' + stock;
    const img = p.photo ?
      `<img src="${p.photo}" class="product-img" onerror="this.style.display='none'">` :
      `<div class="product-img-ph">📦</div>`;
    return `<tr>
      <td>${i + 1}</td>
      <td>${img}</td>
      <td><span class="style-badge">${p.styleId}</span></td>
      <td>${p.code}</td>
      <td>${p.itemName}</td>
      <td><span class="stock-badge" style="background:rgba(6,182,212,0.1);color:#67e8f9">${p.category}</span></td>
      <td>₹${p.costPrice || 0}</td>
      <td>₹${p.currentCustomerPrice}</td>
      <td>₹${p.updatedCustomerPrice || p.currentCustomerPrice}</td>
      <td>${p.percent || 0}%</td>
      <td>₹${p.deliveryFees || 0}</td>
      <td><span class="stock-badge ${stockClass}">${stockLabel}</span></td>
      <td>${p.totalSold}</td>
      <td><div class="action-btns">
        <button class="act-btn view" onclick='viewProduct("${p._id}")' title="View"><i class="fas fa-eye"></i></button>
        <button class="act-btn edit" onclick='editProduct("${p._id}")' title="Edit"><i class="fas fa-edit"></i></button>
        <button class="act-btn book" onclick='quickBook("${p._id}")' title="Add Booking"><i class="fas fa-cart-plus"></i></button>
        <button class="act-btn del" onclick='deleteProduct("${p._id}")' title="Delete"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}

function filterProducts() {
  const search = document.getElementById('prodSearch').value.toLowerCase();
  const cat = document.getElementById('prodCatFilter').value;
  const sort = document.getElementById('prodSort').value;
  let filtered = [...products];
  if (search) filtered = filtered.filter(p =>
    p.itemName.toLowerCase().includes(search) ||
    p.styleId.toLowerCase().includes(search) ||
    p.code.toLowerCase().includes(search)
  );
  if (cat !== 'all') filtered = filtered.filter(p => p.category === cat);
  if (sort === 'name') filtered.sort((a, b) => a.itemName.localeCompare(b.itemName));
  else if (sort === 'stock_asc') filtered.sort((a, b) => a.currentStock - b.currentStock);
  else if (sort === 'stock_desc') filtered.sort((a, b) => b.currentStock - a.currentStock);
  else if (sort === 'price') filtered.sort((a, b) => b.currentCustomerPrice - a.currentCustomerPrice);
  else if (sort === 'sold') filtered.sort((a, b) => b.totalSold - a.totalSold);
  else filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  renderProductsTable(filtered);
}

function globalSearchProducts(val) {
  if (!val) return;
  const filtered = products.filter(p =>
    p.itemName.toLowerCase().includes(val.toLowerCase()) ||
    p.styleId.toLowerCase().includes(val.toLowerCase())
  );
  showPage('products');
  renderProductsTable(filtered);
}

function populateCategoryFilters() {
  const cats = [...new Set(products.map(p => p.category))];
  const selects = ['prodCatFilter', 'gridCategoryFilter', 'catSuggestions'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'DATALIST') {
      el.innerHTML = cats.map(c => `<option value="${c}">`).join('');
    } else {
      el.innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  });
}

function populateProductSelects() {
  const sel = ['qrProductSelect', 'bk-product', 'ret-product'];
  sel.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<option value="">-- Select Product --</option>' +
      products.map(p => `<option value="${p._id}">${p.styleId} — ${p.itemName} (Stock: ${p.currentStock})</option>`).join('');
  });
}

// ===== VIEW PRODUCT =====
async function viewProduct(id) {
  const p = products.find(x => x._id === id);
  if (!p) return;
  document.getElementById('modalProductName').textContent = p.itemName;
  const profit = (p.updatedCustomerPrice || p.currentCustomerPrice) - (p.costPrice || 0) - (p.deliveryFees || 0) - (p.platformFees || 0);
  document.getElementById('modalContent').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        ${p.photo ? `<img src="${p.photo}" style="width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:14px">` : '<div style="width:100%;height:140px;background:var(--card2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:48px;margin-bottom:14px">📦</div>'}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <span class="style-badge">${p.styleId}</span>
          <span class="stock-badge ${p.currentStock===0?'red':p.currentStock<=p.minimumStock?'yellow':'green'}">${p.currentStock===0?'Out of Stock':p.currentStock+' in stock'}</span>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:4px">📦 Code: <b style="color:var(--text)">${p.code}</b></div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:4px">🏷️ Category: <b style="color:var(--text)">${p.category}</b></div>
        ${p.supplier?`<div style="font-size:12px;color:var(--text2)">🏭 Supplier: <b style="color:var(--text)">${p.supplier}</b></div>`:''}
      </div>
      <div>
        <h4 style="font-family:Syne,sans-serif;margin-bottom:12px">💰 Pricing</h4>
        <div class="profit-row"><span>Cost Price:</span><span>₹${p.costPrice||0}</span></div>
        <div class="profit-row"><span>Customer Price:</span><span>₹${p.currentCustomerPrice}</span></div>
        <div class="profit-row"><span>Updated Price:</span><span>₹${p.updatedCustomerPrice||p.currentCustomerPrice}</span></div>
        <div class="profit-row"><span>Delivery:</span><span class="red-text">-₹${p.deliveryFees||0}</span></div>
        <div class="profit-row"><span>Platform Fees:</span><span class="red-text">-₹${p.platformFees||0}</span></div>
        <div class="profit-row profit-total"><span>Net Profit:</span><span class="${profit>=0?'green-text':'red-text'}">₹${profit.toFixed(2)}</span></div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
          <div class="profit-row"><span>Total Sold:</span><span>${p.totalSold} units</span></div>
          <div class="profit-row"><span>Total Revenue:</span><span class="green-text">₹${p.totalRevenue.toFixed(2)}</span></div>
          <div class="profit-row"><span>Bookings:</span><span>${p.bookings?.length||0}</span></div>
          <div class="profit-row"><span>Returns:</span><span>${p.returns?.length||0}</span></div>
        </div>
      </div>
    </div>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn-accent" onclick='closeModal();editProduct("${p._id}")'><i class="fas fa-edit"></i> Edit</button>
      <button class="btn-green" onclick='closeModal();quickBook("${p._id}")'><i class="fas fa-cart-plus"></i> Book</button>
      <button class="btn-ghost" onclick='generateProductQR("${p._id}")'><i class="fas fa-qrcode"></i> QR Code</button>
    </div>
  `;
  openModal('productModal');
}

// ===== EDIT PRODUCT =====
function editProduct(id) {
  const p = products.find(x => x._id === id);
  if (!p) return;
  document.getElementById('editProductId').value = p._id;
  document.getElementById('styleId').value = p.styleId;
  document.getElementById('code').value = p.code;
  document.getElementById('itemName').value = p.itemName;
  document.getElementById('category').value = p.category;
  document.getElementById('supplier').value = p.supplier || '';
  document.getElementById('tags').value = (p.tags || []).join(', ');
  document.getElementById('costPrice').value = p.costPrice || 0;
  document.getElementById('currentCustomerPrice').value = p.currentCustomerPrice;
  document.getElementById('updatedCustomerPrice').value = p.updatedCustomerPrice || '';
  document.getElementById('percent').value = p.percent || 0;
  document.getElementById('deliveryFees').value = p.deliveryFees || 0;
  document.getElementById('platformFees').value = p.platformFees || 0;
  document.getElementById('currentStock').value = p.currentStock;
  document.getElementById('minimumStock').value = p.minimumStock || 5;
  if (p.photo) {
    document.getElementById('photoPreview').src = p.photo;
    document.getElementById('photoPreview').style.display = 'block';
    document.getElementById('photoPlaceholder').style.display = 'none';
  }
  document.getElementById('addEditTitle').textContent = '✏️ Edit Product';
  document.getElementById('addEditSub').textContent = `Editing: ${p.styleId} — ${p.itemName}`;
  document.getElementById('saveBtnText').textContent = 'Update Product';
  showPage('addproduct');
  calcProfit();
}

// ===== SAVE PRODUCT =====
async function saveProduct() {
  const editId = document.getElementById('editProductId').value;
  const styleId = document.getElementById('styleId').value.trim();
  const code = document.getElementById('code').value.trim();
  const itemName = document.getElementById('itemName').value.trim();
  const category = document.getElementById('category').value.trim();
  const currentCustomerPrice = document.getElementById('currentCustomerPrice').value;
  if (!styleId || !code || !itemName || !category || !currentCustomerPrice) {
    showToast('Please fill all required fields!', 'error'); return;
  }
  const fd = new FormData();
  fd.append('styleId', styleId);
  fd.append('code', code);
  fd.append('itemName', itemName);
  fd.append('category', category);
  fd.append('supplier', document.getElementById('supplier').value);
  fd.append('tags', document.getElementById('tags').value);
  fd.append('costPrice', document.getElementById('costPrice').value || 0);
  fd.append('currentCustomerPrice', currentCustomerPrice);
  fd.append('updatedCustomerPrice', document.getElementById('updatedCustomerPrice').value || '');
  fd.append('percent', document.getElementById('percent').value || 0);
  fd.append('deliveryFees', document.getElementById('deliveryFees').value || 0);
  fd.append('platformFees', document.getElementById('platformFees').value || 0);
  fd.append('currentStock', document.getElementById('currentStock').value || 0);
  fd.append('minimumStock', document.getElementById('minimumStock').value || 5);
  const photoFile = document.getElementById('productPhoto').files[0];
  if (photoFile) fd.append('photo', photoFile);
  document.getElementById('saveBtnText').textContent = 'Saving...';
  const url = editId ? `/api/products/${editId}` : '/api/products';
  const method = editId ? 'PUT' : 'POST';
  const res = await api(method, url, fd, true);
  document.getElementById('saveBtnText').textContent = editId ? 'Update Product' : 'Save Product';
  if (res?.success) {
    showToast(res.message, 'success');
    resetProductForm();
    await loadProducts();
    showPage('products');
  } else if (res) showToast(res.message, 'error');
}

function resetProductForm() {
  ['styleId','code','itemName','category','supplier','tags','costPrice','currentCustomerPrice','updatedCustomerPrice','percent','deliveryFees','platformFees','currentStock','minimumStock'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('minimumStock').value = 5;
  document.getElementById('editProductId').value = '';
  document.getElementById('photoPreview').style.display = 'none';
  document.getElementById('photoPlaceholder').style.display = 'block';
  document.getElementById('productPhoto').value = '';
  document.getElementById('addEditTitle').textContent = '➕ Add New Product';
  document.getElementById('addEditSub').textContent = 'Fill in the details below';
  document.getElementById('saveBtnText').textContent = 'Save Product';
  calcProfit();
}

function previewPhoto(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('photoPreview').src = e.target.result;
      document.getElementById('photoPreview').style.display = 'block';
      document.getElementById('photoPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
}

function calcProfit() {
  const sell = parseFloat(document.getElementById('updatedCustomerPrice').value || document.getElementById('currentCustomerPrice').value) || 0;
  const cost = parseFloat(document.getElementById('costPrice').value) || 0;
  const delivery = parseFloat(document.getElementById('deliveryFees').value) || 0;
  const platform = parseFloat(document.getElementById('platformFees').value) || 0;
  const deductions = cost + delivery + platform;
  const profit = sell - deductions;
  document.getElementById('pp-sell').textContent = `₹${sell.toFixed(2)}`;
  document.getElementById('pp-ded').textContent = `-₹${deductions.toFixed(2)}`;
  document.getElementById('pp-profit').textContent = `₹${profit.toFixed(2)}`;
  document.getElementById('pp-profit').style.color = profit >= 0 ? 'var(--green)' : 'var(--red)';
}

// ===== DELETE =====
async function deleteProduct(id) {
  const p = products.find(x => x._id === id);
  if (!confirm(`Delete "${p?.itemName}" (${p?.styleId})?\n\nThis action cannot be undone.`)) return;
  const res = await api('DELETE', `/api/products/${id}`);
  if (res?.success) { showToast(res.message, 'success'); await loadProducts(); }
  else if (res) showToast(res.message, 'error');
}

// ===== DASHBOARD =====
async function loadDashboard() {
  const res = await api('GET', '/api/products/analytics/summary');
  if (!res?.success) return;
  analytics = res;
  const s = res.summary;
  document.getElementById('stat-total').textContent = s.totalProducts;
  document.getElementById('stat-revenue').textContent = '₹' + formatNum(s.totalRevenue);
  document.getElementById('stat-outofstock').textContent = s.outOfStock;
  document.getElementById('stat-sold').textContent = s.totalSold;
  document.getElementById('stat-bookings').textContent = s.totalBookings;
  document.getElementById('stat-returns').textContent = s.totalReturns;
  renderDashboardCharts(res);
  renderLowStockAlerts();
}

function formatNum(n) {
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.round(n);
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function renderDashboardCharts(data) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const chartDefaults = { color: '#e2e8f0', borderColor: '#1e1e50' };
  Chart.defaults.color = chartDefaults.color;
  Chart.defaults.borderColor = chartDefaults.borderColor;
  Chart.defaults.font.family = "'DM Sans', sans-serif";

  destroyChart('monthly'); destroyChart('category'); destroyChart('revenue'); destroyChart('popular');

  const monthly = data.monthlyData || [];
  charts.monthly = new Chart(document.getElementById('monthlySalesChart'), {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Sales', data: monthly.map(m => m.sales), backgroundColor: 'rgba(124,58,237,0.6)', borderRadius: 6 },
        { label: 'Revenue (₹)', data: monthly.map(m => m.revenue), backgroundColor: 'rgba(6,182,212,0.6)', borderRadius: 6, yAxisID: 'y1' }
      ]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true, grid: { color: '#1e1e50' } }, y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } } }, plugins: { legend: { position: 'top' } } }
  });

  const catStats = data.categoryStats || [];
  charts.category = new Chart(document.getElementById('categoryChart'), {
    type: 'doughnut',
    data: {
      labels: catStats.map(c => c.category),
      datasets: [{ data: catStats.map(c => c.count), backgroundColor: ['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'], borderWidth: 2, borderColor: '#0d0d2b' }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });

  charts.revenue = new Chart(document.getElementById('revenueChart'), {
    type: 'line',
    data: {
      labels: months,
      datasets: [{ label: 'Revenue', data: monthly.map(m => m.revenue), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#1e1e50' } } } }
  });

  const pop = data.popular || [];
  charts.popular = new Chart(document.getElementById('popularChart'), {
    type: 'bar',
    data: {
      labels: pop.map(p => p.styleId),
      datasets: [{ label: 'Units Sold', data: pop.map(p => p.totalSold), backgroundColor: ['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444'], borderRadius: 8 }]
    },
    options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: '#1e1e50' } } } }
  });
}

function renderLowStockAlerts() {
  const low = products.filter(p => p.currentStock <= p.minimumStock).slice(0, 8);
  const container = document.getElementById('lowStockList');
  if (!low.length) { container.innerHTML = '<p class="muted-text" style="padding:10px">✅ All products are well stocked!</p>'; return; }
  container.innerHTML = low.map(p => `
    <div class="product-mini">
      <span class="pm-style">${p.styleId}</span>
      <span class="pm-name">${p.itemName}</span>
      <span class="pm-stock ${p.currentStock === 0 ? 'zero' : 'low'}">${p.currentStock === 0 ? '❌ OUT' : '⚠️ ' + p.currentStock}</span>
      <button class="btn-sm" onclick='editProduct("${p._id}")'>Restock</button>
    </div>
  `).join('');
}

// ===== STOCK GRID =====
function loadStockGrid() {
  renderStockGrid();
}

function renderStockGrid() {
  const filter = document.getElementById('gridCategoryFilter').value;
  let data = filter === 'all' ? products : products.filter(p => p.category === filter);
  const grid = document.getElementById('stockGrid');
  if (!data.length) { grid.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>No products found</p></div>'; return; }
  grid.innerHTML = data.map(p => {
    const cls = p.currentStock === 0 ? 'red' : p.currentStock <= p.minimumStock ? 'yellow' : 'green';
    return `<div class="stock-box ${cls}" onclick='viewProduct("${p._id}")'>
      ${p.currentStock === 0 ? '<span class="sb-out">OUT</span>' : ''}
      <div class="sb-style">${p.styleId}</div>
      <div class="sb-name">${p.itemName}</div>
      <div class="sb-stock">${p.currentStock}</div>
      <div class="sb-label">${p.currentStock === 0 ? 'Out of Stock' : 'units left'}</div>
    </div>`;
  }).join('');
}

// ===== CATEGORIES =====
async function loadCategories() {
  await loadProducts();
  const cats = [...new Set(products.map(p => p.category))];
  const container = document.getElementById('categoriesContainer');
  if (!cats.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-tags"></i><p>No categories yet</p></div>'; return; }
  container.innerHTML = cats.map(cat => {
    const catProds = products.filter(p => p.category === cat);
    const catColors = { Footwear: '#7c3aed', Clothing: '#06b6d4', Electronics: '#10b981', Accessories: '#f59e0b', Other: '#ef4444' };
    const color = catColors[cat] || '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
    return `<div class="cat-section">
      <div class="cat-header">
        <div class="cat-title" style="color:${color}">${cat}</div>
        <span class="cat-count">${catProds.length} products</span>
        <div style="margin-left:auto;display:flex;gap:8px">
          <span style="font-size:12px;color:var(--green)">Stock: ${catProds.reduce((s,p)=>s+p.currentStock,0)}</span>
          <span style="font-size:12px;color:var(--accent2)">Revenue: ₹${catProds.reduce((s,p)=>s+p.totalRevenue,0).toFixed(0)}</span>
        </div>
      </div>
      <div class="cat-products">
        ${catProds.map(p => `
          <div class="cat-product-card" onclick='viewProduct("${p._id}")'>
            ${p.photo ? `<img src="${p.photo}" class="cat-product-img" onerror="this.style.display='none'">` : `<div class="cat-product-img" style="display:flex;align-items:center;justify-content:center;font-size:32px">📦</div>`}
            <div class="cat-product-name">${p.itemName}</div>
            <div class="cat-product-style">${p.styleId}</div>
            <div style="margin-top:6px;display:flex;justify-content:space-between">
              <span style="font-size:12px;color:var(--accent2)">₹${p.updatedCustomerPrice||p.currentCustomerPrice}</span>
              <span class="stock-badge ${p.currentStock===0?'red':p.currentStock<=p.minimumStock?'yellow':'green'}" style="font-size:10px;padding:2px 6px">${p.currentStock}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function addCategoryPrompt() {
  const cat = prompt('Enter new category name:');
  if (cat?.trim()) showToast(`Category "${cat}" will be available when you add a product with this category.`, 'info');
}

// ===== BOOKINGS =====
async function loadBookings() {
  await loadProducts();
  let allBookings = [];
  products.forEach(p => {
    (p.bookings || []).forEach(b => allBookings.push({ ...b, productName: p.itemName, styleId: p.styleId, productId: p._id }));
  });
  allBookings.sort((a, b) => new Date(b.bookedDate) - new Date(a.bookedDate));
  const total = allBookings.length;
  const delivered = allBookings.filter(b => b.status === 'delivered').length;
  const booked = allBookings.filter(b => b.status === 'booked').length;
  const cancelled = allBookings.filter(b => b.status === 'cancelled').length;
  document.getElementById('b-total').textContent = total;
  document.getElementById('b-delivered').textContent = delivered;
  document.getElementById('b-booked').textContent = booked;
  document.getElementById('b-cancelled').textContent = cancelled;
  const container = document.getElementById('bookingsTable');
  if (!allBookings.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>No bookings yet</p></div>'; return; }
  const statusColors = { booked: 'yellow', delivered: 'green', cancelled: 'red', returned: 'red', rto: 'red' };
  container.innerHTML = `<table class="pro-table">
    <thead><tr><th>#</th><th>Style ID</th><th>Product</th><th>Customer</th><th>Qty</th><th>Platform</th><th>Date</th><th>Status</th></tr></thead>
    <tbody>${allBookings.map((b, i) => `<tr>
      <td>${i+1}</td>
      <td><span class="style-badge">${b.styleId}</span></td>
      <td>${b.productName}</td>
      <td>${b.customerName || 'N/A'}</td>
      <td>${b.quantity}</td>
      <td style="text-transform:capitalize">${b.platform || 'direct'}</td>
      <td>${new Date(b.bookedDate).toLocaleDateString('en-IN')}</td>
      <td><span class="stock-badge ${statusColors[b.status]||'green'}">${b.status}</span></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function openBookingModal() {
  populateProductSelects();
  openModal('bookingModal');
}

async function saveBooking() {
  const productId = document.getElementById('bk-product').value;
  const customerName = document.getElementById('bk-customer').value;
  const quantity = document.getElementById('bk-qty').value;
  const platform = document.getElementById('bk-platform').value;
  const deliveryDate = document.getElementById('bk-delivery').value;
  const notes = document.getElementById('bk-notes').value;
  if (!productId) { showToast('Please select a product!', 'error'); return; }
  const res = await api('POST', `/api/products/${productId}/booking`, { customerName, quantity, platform, deliveryDate, notes });
  if (res?.success) {
    showToast(res.message, 'success');
    closeModal();
    await loadProducts();
    await loadBookings();
  } else if (res) showToast(res.message, 'error');
}

function quickBook(productId) {
  populateProductSelects();
  document.getElementById('bk-product').value = productId;
  openModal('bookingModal');
}

// ===== RETURNS =====
async function loadReturns() {
  await loadProducts();
  let allReturns = [];
  products.forEach(p => {
    (p.returns || []).forEach(r => allReturns.push({ ...r, productName: p.itemName, styleId: p.styleId }));
  });
  allReturns.sort((a, b) => new Date(b.returnDate) - new Date(a.returnDate));
  const container = document.getElementById('returnsContainer');
  if (!allReturns.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-undo-alt"></i><p>No returns or RTO logged yet</p></div>'; return; }
  container.innerHTML = `<div class="table-wrap"><table class="pro-table">
    <thead><tr><th>#</th><th>Style ID</th><th>Product</th><th>Type</th><th>Qty</th><th>Reason</th><th>Date</th><th>Status</th></tr></thead>
    <tbody>${allReturns.map((r, i) => `<tr>
      <td>${i+1}</td>
      <td><span class="style-badge">${r.styleId}</span></td>
      <td>${r.productName}</td>
      <td><span class="stock-badge ${r.type==='rto'?'red':'yellow'}">${r.type==='rto'?'🚚 RTO':'↩️ Return'}</span></td>
      <td>${r.quantity}</td>
      <td>${r.reason || 'N/A'}</td>
      <td>${new Date(r.returnDate).toLocaleDateString('en-IN')}</td>
      <td><span class="stock-badge green">${r.status}</span></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function openReturnModal() { populateProductSelects(); openModal('returnModal'); }

async function saveReturn() {
  const productId = document.getElementById('ret-product').value;
  const quantity = document.getElementById('ret-qty').value;
  const type = document.getElementById('ret-type').value;
  const reason = document.getElementById('ret-reason').value;
  if (!productId) { showToast('Please select a product!', 'error'); return; }
  const res = await api('POST', `/api/products/${productId}/return`, { quantity, type, reason });
  if (res?.success) {
    showToast(res.message, 'success');
    closeModal();
    await loadProducts();
    await loadReturns();
  } else if (res) showToast(res.message, 'error');
}

// ===== ANALYTICS =====
async function loadAnalytics() {
  const res = await api('GET', '/api/products/analytics/summary');
  if (!res?.success) return;
  analytics = res;
  renderAnalyticsCharts(res);
}

function renderAnalyticsCharts(data) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthly = data.monthlyData || [];
  const catStats = data.categoryStats || [];
  const s = data.summary;

  destroyChart('aTrend'); destroyChart('aRev'); destroyChart('aReturn'); destroyChart('aStock'); destroyChart('aPlatform');

  charts.aTrend = new Chart(document.getElementById('analyticsTrendChart'), {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'Sales Units', data: monthly.map(m => m.sales), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.1)', fill: true, tension: 0.4 },
        { label: 'Revenue ₹', data: monthly.map(m => m.revenue), borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)', fill: true, tension: 0.4, yAxisID: 'y1' }
      ]
    },
    options: { responsive: true, interaction: { mode: 'index' }, scales: { y: { beginAtZero: true, grid: { color: '#1e1e50' } }, y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } } } }
  });

  charts.aRev = new Chart(document.getElementById('analyticsRevChart'), {
    type: 'bar',
    data: {
      labels: catStats.map(c => c.category),
      datasets: [{ label: 'Revenue', data: catStats.map(c => c.revenue), backgroundColor: ['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444'], borderRadius: 6 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#1e1e50' } } } }
  });

  charts.aReturn = new Chart(document.getElementById('analyticsReturnChart'), {
    type: 'doughnut',
    data: {
      labels: ['Delivered', 'Returned', 'RTO', 'Pending'],
      datasets: [{ data: [s.totalSold - s.totalReturns, Math.floor(s.totalReturns * 0.6), Math.floor(s.totalReturns * 0.4), s.totalBookings - s.totalSold], backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6b7280'], borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });

  charts.aStock = new Chart(document.getElementById('analyticsStockChart'), {
    type: 'doughnut',
    data: {
      labels: ['In Stock', 'Low Stock', 'Out of Stock'],
      datasets: [{ data: [s.totalProducts - s.outOfStock - s.lowStock, s.lowStock, s.outOfStock], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });

  const platforms = ['Direct', 'Flipkart', 'Amazon', 'Meesho', 'Other'];
  charts.aPlatform = new Chart(document.getElementById('analyticsPlatformChart'), {
    type: 'pie',
    data: {
      labels: platforms,
      datasets: [{ data: [40, 25, 20, 10, 5], backgroundColor: ['#7c3aed','#06b6d4','#f59e0b','#10b981','#6b7280'], borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

// ===== HEAT MAP =====
function loadHeatmap() {
  const grid = document.getElementById('heatmapGrid');
  const maxVal = Math.max(...(analytics.heatmap || []).map(h => h.value), 1);
  grid.innerHTML = Array.from({ length: 52 }, (_, i) => {
    const val = analytics.heatmap?.[i]?.value || Math.floor(Math.random() * 10);
    const level = val === 0 ? 0 : val < maxVal * 0.25 ? 1 : val < maxVal * 0.5 ? 2 : val < maxVal * 0.75 ? 3 : 4;
    return `<div class="hm-cell level-${level}" title="Week ${i+1}: ${val} sales"></div>`;
  }).join('');
}

// ===== POPULAR =====
async function loadPopular() {
  if (!analytics.popular) await loadDashboard();
  const pop = analytics.popular || [];
  const maxSold = Math.max(...pop.map(p => p.totalSold), 1);
  document.getElementById('popularList').innerHTML = pop.length ?
    pop.map((p, i) => `
      <div class="popular-item">
        <div class="rank-badge ${i===0?'r1':i===1?'r2':i===2?'r3':'rn'}">${i+1}</div>
        ${p.photo ? `<img src="${p.photo}" class="pop-img">` : `<div class="pop-img-ph">📦</div>`}
        <div class="pop-info">
          <div class="pop-name">${p.itemName}</div>
          <div class="pop-style">${p.styleId}</div>
          <div class="sold-bar"><div class="sold-fill" style="width:${(p.totalSold/maxSold*100).toFixed(0)}%"></div></div>
        </div>
        <div class="pop-sold">
          <div class="pop-sold-num">${p.totalSold}</div>
          <div class="pop-sold-label">units sold</div>
        </div>
      </div>
    `).join('') :
    '<div class="empty-state"><i class="fas fa-star"></i><p>No sales data yet</p></div>';
}

// ===== PROFIT CALCULATOR =====
function calculateProfit() {
  const sell = parseFloat(document.getElementById('calc-sell').value) || 0;
  const cost = parseFloat(document.getElementById('calc-cost').value) || 0;
  const delivery = parseFloat(document.getElementById('calc-delivery').value) || 0;
  const platform = parseFloat(document.getElementById('calc-platform').value) || 0;
  const other = parseFloat(document.getElementById('calc-other').value) || 0;
  const gstPct = parseFloat(document.getElementById('calc-gst').value) || 0;
  const qty = parseInt(document.getElementById('calc-qty').value) || 1;
  const gst = sell * gstPct / 100;
  const netProfit = sell - cost - delivery - platform - other - gst;
  const margin = sell > 0 ? (netProfit / sell * 100).toFixed(1) : 0;
  document.getElementById('pb-sell').textContent = `₹${sell.toFixed(2)}`;
  document.getElementById('pb-cost').textContent = `-₹${cost.toFixed(2)}`;
  document.getElementById('pb-del').textContent = `-₹${delivery.toFixed(2)}`;
  document.getElementById('pb-plat').textContent = `-₹${platform.toFixed(2)}`;
  document.getElementById('pb-other').textContent = `-₹${other.toFixed(2)}`;
  document.getElementById('pb-gst').textContent = `-₹${gst.toFixed(2)}`;
  document.getElementById('pb-net').textContent = `₹${netProfit.toFixed(2)}`;
  document.getElementById('pb-net').style.color = netProfit >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('pb-total').textContent = `₹${(netProfit * qty).toFixed(2)}`;
  document.getElementById('pb-total').style.color = netProfit >= 0 ? 'var(--cyan)' : 'var(--red)';
  document.getElementById('pb-margin').textContent = `${margin}%`;
}

// ===== QR GENERATOR =====
function loadQRPage() { populateProductSelects(); }

function qrFromProduct(id) {
  if (!id) return;
  const p = products.find(x => x._id === id);
  if (p) {
    const text = `Style ID: ${p.styleId} | Name: ${p.itemName} | Price: Rs.${p.updatedCustomerPrice||p.currentCustomerPrice} | Stock: ${p.currentStock}`;
    document.getElementById('qrCustomText').value = text;
  }
}

function generateQR() {
  // Get text from input or from selected product
  let text = document.getElementById('qrCustomText').value.trim();
  if (!text) {
    const sel = document.getElementById('qrProductSelect').value;
    if (sel) { qrFromProduct(sel); text = document.getElementById('qrCustomText').value.trim(); }
  }
  if (!text) { showToast('Please enter text OR select a product first!', 'error'); return; }

  const size = parseInt(document.getElementById('qrSize').value) || 200;
  const output = document.getElementById('qrOutput');
  output.innerHTML = ''; // clear old QR

  // Try QRCode library first
  try {
    if (typeof QRCode === 'undefined') throw new Error('QRCode library not loaded');
    new QRCode(output, {
      text: text,
      width: size,
      height: size,
      colorDark: '#7c3aed',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    // Wait a moment then check if it generated
    setTimeout(() => {
      const canvas = output.querySelector('canvas');
      const img = output.querySelector('img');
      if (canvas || img) {
        document.getElementById('qrActions').style.display = 'block';
        showToast('QR Code generated!', 'success');
      } else {
        generateQRFallback(text, size, output);
      }
    }, 300);
  } catch(e) {
    console.log('QRCode lib error, using fallback:', e.message);
    generateQRFallback(text, size, output);
  }
}

// Fallback: use Google Charts API to generate QR
function generateQRFallback(text, size, output) {
  const encodedText = encodeURIComponent(text);
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedText}&color=7c3aed&bgcolor=ffffff&margin=10`;
  output.innerHTML = `
    <div style="text-align:center">
      <img id="qrFallbackImg" src="${url}" 
        style="width:${size}px;height:${size}px;border-radius:12px;border:3px solid #7c3aed;padding:8px;background:#fff"
        onerror="this.parentElement.innerHTML='<p style=color:red>❌ QR failed. Check internet connection.</p>'"
        onload="document.getElementById('qrActions').style.display='block';showToast('QR Code generated!','success')">
      <p style="margin-top:10px;font-size:12px;color:#64748b">QR Code for: <b>${text.substring(0,40)}${text.length>40?'...':''}</b></p>
    </div>`;
  document.getElementById('qrActions').style.display = 'block';
}

function downloadQR() {
  // Try canvas download first
  const canvas = document.querySelector('#qrOutput canvas');
  if (canvas) {
    const link = document.createElement('a');
    link.download = 'stockpro-qr.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('QR downloaded!', 'success');
    return;
  }
  // Try image download (fallback)
  const img = document.querySelector('#qrFallbackImg') || document.querySelector('#qrOutput img');
  if (img) {
    const link = document.createElement('a');
    link.download = 'stockpro-qr.png';
    link.href = img.src;
    link.target = '_blank';
    link.click();
    showToast('QR downloaded!', 'success');
    return;
  }
  showToast('Generate a QR code first!', 'error');
}

function generateProductQR(id) {
  const p = products.find(x => x._id === id);
  if (!p) return;
  document.getElementById('qrCustomText').value = `Style: ${p.styleId} | ${p.itemName} | Price: Rs.${p.updatedCustomerPrice||p.currentCustomerPrice}`;
  closeModal();
  showPage('qrgen');
  setTimeout(() => generateQR(), 200);
}

// ===== SCANNER =====
async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    document.getElementById('scannerVideo').srcObject = cameraStream;
    showToast('Camera started! Point at a QR/barcode', 'success');
  } catch (e) { showToast('Camera access denied: ' + e.message, 'error'); }
}

function stopCamera() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  document.getElementById('scannerVideo').srcObject = null;
}

function scanLookup() {
  const query = document.getElementById('scanInput').value.trim();
  if (!query) { showToast('Enter a product Style ID or name', 'error'); return; }
  const found = products.filter(p =>
    p.styleId.toLowerCase() === query.toLowerCase() ||
    p.code.toLowerCase() === query.toLowerCase() ||
    p.itemName.toLowerCase().includes(query.toLowerCase())
  );
  const res = document.getElementById('scanResult');
  res.style.display = 'block';
  if (!found.length) { res.innerHTML = '<p class="muted-text">❌ No product found matching "' + query + '"</p>'; return; }
  res.innerHTML = found.map(p => `
    <div style="border-bottom:1px solid var(--border);padding:12px 0;last-child:border-none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span class="style-badge">${p.styleId}</span>
        <span class="stock-badge ${p.currentStock===0?'red':p.currentStock<=p.minimumStock?'yellow':'green'}">${p.currentStock===0?'Out of Stock':p.currentStock+' in stock'}</span>
      </div>
      <div style="font-weight:600;margin-bottom:4px">${p.itemName}</div>
      <div style="font-size:12px;color:var(--text2)">Price: ₹${p.updatedCustomerPrice||p.currentCustomerPrice} | Sold: ${p.totalSold}</div>
      <button class="btn-sm" style="margin-top:8px" onclick='viewProduct("${p._id}")'>View Details</button>
    </div>
  `).join('');
}

// ===== INVOICE =====
function generateInvoice(type) {
  const now = new Date();
  const invNum = 'INV-' + Date.now().toString().slice(-6);
  document.getElementById('inv-num').textContent = invNum;
  document.getElementById('inv-date').textContent = now.toLocaleDateString('en-IN');
  let period = '', filteredProds = [];
  if (type === 'daily') {
    period = 'Today — ' + now.toLocaleDateString('en-IN');
    filteredProds = products.filter(p => {
      return p.salesHistory?.some(s => new Date(s.date).toDateString() === now.toDateString());
    });
    if (!filteredProds.length) filteredProds = products.filter(p => p.totalSold > 0).slice(0, 10);
  } else {
    period = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    filteredProds = products.filter(p => {
      return p.salesHistory?.some(s => new Date(s.date).getMonth() === now.getMonth() && new Date(s.date).getFullYear() === now.getFullYear());
    });
    if (!filteredProds.length) filteredProds = products.filter(p => p.totalSold > 0);
  }
  document.getElementById('inv-period').textContent = period;
  let subtotal = 0;
  const tbody = document.getElementById('invBody');
  tbody.innerHTML = filteredProds.map((p, i) => {
    const price = p.updatedCustomerPrice || p.currentCustomerPrice;
    const rev = p.totalRevenue || (p.totalSold * price);
    subtotal += rev;
    return `<tr><td>${i+1}</td><td>${p.styleId}</td><td>${p.itemName}</td><td>${p.totalSold}</td><td>₹${price}</td><td>₹${rev.toFixed(2)}</td></tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">No sales data for this period</td></tr>';
  document.getElementById('inv-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
  document.getElementById('inv-returns').textContent = `-₹0`;
  document.getElementById('inv-grand').textContent = `₹${subtotal.toFixed(2)}`;
}

function printInvoice() { window.print(); }

// ===== SETTINGS =====
async function updateProfile() {
  const res = await api('PUT', '/api/auth/update-profile', {
    name: document.getElementById('set-name').value,
    shopName: document.getElementById('set-shop').value,
    phone: document.getElementById('set-phone').value
  });
  if (res?.success) {
    currentUser = { ...currentUser, ...res.user };
    localStorage.setItem('user', JSON.stringify(currentUser));
    document.getElementById('welcomeName').textContent = currentUser.name;
    document.getElementById('shopNameDisplay').textContent = currentUser.shopName;
    document.getElementById('userAvatar').textContent = currentUser.name[0].toUpperCase();
    showToast('Profile updated!', 'success');
  } else if (res) showToast(res.message, 'error');
}

function toggleDarkMode() {
  const isDark = document.getElementById('darkModeToggle').checked;
  document.documentElement.style.setProperty('--bg', isDark ? '#070713' : '#f1f5f9');
  document.documentElement.style.setProperty('--card', isDark ? '#0f0f30' : '#ffffff');
  document.documentElement.style.setProperty('--text', isDark ? '#e2e8f0' : '#1e293b');
  document.documentElement.style.setProperty('--border', isDark ? '#1e1e50' : '#e2e8f0');
}

// ===== EXCEL EXPORT =====
function exportExcel() {
  if (!products.length) { showToast('No products to export!', 'error'); return; }
  const headers = ['S.No','Style ID','Code','Item Name','Category','Cost Price','Customer Price','Updated Price','%','Delivery','Stock','Total Sold','Revenue'];
  const rows = products.map((p, i) => [
    i+1, p.styleId, p.code, p.itemName, p.category, p.costPrice||0,
    p.currentCustomerPrice, p.updatedCustomerPrice||p.currentCustomerPrice,
    p.percent||0, p.deliveryFees||0, p.currentStock, p.totalSold, p.totalRevenue.toFixed(2)
  ]);
  let csv = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `StockPro-Export-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  showToast('Export downloaded!', 'success');
}

// ===== INIT =====
async function init() {
  if (!checkAuth()) return;
  const sidebar = document.getElementById('sidebar');
  const mainWrap = document.querySelector('.main-wrap');
  // Desktop: open sidebar by default and push content
  if (window.innerWidth >= 1024) {
    sidebar.classList.add('open');
    mainWrap.classList.add('sidebar-open');
  }
  await loadProducts();
  await loadDashboard();
}

window.addEventListener('load', init);

window.addEventListener('resize', () => {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const mainWrap = document.querySelector('.main-wrap');
  if (window.innerWidth >= 1024) {
    // Desktop: always push content, hide overlay
    sidebar.classList.add('open');
    mainWrap.classList.add('sidebar-open');
    overlay.classList.remove('show');
  } else {
    // Mobile/tablet: close sidebar, remove push, overlay handles it
    mainWrap.classList.remove('sidebar-open');
    if (!sidebar.classList.contains('open')) {
      overlay.classList.remove('show');
    }
  }
});
