import jwt from 'jsonwebtoken';

export const protectRoute = (req, res, next) => {
    try {
        // Seedha req.cookies se accessToken nikalna
        const token = req.cookies?.accessToken;

        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token cookie provided.' });
        }

        // Token verify karna
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

        // req.user mein decoded payload ({ id: userId, iat, exp }) save karna
        req.user = decoded;
        next(); // Agle controller par bhej do
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired access token' });
    }
};
