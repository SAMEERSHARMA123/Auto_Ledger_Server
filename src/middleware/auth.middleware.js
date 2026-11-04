    import jwt from 'jsonwebtoken';

    export const protectRoute = (req, res, next) => {
        try {
            // Header se token nikalna: "Bearer eyJhbGci..."
            const authHeader = req.header('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ message: 'Access denied. No token provided.' });
            }

            const token = authHeader.split(' ')[1];
            
            // Token verify karna
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            
            // req.user mein data save karna taaki next controller isko use kar sake
            req.user = decoded; 
            next(); // Agle controller par bhej do
        } catch (error) {
            res.status(401).json({ message: 'Invalid or expired access token' });
        }
    };