const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev_secret_123';

const auth = (req, res, next) => {
    try {
        const header = req.headers.authorization || req.headers.Authorization;
        const token = header && header.split ? header.split(' ')[1] : null;

        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const decoded = jwt.verify(token, SECRET);

        // Normalize user info
        const id = decoded?.id ?? decoded?._id ?? null;
        req.user = {
            id: id ? String(id) : null,
            role: decoded?.role ?? null,
            email: decoded?.email ?? null
        };

        return next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

const adminAuth = [
    auth,
    (req, res, next) => {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        next();
    }
];

module.exports = { auth, adminAuth };