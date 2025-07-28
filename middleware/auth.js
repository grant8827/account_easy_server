const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, access denied'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError.message);
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
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No user found.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

// Business access middleware
const businessAccess = async (req, res, next) => {
  try {
    const businessId = req.params.businessId || req.body.businessId || req.query.businessId;
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Business ID is required'
      });
    }

    const Business = require('../models/Business');
    
    // Check if user has access to this business
    const business = await Business.findOne({
      _id: businessId,
      $or: [
        { owner: req.user.id },
        { 'employees.user': req.user.id }
      ]
    });

    if (!business) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access this business.'
      });
    }

    // Check if business is active
    if (!business.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Business is inactive'
      });
    }

    req.business = business;
    next();
  } catch (error) {
    console.error('Business access middleware error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error in business access check'
    });
  }
};

// Owner or admin access middleware
const ownerOrAdminAccess = async (req, res, next) => {
  try {
    const businessId = req.params.businessId || req.body.businessId || req.query.businessId;
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Business ID is required'
      });
    }

    const Business = require('../models/Business');
    
    // Check if user is owner or has admin role
    const business = await Business.findOne({
      _id: businessId,
      $or: [
        { owner: req.user.id },
        { 
          'employees.user': req.user.id,
          'employees.$.role': { $in: ['hr_manager', 'accountant'] }
        }
      ]
    });

    if (!business && !['super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Owner or admin access required.'
      });
    }

    req.business = business;
    next();
  } catch (error) {
    console.error('Owner/Admin access middleware error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error in access check'
    });
  }
};

// Rate limiting middleware for sensitive operations
const sensitiveOperationLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for sensitive operations
  message: {
    success: false,
    message: 'Too many attempts for this operation, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  auth,
  authorize,
  businessAccess,
  ownerOrAdminAccess,
  sensitiveOperationLimit
};
