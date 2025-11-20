import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import passport from 'passport';
import authRoutes from "./routes/authRoutes.js";
import passportConfig from "./config/passport.js"
import cartRoutes from './routes/cartRoutes.js'
import orderRoutes from "./routes/orderRoutes.js";
import wishlistRoutes from './routes/wishlistRoutes.js';
import { protect } from './middleware/authMiddleware.js';
import userRoutes from './routes/userRoutes.js';

// Load environment variables
dotenv.config();

// Connect to the database
connectDB();

const app = express();
passportConfig(passport);
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// API Routes
app.get('/', (req, res) => {
  res.send('E-commerce API with Cloudinary is running...');
});

app.use('/api/products', productRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', protect, orderRoutes);
app.use('/api/cart', protect, cartRoutes);
app.use('/api/wishlist', protect, wishlistRoutes);
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

