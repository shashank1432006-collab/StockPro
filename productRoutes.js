const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  addBooking, addReturn, getAnalytics, getCategories
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);

router.get('/analytics/summary', getAnalytics);
router.get('/categories', getCategories);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', upload.single('photo'), createProduct);
router.put('/:id', upload.single('photo'), updateProduct);
router.delete('/:id', deleteProduct);
router.post('/:id/booking', addBooking);
router.post('/:id/return', addReturn);

module.exports = router;