const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Business = require('../models/Business');
const { auth, superAdminAccess } = require('../middleware/auth');

// @route   GET /api/admin/pending-accounts
// @desc    Get all pending accounts
// @access  Super Admin only
router.get('/pending-accounts', auth, superAdminAccess, async (req, res) => {
    try {
        const pendingUsers = await User.find({ approvalStatus: 'pending' })
            .select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: {
                users: pendingUsers,
                count: pendingUsers.length
            }
        });
    } catch (error) {
        console.error('Get pending accounts error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching pending accounts'
        });
    }
});

// @route   GET /api/admin/all-accounts
// @desc    Get all user accounts
// @access  Super Admin only
router.get('/all-accounts', auth, superAdminAccess, async (req, res) => {
    try {
        const { page = 1, limit = 10, status, role } = req.query;
        
        // Build query filters
        const filters = {};
        if (status) filters.approvalStatus = status;
        if (role) filters.role = role;

        const users = await User.find(filters)
            .select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
            .populate('approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await User.countDocuments(filters);

        res.json({
            success: true,
            data: {
                users,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalUsers: total
            }
        });
    } catch (error) {
        console.error('Get all accounts error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching accounts'
        });
    }
});

// @route   POST /api/admin/approve-account/:userId
// @desc    Approve a pending account
// @access  Super Admin only
router.post('/approve-account/:userId', auth, superAdminAccess, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.approvalStatus === 'approved') {
            return res.status(400).json({
                success: false,
                message: 'User is already approved'
            });
        }

        user.approvalStatus = 'approved';
        user.approvedBy = req.user.id;
        user.approvalDate = new Date();
        user.rejectionReason = undefined; // Clear any previous rejection reason

        await user.save();

        res.json({
            success: true,
            message: 'Account approved successfully',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    approvalStatus: user.approvalStatus,
                    approvalDate: user.approvalDate
                }
            }
        });
    } catch (error) {
        console.error('Approve account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while approving account'
        });
    }
});

// @route   POST /api/admin/reject-account/:userId
// @desc    Reject a pending account
// @access  Super Admin only
router.post('/reject-account/:userId', auth, superAdminAccess, async (req, res) => {
    try {
        const { userId } = req.params;
        const { rejectionReason } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.approvalStatus = 'rejected';
        user.rejectionReason = rejectionReason || 'No reason provided';
        user.approvedBy = req.user.id;
        user.approvalDate = new Date();

        await user.save();

        res.json({
            success: true,
            message: 'Account rejected successfully',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    approvalStatus: user.approvalStatus,
                    rejectionReason: user.rejectionReason
                }
            }
        });
    } catch (error) {
        console.error('Reject account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while rejecting account'
        });
    }
});

// @route   POST /api/admin/create-account
// @desc    Create a new account (pre-approved)
// @access  Super Admin only
router.post('/create-account', auth, superAdminAccess, async (req, res) => {
    try {
        const { email, password, firstName, lastName, role = 'employee', phone, address } = req.body;

        // Validate required fields
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, first name, and last name are required'
            });
        }

        // Check if user already exists
        let existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Create new user (pre-approved)
        const user = new User({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            role,
            phone,
            address,
            isActive: true,
            emailVerified: false,
            approvalStatus: 'approved',
            approvedBy: req.user.id,
            approvalDate: new Date()
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
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
    } catch (error) {
        console.error('Create account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating account'
        });
    }
});

// @route   DELETE /api/admin/delete-account/:userId
// @desc    Delete a user account
// @access  Super Admin only
router.delete('/delete-account/:userId', auth, superAdminAccess, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Prevent super admin from deleting themselves
        if (userId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own account'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Store user info for response
        const deletedUserInfo = {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
        };

        await User.findByIdAndDelete(userId);

        res.json({
            success: true,
            message: 'Account deleted successfully',
            data: {
                deletedUser: deletedUserInfo
            }
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting account'
        });
    }
});

// @route   PUT /api/admin/update-account/:userId
// @desc    Update user account details
// @access  Super Admin only
router.put('/update-account/:userId', auth, superAdminAccess, async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        // Remove sensitive fields that shouldn't be updated via this route
        delete updates.password;
        delete updates._id;
        delete updates.__v;
        delete updates.createdAt;
        delete updates.updatedAt;

        const user = await User.findByIdAndUpdate(
            userId,
            updates,
            { new: true, runValidators: true }
        ).select('-password -refreshTokens -emailVerificationToken -passwordResetToken');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Account updated successfully',
            data: { user }
        });
    } catch (error) {
        console.error('Update account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating account'
        });
    }
});

// @route   POST /api/admin/toggle-user-status/:userId
// @desc    Toggle user active/inactive status
// @access  Super Admin only
router.post('/toggle-user-status/:userId', auth, superAdminAccess, async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (userId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot change your own status'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.isActive = !user.isActive;
        await user.save();

        res.json({
            success: true,
            message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    isActive: user.isActive
                }
            }
        });
    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating user status'
        });
    }
});

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics
// @access  Super Admin only
router.get('/stats', auth, superAdminAccess, async (req, res) => {
    try {
        // Calculate date for "recent" (last 7 days)
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);

        // Get user statistics
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const recentRegistrations = await User.countDocuments({ 
            createdAt: { $gte: lastWeek } 
        });

        // Get business statistics
        const totalBusinesses = await Business.countDocuments();

        // Get approval status statistics
        const pendingApprovals = await User.countDocuments({ 
            approvalStatus: 'pending' 
        });
        const approvedUsers = await User.countDocuments({ 
            approvalStatus: 'approved' 
        });
        const rejectedUsers = await User.countDocuments({ 
            approvalStatus: 'rejected' 
        });

        // Get role distribution
        const roleStats = await User.aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                totalUsers,
                activeUsers,
                recentRegistrations,
                totalBusinesses,
                pendingApprovals,
                approvedUsers,
                rejectedUsers,
                roleDistribution: roleStats
            }
        });
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching admin statistics'
        });
    }
});

module.exports = router;
