const express = require('express');
const Business = require('../models/Business');
const Employee = require('../models/Employee');
const Transaction = require('../models/Transaction');
const Payroll = require('../models/Payroll');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics for the current user
const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = req.userDoc;

        // Initialize stats
        let stats = {
            totalBusinesses: 0,
            totalEmployees: 0,
            monthlyPayroll: 0,
            pendingTransactions: 0
        };

        // For super_admin, get all businesses
        if (user.role === 'super_admin') {
            // Total businesses (all)
            stats.totalBusinesses = await Business.countDocuments();
            
            // Total employees (all)
            stats.totalEmployees = await Employee.countDocuments();
            
            // Monthly payroll (all active employees)
            const allEmployees = await Employee.find({ 
                'employment.status': 'active' 
            }).select('compensation.basicSalary compensation.allowances');
            
            stats.monthlyPayroll = allEmployees.reduce((total, emp) => {
                return total + (emp.compensation.basicSalary || 0) + (emp.compensation.allowances || 0);
            }, 0);
            
            // Pending transactions (all)
            stats.pendingTransactions = await Transaction.countDocuments({ 
                status: 'pending' 
            });
        } else {
            // For regular users, find businesses they own or are employed by
            const ownedBusinesses = await Business.find({ owner: userId }).select('_id');
            const employedBusinesses = await Business.find({ 
                'employees.user': userId,
                'employees.isActive': true 
            }).select('_id');
            
            // Combine owned and employed businesses (remove duplicates)
            const allUserBusinessIds = [
                ...ownedBusinesses.map(b => b._id),
                ...employedBusinesses.map(b => b._id)
            ];
            const uniqueBusinessIds = [...new Set(allUserBusinessIds.map(id => id.toString()))];
            
            if (uniqueBusinessIds.length > 0) {
                // Total businesses accessible by user
                stats.totalBusinesses = uniqueBusinessIds.length;
                
                // Total employees in user's accessible businesses
                stats.totalEmployees = await Employee.countDocuments({
                    business: { $in: uniqueBusinessIds }
                });
                
                // Monthly payroll for user's businesses
                const userEmployees = await Employee.find({
                    business: { $in: uniqueBusinessIds },
                    'employment.status': 'active'
                }).select('compensation.basicSalary compensation.allowances');
                
                stats.monthlyPayroll = userEmployees.reduce((total, emp) => {
                    return total + (emp.compensation.basicSalary || 0) + (emp.compensation.allowances || 0);
                }, 0);
                
                // Pending transactions for user's businesses
                stats.pendingTransactions = await Transaction.countDocuments({
                    business: { $in: uniqueBusinessIds },
                    status: 'pending'
                });
            }
        }

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving dashboard statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Routes
router.use(auth); // Apply auth middleware

router.get('/stats', getDashboardStats);

module.exports = router;
