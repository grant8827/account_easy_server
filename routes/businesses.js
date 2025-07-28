const express = require('express');
const Business = require('../models/Business');
const User = require('../models/User');
const Employee = require('../models/Employee');
const { auth, authorize, businessAccess, ownerOrAdminAccess } = require('../middleware/auth');
const { validateInput, businessCreationRules } = require('../middleware/validation');
const router = express.Router();

// @route   POST /api/businesses
// @desc    Create a new business
// @access  Private
router.post('/', auth, businessCreationRules(), validateInput, async (req, res) => {
  try {
    const {
      name,
      registrationNumber,
      trn,
      nis,
      businessType,
      industry,
      address,
      contactInfo,
      payrollSettings,
      taxSettings,
      fiscalYearEnd,
      settings
    } = req.body;

    // Check if business with same TRN or registration number exists
    const existingBusiness = await Business.findOne({
      $or: [
        { trn },
        { registrationNumber }
      ]
    });

    if (existingBusiness) {
      return res.status(400).json({
        success: false,
        message: 'Business with this TRN or registration number already exists'
      });
    }

    // Create new business
    const business = new Business({
      name,
      registrationNumber,
      trn,
      nis,
      businessType,
      industry,
      address,
      contactInfo,
      owner: req.user.id,
      payrollSettings: payrollSettings || {},
      taxSettings: taxSettings || {},
      fiscalYearEnd,
      settings: settings || {}
    });

    await business.save();

    // Add business to user's businesses array and set as current business
    const user = await User.findById(req.user.id);
    user.businesses.push(business._id);
    if (!user.currentBusiness) {
      user.currentBusiness = business._id;
    }
    await user.save();

    // Populate owner information
    await business.populate('owner', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Business created successfully',
      data: { business }
    });
  } catch (error) {
    console.error('Business creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during business creation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/businesses
// @desc    Get all businesses for the current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, industry, parish } = req.query;
    
    // Build query for businesses where user is owner or employee
    const query = {
      $or: [
        { owner: req.user.id },
        { 'employees.user': req.user.id }
      ],
      isActive: true
    };

    // Add search filter
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { registrationNumber: { $regex: search, $options: 'i' } },
          { trn: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Add industry filter
    if (industry) {
      query.industry = industry;
    }

    // Add parish filter
    if (parish) {
      query['address.parish'] = parish;
    }

    const businesses = await Business.find(query)
      .populate('owner', 'firstName lastName email')
      .populate('employees.user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Business.countDocuments(query);

    res.json({
      success: true,
      data: {
        businesses,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get businesses error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving businesses'
    });
  }
});

// @route   GET /api/businesses/:businessId
// @desc    Get a specific business
// @access  Private
router.get('/:businessId', auth, businessAccess, async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId)
      .populate('owner', 'firstName lastName email phone')
      .populate('employees.user', 'firstName lastName email phone');

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    res.json({
      success: true,
      data: { business }
    });
  } catch (error) {
    console.error('Get business error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving business'
    });
  }
});

// @route   PUT /api/businesses/:businessId
// @desc    Update a business
// @access  Private (Owner or Admin only)
router.put('/:businessId', auth, ownerOrAdminAccess, validateInput, async (req, res) => {
  try {
    const {
      name,
      registrationNumber,
      trn,
      nis,
      businessType,
      industry,
      address,
      contactInfo,
      payrollSettings,
      taxSettings,
      fiscalYearEnd,
      settings
    } = req.body;

    const business = await Business.findById(req.params.businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Check if TRN or registration number is being changed and if it conflicts
    if ((trn && trn !== business.trn) || (registrationNumber && registrationNumber !== business.registrationNumber)) {
      const existingBusiness = await Business.findOne({
        _id: { $ne: business._id },
        $or: [
          { trn: trn || business.trn },
          { registrationNumber: registrationNumber || business.registrationNumber }
        ]
      });

      if (existingBusiness) {
        return res.status(400).json({
          success: false,
          message: 'Business with this TRN or registration number already exists'
        });
      }
    }

    // Update business fields
    if (name) business.name = name;
    if (registrationNumber) business.registrationNumber = registrationNumber;
    if (trn) business.trn = trn;
    if (nis !== undefined) business.nis = nis;
    if (businessType) business.businessType = businessType;
    if (industry) business.industry = industry;
    if (address) business.address = { ...business.address, ...address };
    if (contactInfo) business.contactInfo = { ...business.contactInfo, ...contactInfo };
    if (payrollSettings) business.payrollSettings = { ...business.payrollSettings, ...payrollSettings };
    if (taxSettings) business.taxSettings = { ...business.taxSettings, ...taxSettings };
    if (fiscalYearEnd) business.fiscalYearEnd = fiscalYearEnd;
    if (settings) business.settings = { ...business.settings, ...settings };

    await business.save();

    await business.populate('owner', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Business updated successfully',
      data: { business }
    });
  } catch (error) {
    console.error('Business update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during business update',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/businesses/:businessId
// @desc    Deactivate a business (soft delete)
// @access  Private (Owner only)
router.delete('/:businessId', auth, async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Check if user is the owner
    if (business.owner.toString() !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only business owner can deactivate business.'
      });
    }

    // Soft delete - deactivate the business
    business.isActive = false;
    await business.save();

    // Deactivate all employees of this business
    await Employee.updateMany(
      { business: business._id },
      { isActive: false }
    );

    res.json({
      success: true,
      message: 'Business deactivated successfully'
    });
  } catch (error) {
    console.error('Business deactivation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during business deactivation'
    });
  }
});

// @route   POST /api/businesses/:businessId/employees
// @desc    Add employee to business
// @access  Private (Owner or HR Manager)
router.post('/:businessId/employees', auth, ownerOrAdminAccess, async (req, res) => {
  try {
    const { userId, position, department, startDate, salary } = req.body;

    if (!userId || !position || !department || !startDate || !salary) {
      return res.status(400).json({
        success: false,
        message: 'User ID, position, department, start date, and salary are required'
      });
    }

    const business = await Business.findById(req.params.businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is already an employee of this business
    const existingEmployee = business.employees.find(emp => 
      emp.user.toString() === userId && emp.isActive
    );

    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'User is already an employee of this business'
      });
    }

    // Add employee to business
    const employeeData = {
      user: userId,
      position,
      department,
      startDate: new Date(startDate),
      salary,
      isActive: true
    };

    business.employees.push(employeeData);
    await business.save();

    // Add business to user's businesses if not already there
    if (!user.businesses.includes(business._id)) {
      user.businesses.push(business._id);
      await user.save();
    }

    await business.populate('employees.user', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Employee added to business successfully',
      data: { 
        business,
        newEmployee: business.employees[business.employees.length - 1]
      }
    });
  } catch (error) {
    console.error('Add employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding employee to business'
    });
  }
});

// @route   PUT /api/businesses/:businessId/employees/:employeeId
// @desc    Update employee in business
// @access  Private (Owner or HR Manager)
router.put('/:businessId/employees/:employeeId', auth, ownerOrAdminAccess, async (req, res) => {
  try {
    const { position, department, salary, isActive } = req.body;

    const business = await Business.findById(req.params.businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    const employee = business.employees.id(req.params.employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found in this business'
      });
    }

    // Update employee fields
    if (position) employee.position = position;
    if (department) employee.department = department;
    if (salary) employee.salary = salary;
    if (isActive !== undefined) {
      employee.isActive = isActive;
      if (!isActive) {
        employee.endDate = new Date();
      }
    }

    await business.save();
    await business.populate('employees.user', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: { employee }
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating employee'
    });
  }
});

// @route   DELETE /api/businesses/:businessId/employees/:employeeId
// @desc    Remove employee from business (deactivate)
// @access  Private (Owner or HR Manager)
router.delete('/:businessId/employees/:employeeId', auth, ownerOrAdminAccess, async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    const employee = business.employees.id(req.params.employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found in this business'
      });
    }

    // Deactivate employee
    employee.isActive = false;
    employee.endDate = new Date();

    await business.save();

    res.json({
      success: true,
      message: 'Employee removed from business successfully'
    });
  } catch (error) {
    console.error('Remove employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error removing employee from business'
    });
  }
});

// @route   GET /api/businesses/:businessId/dashboard
// @desc    Get business dashboard data
// @access  Private
router.get('/:businessId/dashboard', auth, businessAccess, async (req, res) => {
  try {
    const businessId = req.params.businessId;
    const { year = new Date().getFullYear() } = req.query;

    // Get active employee count
    const business = await Business.findById(businessId);
    const activeEmployeeCount = business.getActiveEmployees().length;

    // Get transaction summary for the year
    const Transaction = require('../models/Transaction');
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);
    
    const transactionSummary = await Transaction.getFinancialSummary(
      businessId, 
      startOfYear, 
      endOfYear
    );

    // Get payroll summary for the year
    const Payroll = require('../models/Payroll');
    const payrollSummary = await Payroll.getPayrollSummary(
      businessId,
      startOfYear,
      endOfYear
    );

    // Calculate basic financial metrics
    const totalIncome = transactionSummary.income?.total || 0;
    const totalExpenses = transactionSummary.expense?.total || 0;
    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    res.json({
      success: true,
      data: {
        overview: {
          activeEmployees: activeEmployeeCount,
          totalIncome,
          totalExpenses,
          netProfit,
          profitMargin: parseFloat(profitMargin.toFixed(2))
        },
        transactions: transactionSummary,
        payroll: payrollSummary,
        business: {
          name: business.name,
          industry: business.industry,
          fiscalYearEnd: business.fiscalYearEnd
        }
      }
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving dashboard data'
    });
  }
});

module.exports = router;
