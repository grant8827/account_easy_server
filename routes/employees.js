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
            userData,
            business: businessId,
            employeeId,
            personalInfo,
            employment,
            compensation,
            taxInfo,
            bankDetails
        } = req.body;

        // Validate required fields
        if (!userData || !businessId || !personalInfo || !employment || !compensation || !taxInfo) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: userData, business, personalInfo, employment, compensation, taxInfo are required'
            });
        }

        // Validate personal info
        if (!personalInfo.dateOfBirth) {
            return res.status(400).json({
                success: false,
                message: 'Date of birth is required'
            });
        }

        // Validate tax info
        if (!taxInfo.trn || !taxInfo.nis) {
            return res.status(400).json({
                success: false,
                message: 'TRN and NIS are required'
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

        // Check if user already exists with this email
        let user = await User.findOne({ email: userData.email.toLowerCase() });
        
        if (!user) {
            // Create new user for the employee
            const bcrypt = require('bcryptjs');
            
            // Validate TRN and NIS format for user
            if (!taxInfo.trn || !/^\d{9}$/.test(taxInfo.trn)) {
                return res.status(400).json({
                    success: false,
                    message: 'TRN must be exactly 9 digits'
                });
            }
            
            if (!taxInfo.nis || !/^\d{9}$/.test(taxInfo.nis)) {
                return res.status(400).json({
                    success: false,
                    message: 'NIS must be exactly 9 digits'
                });
            }
            
            user = new User({
                email: userData.email.toLowerCase(),
                password: userData.password || 'TempPass123!', // Temporary password
                firstName: userData.firstName,
                lastName: userData.lastName,
                role: userData.role || 'employee',
                phone: userData.phone,
                trn: taxInfo.trn,
                nis: taxInfo.nis,
                isActive: true,
                emailVerified: false
            });

            // Hash password
            const salt = await bcrypt.genSalt(12);
            user.password = await bcrypt.hash(user.password, salt);
            
            try {
                await user.save();
                console.log('User created successfully:', user._id);
            } catch (userError) {
                console.error('User creation error:', userError);
                if (userError.name === 'ValidationError') {
                    const userErrorMessages = Object.values(userError.errors).map(err => `User ${err.path}: ${err.message}`);
                    return res.status(400).json({
                        success: false,
                        message: 'User validation error',
                        errors: userErrorMessages
                    });
                }
                throw userError;
            }
        }

        // Check if employee already exists
        const existingEmployee = await Employee.findOne({
            business: businessId,
            user: user._id
        });

        if (existingEmployee) {
            return res.status(400).json({
                success: false,
                message: 'Employee already exists for this business'
            });
        }

        // If employeeId is provided, check for duplicates
        if (employeeId) {
            const duplicateEmployeeId = await Employee.findOne({
                business: businessId,
                employeeId: employeeId
            });

            if (duplicateEmployeeId) {
                return res.status(400).json({
                    success: false,
                    message: 'Employee ID already exists in this business'
                });
            }
        }

        // Create new employee (employeeId will be auto-generated by pre-save middleware if not provided)
        const employee = new Employee({
            user: user._id,
            business: businessId,
            ...(employeeId && { employeeId }), // Include employeeId only if provided
            personalInfo: {
                ...personalInfo,
                dateOfBirth: new Date(personalInfo.dateOfBirth)
            },
            employment: {
                ...employment,
                startDate: new Date(employment.startDate || Date.now()),
                endDate: employment.endDate ? new Date(employment.endDate) : undefined
            },
            compensation,
            taxInfo,
            bankDetails: bankDetails || {}
        });

        // Save employee
        try {
            console.log('Attempting to save employee with data:', {
                user: user._id,
                business: businessId,
                employeeId: employeeId || 'auto-generate',
                personalInfo,
                employment,
                compensation,
                taxInfo
            });
            
            await employee.save();
            console.log('Employee saved successfully:', employee._id, 'with employeeId:', employee.employeeId);
        } catch (employeeError) {
            console.error('Employee save error:', employeeError);
            throw employeeError;
        }

        // Update user's businesses array if not already included
        if (!user.businesses.includes(businessId)) {
            user.businesses.push(businessId);
            if (!user.currentBusiness) {
                user.currentBusiness = businessId;
            }
            await user.save();
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
        console.error('Request body:', JSON.stringify(req.body, null, 2));
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            console.error('Validation errors:', error.errors);
            const messages = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message,
                value: err.value
            }));
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: messages,
                details: Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`)
            });
        }
        
        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            console.error('Duplicate key error:', field, error.keyValue);
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
            .populate('user', 'firstName lastName email phone')
            .select('-bankDetails');

        console.log(`Found ${employees.length} employees for business ${businessId}`);
        console.log('Employee data:', employees.map(emp => ({
            id: emp._id,
            employeeId: emp.employeeId,
            name: `${emp.user?.firstName} ${emp.user?.lastName}`,
            position: emp.employment?.position
        })));

        // Transform employees to match frontend interface
        const transformedEmployees = employees.map(employee => ({
            _id: employee._id,
            user: {
                _id: employee.user._id,
                firstName: employee.user.firstName,
                lastName: employee.user.lastName,
                email: employee.user.email,
                phone: employee.user.phone
            },
            business: {
                _id: employee.business,
                name: business.name
            },
            employeeId: employee.employeeId,
            personalInfo: employee.personalInfo,
            employment: {
                position: employee.employment.position,
                department: employee.employment.department,
                startDate: employee.employment.startDate,
                endDate: employee.employment.endDate,
                employmentType: employee.employment.employmentType,
                status: employee.isActive ? 'active' : 'inactive', // Map isActive to status
                salary: {
                    amount: employee.compensation.baseSalary.amount,
                    currency: employee.compensation.baseSalary.currency,
                    frequency: employee.compensation.baseSalary.frequency
                },
                workSchedule: employee.employment.workSchedule || {
                    hoursPerWeek: 40,
                    workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                }
            },
            compliance: {
                trn: employee.taxInfo.trn,
                nis: employee.taxInfo.nis,
                taxExemptionStatus: 'standard',
                filingStatus: employee.taxInfo.taxStatus || 'single'
            },
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt
        }));

        res.json({
            success: true,
            employees: transformedEmployees
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
