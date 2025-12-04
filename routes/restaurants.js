const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth'); // ADD THIS LINE
const Restaurant = require('../models/Restaurant');

// ========== PUBLIC ROUTES (No auth needed) ==========

// GET all restaurants (Public)
router.get('/', async (req, res) => {
    try {
        const restaurants = await Restaurant.find();
        res.json({ success: true, data: restaurants });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching restaurants' });
    }
});

// GET single restaurant (Public)
router.get('/:id', async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        res.json({ success: true, data: restaurant });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching restaurant' });
    }
});

// ========== PROTECTED ROUTES (Need auth) ==========

// CREATE restaurant (Protected - logged in users)
router.post('/', auth, async (req, res) => { // ADD 'auth' HERE
    try {
        const restaurantData = {
            ...req.body,
            createdBy: req.user.id // Add user ID from auth middleware
        };
        
        const restaurant = await Restaurant.create(restaurantData);
        res.status(201).json({ 
            success: true, 
            message: 'Restaurant created',
            data: restaurant 
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            message: 'Error creating restaurant',
            error: error.message 
        });
    }
});

// UPDATE restaurant (Protected - admin only)
router.put('/:id', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Only admins can update restaurants' 
            });
        }

        const restaurant = await Restaurant.findById(req.params.id);
        
        if (!restaurant) {
            return res.status(404).json({ 
                success: false, 
                message: 'Restaurant not found' 
            });
        }
        
        const updatedRestaurant = await Restaurant.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        res.json({ 
            success: true, 
            message: 'Restaurant updated',
            data: updatedRestaurant 
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            message: 'Error updating restaurant',
            error: error.message
        });
    }
});

// DELETE restaurant (Protected - admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Only admins can delete restaurants' 
            });
        }

        const restaurant = await Restaurant.findById(req.params.id);
        
        if (!restaurant) {
            return res.status(404).json({ 
                success: false, 
                message: 'Restaurant not found' 
            });
        }
        
        await Restaurant.findByIdAndDelete(req.params.id);
        
        res.json({ 
            success: true, 
            message: 'Restaurant deleted' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting restaurant' 
        });
    }
});

// SEARCH restaurants (Public)
router.get('/search/filters', async (req, res) => {
    try {
        const { city, cuisine, minRating } = req.query;
        let filter = {};
        
        if (city) filter['address.city'] = new RegExp(city, 'i');
        if (cuisine) filter.cuisines = new RegExp(cuisine, 'i');
        if (minRating) filter.rating = { $gte: parseFloat(minRating) };
        
        const restaurants = await Restaurant.find(filter).limit(20);
        res.json({ 
            success: true, 
            count: restaurants.length,
            data: restaurants 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Search failed' 
        });
    }
});

module.exports = router;