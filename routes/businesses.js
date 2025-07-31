const express = require('express');
const Business = require('../models/Business');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Business route handlers
const createBusinessHandler = async (req, res) => {
    try {
        console.log('Creating business with data:', JSON.stringify(req.body, null, 2));
        console.log('User from token:', req.user);
        
        const {
            name,
            registrationNumber,
            trn,
            nis,
            businessType,
            industry,
            address,
            contactInfo,
            payrollSettings,
            taxSettings,
            fiscalYearEnd,
            settings
        } = req.body;

        // Check if business with same TRN or registration number exists
        const existingBusiness = await Business.findOne({
            $or: [
                { trn },
                { registrationNumber }
            ]
        });

        if (existingBusiness) {
            return res.status(400).json({
                success: false,
                message: 'Business with this TRN or registration number already exists'
            });
        }

        // Create new business
        const business = new Business({
            name,
            registrationNumber,
            trn,
            nis,
            businessType,
            industry,
            address,
            contactInfo,
            owner: req.user.id,
            payrollSettings: payrollSettings || {},
            taxSettings: taxSettings || {},
            fiscalYearEnd,
            settings: settings || {}
        });

        await business.save();

        // Add business to user's businesses array
        const user = await User.findById(req.user.id);
        user.businesses.push(business._id);
        if (!user.currentBusiness) {
            user.currentBusiness = business._id;
        }
        await user.save();

        res.status(201).json({
            success: true,
            message: 'Business created successfully',
            business
        });
    } catch (error) {
        console.error('Business creation error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: messages
            });
        }
        
        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `Business with this ${field} already exists`
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error creating business',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getBusinessesHandler = async (req, res) => {
    try {
        console.log('Getting businesses for user:', req.user);
        console.log('User document:', req.userDoc ? 'Found' : 'Not found');
        
        // Use the populated user document from auth middleware
        let user = req.userDoc;
        
        // If userDoc is not available, fetch the user with populated businesses
        if (!user) {
            console.log('User document not found in request, fetching from database...');
            user = await User.findById(req.user.id).populate('businesses');
            
            if (!user) {
                console.error('User not found in database:', req.user.id);
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
        }

        // If businesses aren't populated, populate them
        if (!user.businesses || user.businesses.length === 0 || typeof user.businesses[0] === 'string') {
            console.log('Businesses not populated, populating now...');
            await user.populate('businesses');
        }

        console.log('Returning businesses:', user.businesses?.length || 0);

        res.json({
            success: true,
            businesses: user.businesses || []
        });
    } catch (error) {
        console.error('Get businesses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving businesses',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getBusinessHandler = async (req, res) => {
    try {
        const business = await Business.findOne({
            _id: req.params.businessId,
            owner: req.user.id
        });

        if (!business) {
            return res.status(404).json({
                success: false,
                message: 'Business not found'
            });
        }

        res.json({
            success: true,
            business
        });
    } catch (error) {
        console.error('Get business error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving business'
        });
    }
};

// Routes
router.post('/', createBusinessHandler);
router.get('/', getBusinessesHandler);
router.get('/:businessId', getBusinessHandler);

module.exports = router;
