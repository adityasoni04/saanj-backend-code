import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  productId: { // Referencing your custom product ID
    type: String,
    required: true,
    ref: 'Product' // Optional: if you want to populate product details later
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  }
}, { _id: false }); // Don't create separate _id for items

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    unique: true // Ensure only one cart per user
  },
  items: [cartItemSchema] // Array of cart items
}, {
  timestamps: true // Adds createdAt and updatedAt
});

const Cart = mongoose.model('Cart', cartSchema);
export default Cart;