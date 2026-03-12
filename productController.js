const Product = require('../models/productModel');

// @GET /api/products
exports.getProducts = async (req, res) => {
  try {
    const { category, search, outOfStock, sort } = req.query;
    let query = { user: req.user._id };
    if (category && category !== 'all') query.category = category;
    if (outOfStock === 'true') query.currentStock = 0;
    if (search) query.$or = [
      { itemName: { $regex: search, $options: 'i' } },
      { styleId: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
    let sortObj = { createdAt: -1 };
    if (sort === 'name') sortObj = { itemName: 1 };
    if (sort === 'stock_asc') sortObj = { currentStock: 1 };
    if (sort === 'stock_desc') sortObj = { currentStock: -1 };
    if (sort === 'price') sortObj = { currentCustomerPrice: -1 };
    if (sort === 'sold') sortObj = { totalSold: -1 };
    const products = await Product.find(query).sort(sortObj);
    res.json({ success: true, count: products.length, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/products/:id
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/products
exports.createProduct = async (req, res) => {
  try {
    const { styleId, code, itemName, category, currentCustomerPrice, updatedCustomerPrice,
      percent, deliveryFees, platformFees, costPrice, currentStock, minimumStock, supplier, tags } = req.body;
    const exists = await Product.findOne({ styleId: styleId?.toUpperCase(), user: req.user._id });
    if (exists) return res.status(400).json({ success: false, message: `Style ID "${styleId}" already exists! Please use a unique Style ID.` });
    const product = await Product.create({
      styleId: styleId?.toUpperCase(),
      code, itemName, category,
      photo: req.file ? `/uploads/${req.file.filename}` : null,
      currentCustomerPrice, updatedCustomerPrice, percent,
      deliveryFees, platformFees, costPrice, currentStock,
      minimumStock: minimumStock || 5,
      supplier, tags: tags ? tags.split(',').map(t => t.trim()) : [],
      user: req.user._id
    });
    res.status(201).json({ success: true, message: 'Product added successfully!', product });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Style ID already exists!' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const updateData = { ...req.body };
    if (updateData.styleId) updateData.styleId = updateData.styleId.toUpperCase();
    if (req.file) updateData.photo = `/uploads/${req.file.filename}`;
    if (updateData.tags && typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map(t => t.trim());
    }
    // Check styleId uniqueness (excluding current)
    if (updateData.styleId && updateData.styleId !== product.styleId) {
      const dup = await Product.findOne({ styleId: updateData.styleId, user: req.user._id, _id: { $ne: req.params.id } });
      if (dup) return res.status(400).json({ success: false, message: 'Style ID already in use!' });
    }
    const updated = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    res.json({ success: true, message: 'Product updated!', product: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deleted successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/products/:id/booking
exports.addBooking = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const { customerName, quantity, platform, notes, deliveryDate } = req.body;
    const qty = parseInt(quantity) || 1;
    if (product.currentStock < qty) return res.status(400).json({ success: false, message: 'Insufficient stock!' });
    product.bookings.push({ customerName, quantity: qty, platform, notes, deliveryDate });
    product.currentStock -= qty;
    product.totalSold += qty;
    const price = product.updatedCustomerPrice || product.currentCustomerPrice;
    product.totalRevenue += price * qty;
    // Sales history
    const now = new Date();
    const weekNum = Math.ceil((now.getDate()) / 7);
    product.salesHistory.push({ date: now, quantity: qty, revenue: price * qty, week: weekNum, month: now.getMonth() + 1, year: now.getFullYear() });
    await product.save();
    res.json({ success: true, message: 'Booking added!', product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/products/:id/return
exports.addReturn = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const { reason, quantity, type } = req.body;
    const qty = parseInt(quantity) || 1;
    product.returns.push({ reason, quantity: qty, type: type || 'return' });
    product.currentStock += qty; // Restock on return
    await product.save();
    res.json({ success: true, message: `${type === 'rto' ? 'RTO' : 'Return'} logged and stock restocked!`, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/products/analytics/summary
exports.getAnalytics = async (req, res) => {
  try {
    const products = await Product.find({ user: req.user._id });
    const totalProducts = products.length;
    const outOfStock = products.filter(p => p.currentStock === 0).length;
    const lowStock = products.filter(p => p.currentStock > 0 && p.currentStock <= p.minimumStock).length;
    const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalSold = products.reduce((sum, p) => sum + p.totalSold, 0);
    const totalReturns = products.reduce((sum, p) => sum + p.returns.length, 0);
    const totalBookings = products.reduce((sum, p) => sum + p.bookings.length, 0);
    const categories = [...new Set(products.map(p => p.category))];
    const popular = products.sort((a, b) => b.totalSold - a.totalSold).slice(0, 5).map(p => ({
      id: p._id, styleId: p.styleId, itemName: p.itemName, totalSold: p.totalSold, photo: p.photo
    }));
    const categoryStats = categories.map(cat => {
      const catProducts = products.filter(p => p.category === cat);
      return {
        category: cat,
        count: catProducts.length,
        revenue: catProducts.reduce((s, p) => s + p.totalRevenue, 0),
        sold: catProducts.reduce((s, p) => s + p.totalSold, 0)
      };
    });
    // Monthly data
    const monthlyData = [];
    for (let m = 1; m <= 12; m++) {
      const monthSales = products.reduce((sum, p) => {
        return sum + p.salesHistory.filter(s => s.month === m).reduce((s, h) => s + h.quantity, 0);
      }, 0);
      const monthRevenue = products.reduce((sum, p) => {
        return sum + p.salesHistory.filter(s => s.month === m).reduce((s, h) => s + h.revenue, 0);
      }, 0);
      monthlyData.push({ month: m, sales: monthSales, revenue: monthRevenue });
    }
    // Heat map (52 weeks)
    const heatmap = Array.from({ length: 52 }, (_, i) => ({
      week: i + 1,
      value: products.reduce((sum, p) => sum + p.salesHistory.filter(s => s.week === (i + 1) % 4 + 1).reduce((s, h) => s + h.quantity, 0), 0)
    }));
    res.json({
      success: true,
      summary: { totalProducts, outOfStock, lowStock, totalRevenue, totalSold, totalReturns, totalBookings },
      popular, categoryStats, monthlyData, heatmap
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/products/categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { user: req.user._id });
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};