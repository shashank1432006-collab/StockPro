const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customerName: String,
  quantity: { type: Number, default: 1 },
  bookedDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['booked', 'delivered', 'cancelled', 'returned', 'rto'], default: 'booked' },
  platform: { type: String, enum: ['direct', 'flipkart', 'amazon', 'meesho', 'other'], default: 'direct' },
  deliveryDate: Date,
  notes: String
});

const returnSchema = new mongoose.Schema({
  reason: String,
  quantity: { type: Number, default: 1 },
  returnDate: { type: Date, default: Date.now },
  type: { type: String, enum: ['return', 'rto'], default: 'return' },
  status: { type: String, enum: ['pending', 'received', 'restocked'], default: 'pending' }
});

const productSchema = new mongoose.Schema({
  styleId: { type: String, required: true, unique: true, uppercase: true },
  code: { type: String, required: true },
  itemName: { type: String, required: true },
  category: { type: String, required: true, default: 'General' },
  photo: { type: String },
  currentCustomerPrice: { type: Number, required: true },
  updatedCustomerPrice: { type: Number },
  percent: { type: Number, default: 0 },
  deliveryFees: { type: Number, default: 0 },
  platformFees: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0, min: 0 },
  minimumStock: { type: Number, default: 5 },
  totalSold: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  bookings: [bookingSchema],
  returns: [returnSchema],
  isActive: { type: Boolean, default: true },
  tags: [String],
  barcode: String,
  supplier: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  salesHistory: [{
    date: { type: Date, default: Date.now },
    quantity: Number,
    revenue: Number,
    week: Number,
    month: Number,
    year: Number
  }]
}, { timestamps: true });

productSchema.virtual('profit').get(function() {
  const price = this.updatedCustomerPrice || this.currentCustomerPrice;
  return price - this.costPrice - this.deliveryFees - this.platformFees;
});

productSchema.virtual('isOutOfStock').get(function() {
  return this.currentStock === 0;
});

productSchema.virtual('isLowStock').get(function() {
  return this.currentStock > 0 && this.currentStock <= this.minimumStock;
});

module.exports = mongoose.model('Product', productSchema);