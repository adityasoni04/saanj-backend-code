import Wishlist from '../models/wishlistModel.js';
import Product from '../models/productModel.js'; // To populate product details

// Helper to get or create a wishlist for a user
const getOrCreateWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ userId });
  if (!wishlist) {
    wishlist = await Wishlist.create({ userId, items: [] });
  }
  return wishlist;
};

// Helper function to populate product details
const populateWishlistItems = async (itemArray) => {
    if (!itemArray || itemArray.length === 0) return [];
    
    const productIds = [...new Set(itemArray)]; // Get unique product IDs
    
    const products = await Product.find({ productId: { $in: productIds } })
                                   .select('productId productName price images category subcategory')
                                   .lean();
                                   
    const productMap = new Map(products.map(p => [p.productId, p]));
    
    // Return an array of populated product objects
    return productIds
        .map(id => productMap.get(id))
        .filter(Boolean); // Filter out any products not found
};

/**
 * @desc    Get the logged-in user's wishlist (populated)
 * @route   GET /api/wishlist
 * @access  Private
 */
const getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.user._id }).lean();

    if (!wishlist || wishlist.items.length === 0) {
      return res.json({ userId: req.user._id, items: [], _id: wishlist?._id || null });
    }

    // Populate items with product details
    const populatedItems = await populateWishlistItems(wishlist.items);

    res.json({
        ...wishlist,
        items: populatedItems
    });
  } catch (error) {
    console.error('Error getting wishlist:', error);
    res.status(500).json({ message: 'Error fetching wishlist.' });
  }
};

/**
 * @desc    Add an item to the wishlist
 * @route   POST /api/wishlist
 * @access  Private
 */
const addToWishlist = async (req, res) => {
  const { productId } = req.body;
  const userId = req.user._id;

  if (!productId) {
    return res.status(400).json({ message: 'Product ID is required.' });
  }

  try {
    const productExists = await Product.exists({ productId: productId });
    if (!productExists) {
        return res.status(404).json({ message: 'Product not found.' });
    }
    
    const wishlist = await getOrCreateWishlist(userId);

    // Check if item is already in the wishlist
    if (wishlist.items.includes(productId)) {
      // Item already exists, send back the populated list
      const populatedItems = await populateWishlistItems(wishlist.items);
      return res.status(200).json({ ...wishlist.toObject(), items: populatedItems });
    }

    // Add item and save
    wishlist.items.push(productId);
    await wishlist.save();

    // Populate and send back the updated wishlist
    const populatedItems = await populateWishlistItems(wishlist.items);
    res.status(201).json({ ...wishlist.toObject(), items: populatedItems });

  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ message: 'Error adding item to wishlist.' });
  }
};

/**
 * @desc    Remove an item from the wishlist
 * @route   DELETE /api/wishlist/:productId
 * @access  Private
 */
const removeFromWishlist = async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  try {
    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found.' });
    }

    const initialLength = wishlist.items.length;
    wishlist.items = wishlist.items.filter(item => item !== productId);

    if (wishlist.items.length === initialLength) {
      return res.status(404).json({ message: 'Item not found in wishlist.' });
    }

    await wishlist.save();
    
    // Populate and send back the updated wishlist
    const populatedItems = await populateWishlistItems(wishlist.items);
    res.status(200).json({ ...wishlist.toObject(), items: populatedItems });

  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ message: 'Error removing item from wishlist.' });
  }
};

export {
  getWishlist,
  addToWishlist,
  removeFromWishlist
};