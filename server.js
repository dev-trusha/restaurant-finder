require('dotenv').config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const exphbs = require('express-handlebars');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 8000;

// Database connection
const connectDB = require('./config/db');
connectDB();

// Handlebars configuration with all needed helpers
const hbs = exphbs.create({
    extname: '.hbs',
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true
    },
helpers: {
    eq: function (a, b) { 
        return a === b; 
    },
    join: function (array, separator) { 
        if (!array || !Array.isArray(array)) return '';
        return array.join(separator); 
    },
    json: function(context) {
        return JSON.stringify(context);
    },
    // Rating stars helper
    ratingStars: function(rating, options) {
        if (!rating) rating = 0;
        rating = parseFloat(rating);
        
        let stars = '';
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        
        // Full stars
        for (let i = 0; i < fullStars; i++) {
            stars += '★';
        }
        
        // Half star
        if (hasHalfStar) {
            stars += '⯨';
        }
        
        // Empty stars
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        for (let i = 0; i < emptyStars; i++) {
            stars += '☆';
        }
        
        return stars;
    },
    // Format date helper
    formatDate: function(date) {
        if (!date) return '';
        try {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) + ' at ' + d.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return date;
        }
    },
    // Check if value exists
    exists: function(value, options) {
        if (value !== undefined && value !== null && value !== '') {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    }
}
});


// View engine setup
app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());    
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to check auth on EVERY request
app.use(async (req, res, next) => {
    // Try multiple sources for token
    let token;
    let user;
    
    // 1. Check Authorization header (API calls)
    if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // 2. Check cookies (server-side rendering)
    else if (req.cookies?.token) {
        token = req.cookies.token;
        try {
            user = req.cookies.user ? JSON.parse(decodeURIComponent(req.cookies.user)) : null;
        } catch (e) {
            console.log('Error parsing user cookie:', e.message);
        }
    }
    // 3. Check query parameter (links)
    else if (req.query.token) {
        token = req.query.token;
    }
    // 4. Check session (if using express-session)
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_123');
            
            // If we have user from cookie, use it, otherwise decode from token
            if (!user) {
                // Try to get user from database for full details
                try {
                    const User = require('./models/User');
                    const dbUser = await User.findById(decoded.id).select('-password').lean();
                    if (dbUser) {
                        user = dbUser;
                    } else {
                        user = {
                            id: decoded.id,
                            email: decoded.email,
                            role: decoded.role || 'user'
                        };
                    }
                } catch (dbError) {
                    // If DB fails, use token data
                    user = {
                        id: decoded.id,
                        email: decoded.email,
                        role: decoded.role || 'user'
                    };
                }
            }
            
            // Make user available to templates
            res.locals.user = user;
            req.user = user;
            
        } catch (error) {
            console.log('Token verification failed:', error.message);
            // Clear invalid tokens
            res.clearCookie('token');
            res.clearCookie('user');
        }
    }
    
    next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/restaurants', require('./routes/restaurants'));


// Template Routes
app.get('/', (req, res) => {
    res.render('index');
});

// Auth Routes (UI)
app.get('/auth/login', (req, res) => {
    res.render('auth/login', { 
        user: req.user || null,
        error: req.query.error 
    });
});

// Set session after login
app.post('/auth/set-session', (req, res) => {
    try {
        const { token, user } = req.body;
        
        // Set cookie
        res.cookie('token', token, {
            maxAge: 24 * 60 * 60 * 1000, // 1 day
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        
        res.cookie('user', user, {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: false, // Allow JavaScript to read
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        
        res.redirect('/');
    } catch (error) {
        res.redirect('/auth/login?error=Session+failed');
    }
});

// Quick login check endpoint
app.get('/auth/check', (req, res) => {
    const token = req.cookies?.token || req.query.token;
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_123');
            res.json({ loggedIn: true, user: decoded });
        } catch {
            res.json({ loggedIn: false });
        }
    } else {
        res.json({ loggedIn: false });
    }
});

app.get('/auth/register', (req, res) => {
    res.render('auth/register', { 
        user: req.user || null,
        error: req.query.error 
    });
});

// Protect restaurant creation page
app.get('/restaurants/create', (req, res, next) => {
    // Check if user is logged in (simple version)
    const token = req.cookies?.token || req.query.token;
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_123');
            req.user = decoded;
            next();
        } catch {
            res.redirect('/auth/login');
        }
    } else {
        res.redirect('/auth/login');
    }
}, (req, res) => {
    res.render('restaurant-create', {
        user: req.user,
        restaurant: {},
        errors: {}
    });
});

// Middleware to add user to all views
app.use((req, res, next) => {
    // Check for token in cookies, query, or header
    let token;
    
    if (req.cookies?.token) {
        token = req.cookies.token;
    } else if (req.query.token) {
        token = req.query.token;
    } else if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_123');
            res.locals.user = decoded; // Make user available in all views
            req.user = decoded;
        } catch (error) {
            // Token invalid, continue without user
        }
    }
    
    next();
});
// Logout route - SIMPLE VERSION
app.get('/auth/logout', (req, res) => {
    // Clear ALL cookies
    res.clearCookie('token');
    res.clearCookie('user');
    
    // Redirect immediately to home
    res.redirect('/');
});

app.get('/restaurants/search', (req, res) => {
    res.render('restaurant-search', {
        searchParams: req.query,
        errors: null
    });
});

app.get('/restaurants/search/results', async (req, res) => {
    try {
        // Check DB connection
        if (mongoose.connection.readyState !== 1) {
            return res.render('restaurant-search', {
                searchParams: req.query,
                errors: [{ msg: 'Database not available. Please try again.' }]
            });
        }

        const { page = 1, perPage = 10, city, cuisine, minRating } = req.query;
        
        const Restaurant = require('./models/Restaurant');
        const pageNum = parseInt(page);
        const perPageNum = parseInt(perPage);
        const skip = (pageNum - 1) * perPageNum;

        let filter = {};
        if (city) filter['address.city'] = new RegExp(city, 'i');
        if (cuisine) filter.cuisines = new RegExp(cuisine, 'i');
        if (minRating) filter.rating = { $gte: parseFloat(minRating) };

        const restaurants = await Restaurant.find(filter)
            .skip(skip)
            .limit(perPageNum)
            .sort({ rating: -1, name: 1 })
            .lean();

        const total = await Restaurant.countDocuments(filter);
        const totalPages = Math.ceil(total / perPageNum);

        // Build pagination URLs
        const buildUrl = (newPage) => {
            let url = `/restaurants/search/results?page=${newPage}&perPage=${perPageNum}`;
            if (city) url += `&city=${encodeURIComponent(city)}`;
            if (cuisine) url += `&cuisine=${encodeURIComponent(cuisine)}`;
            if (minRating) url += `&minRating=${minRating}`;
            return url;
        };

        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push({
                number: i,
                active: i === pageNum,
                url: buildUrl(i)
            });
        }

        res.render('restaurant-results', {
            restaurants,
            searchParams: req.query,
            user: req.user,
            pagination: {
                page: pageNum,
                perPage: perPageNum,
                total,
                totalPages,
                hasPrev: pageNum > 1,
                hasNext: pageNum < totalPages,
                prevUrl: buildUrl(pageNum - 1),
                nextUrl: buildUrl(pageNum + 1),
                pages
            }
        });

    } catch (error) {
        console.error('Search error:', error);
        res.render('restaurant-search', {
            searchParams: req.query,
            errors: [{ msg: 'Error performing search' }]
        });
    }
});

app.post('/restaurants', async (req, res) => {
    try {
        // Check DB connection
        if (mongoose.connection.readyState !== 1) {
            return res.render('restaurant-create', {
                restaurant: req.body,
                errors: { general: 'Database not available. Please try again.' }
            });
        }

        const restaurantData = {
            name: req.body.name,
            rating: req.body.rating ? parseFloat(req.body.rating) : 0,
            address: {
                street: req.body['address[street]'] || req.body.address?.street || '',
                city: req.body['address[city]'] || req.body.address?.city || '',
                country: req.body['address[country]'] || req.body.address?.country || ''
            },
            cuisines: req.body.cuisines ? req.body.cuisines.split(',').map(c => c.trim()) : [],
            amenities: req.body.amenities ? req.body.amenities.split(',').map(a => a.trim()) : [],
            hasWifi: req.body.hasWifi === 'on',
            image: req.body.image,
            location: req.body.location,
            geo: {
                lat: parseFloat(req.body['geo[lat]'] || req.body.geo?.lat || 0),
                lng: parseFloat(req.body['geo[lng]'] || req.body.geo?.lng || 0)
            },
            priceRange: req.body.priceRange,
            averageCostForTwo: parseInt(req.body.averageCostForTwo) || 0,
            currency: req.body.currency
        };

        const Restaurant = require('./models/Restaurant');
        const restaurant = new Restaurant(restaurantData);
        await restaurant.save();

        res.redirect('/restaurants/search/results');

    } catch (error) {
        console.error('Create restaurant error:', error);
        
        let errors = {};
        if (error.name === 'ValidationError') {
            Object.keys(error.errors).forEach(key => {
                errors[key] = error.errors[key].message;
            });
        } else {
            errors.general = 'Error creating restaurant: ' + error.message;
        }

        res.render('restaurant-create', {
            restaurant: req.body,
            errors
        });
    }
});

app.get('/restaurants/:id', async (req, res) => {
    try {
        // Check DB connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).render('error', { 
                message: 'Database not available. Please try again later.' 
            });
        }

        const Restaurant = require('./models/Restaurant');
        const restaurant = await Restaurant.findById(req.params.id).lean();
        
        if (!restaurant) {
            return res.status(404).render('error', { message: 'Restaurant not found' });
        }

        res.render('restaurant-details', { restaurant, user: req.user });

    } catch (error) {
        console.error('Restaurant details error:', error);
        res.status(500).render('error', { message: 'Error loading restaurant' });
    }
});


// EDIT restaurant form (Admin only)
app.get('/restaurants/:id/edit', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!req.user) {
            return res.redirect('/auth/login?error=Please+login+to+continue');
        }
        if (req.user.role !== 'admin') {
            return res.status(403).render('error', { 
                message: 'Access denied. Only admins can edit restaurants.' 
            });
        }

        // Check DB connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).render('error', { 
                message: 'Database not available. Please try again later.' 
            });
        }

        const Restaurant = require('./models/Restaurant');
        const restaurant = await Restaurant.findById(req.params.id).lean();
        
        if (!restaurant) {
            return res.status(404).render('error', { 
                message: 'Restaurant not found' 
            });
        }

        res.render('restaurant-edit', { 
            restaurant: {
                ...restaurant,
                _id: restaurant._id.toString()
            },
            errors: {}
        });

    } catch (error) {
        console.error('Edit restaurant error:', error);
        res.status(500).render('error', { 
            message: 'Error loading restaurant for editing' 
        });
    }
});

// UPDATE restaurant (Admin only)
app.post('/restaurants/:id/update', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!req.user) {
            return res.redirect('/auth/login?error=Please+login+to+continue');
        }
        if (req.user.role !== 'admin') {
            return res.status(403).render('error', { 
                message: 'Access denied. Only admins can update restaurants.' 
            });
        }

        // Check DB connection
        if (mongoose.connection.readyState !== 1) {
            return res.render('restaurant-edit', {
                restaurant: { _id: req.params.id, ...req.body },
                errors: { general: 'Database not available. Please try again.' }
            });
        }

        const restaurantData = {
            name: req.body.name,
            rating: req.body.rating ? parseFloat(req.body.rating) : 0,
            address: {
                street: req.body['address[street]'] || req.body.address?.street || '',
                city: req.body['address[city]'] || req.body.address?.city || '',
                country: req.body['address[country]'] || req.body.address?.country || ''
            },
            cuisines: req.body.cuisines ? req.body.cuisines.split(',').map(c => c.trim()).filter(c => c !== '') : [],
            amenities: req.body.amenities ? req.body.amenities.split(',').map(a => a.trim()).filter(a => a !== '') : [],
            hasWifi: req.body.hasWifi === 'on',
            image: req.body.image || '',
            location: req.body.location,
            geo: {
                lat: parseFloat(req.body['geo[lat]'] || req.body.geo?.lat || 0),
                lng: parseFloat(req.body['geo[lng]'] || req.body.geo?.lng || 0)
            },
            priceRange: req.body.priceRange || '$$',
            averageCostForTwo: parseInt(req.body.averageCostForTwo) || 0,
            currency: req.body.currency || 'USD'
        };

        const Restaurant = require('./models/Restaurant');
        const restaurant = await Restaurant.findByIdAndUpdate(
            req.params.id,
            restaurantData,
            { new: true, runValidators: true }
        );

        if (!restaurant) {
            return res.status(404).render('error', { 
                message: 'Restaurant not found' 
            });
        }

        // Success - redirect to restaurant details
        res.redirect(`/restaurants/${req.params.id}`);

    } catch (error) {
        console.error('Update restaurant error:', error);
        
        let errors = {};
        if (error.name === 'ValidationError') {
            Object.keys(error.errors).forEach(key => {
                errors[key] = error.errors[key].message;
            });
        } else if (error.name === 'CastError') {
            errors.general = 'Invalid restaurant ID';
        } else {
            errors.general = 'Error updating restaurant: ' + error.message;
        }

        // Get restaurant data for re-rendering form
        const Restaurant = require('./models/Restaurant');
        const restaurant = await Restaurant.findById(req.params.id).lean() || { _id: req.params.id };

        res.render('restaurant-edit', {
            restaurant: {
                ...restaurant,
                ...req.body,
                _id: req.params.id
            },
            errors
        });
    }
});

// DELETE restaurant (with confirmation) - Admin only
app.get('/restaurants/:id/delete', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!req.user) {
            return res.redirect('/auth/login?error=Please+login+to+continue');
        }
        if (req.user.role !== 'admin') {
            return res.status(403).render('error', { 
                message: 'Access denied. Only admins can delete restaurants.' 
            });
        }

        // Check DB connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).render('error', { 
                message: 'Database not available. Please try again later.' 
            });
        }

        const Restaurant = require('./models/Restaurant');
        const restaurant = await Restaurant.findById(req.params.id).lean();
        
        if (!restaurant) {
            return res.status(404).render('error', { 
                message: 'Restaurant not found' 
            });
        }

        res.render('restaurant-delete', { 
            restaurant: {
                ...restaurant,
                _id: restaurant._id.toString()
            }
        });

    } catch (error) {
        console.error('Delete confirmation error:', error);
        res.status(500).render('error', { 
            message: 'Error loading restaurant for deletion' 
        });
    }
});

// DELETE restaurant (confirm) - Admin only
app.post('/restaurants/:id/delete', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!req.user) {
            return res.redirect('/auth/login?error=Please+login+to+continue');
        }
        if (req.user.role !== 'admin') {
            return res.status(403).render('error', { 
                message: 'Access denied. Only admins can delete restaurants.' 
            });
        }

        const Restaurant = require('./models/Restaurant');
        const restaurant = await Restaurant.findByIdAndDelete(req.params.id);

        if (!restaurant) {
            return res.status(404).render('error', { 
                message: 'Restaurant not found' 
            });
        }

        // Success - redirect to search results
        res.redirect('/restaurants/search/results');

    } catch (error) {
        console.error('Delete restaurant error:', error);
        res.status(500).render('error', { 
            message: 'Error deleting restaurant' 
        });
    }
});

// Simple error page
app.get('/error', (req, res) => {
    res.render('error', { message: req.query.message || 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { 
        message: 'Page not found' 
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).render('error', { 
        message: 'Internal server error' 
    });
});

// Check if we're on Vercel
if (process.env.VERCEL) {
  // Export for Vercel serverless functions
  module.exports = app;
} else {
  // Local development
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔗 API available at http://localhost:${PORT}/api/restaurants`);
    console.log(`🔍 Search page: http://localhost:${PORT}/restaurants/search`);
    console.log(`🏪 Add restaurant: http://localhost:${PORT}/restaurants/create`);
  });
}