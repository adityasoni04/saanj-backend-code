import express from 'express';
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart
} from '../controllers/cartController.js';
// Note: 'protect' middleware will be applied in server.js for all cart routes

const router = express.Router();

// Base route for getting the cart and adding items
router.route('/')
  .get(getCart)       // GET /api/cart
  .post(addToCart);    // POST /api/cart (body: { productId, quantity })

// Route for clearing the entire cart
router.route('/clear')
  .delete(clearCart); // DELETE /api/cart/clear

// Routes for specific items identified by productId in the URL
router.route('/:productId')
  .put(updateCartItemQuantity) // PUT /api/cart/:productId (body: { quantity })
  .delete(removeFromCart);     // DELETE /api/cart/:productId

export default router;