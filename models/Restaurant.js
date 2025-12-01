const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  stars: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 500
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const addressSchema = new mongoose.Schema({
  street: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    required: true,
    trim: true
  }
});

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Restaurant name is required'],
    trim: true,
    maxlength: 100
  },
  rating: {
    type: Number,
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot be more than 5'],
    default: 0
  },
  address: {
    type: addressSchema,
    required: true
  },
  cuisines: [{
    type: String,
    trim: true
  }],
  amenities: [{
    type: String,
    trim: true
  }],
  hasWifi: {
    type: Boolean,
    default: false
  },
  image: {
    type: String,
    default: 'https://picsum.photos/400/300?food',
    validate: {
        validator: function(v) {
            // Allow empty
            if (!v || v.trim() === '') return true;
            
            // Check if it's a valid URL (any valid URL)
            try {
                new URL(v);
                return v.startsWith('http://') || v.startsWith('https://');
            } catch (e) {
                return false;
            }
        },
        message: 'Image must be a valid URL (e.g., https://example.com/image)'
    }
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  geo: {
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    }
  },
  reviews: [reviewSchema],
  priceRange: {
    type: String,
    enum: ['$', '$$', '$$$', '$$$$'],
    required: true
  },
  averageCostForTwo: {
    type: Number,
    min: 0,
    required: true
  },
  currency: {
    type: String,
    required: true,
    trim: true
  },
  votes: {
    type: Number,
    min: 0,
    default: 0
  }
}, {
  timestamps: true
});

// Index for better query performance
restaurantSchema.index({ 'address.city': 1 });
restaurantSchema.index({ cuisines: 1 });
restaurantSchema.index({ rating: -1 });

module.exports = mongoose.model('Restaurant', restaurantSchema);