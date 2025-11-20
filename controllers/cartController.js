import Cart from '../models/cartModel.js';
import Product from '../models/productModel.js'; // Ensure Product model is imported
import mongoose from 'mongoose'; // Needed for ObjectId validation if used later

// --- HELPER FUNCTION for Manual Population ---
// Fetches products based on string productIds and creates a lookup map
const fetchAndMapProducts = async (itemArray) => {
    // Return early if no items to process
    if (!itemArray || itemArray.length === 0) {
        return { populatedItems: [] };
    }

    // Extract unique productIds from cart items
    const productIds = [...new Set(itemArray.map(item => item.productId))]; // Use Set for uniqueness

    // Fetch corresponding products from the Product collection
    const products = await Product.find({ productId: { $in: productIds } })
                                   .select('productId productName price images category subcategory') // Select fields needed by frontend
                                   .lean(); // Use .lean() for plain JS objects for performance

    // Create a Map for efficient lookup: Map<productId_string, product_object>
    const productMap = new Map(products.map(p => [p.productId, p]));

    // Map cart items, replacing string ID with the full product object
    const populatedItems = itemArray.map(item => ({
      quantity: item.quantity,
      // Find the product details using the string productId
      // Fallback to the original string ID if the product wasn't found (e.g., deleted)
      productId: productMap.get(item.productId) || item.productId
    })).filter(item => typeof item.productId === 'object'); // Optionally filter out items where product wasn't found

    return { populatedItems };
};
// --- END HELPER FUNCTION ---


// Helper to get or create a cart for a user
const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    // If no cart exists, create a new one
    cart = await Cart.create({ userId, items: [] });
  }
  return cart;
};

/**
 * @desc    Get user's cart with populated product details
 * @route   GET /api/cart
 * @access  Private
 */
const getCart = async (req, res) => {
  try {
    // Find the user's cart document
    const cart = await Cart.findOne({ userId: req.user._id }).lean(); // Use lean() for the base cart

    // If cart doesn't exist or has no items, return an empty structure
    if (!cart || cart.items.length === 0) {
      return res.json({ userId: req.user._id, items: [], _id: cart?._id || null });
    }

    // Manually populate product details using the helper
    const { populatedItems } = await fetchAndMapProducts(cart.items);

    // Return the cart structure with populated items
    res.json({
        _id: cart._id,
        userId: cart.userId,
        items: populatedItems, // Send the manually populated items
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
    });

  } catch (error) {
    console.error('Error getting and populating cart:', error);
    res.status(500).json({ message: 'Error fetching cart data.' });
  }
};

/**
 * @desc    Add item to cart or update quantity, return populated cart
 * @route   POST /api/cart
 * @access  Private
 */
const addToCart = async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const userId = req.user._id;

  // Validate input
  if (!productId || !Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: 'Invalid product ID or quantity.' });
  }

  try {
     // Check if product exists
     const productExists = await Product.exists({ productId: productId });
     if (!productExists) {
         return res.status(404).json({ message: 'Product not found.' });
     }

    // Get or create the user's cart
    const cart = await getOrCreateCart(userId);

    // Find if the item already exists in the cart
    const existingItemIndex = cart.items.findIndex(item => item.productId === productId);

    if (existingItemIndex > -1) {
      // Item exists, increase quantity
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Item doesn't exist, add it
      cart.items.push({ productId, quantity });
    }

    // Save the updated cart document
    const updatedCart = await cart.save();

    // Manually populate the items in the updated cart
    const { populatedItems } = await fetchAndMapProducts(updatedCart.items);

    // Send the populated cart back as the response
    res.status(200).json({
        _id: updatedCart._id,
        userId: updatedCart.userId,
        items: populatedItems,
        createdAt: updatedCart.createdAt,
        updatedAt: updatedCart.updatedAt,
    });

  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ message: 'Error adding item to cart.' });
  }
};

/**
 * @desc    Update item quantity in cart, return populated cart
 * @route   PUT /api/cart/:productId
 * @access  Private
 */
const updateCartItemQuantity = async (req, res) => {
    const { productId } = req.params; // Get productId from URL parameter
    const { quantity } = req.body;
    const userId = req.user._id;

    // Validate quantity
    if (quantity === undefined || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: 'Invalid quantity provided. Must be at least 1.' });
    }

    try {
        // Find the user's cart
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found.' });
        }

        // Find the index of the item to update
        const itemIndex = cart.items.findIndex(item => item.productId === productId);

        if (itemIndex > -1) {
            // Update the quantity
            cart.items[itemIndex].quantity = quantity;
            // Save the cart
            const updatedCart = await cart.save();

            // Manually populate the items
            const { populatedItems } = await fetchAndMapProducts(updatedCart.items);

            // Send the populated cart back
            res.json({
                _id: updatedCart._id,
                userId: updatedCart.userId,
                items: populatedItems,
                createdAt: updatedCart.createdAt,
                updatedAt: updatedCart.updatedAt,
            });
        } else {
            // Item wasn't found in the cart
            res.status(404).json({ message: 'Item not found in cart.' });
        }
    } catch (error) {
        console.error('Error updating cart quantity:', error);
        res.status(500).json({ message: 'Error updating item quantity.' });
    }
};


/**
 * @desc    Remove item from cart, return populated cart
 * @route   DELETE /api/cart/:productId
 * @access  Private
 */
const removeFromCart = async (req, res) => {
  const { productId } = req.params; // Get productId from URL parameter
  const userId = req.user._id;

  try {
    // Find the user's cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found.' });
    }

    const initialLength = cart.items.length;
    // Filter out the item to be removed
    cart.items = cart.items.filter(item => item.productId !== productId);

    // Check if any item was actually removed
    if (cart.items.length === initialLength) {
        return res.status(404).json({ message: 'Item not found in cart.' });
    }

    // Save the updated cart
    const updatedCart = await cart.save();

    // Manually populate the remaining items
    const { populatedItems } = await fetchAndMapProducts(updatedCart.items);

    // Send the populated cart back
    res.json({
        _id: updatedCart._id,
        userId: updatedCart.userId,
        items: populatedItems,
        createdAt: updatedCart.createdAt,
        updatedAt: updatedCart.updatedAt,
    });

  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ message: 'Error removing item from cart.' });
  }
};

/**
 * @desc    Clear entire cart
 * @route   DELETE /api/cart/clear
 * @access  Private
 */
const clearCart = async (req, res) => {
    const userId = req.user._id;
    try {
        // Find the user's cart
        const cart = await Cart.findOne({ userId });
        if (cart) {
            // Empty the items array
            cart.items = [];
            // Save the empty cart
            await cart.save();
            // Return the empty cart structure
            res.json({
                 _id: cart._id,
                 userId: cart.userId,
                 items: [], // Explicitly empty
                 createdAt: cart.createdAt,
                 updatedAt: cart.updatedAt,
             });
        } else {
             // If no cart existed, return an empty structure anyway
             res.json({ userId: userId, items: [], _id: null });
        }
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ message: 'Error clearing cart.' });
    }
};


// Export all controller functions
export {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart
};