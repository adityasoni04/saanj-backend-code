import Product from '../models/productModel.js';
import { cloudinary } from '../config/cloudinary.js';

const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const match = url.match(/upload\/(?:v\d+\/)?(.+?)(\.\w+)?$/);
  return match ? match[1] : null;
};

const createProduct = async (req, res) => {
  try {
    const {
      productName, description, price, category, subcategory,
      originalPrice, stock, featured
    } = req.body;

    // --- 1. Parse Specifications ---
    let specifications = [];
    if (req.body.specifications) {
      try {
        specifications = JSON.parse(req.body.specifications);
        if (!Array.isArray(specifications)) {
          throw new Error('Specifications must be an array.');
        }
      } catch (e) {
        return res.status(400).json({ message: `Invalid specifications format: ${e.message}` });
      }
    }

    // --- 2. Parse Features ---
    let features = req.body.features || [];
    if (typeof features === 'string') {
      if (features.startsWith('[') && features.endsWith(']')) {
        try { features = JSON.parse(features); } catch (e) { features = [features]; }
      } else {
        features = [features];
      }
    }
    if (!Array.isArray(features)) {
      features = [];
    }

    // --- 3. Map Images to URLs ---
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map(file => file.path);
    }

    // --- 4. Assemble Product Data ---
    const productData = {
      productName, description, price, category, subcategory,
      images: imageUrls,
      features,
      specifications,
      originalPrice, stock, featured,
    };

    // --- 5. Create and Save ---
    const product = new Product(productData);
    const createdProduct = await product.save();
    res.status(201).json(createdProduct);

  } catch (error) {
    console.error('Error in createProduct:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: `Validation failed: ${messages.join(', ')}`, errors: error.errors });
    }
    res.status(400).json({ message: 'Error creating product', error: error.message });
  }
};

const getProducts = async (req, res) => {
  try {
    const { categorySlug, subcategorySlug, q } = req.query;

    const filter = {};

    if (categorySlug) {
      filter.category = categorySlug;
    }
    if (subcategorySlug) {
      filter.subcategory = subcategorySlug;
    }
    if (q) {
      filter.$text = { $search: q };
    }
    let products;

    if (q) {
      products = await Product.find(filter, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } })
        .lean();
    } else {
      products = await Product.find(filter)
        .sort({ createdAt: -1 })
        .lean();
    }

    res.json(products);

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
};

const getAdminProducts = async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (q) { filter.$text = { $search: q }; }

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(filter);

    let query = Product.find(filter);

    if (q) {
      query = query.sort({ score: { $meta: "textScore" } });
    } else {
      query = query.sort({ createdAt: -1 });
    }

    const products = await query.skip(skip).limit(limit).lean();

    // Return the full object
    res.json({
      products,
      page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
    });

  } catch (error) {
    console.error('Error fetching admin products:', error);
    res.status(500).json({ message: 'Error fetching admin products', error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findOne({ productId });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // --- 1. Parse Specifications (Unchanged) ---
    let specifications = product.specifications;
    if (req.body.specifications !== undefined) {
      try {
        specifications = JSON.parse(req.body.specifications);
        if (!Array.isArray(specifications)) throw new Error('Must be an array.');
      } catch (e) {
        return res.status(400).json({ message: `Invalid specifications format: ${e.message}` });
      }
    }

    // --- 2. Parse Features (FIXED for Nested Arrays) ---
    let features = product.features;
    if (req.body.features !== undefined) {
      let rawFeatures = req.body.features;

      // Handle string input (FormData often sends JSON strings)
      if (typeof rawFeatures === 'string') {
        try {
          if (rawFeatures.trim().startsWith('[')) {
            rawFeatures = JSON.parse(rawFeatures);
          } else {
            rawFeatures = [rawFeatures];
          }
        } catch (e) {
          rawFeatures = [rawFeatures];
        }
      }

      // Ensure array
      if (!Array.isArray(rawFeatures)) {
        rawFeatures = [rawFeatures];
      }

      // THE FIX: Flatten nested arrays (e.g. [[["Text"]]]) into a single list
      features = rawFeatures
        .flat(Infinity)
        .map(item => String(item).trim())
        .filter(item => item.length > 0);
    }

    // --- 3. Handle Images (Unchanged) ---
    let existingImageUrls = req.body.existingImageUrls || [];
    if (typeof existingImageUrls === 'string') {
      existingImageUrls = [existingImageUrls];
    }

    const urlsToDelete = product.images.filter(url => !existingImageUrls.includes(url));
    if (urlsToDelete.length > 0) {
      const publicIdsToDelete = urlsToDelete.map(getPublicIdFromUrl).filter(id => id);
      if (publicIdsToDelete.length > 0) {
        await cloudinary.api.delete_resources(publicIdsToDelete);
      }
    }

    let updatedImageUrls = product.images.filter(url => existingImageUrls.includes(url));
    if (req.files && req.files.length > 0) {
      const newImageUrls = req.files.map(file => file.path);
      updatedImageUrls = [...updatedImageUrls, ...newImageUrls];
    }

    // --- 4. Update Product Fields (Unchanged) ---
    product.productName = req.body.productName ?? product.productName;
    product.description = req.body.description ?? product.description;
    product.price = req.body.price ?? product.price;
    product.category = req.body.category ?? product.category;
    product.subcategory = req.body.subcategory ?? product.subcategory;
    product.originalPrice = req.body.originalPrice ?? product.originalPrice;
    product.stock = req.body.stock ?? product.stock;
    product.featured = req.body.featured ?? product.featured;
    product.images = updatedImageUrls;
    product.features = features;
    product.specifications = specifications;

    // --- 5. Save and Respond ---
    const updatedProduct = await product.save();
    res.json(updatedProduct);

  } catch (error) {
    console.error('Error in updateProduct:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: `Validation failed: ${messages.join(', ')}`, errors: error.errors });
    }
    res.status(500).json({ message: 'Error updating product', error: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ productId: req.params.productId });

    if (product) {
      res.json(product); // Return the found product
    } else {
      res.status(404).json({ message: 'Product not found' }); // Return 404 if not found
    }
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    res.status(500).json({ message: 'Error fetching product details', error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ productId: req.params.productId });

    if (product) {
      if (product.images && product.images.length > 0) {
        const publicIdsToDelete = product.images.map(getPublicIdFromUrl).filter(id => id);
        if (publicIdsToDelete.length > 0) {
          await cloudinary.api.delete_resources(publicIdsToDelete);
        }
      }
      await Product.deleteOne({ _id: product._id });
      res.json({ message: 'Product and associated images removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
};

const getFeaturedProducts = async (req, res) => {
  try {
    const featuredProducts = await Product.find({ featured: true })
      .sort({ createdAt: -1 })
      .lean();

    res.json(featuredProducts);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ message: 'Error fetching featured products', error: error.message });
  }
};

export { createProduct, getProducts, getAdminProducts, updateProduct, getProductById, getFeaturedProducts, deleteProduct };

