import jwt from 'jsonwebtoken';

export const generateAccessToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, {
        expiresIn: '15m',
    });
};

export const generateRefreshToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: '7d',
    });
};

export const setAuthCookies = (res, accessToken, refreshToken) => {
    const baseOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    };

    if (accessToken) {
        res.cookie('accessToken', accessToken, {
            ...baseOptions,
            maxAge: 15 * 60 * 1000, // 15 minutes
        });
    }

    if (refreshToken) {
        res.cookie('refreshToken', refreshToken, {
            ...baseOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
    }
};

export const clearAuthCookies = (res) => {
    const clearOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: new Date(0),
    };

    res.cookie('accessToken', '', clearOptions);
    res.cookie('refreshToken', '', clearOptions);
};
