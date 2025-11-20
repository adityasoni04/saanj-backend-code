import express from 'express';
import { createOrder, verifyPayment } from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Route for Step 1: Create the order
router.route('/orders').post(protect, createOrder);

// Route for Step 2: Verify the payment
router.route('/verify').post(protect, verifyPayment);

export default router;