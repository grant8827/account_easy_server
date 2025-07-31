const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const authHandlers = require('./authHandlers');
const { auth } = require('../middleware/auth');

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

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', authHandlers.register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', authHandlers.login);

// @route   GET /api/auth/me
// @desc    Get authenticated user
// @access  Private
router.get('/me', auth, authHandlers.getMe);

// @route   POST /api/auth/refresh-token
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh-token', auth, async (req, res) => {
  try {
    // User is already verified by auth middleware
    const user = req.userDoc;
    
    // Generate new token
    const token = await createToken(user);
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing token'
    });
  }
});

module.exports = router;
