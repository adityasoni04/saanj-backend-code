// import express from 'express';
// import {
//   createProduct,
//   getProducts,
//   updateProduct,
//   deleteProduct,
//   getProductById,
//   getAdminProducts,
// } from '../controllers/productController.js';
// import upload from '../middleware/uploadMiddleware.js';
// import { protect, admin } from '../middleware/authMiddleware.js';

// const router = express.Router();

// const imageUpload = upload.array('images', 10);

// router.route('/admin').get(protect, admin, getAdminProducts);


// router.route('/')
//   .get(getProducts)
//   .post(imageUpload, createProduct);

// router.route('/:productId').get(getProductById);
// router.route('/:productId')
//   .put(imageUpload, updateProduct)
//   .delete(deleteProduct);


// export default router;

import express from 'express';
import {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  getProductById,
  getAdminProducts,
} from '../controllers/productController.js';
import upload from '../middleware/uploadMiddleware.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware for handling image uploads
const imageUpload = upload.array('images', 10);

// --- ADMIN ROUTES ---
// These are specific and must come first

// GET /api/products/admin (For admin panel, paginated)
router.route('/admin').get(protect, admin, getAdminProducts);

// POST /api/products (Create a new product)
router.route('/').post(protect, admin, imageUpload, createProduct);

// PUT & DELETE /api/products/:productId (Update/Delete a product)
router.route('/:productId')
  .put(protect, admin, imageUpload, updateProduct)
  .delete(protect, admin, deleteProduct);

// --- PUBLIC/CUSTOMER ROUTES ---
// These are general and must come last

// GET /api/products (For search and category pages)
router.route('/').get(getProducts);

// GET /api/products/:productId (Get a single product)
// This is last so 'admin' isn't mistaken for a productId
router.route('/:productId').get(getProductById);

export default router;

