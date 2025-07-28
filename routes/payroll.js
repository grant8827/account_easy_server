const express = require('express');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Business = require('../models/Business');
const { auth, businessAccess, ownerOrAdminAccess } = require('../middleware/auth');
const { validateInput, payrollRules } = require('../middleware/validation');
const router = express.Router();

// @route   POST /api/payroll
// @desc    Create a new payroll entry
// @access  Private (Owner or HR Manager)
router.post('/', auth, payrollRules(), validateInput, async (req, res) => {
  try {
    const {
      business: businessId,
      employee: employeeId,
      payPeriod,
      earnings,
      workRecord,
      paymentInfo,
      notes
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

    // Check if user has permission to create payroll
    const canCreatePayroll = business.owner.toString() === req.user.id ||
                            req.user.role === 'hr_manager' ||
                            req.user.role === 'accountant' ||
                            req.user.role === 'super_admin';

    if (!canCreatePayroll) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create payroll entries'
      });
    }

    // Check if employee exists and belongs to this business
    const employee = await Employee.findOne({
      _id: employeeId,
      business: businessId,
      isActive: true
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or not active in this business'
      });
    }

    // Check if payroll already exists for this employee and pay period
    const existingPayroll = await Payroll.findOne({
      business: businessId,
      employee: employeeId,
      'payPeriod.startDate': payPeriod.startDate,
      'payPeriod.endDate': payPeriod.endDate
    });

    if (existingPayroll) {
      return res.status(400).json({
        success: false,
        message: 'Payroll entry already exists for this employee and pay period'
      });
    }

    // Create payroll entry
    const payroll = new Payroll({
      business: businessId,
      employee: employeeId,
      payPeriod: {
        startDate: new Date(payPeriod.startDate),
        endDate: new Date(payPeriod.endDate),
        type: payPeriod.type
      },
      earnings: {
        basicSalary: earnings.basicSalary,
        overtime: earnings.overtime || {},
        allowances: earnings.allowances || [],
        bonus: earnings.bonus || 0,
        commission: earnings.commission || 0,
        backPay: earnings.backPay || 0
      },
      workRecord: workRecord || {},
      paymentInfo: {
        payDate: new Date(paymentInfo.payDate),
        paymentMethod: paymentInfo.paymentMethod,
        bankDetails: paymentInfo.bankDetails || {},
        checkNumber: paymentInfo.checkNumber
      },
      notes,
      createdBy: req.user.id
    });

    await payroll.save();

    // Populate related fields
    await payroll.populate('employee business createdBy', 'firstName lastName email name');

    res.status(201).json({
      success: true,
      message: 'Payroll entry created successfully',
      data: { payroll }
    });
  } catch (error) {
    console.error('Payroll creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during payroll creation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/payroll
// @desc    Get payroll entries for a business
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const {
      business: businessId,
      employee: employeeId,
      page = 1,
      limit = 20,
      startDate,
      endDate,
      status,
      payPeriodType,
      sortBy = 'payPeriod.startDate',
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

    if (employeeId) query.employee = employeeId;
    if (status) query.status = status;
    if (payPeriodType) query['payPeriod.type'] = payPeriodType;

    // Date range filter
    if (startDate || endDate) {
      query['payPeriod.startDate'] = {};
      if (startDate) query['payPeriod.startDate'].$gte = new Date(startDate);
      if (endDate) query['payPeriod.startDate'].$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const payrolls = await Payroll.find(query)
      .populate('employee', 'employeeId personalInfo employment')
      .populate('business', 'name')
      .populate('createdBy', 'firstName lastName email')
      .populate('processedBy', 'firstName lastName email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payroll.countDocuments(query);

    // Calculate summary for filtered results
    const summary = await Payroll.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          totalGross: { $sum: '$earnings.grossEarnings' },
          totalNet: { $sum: '$netPay' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        payrolls,
        summary: summary.reduce((acc, item) => {
          acc[item._id] = {
            totalGross: item.totalGross,
            totalNet: item.totalNet,
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
    console.error('Get payroll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving payroll entries'
    });
  }
});

// @route   GET /api/payroll/:payrollId
// @desc    Get a specific payroll entry
// @access  Private
router.get('/:payrollId', auth, async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.payrollId)
      .populate('employee', 'employeeId personalInfo employment compensation taxInfo')
      .populate('business', 'name payrollSettings taxSettings')
      .populate('createdBy', 'firstName lastName email')
      .populate('processedBy', 'firstName lastName email')
      .populate('approvals.approver', 'firstName lastName email');

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll entry not found'
      });
    }

    // Check access
    const business = await Business.findOne({
      _id: payroll.business._id,
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
      data: { payroll }
    });
  } catch (error) {
    console.error('Get payroll entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving payroll entry'
    });
  }
});

// @route   PUT /api/payroll/:payrollId
// @desc    Update a payroll entry
// @access  Private (Owner or HR Manager)
router.put('/:payrollId', auth, validateInput, async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.payrollId);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll entry not found'
      });
    }

    // Check business access and permissions
    const business = await Business.findOne({
      _id: payroll.business,
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

    const canEdit = business.owner.toString() === req.user.id ||
                   req.user.role === 'hr_manager' ||
                   req.user.role === 'accountant' ||
                   req.user.role === 'super_admin';

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit payroll entries'
      });
    }

    // Check if payroll is already paid
    if (payroll.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit payroll that has already been paid'
      });
    }

    const {
      earnings,
      workRecord,
      paymentInfo,
      notes,
      status
    } = req.body;

    // Update fields
    if (earnings) {
      payroll.earnings = { ...payroll.earnings, ...earnings };
    }

    if (workRecord) {
      payroll.workRecord = { ...payroll.workRecord, ...workRecord };
    }

    if (paymentInfo) {
      payroll.paymentInfo = { ...payroll.paymentInfo, ...paymentInfo };
      if (paymentInfo.payDate) {
        payroll.paymentInfo.payDate = new Date(paymentInfo.payDate);
      }
    }

    if (notes !== undefined) payroll.notes = notes;
    if (status && ['draft', 'calculated', 'approved'].includes(status)) {
      payroll.status = status;
    }

    await payroll.save();

    await payroll.populate('employee business createdBy', 'firstName lastName email name');

    res.json({
      success: true,
      message: 'Payroll entry updated successfully',
      data: { payroll }
    });
  } catch (error) {
    console.error('Payroll update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during payroll update',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/payroll/:payrollId/approve
// @desc    Approve a payroll entry
// @access  Private (Owner or HR Manager)
router.post('/:payrollId/approve', auth, ownerOrAdminAccess, async (req, res) => {
  try {
    const { comments } = req.body;

    const payroll = await Payroll.findById(req.params.payrollId);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll entry not found'
      });
    }

    if (payroll.status !== 'calculated') {
      return res.status(400).json({
        success: false,
        message: 'Payroll must be in calculated status to approve'
      });
    }

    await payroll.approve(req.user.id, comments);

    res.json({
      success: true,
      message: 'Payroll entry approved successfully',
      data: { payroll }
    });
  } catch (error) {
    console.error('Payroll approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during payroll approval'
    });
  }
});

// @route   POST /api/payroll/:payrollId/pay
// @desc    Mark payroll as paid
// @access  Private (Owner or HR Manager)
router.post('/:payrollId/pay', auth, ownerOrAdminAccess, async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.payrollId);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll entry not found'
      });
    }

    if (payroll.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Payroll must be approved before it can be marked as paid'
      });
    }

    await payroll.markAsPaid(req.user.id);

    res.json({
      success: true,
      message: 'Payroll marked as paid successfully',
      data: { payroll }
    });
  } catch (error) {
    console.error('Payroll payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during payroll payment processing'
    });
  }
});

// @route   DELETE /api/payroll/:payrollId
// @desc    Delete a payroll entry
// @access  Private (Owner only)
router.delete('/:payrollId', auth, async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.payrollId);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll entry not found'
      });
    }

    // Check if user is business owner
    const business = await Business.findById(payroll.business);
    if (!business || (business.owner.toString() !== req.user.id && req.user.role !== 'super_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can delete payroll entries'
      });
    }

    // Check if payroll is paid
    if (payroll.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete payroll that has been paid'
      });
    }

    await Payroll.findByIdAndDelete(req.params.payrollId);

    res.json({
      success: true,
      message: 'Payroll entry deleted successfully'
    });
  } catch (error) {
    console.error('Payroll deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during payroll deletion'
    });
  }
});

// @route   GET /api/payroll/business/:businessId/summary
// @desc    Get payroll summary for a business
// @access  Private
router.get('/business/:businessId/summary', auth, businessAccess, async (req, res) => {
  try {
    const { year = new Date().getFullYear(), startDate, endDate } = req.query;
    const businessId = req.params.businessId;

    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31);
    }

    const summary = await Payroll.getPayrollSummary(businessId, start, end);

    // Get monthly breakdown
    const monthlyBreakdown = await Payroll.aggregate([
      {
        $match: {
          business: mongoose.Types.ObjectId(businessId),
          'payPeriod.startDate': { $gte: start, $lte: end },
          status: { $in: ['approved', 'paid'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$payPeriod.startDate' },
            month: { $month: '$payPeriod.startDate' }
          },
          totalGross: { $sum: '$earnings.grossEarnings' },
          totalNet: { $sum: '$netPay' },
          totalDeductions: { $sum: '$deductions.totalDeductions' },
          employeeCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get tax breakdown
    const taxBreakdown = await Payroll.aggregate([
      {
        $match: {
          business: mongoose.Types.ObjectId(businessId),
          'payPeriod.startDate': { $gte: start, $lte: end },
          status: { $in: ['approved', 'paid'] }
        }
      },
      {
        $group: {
          _id: null,
          totalPAYE: { $sum: '$deductions.paye.amount' },
          totalNIS: { $sum: '$deductions.nis.contribution' },
          totalEducationTax: { $sum: '$deductions.educationTax.amount' },
          totalHeartTrust: { $sum: '$deductions.heartTrust.amount' },
          totalPension: { $sum: '$deductions.pension.employeeContribution' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period: { start, end },
        summary,
        monthlyBreakdown,
        taxBreakdown: taxBreakdown[0] || {}
      }
    });
  } catch (error) {
    console.error('Payroll summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving payroll summary'
    });
  }
});

// @route   POST /api/payroll/business/:businessId/bulk-create
// @desc    Create payroll entries for all active employees
// @access  Private (Owner or HR Manager)
router.post('/business/:businessId/bulk-create', auth, ownerOrAdminAccess, async (req, res) => {
  try {
    const { payPeriod, payDate } = req.body;
    const businessId = req.params.businessId;

    if (!payPeriod || !payPeriod.startDate || !payPeriod.endDate || !payPeriod.type) {
      return res.status(400).json({
        success: false,
        message: 'Pay period information is required'
      });
    }

    if (!payDate) {
      return res.status(400).json({
        success: false,
        message: 'Pay date is required'
      });
    }

    // Get all active employees for this business
    const employees = await Employee.find({
      business: businessId,
      isActive: true
    }).populate('user', 'firstName lastName email');

    if (employees.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active employees found for this business'
      });
    }

    const business = await Business.findById(businessId);
    const createdPayrolls = [];
    const errors = [];

    // Create payroll for each employee
    for (const employee of employees) {
      try {
        // Check if payroll already exists
        const existingPayroll = await Payroll.findOne({
          business: businessId,
          employee: employee._id,
          'payPeriod.startDate': new Date(payPeriod.startDate),
          'payPeriod.endDate': new Date(payPeriod.endDate)
        });

        if (existingPayroll) {
          errors.push({
            employee: employee.employeeId,
            error: 'Payroll already exists for this period'
          });
          continue;
        }

        // Calculate basic salary based on employment type
        let basicSalary = employee.compensation.baseSalary.amount;
        
        // Adjust salary based on frequency and pay period type
        if (employee.compensation.baseSalary.frequency === 'annually') {
          if (payPeriod.type === 'monthly') {
            basicSalary = basicSalary / 12;
          } else if (payPeriod.type === 'bi-weekly') {
            basicSalary = basicSalary / 26;
          } else if (payPeriod.type === 'weekly') {
            basicSalary = basicSalary / 52;
          }
        }

        const payroll = new Payroll({
          business: businessId,
          employee: employee._id,
          payPeriod: {
            startDate: new Date(payPeriod.startDate),
            endDate: new Date(payPeriod.endDate),
            type: payPeriod.type
          },
          earnings: {
            basicSalary,
            allowances: employee.compensation.allowances || []
          },
          paymentInfo: {
            payDate: new Date(payDate),
            paymentMethod: 'bank_transfer',
            bankDetails: employee.bankDetails || {}
          },
          createdBy: req.user.id,
          status: 'calculated'
        });

        await payroll.save();
        createdPayrolls.push({
          employee: employee.employeeId,
          payrollId: payroll._id
        });
      } catch (error) {
        errors.push({
          employee: employee.employeeId,
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Bulk payroll creation completed. Created ${createdPayrolls.length} entries.`,
      data: {
        created: createdPayrolls,
        errors: errors,
        summary: {
          totalEmployees: employees.length,
          successful: createdPayrolls.length,
          failed: errors.length
        }
      }
    });
  } catch (error) {
    console.error('Bulk payroll creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk payroll creation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
