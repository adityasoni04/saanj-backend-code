import multer from 'multer';
import { storage } from '../config/cloudinary.js';

// Initialize multer with the Cloudinary storage engine
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 } // Limit file size to 5MB
});

export default upload;

