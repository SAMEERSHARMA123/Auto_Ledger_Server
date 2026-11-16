import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import {
    generateAccessToken,
    generateRefreshToken,
    setAuthCookies,
    clearAuthCookies
} from '../utils/generateToken.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email and password are required' });
        }

        const userExists = await User.findOne({ email }).lean();
        if (userExists) return res.status(400).json({ message: 'User already exists' });

        const user = await User.create({ name, email, password });

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        setAuthCookies(res, accessToken, refreshToken);

        res.status(201).json({
            message: 'User registered successfully',
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email }).lean();
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        // अगर यूज़र ने सिर्फ Google से अकाउंट बनाया है और पासवर्ड सेट नहीं है
        if (!user.password) {
            return res.status(400).json({ message: 'Please sign in with Google for this account' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        setAuthCookies(res, accessToken, refreshToken);

        res.status(200).json({
            message: 'Login successful',
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const logoutUser = (req, res) => {
    clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out successfully' });
};

export const refreshAccessToken = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) return res.status(401).json({ message: 'No refresh token found' });

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const newAccessToken = generateAccessToken(decoded.id);

        setAuthCookies(res, newAccessToken, null);

        res.status(200).json({ message: 'Access token refreshed' });
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
};

export const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password').lean();
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ message: 'Google ID Token is required' });

        // 1. Google Token वेरिफ़ाई करें
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const { email, name, picture, sub: googleId } = ticket.getPayload();

        // 2. ईमेल से यूज़र ढूँढें
        let user = await User.findOne({ email });

        if (!user) {
            // नया यूज़र: ऑटो-रजिस्टर करें (201 Status के साथ)
            user = await User.create({
                name: name || email.split('@')[0],
                email,
                googleId,
                avatar: picture // अगर मॉडल में avatar फ़ील्ड है तो सेव हो जाएगी
            });
        } else if (!user.googleId) {
            // पुराना ईमेल यूज़र: पहली बार Google से आया है तो googleId लिंक करें
            user.googleId = googleId;
            if (!user.avatar && picture) user.avatar = picture;
            await user.save();
        }

        // 3. टोकन जनरेट करें और HTTP-Only कुकी सेट करें
        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        setAuthCookies(res, accessToken, refreshToken);

        res.status(200).json({
            message: 'Google authentication successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ message: error.message || 'Google authentication failed' });
    }
};
