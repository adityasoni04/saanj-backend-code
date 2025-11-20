import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true }, // Stored in PAISE
}, { _id: false });

const paymentInfoSchema = new mongoose.Schema({
    paymentId: { type: String },
    signature: { type: String },
}, { _id: false });

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    products: [orderItemSchema],
    amount: {
        type: Number, // Total amount in PAISE
        required: true,
    },
    shippingAddress: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        country: { type: String, required: true },
    },
    paymentMethod: {
        type: String,
        enum: ['Razorpay', 'COD'],
        required: true,
    },
    isPaid: {
        type: Boolean,
        default: false,
    },

    // --- Statuses ---
    orderStatus: {
        type: String,
        enum: [
            'Pending Payment',
            'Processing',
            'Shipped',
            'Out for Delivery',
            'Delivered',
            'Cancelled',
            'Exchange Requested',
            'Exchange Approved',
            'Exchange Rejected',
            'Exchange Completed'
        ],
        default: 'Pending Payment',
    },

    // --- NEW FIELD ---
    receiptId: {
        type: String, // Unified receipt (for both Razorpay and COD)
        required: false,
        unique: true,
        sparse: true,
    },

    razorpayOrder: {
        type: Object,
        required: false, // only for Razorpay
    },

    paymentInfo: {
        type: paymentInfoSchema,
        required: false,
    },

    deliveredAt: {
        type: Date,
    },

    shippingInfo: {
        provider: { type: String },
        trackingId: { type: String },
    },

    exchangeStatus: {
        type: String,
        enum: ['None', 'Requested', 'Approved', 'Rejected', 'Completed'],
        default: 'None',
    },
    exchangeReason: {
        type: String,
        trim: true,
    }

}, { timestamps: true });

// Unique index for safety
orderSchema.index({ receiptId: 1 }, { unique: true });
orderSchema.index({ "razorpayOrder.id": 1 }, { sparse: true, unique: true });

const Order = mongoose.model('Order', orderSchema);
export default Order;
