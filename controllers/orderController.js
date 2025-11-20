import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import mongoose from 'mongoose';

// --- HELPER FUNCTION (To populate product details) ---
const fetchAndMapProducts = async (itemArray) => {
  if (!itemArray || itemArray.length === 0) return [];
  const productIds = [...new Set(itemArray.map(item => item.productId))];
  const products = await Product.find({ productId: { $in: productIds } })
    .select('productId productName price images category subcategory')
    .lean();
  const productMap = new Map(products.map(p => [p.productId, p]));
  const populatedItems = itemArray.map(item => ({
    quantity: item.quantity,
    price: item.price, // Use the price from the order (in paise)
    productDetails: productMap.get(item.productId) || null
  })).filter(item => item.productDetails !== null);
  return populatedItems;
};

// --- Get a user's orders (Populated) ---
const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    const populatedOrders = await Promise.all(
      orders.map(async (order) => {
        const populatedItems = await fetchAndMapProducts(order.products);
        return { ...order, products: populatedItems };
      })
    );
    res.json(populatedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user orders', error: error.message });
  }
};

// --- Get a single order by ID (Populated) ---
const getOrderById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid Order ID format' });
    }
    const order = await Order.findById(req.params.id).lean();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (req.user.role !== 'admin' && order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }
    const populatedItems = await fetchAndMapProducts(order.products);
    res.json({ ...order, products: populatedItems });
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({ message: 'Error fetching order', error: error.message });
  }
};

// --- [Admin] Get all orders (Populated) ---
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
    const populatedOrders = await Promise.all(
      orders.map(async (order) => {
        const populatedItems = await fetchAndMapProducts(order.products);
        const user = await mongoose.model('User').findById(order.userId).select('displayName email').lean();
        return { ...order, products: populatedItems, userId: user };
      })
    );
    res.json(populatedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all orders', error: error.message });
  }
};

// --- [Admin] Update an order's status ---
const updateOrderStatus = async (req, res) => {
  try {
    // 1. Get status AND trackingId from the body
    const { status, trackingId } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // 2. Add logic for 'Shipped' status
    if (status === 'Shipped') {
      if (!trackingId) {
        return res.status(400).json({ message: 'Tracking ID is required to ship an order.' });
      }
      order.shippingInfo = {
        provider: 'Delhivery', // Your provider
        trackingId: trackingId,
      };
    }

    // 3. Add logic for 'Delivered' status
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
      if (order.paymentMethod === 'COD') {
        order.isPaid = true; // Mark COD as paid on delivery
      }
    }

    // 4. Save the new status
    order.orderStatus = status;
    const updatedOrder = await order.save();
    res.json(updatedOrder);

  } catch (error) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};

// --- [User] Request an exchange ---
const requestExchange = async (req, res) => {
  try {
    // --- 1. GET REASON FROM REQ.BODY ---
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) { return res.status(404).json({ message: 'Order not found' }); }

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // --- 2. VALIDATE REASON ---
    if (!reason || reason.trim() === "") {
      return res.status(400).json({ message: 'An exchange reason is required.' });
    }

    // --- 3. (All other checks are the same) ---
    if (order.orderStatus !== 'Delivered') {
      return res.status(400).json({ message: 'Order is not "Delivered".' });
    }
    if (!order.deliveredAt) {
      return res.status(400).json({ message: 'Order delivery date is not set.' });
    }
    if (order.exchangeStatus !== 'None') {
      return res.status(400).json({ message: `Exchange already ${order.exchangeStatus.toLowerCase()}.` });
    }
    const deliveredAt = new Date(order.deliveredAt);
    const daysSinceDelivery = (new Date().getTime() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceDelivery > 7) {
      return res.status(400).json({ message: 'The 7-day exchange window has closed.' });
    }

    // --- 4. SAVE THE REASON ---
    order.orderStatus = 'Exchange Requested';
    order.exchangeStatus = 'Requested';
    order.exchangeReason = reason; // <-- Save the reason

    const updatedOrder = await order.save();
    res.json(updatedOrder);

  } catch (error) {
    console.error('Exchange request error:', error);
    res.status(500).json({ message: 'Server error during exchange request.' });
  }
};

const manageExchangeRequest = async (req, res) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.orderStatus !== 'Exchange Requested') {
      return res.status(400).json({ message: 'This order is not awaiting exchange approval.' });
    }

    if (action === 'approve') {
      order.orderStatus = 'Processing'; // Set to 'Processing' to ship the new item
      order.exchangeStatus = 'Approved';
    } else if (action === 'reject') {
      order.orderStatus = 'Delivered'; // Put it back to 'Delivered'
      order.exchangeStatus = 'Rejected';
    } else {
      return res.status(400).json({ message: 'Invalid action.' });
    }

    const updatedOrder = await order.save();
    res.json(updatedOrder);

  } catch (error) {
    console.error('Manage exchange error:', error);
    res.status(500).json({ message: 'Server error managing exchange.' });
  }
};


// --- 5. EXPORT NEW FUNCTION ---
export { getUserOrders, getOrderById, getAllOrders, updateOrderStatus, requestExchange, manageExchangeRequest };