import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { generateAccessToken, generateRefreshToken, setRefreshTokenCookie } from '../utils/generateToken.js';

export const registerUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Fast-Fail: Khali inputs par pehle hi error return karein
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // 2. Lean query se check karein ki user exist karta hai ya nahi
        const userExists = await User.findOne({ email }).lean();
        if (userExists) return res.status(400).json({ message: 'User already exists' });

        const user = await User.create({ email, password });

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        setRefreshTokenCookie(res, refreshToken);

        res.status(201).json({
            message: 'User registered successfully',
            user: { id: user._id, email: user.email },
            accessToken
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Fast-Fail validation
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // 2. .lean() query (Fastest way to read from MongoDB)
        const user = await User.findOne({ email }).lean();
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        // 3. Direct bcrypt compare (Kyunki lean() mein custom methods kaam nahi karte)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        setRefreshTokenCookie(res, refreshToken);

        res.status(200).json({
            message: 'Login successful',
            user: { id: user._id, email: user.email },
            accessToken
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const logoutUser = (req, res) => {
    res.cookie('refreshToken', '', { httpOnly: true, expires: new Date(0) });
    res.status(200).json({ message: 'Logged out successfully' });
};



// Google Client initialize karein (.env mein GOOGLE_CLIENT_ID hona chahiye)
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 1. Refresh Token Controller (Mute access token renew karne ke liye)
export const refreshAccessToken = async (req, res) => {
    try {
        // Cookie parser ki madad se HttpOnly cookie read karna
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) return res.status(401).json({ message: 'No refresh token found' });

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        // Naya 15 minute ka access token banana
        const newAccessToken = generateAccessToken(decoded.id);

        res.status(200).json({ accessToken: newAccessToken });
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
};

// 2. Get Profile Controller (Protected Route)
export const getUserProfile = async (req, res) => {
    try {
        // req.user.id middleware se aayega. .select('-password') password ko response se hata dega
        const user = await User.findById(req.user.id).select('-password').lean();
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Google Login Controller
export const googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ message: 'Google ID Token is required' });

        // Google server se token verify karna
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const { email, sub: googleId } = ticket.getPayload();

        // Check karo agar user exist karta hai, nahi toh naya banao
        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({ email, googleId });
        }

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        setRefreshTokenCookie(res, refreshToken);

        res.status(200).json({
            message: 'Google login successful',
            user: { id: user._id, email: user.email },
            accessToken
        });
    } catch (error) {
        res.status(401).json({ message: 'Google authentication failed' });
    }
};