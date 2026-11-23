import User, { ALLOWED_THEMES, DEFAULT_THEME_ID } from '../models/User.js';
import Expense from '../models/Expense.js';
import DebtAccount from '../models/debt.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import {
    generateAccessToken,
    generateRefreshToken,
    setAuthCookies,
    clearAuthCookies
} from '../utils/generateToken.js';
import { uploadAvatarToCloudinary } from '../services/cloudinary.service.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ALLOWED_THRESHOLDS = ['75%', '80%', '90%'];

const resolveTheme = (themeId) =>
    ALLOWED_THEMES.includes(themeId) ? themeId : DEFAULT_THEME_ID;

const formatUserResponse = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || '',
    themeId: resolveTheme(user.themeId),
    monthlyBudget: user.monthlyBudget ?? 50000,
    alertThreshold: ALLOWED_THRESHOLDS.includes(user.alertThreshold)
        ? user.alertThreshold
        : '80%',
});

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
            user: formatUserResponse(user),
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
            user: formatUserResponse(user),
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
        const user = await User.findById(req.user.id)
            .select('-password -tokenId -__v')
            .lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            ...user,
            themeId: resolveTheme(user.themeId),
            monthlyBudget: user.monthlyBudget ?? 50000,
            alertThreshold: ALLOWED_THRESHOLDS.includes(user.alertThreshold)
                ? user.alertThreshold
                : '80%',
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ message: 'Google ID Token is required' });
        }

        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const { email, name, picture, sub: googleId } = ticket.getPayload();
        const cleanName = (name && name.trim()) || email.split('@')[0];

        let user = await User.findOne({ email });
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            const cloudinaryAvatar = picture
                ? (await uploadAvatarToCloudinary(picture, googleId)) || picture
                : undefined;

            user = await User.create({
                name: cleanName,
                email,
                googleId,
                avatar: cloudinaryAvatar,
            });
        } else {
            let updated = false;

            if (!user.googleId) {
                user.googleId = googleId;
                updated = true;
            }
            if (!user.name && cleanName) {
                user.name = cleanName;
                updated = true;
            }
            if (!user.avatar && picture) {
                const cloudinaryAvatar =
                    (await uploadAvatarToCloudinary(picture, user._id.toString())) || picture;
                user.avatar = cloudinaryAvatar;
                updated = true;
            }

            if (updated) {
                await user.save();
            }
        }

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        setAuthCookies(res, accessToken, refreshToken);

        res.status(isNewUser ? 201 : 200).json({
            message: 'Google authentication successful',
            user: formatUserResponse(user),
        });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ message: error.message || 'Google authentication failed' });
    }
};

export const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { name, avatar, image, themeId, monthlyBudget, alertThreshold } = req.body;

        if (typeof name === 'string' && name.trim()) {
            user.name = name.trim();
        }

        if (typeof themeId === 'string' && themeId.trim()) {
            const cleanTheme = themeId.trim();
            if (!ALLOWED_THEMES.includes(cleanTheme)) {
                return res.status(400).json({ message: 'Invalid theme selection' });
            }
            user.themeId = cleanTheme;
        }

        if (monthlyBudget !== undefined) {
            const parsedBudget = Number(monthlyBudget);
            if (Number.isNaN(parsedBudget) || parsedBudget <= 0) {
                return res.status(400).json({ message: 'Invalid monthly budget amount' });
            }
            user.monthlyBudget = parsedBudget;
        }

        if (alertThreshold !== undefined) {
            if (!ALLOWED_THRESHOLDS.includes(alertThreshold)) {
                return res.status(400).json({ message: 'Invalid alert threshold selection' });
            }
            user.alertThreshold = alertThreshold;
        }

        if (avatar === null) {
            user.avatar = '';
        } else {
            const incomingImage = req.file?.buffer || req.file?.path || avatar || image;
            if (incomingImage) {
                const uploadedUrl = await uploadAvatarToCloudinary(incomingImage, user._id.toString());
                if (!uploadedUrl) {
                    return res.status(500).json({ message: 'Failed to upload profile image' });
                }
                user.avatar = uploadedUrl;
            }
        }

        await user.save();

        res.status(200).json({
            message: 'Profile updated successfully',
            user: formatUserResponse(user),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.password) {
            return res.status(400).json({ message: 'Google-linked accounts cannot change password here' });
        }

        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        await Promise.all([
            Expense.deleteMany({ userId }),
            DebtAccount.deleteMany({ userId }),
            User.findByIdAndDelete(userId),
        ]);

        clearAuthCookies(res);
        res.status(200).json({ message: 'Account deleted permanently' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};