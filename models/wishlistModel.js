import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    unique: true // Only one wishlist per user
  },
  // We will store an array of the custom 'productId' strings
  items: [{
    type: String, // Storing your custom 'productId' (e.g., "PROD123")
    required: true,
  }]
}, {
  timestamps: true // Adds createdAt and updatedAt
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);
export default Wishlist;