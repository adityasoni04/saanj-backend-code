import express from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist
} from '../controllers/wishlistController.js';

const router = express.Router();

// Base route for getting the wishlist and adding items
router.route('/')
  .get(getWishlist)       // GET /api/wishlist
  .post(addToWishlist);    // POST /api/wishlist (body: { productId })

// Route for removing a specific item
router.route('/:productId')
  .delete(removeFromWishlist); // DELETE /api/wishlist/:productId

export default router;