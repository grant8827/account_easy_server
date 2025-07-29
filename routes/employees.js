const express = require('express');
const Employee = require('../models/Employee');
const Business = require('../models/Business');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Employee route handlers
const createEmployeeHandler = async (req, res) => {
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

        // Validate required fields
        if (!userId || !businessId || !personalInfo || !employment || !compensation) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Validate personal info
        if (!personalInfo.dateOfBirth) {
            return res.status(400).json({
                success: false,
                message: 'Date of birth is required'
            });
        }

        // Check if business exists and user has access
        const business = await Business.findOne({
            _id: businessId,
            $or: [
                { owner: req.user.id },
                { 'employees.user': req.user.id }
            ]
        });

        if (!business) {
            return res.status(404).json({
                success: false,
                message: 'Business not found or access denied'
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

        // Check if employee already exists
        const existingEmployee = await Employee.findOne({
            business: businessId,
            user: userId
        });

        if (existingEmployee) {
            return res.status(400).json({
                success: false,
                message: 'Employee already exists for this business'
            });
        }

        // Generate unique employee ID
        const year = new Date().getFullYear().toString().substr(-2);
        const count = await Employee.countDocuments({ business: businessId }) + 1;
        const employeeId = `${business.registrationNumber}-${year}${count.toString().padStart(4, '0')}`;

        // Create new employee
        const employee = new Employee({
            user: userId,
            business: businessId,
            employeeId,
            personalInfo: {
                ...personalInfo,
                dateOfBirth: new Date(personalInfo.dateOfBirth)
            },
            employment: {
                ...employment,
                startDate: new Date(employment.startDate),
                endDate: employment.endDate ? new Date(employment.endDate) : undefined
            },
            compensation,
            taxInfo: taxInfo || {
                trn: user.trn,
                nis: user.nis
            },
            bankDetails: bankDetails || {}
        });

        // Save employee
        await employee.save();

        // Update user's businesses array if not already included
        if (!user.businesses.includes(businessId)) {
            user.businesses.push(businessId);
            if (!user.currentBusiness) {
                user.currentBusiness = businessId;
            }
            await user.save();
        }

        // Add employee to business's employees array
        if (!business.employees.some(emp => emp.user.toString() === userId)) {
            business.employees.push({
                user: userId,
                role: employment.role || 'employee',
                employeeId: employee.employeeId
            });
            await business.save();
        }

        // Populate response data
        await employee.populate('user', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            data: { employee }
        });
    } catch (error) {
        console.error('Employee creation error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: messages
            });
        }
        
        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `Duplicate ${field} error`,
                error: `The ${field} already exists`
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error creating employee',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getEmployeesHandler = async (req, res) => {
    try {
        const { businessId } = req.params;
        
        // Validate business access
        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({
                success: false,
                message: 'Business not found'
            });
        }

        // Check if user has access to this business
        const user = req.userDoc;
        if (!user.businesses.includes(business._id) && user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this business'
            });
        }

        const employees = await Employee.find({ business: businessId })
            .populate('user', 'firstName lastName email')
            .select('-bankDetails -taxInfo');

        res.json({
            success: true,
            employees
        });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving employees'
        });
    }
};

const getEmployeeHandler = async (req, res) => {
    try {
        const { employeeId } = req.params;

        const employee = await Employee.findById(employeeId)
            .populate('user', 'firstName lastName email');

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        res.json({
            success: true,
            employee
        });
    } catch (error) {
        console.error('Get employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving employee'
        });
    }
};

// Routes
router.use(auth); // Apply auth middleware to all employee routes

// Protected routes
router.post('/', createEmployeeHandler);
router.get('/business/:businessId', getEmployeesHandler);
router.get('/:employeeId', getEmployeeHandler);

module.exports = router;
