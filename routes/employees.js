const express = require('express');
const Employee = require('../models/Employee');
const Business = require('../models/Business');
const User = require('../models/User');
const { auth, businessAccess, ownerOrAdminAccess } = require('../middleware/auth');
const { validateInput, employeeCreationRules } = require('../middleware/validation');
const router = express.Router();

// @route   POST /api/employees
// @desc    Create a new employee
// @access  Private (Owner or HR Manager)
router.post('/', auth, employeeCreationRules(), validateInput, async (req, res) => {
  try {
    const {
      user: userId,
      business: businessId,
      personalInfo,
      employment,
      compensation,
      taxInfo,
      bankDetails
    } = req.body;

    // Check if business exists and user has access
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

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if employee already exists for this business
    const existingEmployee = await Employee.findOne({
      user: userId,
      business: businessId,
      isActive: true
    });

    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'Employee already exists for this business'
      });
    }

    // Check if TRN or NIS already exists
    const existingTaxInfo = await Employee.findOne({
      $or: [
        { 'taxInfo.trn': taxInfo.trn },
        { 'taxInfo.nis': taxInfo.nis }
      ]
    });

    if (existingTaxInfo) {
      return res.status(400).json({
        success: false,
        message: 'Employee with this TRN or NIS already exists'
      });
    }

    // Create employee
    const employee = new Employee({
      user: userId,
      business: businessId,
      personalInfo,
      employment: {
        ...employment,
        probationPeriod: {
          months: employment.probationPeriod?.months || 3,
          endDate: new Date(Date.now() + (employment.probationPeriod?.months || 3) * 30 * 24 * 60 * 60 * 1000)
        }
      },
      compensation,
      taxInfo,
      bankDetails
    });

    await employee.save();

    // Add employee to business
    await business.addEmployee({
      user: userId,
      position: employment.position,
      department: employment.department,
      startDate: employment.startDate,
      salary: compensation.baseSalary,
      isActive: true
    });

    // Add business to user's businesses if not already there
    if (!user.businesses.includes(businessId)) {
      user.businesses.push(businessId);
      await user.save();
    }

    // Populate user information
    await employee.populate('user', 'firstName lastName email phone');
    await employee.populate('business', 'name industry');

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: { employee }
    });
  } catch (error) {
    console.error('Employee creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during employee creation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/employees
// @desc    Get employees for a business
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      business: businessId, 
      page = 1, 
      limit = 10, 
      search, 
      department, 
      status = 'active' 
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
    
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    if (department) {
      query['employment.department'] = department;
    }

    // Build aggregation pipeline for search
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' }
    ];

    // Add search filter
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'userInfo.firstName': { $regex: search, $options: 'i' } },
            { 'userInfo.lastName': { $regex: search, $options: 'i' } },
            { 'userInfo.email': { $regex: search, $options: 'i' } },
            { 'employment.position': { $regex: search, $options: 'i' } },
            { employeeId: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Add sorting and pagination
    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    );

    const employees = await Employee.aggregate(pipeline);

    // Get total count for pagination
    const totalPipeline = [...pipeline.slice(0, -2)]; // Remove skip and limit
    totalPipeline.push({ $count: 'total' });
    const totalResult = await Employee.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    res.json({
      success: true,
      data: {
        employees,
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
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving employees'
    });
  }
});

// @route   GET /api/employees/:employeeId
// @desc    Get a specific employee
// @access  Private
router.get('/:employeeId', auth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.employeeId)
      .populate('user', 'firstName lastName email phone address')
      .populate('business', 'name industry address')
      .populate('employment.supervisor', 'employeeId');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check access
    const business = await Business.findOne({
      _id: employee.business._id,
      $or: [
        { owner: req.user.id },
        { 'employees.user': req.user.id }
      ]
    });

    if (!business && employee.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { employee }
    });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving employee'
    });
  }
});

// @route   PUT /api/employees/:employeeId
// @desc    Update an employee
// @access  Private (Owner, HR Manager, or self)
router.put('/:employeeId', auth, validateInput, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check access
    const business = await Business.findOne({
      _id: employee.business,
      $or: [
        { owner: req.user.id },
        { 'employees.user': req.user.id }
      ]
    });

    const isOwnerOrAdmin = business && (
      business.owner.toString() === req.user.id ||
      req.user.role === 'hr_manager' ||
      req.user.role === 'super_admin'
    );

    const isSelf = employee.user.toString() === req.user.id;

    if (!isOwnerOrAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const {
      personalInfo,
      employment,
      compensation,
      taxInfo,
      bankDetails,
      isActive
    } = req.body;

    // Restrict what non-admin users can update
    if (!isOwnerOrAdmin) {
      // Self-update restrictions
      if (employment || compensation || isActive !== undefined) {
        return res.status(403).json({
          success: false,
          message: 'You can only update personal information'
        });
      }
    }

    // Update fields
    if (personalInfo) {
      employee.personalInfo = { ...employee.personalInfo, ...personalInfo };
    }

    if (employment && isOwnerOrAdmin) {
      employee.employment = { ...employee.employment, ...employment };
    }

    if (compensation && isOwnerOrAdmin) {
      employee.compensation = { ...employee.compensation, ...compensation };
    }

    if (taxInfo && isOwnerOrAdmin) {
      // Check if TRN or NIS is being changed and conflicts exist
      if (taxInfo.trn !== employee.taxInfo.trn || taxInfo.nis !== employee.taxInfo.nis) {
        const existingTaxInfo = await Employee.findOne({
          _id: { $ne: employee._id },
          $or: [
            { 'taxInfo.trn': taxInfo.trn },
            { 'taxInfo.nis': taxInfo.nis }
          ]
        });

        if (existingTaxInfo) {
          return res.status(400).json({
            success: false,
            message: 'Employee with this TRN or NIS already exists'
          });
        }
      }
      employee.taxInfo = { ...employee.taxInfo, ...taxInfo };
    }

    if (bankDetails) {
      employee.bankDetails = { ...employee.bankDetails, ...bankDetails };
    }

    if (isActive !== undefined && isOwnerOrAdmin) {
      employee.isActive = isActive;
    }

    await employee.save();

    await employee.populate('user', 'firstName lastName email phone');
    await employee.populate('business', 'name');

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: { employee }
    });
  } catch (error) {
    console.error('Employee update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during employee update',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/employees/:employeeId/leave-request
// @desc    Submit a leave request
// @access  Private (Self or Admin)
router.post('/:employeeId/leave-request', auth, async (req, res) => {
  try {
    const { type, startDate, endDate, reason } = req.body;

    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if user can request leave for this employee
    if (employee.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only request leave for yourself'
      });
    }

    // Calculate leave days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // Include both start and end dates

    // Check if employee has enough leave days
    if (type === 'vacation' && employee.leave.vacationDays.remaining < days) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient vacation days remaining'
      });
    }

    if (type === 'sick' && employee.leave.sickDays.remaining < days) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient sick days remaining'
      });
    }

    await employee.requestLeave({
      type,
      startDate: start,
      endDate: end,
      days,
      reason
    });

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: { 
        leaveRequest: employee.leave.requests[employee.leave.requests.length - 1]
      }
    });
  } catch (error) {
    console.error('Leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error submitting leave request'
    });
  }
});

// @route   PUT /api/employees/:employeeId/leave-request/:requestId
// @desc    Approve or deny a leave request
// @access  Private (Admin only)
router.put('/:employeeId/leave-request/:requestId', auth, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'denied'

    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either approved or denied'
      });
    }

    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if user has permission to approve leave
    const business = await Business.findOne({
      _id: employee.business,
      $or: [
        { owner: req.user.id },
        { 'employees.user': req.user.id }
      ]
    });

    const canApprove = business && (
      business.owner.toString() === req.user.id ||
      req.user.role === 'hr_manager' ||
      req.user.role === 'super_admin'
    );

    if (!canApprove) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You cannot approve leave requests.'
      });
    }

    await employee.processLeaveRequest(req.params.requestId, status, req.user.id);

    res.json({
      success: true,
      message: `Leave request ${status} successfully`,
      data: { employee: employee.leave }
    });
  } catch (error) {
    console.error('Leave approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing leave request'
    });
  }
});

// @route   POST /api/employees/:employeeId/terminate
// @desc    Terminate an employee
// @access  Private (Owner or HR Manager only)
router.post('/:employeeId/terminate', auth, ownerOrAdminAccess, async (req, res) => {
  try {
    const { date, reason, type, noticePeriod } = req.body;

    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (!employee.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Employee is already terminated'
      });
    }

    await employee.terminate({
      date: date ? new Date(date) : new Date(),
      reason,
      type: type || 'involuntary',
      noticePeriod: noticePeriod || 0
    });

    // Also update in business employees array
    const business = await Business.findById(employee.business);
    if (business) {
      await business.deactivateEmployee(employee.user);
    }

    res.json({
      success: true,
      message: 'Employee terminated successfully',
      data: { employee }
    });
  } catch (error) {
    console.error('Employee termination error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during employee termination'
    });
  }
});

// @route   GET /api/employees/business/:businessId/summary
// @desc    Get employee summary for a business
// @access  Private
router.get('/business/:businessId/summary', auth, businessAccess, async (req, res) => {
  try {
    const businessId = req.params.businessId;

    const summary = await Employee.aggregate([
      { $match: { business: mongoose.Types.ObjectId(businessId) } },
      {
        $group: {
          _id: null,
          totalEmployees: { $sum: 1 },
          activeEmployees: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          inactiveEmployees: {
            $sum: { $cond: ['$isActive', 0, 1] }
          },
          departmentBreakdown: {
            $push: '$employment.department'
          },
          averageSalary: {
            $avg: '$compensation.baseSalary.amount'
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalEmployees: 1,
          activeEmployees: 1,
          inactiveEmployees: 1,
          averageSalary: { $round: ['$averageSalary', 2] },
          departmentBreakdown: 1
        }
      }
    ]);

    // Get department breakdown
    const departmentCounts = await Employee.aggregate([
      { $match: { business: mongoose.Types.ObjectId(businessId), isActive: true } },
      { $group: { _id: '$employment.department', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        summary: summary[0] || {
          totalEmployees: 0,
          activeEmployees: 0,
          inactiveEmployees: 0,
          averageSalary: 0
        },
        departmentBreakdown: departmentCounts
      }
    });
  } catch (error) {
    console.error('Employee summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving employee summary'
    });
  }
});

module.exports = router;
