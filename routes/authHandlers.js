const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateRegistration } = require('../middleware/validation');

// Helper function to create JWT token
const createToken = (user) => {
  const payload = {
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  };

  return new Promise((resolve, reject) => {
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) reject(err);
        resolve(token);
      }
    );
  });
};

module.exports = {
  // @desc    Register a new user
  // @route   POST /api/auth/register
  register: async (req, res) => {
    try {
      const { email, password, firstName, lastName, role = 'employee', phone, address } = req.body;

      // Validate input
      const validationError = validateRegistration(req.body);
      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError
        });
      }

      // Check if user already exists
      let user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      // Create new user
      user = new User({
        email: email.toLowerCase(),
        password,
        firstName,
        lastName,
        role,
        phone,
        address,
        isActive: true,
        emailVerified: false,
        approvalStatus: role === 'super_admin' ? 'approved' : 'pending' // Super admins are auto-approved
      });

      // Hash password
      const salt = await bcrypt.genSalt(12);
      user.password = await bcrypt.hash(password, salt);

      // Save user
      await user.save();

      if (user.approvalStatus === 'pending') {
        return res.status(201).json({
          success: true,
          message: 'Registration successful. Your account is pending approval by a super administrator.',
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              approvalStatus: user.approvalStatus
            }
          }
        });
      }

      // Create JWT payload for approved users (super_admin)
      const token = await createToken(user);
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            phone: user.phone,
            address: user.address
          }
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during registration',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // @desc    Login user
  // @route   POST /api/auth/login
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Check for user
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Your account has been deactivated'
        });
      }

      // Check approval status
      if (user.approvalStatus !== 'approved') {
        let message = 'Your account is pending approval by a super administrator';
        if (user.approvalStatus === 'rejected') {
          message = `Your account has been rejected${user.rejectionReason ? ': ' + user.rejectionReason : ''}`;
        }
        return res.status(401).json({
          success: false,
          message
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Create token and update last login
      const token = await createToken(user);
      user.lastLogin = new Date();
      await user.save();

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            phone: user.phone,
            address: user.address,
            businesses: user.businesses,
            currentBusiness: user.currentBusiness
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // @desc    Get authenticated user
  // @route   GET /api/auth/me
  getMe: async (req, res) => {
    try {
      const user = await User.findById(req.user.id)
        .select('-password')
        .populate('businesses', 'name registrationNumber trn')
        .populate('currentBusiness', 'name registrationNumber trn');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching user data',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};
