const express = require('express');
const Transaction = require('../models/Transaction');
const Business = require('../models/Business');
const { auth, businessAccess } = require('../middleware/auth');
const { validateInput, transactionRules } = require('../middleware/validation');
const router = express.Router();

// @route   POST /api/transactions
// @desc    Create a new transaction
// @access  Private
router.post('/', auth, transactionRules(), validateInput, async (req, res) => {
  try {
    const {
      business: businessId,
      type,
      category,
      description,
      amount,
      currency,
      exchangeRate,
      date,
      paymentMethod,
      reference,
      vendor,
      customer,
      taxInfo,
      attachments,
      notes,
      tags
    } = req.body;

    // Check business access
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
        message: 'Access denied or business not found'
      });
    }

    // Create transaction
    const transaction = new Transaction({
      business: businessId,
      type,
      category,
      description,
      amount,
      currency: currency || 'JMD',
      exchangeRate: exchangeRate || 1,
      date: date ? new Date(date) : new Date(),
      paymentMethod,
      reference,
      vendor,
      customer,
      taxInfo: {
        isTaxable: taxInfo?.isTaxable !== false,
        gctRate: taxInfo?.gctRate || 0.15,
        gctAmount: taxInfo?.gctAmount || 0,
        withholdingTax: taxInfo?.withholdingTax || {}
      },
      attachments: attachments || [],
      createdBy: req.user.id,
      notes,
      tags: tags || []
    });

    await transaction.save();

    // Populate created by user
    await transaction.populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: { transaction }
    });
  } catch (error) {
    console.error('Transaction creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during transaction creation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/transactions
// @desc    Get transactions for a business
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const {
      business: businessId,
      page = 1,
      limit = 20,
      search,
      type,
      category,
      status,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      reconciled,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Business ID is required'
      });
    }

    // Check business access
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
        message: 'Access denied or business not found'
      });
    }

    // Build query
    const query = { business: businessId };

    // Add filters
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { transactionNumber: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { 'vendor.name': { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } }
      ];
    }

    if (type) query.type = type;
    if (category) query.category = category;
    if (status) query.status = status;
    if (reconciled !== undefined) query.reconciled = reconciled === 'true';

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const transactions = await Transaction.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .populate('reconciledBy', 'firstName lastName email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    // Calculate summary for the filtered results
    const summary = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        summary: summary.reduce((acc, item) => {
          acc[item._id] = {
            total: item.totalAmount,
            count: item.count
          };
          return acc;
        }, {}),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving transactions'
    });
  }
});

// @route   GET /api/transactions/:transactionId
// @desc    Get a specific transaction
// @access  Private
router.get('/:transactionId', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.transactionId)
      .populate('business', 'name')
      .populate('createdBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .populate('reconciledBy', 'firstName lastName email');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check business access
    const business = await Business.findOne({
      _id: transaction.business._id,
      $or: [
        { owner: req.user.id },
        { 'employees.user': req.user.id }
      ]
    });

    if (!business) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { transaction }
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving transaction'
    });
  }
});

// @route   PUT /api/transactions/:transactionId
// @desc    Update a transaction
// @access  Private
router.put('/:transactionId', auth, validateInput, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check business access
    const business = await Business.findOne({
      _id: transaction.business,
      $or: [
        { owner: req.user.id },
        { 'employees.user': req.user.id }
      ]
    });

    if (!business) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if transaction is reconciled (can't edit reconciled transactions)
    if (transaction.reconciled) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit reconciled transactions'
      });
    }

    const {
      type,
      category,
      description,
      amount,
      currency,
      exchangeRate,
      date,
      paymentMethod,
      reference,
      vendor,
      customer,
      taxInfo,
      notes,
      tags,
      status
    } = req.body;

    // Update fields
    if (type) transaction.type = type;
    if (category) transaction.category = category;
    if (description) transaction.description = description;
    if (amount !== undefined) transaction.amount = amount;
    if (currency) transaction.currency = currency;
    if (exchangeRate !== undefined) transaction.exchangeRate = exchangeRate;
    if (date) transaction.date = new Date(date);
    if (paymentMethod) transaction.paymentMethod = paymentMethod;
    if (reference !== undefined) transaction.reference = reference;
    if (vendor) transaction.vendor = { ...transaction.vendor, ...vendor };
    if (customer) transaction.customer = { ...transaction.customer, ...customer };
    if (taxInfo) transaction.taxInfo = { ...transaction.taxInfo, ...taxInfo };
    if (notes !== undefined) transaction.notes = notes;
    if (tags) transaction.tags = tags;
    if (status) transaction.status = status;

    await transaction.save();

    await transaction.populate('createdBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: { transaction }
    });
  } catch (error) {
    console.error('Transaction update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during transaction update',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/transactions/:transactionId
// @desc    Delete a transaction
// @access  Private
router.delete('/:transactionId', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check business access and permissions
    const business = await Business.findOne({
      _id: transaction.business,
      $or: [
        { owner: req.user.id },
        { 'employees.user': req.user.id }
      ]
    });

    if (!business) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if user is owner or created the transaction
    const canDelete = business.owner.toString() === req.user.id ||
                     transaction.createdBy.toString() === req.user.id ||
                     req.user.role === 'super_admin';

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete transactions you created or if you are the business owner'
      });
    }

    // Check if transaction is reconciled
    if (transaction.reconciled) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete reconciled transactions'
      });
    }

    await Transaction.findByIdAndDelete(req.params.transactionId);

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Transaction deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during transaction deletion'
    });
  }
});

// @route   PUT /api/transactions/:transactionId/reconcile
// @desc    Mark transaction as reconciled
// @access  Private
router.put('/:transactionId/reconcile', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check business access
    const business = await Business.findOne({
      _id: transaction.business,
      $or: [
        { owner: req.user.id },
        { 'employees.user': req.user.id }
      ]
    });

    if (!business) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if user has permission to reconcile
    const canReconcile = business.owner.toString() === req.user.id ||
                        req.user.role === 'accountant' ||
                        req.user.role === 'super_admin';

    if (!canReconcile) {
      return res.status(403).json({
        success: false,
        message: 'Only business owners or accountants can reconcile transactions'
      });
    }

    await transaction.markReconciled(req.user.id);

    res.json({
      success: true,
      message: 'Transaction marked as reconciled',
      data: { transaction }
    });
  } catch (error) {
    console.error('Transaction reconciliation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during transaction reconciliation'
    });
  }
});

// @route   GET /api/transactions/business/:businessId/financial-summary
// @desc    Get financial summary for a business
// @access  Private
router.get('/business/:businessId/financial-summary', auth, businessAccess, async (req, res) => {
  try {
    const { startDate, endDate, year = new Date().getFullYear() } = req.query;
    const businessId = req.params.businessId;

    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      start = new Date(year, 0, 1); // January 1st
      end = new Date(year, 11, 31); // December 31st
    }

    const summary = await Transaction.getFinancialSummary(businessId, start, end);

    // Get monthly breakdown
    const monthlyBreakdown = await Transaction.aggregate([
      {
        $match: {
          business: mongoose.Types.ObjectId(businessId),
          date: { $gte: start, $lte: end },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get category breakdown
    const categoryBreakdown = await Transaction.aggregate([
      {
        $match: {
          business: mongoose.Types.ObjectId(businessId),
          date: { $gte: start, $lte: end },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            type: '$type',
            category: '$category'
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    // Calculate key metrics
    const totalIncome = summary.income?.total || 0;
    const totalExpenses = summary.expense?.total || 0;
    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    res.json({
      success: true,
      data: {
        period: { startDate: start, endDate: end },
        summary,
        metrics: {
          totalIncome,
          totalExpenses,
          netProfit,
          profitMargin: parseFloat(profitMargin.toFixed(2)),
          transactionCount: (summary.income?.count || 0) + (summary.expense?.count || 0)
        },
        monthlyBreakdown,
        categoryBreakdown
      }
    });
  } catch (error) {
    console.error('Financial summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving financial summary'
    });
  }
});

// @route   GET /api/transactions/business/:businessId/cash-flow
// @desc    Get cash flow analysis for a business
// @access  Private
router.get('/business/:businessId/cash-flow', auth, businessAccess, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const businessId = req.params.businessId;

    const cashFlow = await Transaction.aggregate([
      {
        $match: {
          business: mongoose.Types.ObjectId(businessId),
          date: {
            $gte: new Date(year, 0, 1),
            $lte: new Date(year, 11, 31)
          },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          cashIn: {
            $sum: {
              $cond: [
                { $in: ['$type', ['income', 'asset_sale']] },
                '$amount',
                0
              ]
            }
          },
          cashOut: {
            $sum: {
              $cond: [
                { $in: ['$type', ['expense', 'asset_purchase']] },
                '$amount',
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          cashIn: 1,
          cashOut: 1,
          netCashFlow: { $subtract: ['$cashIn', '$cashOut'] }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Calculate cumulative cash flow
    let cumulativeCashFlow = 0;
    const cashFlowWithCumulative = cashFlow.map(item => {
      cumulativeCashFlow += item.netCashFlow;
      return {
        ...item,
        cumulativeCashFlow
      };
    });

    res.json({
      success: true,
      data: {
        year: parseInt(year),
        cashFlow: cashFlowWithCumulative,
        summary: {
          totalCashIn: cashFlow.reduce((sum, item) => sum + item.cashIn, 0),
          totalCashOut: cashFlow.reduce((sum, item) => sum + item.cashOut, 0),
          netCashFlow: cashFlow.reduce((sum, item) => sum + item.netCashFlow, 0)
        }
      }
    });
  } catch (error) {
    console.error('Cash flow analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving cash flow analysis'
    });
  }
});

module.exports = router;
