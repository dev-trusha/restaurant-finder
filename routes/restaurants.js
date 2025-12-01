const express = require('express');
const router = express.Router();
const Restaurant = require('../models/Restaurant');
const { body, validationResult, query } = require('express-validator');

// GET all restaurants with pagination and filtering
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('PerPage must be between 1 and 100'),
  query('city').optional().trim().isLength({ min: 1 }).withMessage('City must not be empty'),
  query('cuisine').optional().trim().isLength({ min: 1 }).withMessage('Cuisine must not be empty'),
  query('minRating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 10;
    const skip = (page - 1) * perPage;

    // Build filter object
    let filter = {};
    if (req.query.city) {
      filter['address.city'] = new RegExp(req.query.city, 'i');
    }
    if (req.query.cuisine) {
      filter.cuisines = new RegExp(req.query.cuisine, 'i');
    }
    if (req.query.minRating) {
      filter.rating = { $gte: parseFloat(req.query.minRating) };
    }

    const restaurants = await Restaurant.find(filter)
      .skip(skip)
      .limit(perPage)
      .sort({ rating: -1, name: 1 });

    const total = await Restaurant.countDocuments(filter);
    const totalPages = Math.ceil(total / perPage);

    res.json({
      success: true,
      data: restaurants,
      pagination: {
        page,
        perPage,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching restaurants'
    });
  }
});

// GET restaurant by ID
router.get('/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    res.json({
      success: true,
      data: restaurant
    });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid restaurant ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching restaurant'
    });
  }
});

// CREATE new restaurant
router.post('/', [
  body('name').notEmpty().withMessage('Name is required').trim().isLength({ max: 100 }),
  body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
  body('address.street').notEmpty().withMessage('Street address is required'),
  body('address.city').notEmpty().withMessage('City is required'),
  body('address.country').notEmpty().withMessage('Country is required'),
  body('cuisines').isArray({ min: 1 }).withMessage('At least one cuisine is required'),
  body('cuisines.*').notEmpty().withMessage('Cuisine cannot be empty'),
  body('hasWifi').optional().isBoolean().withMessage('hasWifi must be a boolean'),
  body('image').optional().isURL().withMessage('Image must be a valid URL'),
  body('location').notEmpty().withMessage('Location is required'),
  body('geo.lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  body('geo.lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  body('priceRange').isIn(['$', '$$', '$$$', '$$$$']).withMessage('Valid price range is required'),
  body('averageCostForTwo').isInt({ min: 0 }).withMessage('Average cost must be a positive number'),
  body('currency').notEmpty().withMessage('Currency is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const restaurant = new Restaurant(req.body);
    const savedRestaurant = await restaurant.save();

    res.status(201).json({
      success: true,
      message: 'Restaurant created successfully',
      data: savedRestaurant
    });
  } catch (error) {
    console.error('Error creating restaurant:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating restaurant'
    });
  }
});

// UPDATE restaurant
router.put('/:id', [
  body('name').optional().trim().isLength({ max: 100 }),
  body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
  body('address.street').optional().notEmpty().withMessage('Street cannot be empty'),
  body('address.city').optional().notEmpty().withMessage('City cannot be empty'),
  body('address.country').optional().notEmpty().withMessage('Country cannot be empty'),
  body('cuisines').optional().isArray({ min: 1 }).withMessage('At least one cuisine is required'),
  body('cuisines.*').optional().notEmpty().withMessage('Cuisine cannot be empty'),
  body('hasWifi').optional().isBoolean().withMessage('hasWifi must be a boolean'),
  body('image').optional().isURL().withMessage('Image must be a valid URL'),
  body('location').optional().notEmpty().withMessage('Location cannot be empty'),
  body('geo.lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  body('geo.lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  body('priceRange').optional().isIn(['$', '$$', '$$$', '$$$$']).withMessage('Valid price range is required'),
  body('averageCostForTwo').optional().isInt({ min: 0 }).withMessage('Average cost must be a positive number'),
  body('currency').optional().notEmpty().withMessage('Currency is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    res.json({
      success: true,
      message: 'Restaurant updated successfully',
      data: restaurant
    });
  } catch (error) {
    console.error('Error updating restaurant:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid restaurant ID'
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating restaurant'
    });
  }
});

// DELETE restaurant
router.delete('/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndDelete(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    res.json({
      success: true,
      message: 'Restaurant deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid restaurant ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while deleting restaurant'
    });
  }
});

module.exports = router;