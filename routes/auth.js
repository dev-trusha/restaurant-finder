const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/auth');

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'User already exists' 
            });
        }
        
        // Create new user instance
        const user = new User({
            username,
            email: email.toLowerCase(),
            password
        });
        
        // Only add role if provided and valid
        if (role && (role === 'user' || role === 'admin')) {
            user.role = role;
        }
        
        // Save user (triggers pre-save hook for password hashing)
        await user.save();
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user._id, 
                role: user.role,
                email: user.email 
            },
            process.env.JWT_SECRET || 'dev_secret_123',
            { expiresIn: '24h' }
        );
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ 
            success: false, 
            message: 'Registration failed',
            error: error.message 
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Check if user exists
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }
        
        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }
        
        // Generate JWT token (use same fallback secret)
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || 'dev_secret_123',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );
        
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Login failed', 
            error: error.message 
        });
    }
});

// Logout user
router.post('/logout', auth, (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch profile' 
        });
    }
});

module.exports = router;