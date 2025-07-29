const { body, validationResult } = require('express-validator');

// Payroll validation rules
const payrollRules = () => {
    return [
        body('business')
            .notEmpty()
            .isMongoId()
            .withMessage('Valid business ID is required'),
        body('employeeId')
            .notEmpty()
            .isMongoId()
            .withMessage('Valid employee ID is required'),
        body('payPeriod.startDate')
            .notEmpty()
            .isISO8601()
            .withMessage('Valid start date is required'),
        body('payPeriod.endDate')
            .notEmpty()
            .isISO8601()
            .withMessage('Valid end date is required'),
        body('baseSalary')
            .notEmpty()
            .isNumeric()
            .withMessage('Base salary is required and must be a number'),
        body('deductions.*.type')
            .optional()
            .isIn(['tax', 'nis', 'health', 'other'])
            .withMessage('Invalid deduction type'),
        body('deductions.*.amount')
            .optional()
            .isNumeric()
            .withMessage('Deduction amount must be a number'),
        body('allowances.*.type')
            .optional()
            .isString()
            .withMessage('Allowance type must be a string'),
        body('allowances.*.amount')
            .optional()
            .isNumeric()
            .withMessage('Allowance amount must be a number')
    ];
};

// Transaction validation rules
const transactionRules = () => {
    return [
        body('type')
            .notEmpty()
            .isIn(['income', 'expense'])
            .withMessage('Transaction type must be either income or expense'),
        body('category')
            .notEmpty()
            .withMessage('Category is required'),
        body('amount')
            .notEmpty()
            .isNumeric()
            .withMessage('Amount must be a number'),
        body('currency')
            .notEmpty()
            .isLength({ min: 3, max: 3 })
            .withMessage('Currency must be a 3-letter code'),
        body('date')
            .optional()
            .isISO8601()
            .withMessage('Date must be in ISO format'),
        body('description')
            .optional()
            .isString()
            .withMessage('Description must be a string')
    ];
};

// Input validation middleware
const validateInput = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

// Validation middleware functions
const validation = {
    // Validate user registration data
    validateRegistration(data) {
        const { email, password, firstName, lastName } = data;
        
        // Check required fields
        if (!email || !password || !firstName || !lastName) {
            return 'All fields are required';
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return 'Please provide a valid email address';
        }

        // Validate password strength
        if (password.length < 8) {
            return 'Password must be at least 8 characters long';
        }

        // Validate name fields
        if (firstName.length < 2 || lastName.length < 2) {
            return 'First and last names must be at least 2 characters long';
        }

        return null;
    },

    // Validate user login data
    validateLogin(data) {
        const { email, password } = data;

        // Check required fields
        if (!email || !password) {
            return 'Email and password are required';
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return 'Please provide a valid email address';
        }

        return null;
    },

    // Validate business data
    validateBusiness(data) {
        const { name, address, taxId } = data;

        // Check required fields
        if (!name || !address) {
            return 'Business name and address are required';
        }

        // Validate business name
        if (name.length < 2) {
            return 'Business name must be at least 2 characters long';
        }

        // Validate tax ID if provided
        if (taxId && taxId.length < 5) {
            return 'Tax ID must be at least 5 characters long';
        }

        return null;
    },

    // Validate employee data
    validateEmployee(data) {
        const { firstName, lastName, email, position } = data;

        // Check required fields
        if (!firstName || !lastName || !email || !position) {
            return 'First name, last name, email, and position are required';
        }

        // Validate name fields
        if (firstName.length < 2 || lastName.length < 2) {
            return 'First and last names must be at least 2 characters long';
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return 'Please provide a valid email address';
        }

        // Validate position
        if (position.length < 2) {
            return 'Position must be at least 2 characters long';
        }

        return null;
    }
};

module.exports = {
    ...validation,
    transactionRules,
    payrollRules,
    validateInput
};
