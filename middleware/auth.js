const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Business = require('../models/Business');

// Authentication middleware
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authorization header must start with Bearer'
            });
        }

        const token = authHeader.split(' ')[1];

        if (!token || token === 'null' || token === 'undefined') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token provided'
            });
        }

        // Verify token
        let decoded;
        try {
            if (!process.env.JWT_SECRET) {
                console.error('JWT_SECRET is not defined in environment variables');
                return res.status(500).json({
                    success: false,
                    message: 'Server configuration error'
                });
            }
            
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            if (!decoded.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token structure'
                });
            }
        } catch (verifyError) {
            console.error('Token verification failed:', verifyError.message);
            if (verifyError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token has expired'
                });
            }
            return res.status(401).json({
                success: false,
                message: 'Token verification failed'
            });
        }
        
        // Get user from database
        const user = await User.findById(decoded.user.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Token is not valid'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // Add user to request
        req.user = decoded.user;
        req.userDoc = user;

        // Populate businesses for convenience
        if (user.businesses && user.businesses.length > 0) {
            await user.populate('businesses');
        }

        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        res.status(401).json({
            success: false,
            message: 'Token is not valid'
        });
    }
};

// Owner or Admin access middleware
const ownerOrAdminAccess = async (req, res, next) => {
    try {
        // Check if user is super_admin or business_owner
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!['super_admin', 'business_owner', 'hr_manager'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Required role: business owner or HR manager'
            });
        }

        next();
    } catch (error) {
        console.error('Owner/Admin access middleware error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error checking access permissions'
        });
    }
};

// Business access middleware
const businessAccess = async (req, res, next) => {
    try {
        const businessId = req.params.businessId;
        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: 'Business ID is required'
            });
        }

        // Get business from database
        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({
                success: false,
                message: 'Business not found'
            });
        }

        // Check if user has access to this business
        const user = await User.findById(req.user.id);
        if (!user.businesses.includes(business._id) && 
            user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this business'
            });
        }

        // Add business to request
        req.business = business;
        next();
    } catch (error) {
        console.error('Business access middleware error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error checking business access'
        });
    }
};

module.exports = {
    auth,
    businessAccess,
    ownerOrAdminAccess
};
