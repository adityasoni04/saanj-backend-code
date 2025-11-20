import express from 'express';
import {
  getUserOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  requestExchange, 
  manageExchangeRequest// <-- 1. Import
} from '../controllers/orderController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- User Routes ---
router.route('/myorders').get(protect, getUserOrders);
router.route('/:id').get(protect, getOrderById);
router.route('/:id/request-exchange').post(protect, requestExchange); // <-- 2. Add new route

// --- Admin Routes ---
router.route('/').get(protect, admin, getAllOrders);
router.route('/:id/status').put(protect, admin, updateOrderStatus);
router.route('/:id/manage-exchange').put(protect, admin, manageExchangeRequest); // <-- 2. Add new route

export default router;