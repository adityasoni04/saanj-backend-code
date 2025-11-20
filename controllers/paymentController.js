import Razorpay from 'razorpay';
import crypto from 'crypto';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import dotenv from 'dotenv';

dotenv.config();

const razorpayInstance = new Razorpay({
  key_id: process.env.VITE_RAZORPAY_KEY_ID,
  key_secret: process.env.VITE_RAZORPAY_KEY_SECRET,
});

export const createOrder = async (req, res) => {
  try {
    const { products, shippingAddress, paymentMethod } = req.body;

    if (!products?.length) return res.status(400).json({ message: 'No products in order.' });
    if (!paymentMethod) return res.status(400).json({ message: 'Payment method is required.' });

    // Clear stale unpaid orders
    await Order.deleteMany({
      userId: req.user._id,
      isPaid: false,
      orderStatus: 'Pending Payment',
    });

    // --- Price Calculation (in PAISE) ---
    const productIds = products.map(p => p.productId);
    const dbProducts = await Product.find({ productId: { $in: productIds } }).lean();
    const priceMap = new Map(dbProducts.map(p => [p.productId, p.price]));

    let totalAmountRupees = 0;
    const orderProducts = [];

    for (const item of products) {
      const dbPrice = priceMap.get(item.productId);
      if (!dbPrice) return res.status(404).json({ message: `Product not found: ${item.productId}` });

      totalAmountRupees += dbPrice * item.quantity;
      orderProducts.push({
        productId: item.productId,
        quantity: item.quantity,
        price: dbPrice * 100, // paise
      });
    }

    const amountInPaise = Math.round(totalAmountRupees * 100);
    const receiptId = `receipt_${crypto.randomBytes(8).toString('hex')}`;

    // --- Razorpay Payment ---
    if (paymentMethod === 'Razorpay') {
      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: receiptId,
      };

      razorpayInstance.orders.create(options, async (error, razorpayOrder) => {
        if (error) {
          console.error('Razorpay Error:', error);
          return res.status(500).json({ message: 'Failed to create Razorpay order.' });
        }

        const newOrder = new Order({
          userId: req.user._id,
          products: orderProducts,
          amount: amountInPaise,
          shippingAddress,
          paymentMethod: 'Razorpay',
          razorpayOrder,
          receiptId,
          isPaid: false,
          orderStatus: 'Pending Payment',
        });

        const createdOrder = await newOrder.save();
        res.status(201).json(createdOrder);
      });

    } else if (paymentMethod === 'COD') {
      // --- Cash on Delivery ---
      const newOrder = new Order({
        userId: req.user._id,
        products: orderProducts,
        amount: amountInPaise,
        shippingAddress,
        paymentMethod: 'COD',
        isPaid: false,
        orderStatus: 'Processing',
        receiptId, // use clean new field instead of fake razorpayOrder
      });

      const createdOrder = await newOrder.save();
      res.status(201).json(createdOrder);
    } else {
      res.status(400).json({ message: 'Invalid payment method.' });
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Server error while creating order.' });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.VITE_RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature.' });
    }

    const order = await Order.findOne({ 'razorpayOrder.id': razorpay_order_id });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    order.isPaid = true;
    order.orderStatus = 'Processing';
    order.paymentInfo = {
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    };
    await order.save();

    res.status(200).json({
      message: 'Payment verified successfully.',
      orderId: order._id,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ message: 'Server error during payment verification.' });
  }
};
