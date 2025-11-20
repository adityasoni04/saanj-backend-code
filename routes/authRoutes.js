import express from 'express';
import passport from 'passport';
import { googleCallback, getProfile } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/', session: false }),
  googleCallback
);

router.get('/profile', protect, getProfile);

export default router;

