import express from 'express';
import { registerUser, loginUser, logoutUser, getUserProfile, googleLogin , refreshAccessToken, updateUserProfile } from '../controllers/auth.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);

router.post('/refresh', refreshAccessToken); 
router.post('/google', googleLogin);

router.get('/profile', protectRoute, getUserProfile);
router.put('/profile', protectRoute, updateUserProfile);

export default router; 