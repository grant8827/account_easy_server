const express = require('express');
const mongoose = require('mongoose');
const Business = require('../models/Business');
const Employee = require('../models/Employee');
const Transaction = require('../models/Transaction');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/dashboard/summary
// @desc    Get dashboard summary data for the authenticated user
// @access  Private
router.get('/summary', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's businesses
    const businesses = await Business.find({
      $or: [
        { owner: userId },
        { 'employees.user': userId }
      ]
    }).select('_id name owner');

    const businessIds = businesses.map(b => b._id);

    // Get total employees across all user's businesses
    const totalEmployees = await Employee.countDocuments({
      business: { $in: businessIds }
    });

    // Get total pending transactions
    const pendingTransactions = await Transaction.countDocuments({
      business: { $in: businessIds },
      status: 'pending'
    });

    // Calculate monthly payroll (sum of all employee salaries)
    const payrollData = await Employee.aggregate([
      {
        $match: {
          business: { $in: businessIds },
          'employment.status': 'active'
        }
      },
      {
        $group: {
          _id: null,
          totalMonthlyPayroll: { $sum: '$compensation.salary' }
        }
      }
    ]);

    const monthlyPayroll = payrollData.length > 0 ? payrollData[0].totalMonthlyPayroll : 0;

    // Get recent transactions for activity feed
    const recentTransactions = await Transaction.find({
      business: { $in: businessIds }
    })
    .populate('business', 'name')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('description amount type date status business createdBy');

    // Get monthly income vs expenses for the current year
    const currentYear = new Date().getFullYear();
    const monthlyFinancials = await Transaction.aggregate([
      {
        $match: {
          business: { $in: businessIds },
          date: {
            $gte: new Date(currentYear, 0, 1),
            $lte: new Date(currentYear, 11, 31)
          },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      },
      {
        $sort: { '_id.month': 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalBusinesses: businesses.length,
          totalEmployees,
          monthlyPayroll,
          pendingTransactions
        },
        businesses: businesses.map(b => ({
          _id: b._id,
          name: b.name,
          isOwner: b.owner.toString() === userId
        })),
        recentActivity: recentTransactions,
        monthlyFinancials
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving dashboard data'
    });
  }
});

// @route   GET /api/dashboard/business/:businessId/stats
// @desc    Get specific business statistics
// @access  Private
router.get('/business/:businessId/stats', auth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    // Verify user has access to this business
    const business = await Business.findOne({
      _id: businessId,
      $or: [
        { owner: userId },
        { 'employees.user': userId }
      ]
    });

    if (!business) {
      return res.status(403).json({
        success: false,
        message: 'Access denied or business not found'
      });
    }

    // Get business-specific stats
    const employeeCount = await Employee.countDocuments({
      business: businessId,
      'employment.status': 'active'
    });

    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          business: mongoose.Types.ObjectId(businessId)
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const payrollTotal = await Employee.aggregate([
      {
        $match: {
          business: mongoose.Types.ObjectId(businessId),
          'employment.status': 'active'
        }
      },
      {
        $group: {
          _id: null,
          totalSalary: { $sum: '$compensation.salary' }
        }
      }
    ]);

    // Get current month's financial summary
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const monthlyFinancials = await Transaction.aggregate([
      {
        $match: {
          business: mongoose.Types.ObjectId(businessId),
          date: { $gte: startOfMonth, $lte: endOfMonth },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = transactionStats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount
      };
      return acc;
    }, {});

    const financials = monthlyFinancials.reduce((acc, item) => {
      acc[item._id] = {
        total: item.total,
        count: item.count
      };
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        business: {
          _id: business._id,
          name: business.name
        },
        stats: {
          employees: employeeCount,
          monthlyPayroll: payrollTotal.length > 0 ? payrollTotal[0].totalSalary : 0,
          transactions: stats,
          currentMonth: financials
        }
      }
    });
  } catch (error) {
    console.error('Business stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving business statistics'
    });
  }
});

module.exports = router;
