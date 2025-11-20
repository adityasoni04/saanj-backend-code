import mongoose from 'mongoose';
import { generateProductId } from '../utils/generateProductId.js';

// Sub-schema for Specifications
const specificationSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  value: { type: String, required: true, trim: true },
}, { _id: false });

// imageSchema removed

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    unique: true,
    required: true,
    default: () => `PROD${generateProductId()}`,
  },
  productName: {
    type: String,
    required: [true, 'Product name is required.'],
    trim: true,
  },
  category: {
    type: String,
    required: [true, 'Category is required.'],
    trim: true,
  },
  subcategory: {
    type: String,
    trim: false, // Changed to true
  },
  description: {
    type: String,
    required: [true, 'Description is required.'],
  },
  price: {
    type: Number,
    required: [true, 'Price is required.'],
    min: 0, // Added validation
  },
  originalPrice: {
    type: Number,
    required: false,
    min: 0, // Added validation
  },
  stock: {
    type: Number,
    required: false,
    default: 0,
    min: 0, // Added validation
  },
  featured: {
    type: Boolean,
    default: false,
  },
  images: {
    type: [String], // Correctly an array of URL strings
  },
  features: {
    type: [String],
    default: [],
  },
  specifications: {
    type: [specificationSchema],
    default: [],
  },
}, {
  timestamps: true,
});

const Product = mongoose.model('Product', productSchema);

export default Product;