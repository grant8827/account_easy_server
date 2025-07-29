const express = require('express');
const router = express.Router();
const authHandlers = require('./authHandlers');
const { auth } = require('../middleware/auth');

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

module.exports = router;
