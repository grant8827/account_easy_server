const { body, validationResult } = require('express-validator');

// Input validation middleware
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

// User registration validation rules
const userRegistrationRules = () => {
  return [
    body('firstName')
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters')
      .trim(),
    
    body('lastName')
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters')
      .trim(),
    
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail()
      .toLowerCase(),
    
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
    body('phone')
      .optional()
      .isMobilePhone()
      .withMessage('Please provide a valid phone number'),
    
    body('trn')
      .optional()
      .matches(/^\d{9}$/)
      .withMessage('TRN must be exactly 9 digits'),
    
    body('nis')
      .optional()
      .matches(/^\d{9}$/)
      .withMessage('NIS must be exactly 9 digits'),
    
    body('role')
      .optional()
      .isIn(['super_admin', 'business_owner', 'accountant', 'employee', 'hr_manager'])
      .withMessage('Invalid role specified')
  ];
};

// User login validation rules
const userLoginRules = () => {
  return [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail()
      .toLowerCase(),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ];
};

// Business creation validation rules
const businessCreationRules = () => {
  return [
    body('name')
      .notEmpty()
      .withMessage('Business name is required')
      .isLength({ min: 1, max: 100 })
      .withMessage('Business name must be between 1 and 100 characters')
      .trim(),
    
    body('registrationNumber')
      .notEmpty()
      .withMessage('Business registration number is required')
      .trim(),
    
    body('trn')
      .notEmpty()
      .withMessage('TRN is required')
      .matches(/^\d{9}$/)
      .withMessage('TRN must be exactly 9 digits'),
    
    body('nis')
      .optional()
      .matches(/^\d{9}$/)
      .withMessage('NIS must be exactly 9 digits'),
    
    body('businessType')
      .isIn([
        'Sole Proprietorship',
        'Partnership',
        'Limited Liability Company',
        'Corporation',
        'Non-Profit Organization',
        'Cooperative',
        'Other'
      ])
      .withMessage('Invalid business type'),
    
    body('industry')
      .isIn([
        'Agriculture',
        'Mining',
        'Manufacturing',
        'Construction',
        'Retail Trade',
        'Wholesale Trade',
        'Transportation',
        'Information Technology',
        'Finance and Insurance',
        'Real Estate',
        'Professional Services',
        'Education',
        'Healthcare',
        'Hospitality',
        'Entertainment',
        'Government',
        'Other'
      ])
      .withMessage('Invalid industry'),
    
    body('address.street')
      .notEmpty()
      .withMessage('Street address is required'),
    
    body('address.city')
      .notEmpty()
      .withMessage('City is required'),
    
    body('address.parish')
      .isIn([
        'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 
        'St. Mary', 'St. Ann', 'Trelawny', 'St. James', 
        'Hanover', 'Westmoreland', 'St. Elizabeth', 
        'Manchester', 'Clarendon', 'St. Catherine'
      ])
      .withMessage('Invalid parish'),
    
    body('contactInfo.phone')
      .isMobilePhone()
      .withMessage('Please provide a valid phone number'),
    
    body('contactInfo.email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail()
      .toLowerCase(),
    
    body('contactInfo.website')
      .optional()
      .isURL()
      .withMessage('Please provide a valid website URL')
  ];
};

// Employee creation validation rules
const employeeCreationRules = () => {
  return [
    body('user')
      .notEmpty()
      .withMessage('User ID is required')
      .isMongoId()
      .withMessage('Invalid user ID'),
    
    body('personalInfo.dateOfBirth')
      .isISO8601()
      .withMessage('Please provide a valid date of birth')
      .custom((value) => {
        const age = new Date().getFullYear() - new Date(value).getFullYear();
        if (age < 16 || age > 75) {
          throw new Error('Employee must be between 16 and 75 years old');
        }
        return true;
      }),
    
    body('employment.position')
      .notEmpty()
      .withMessage('Position is required')
      .trim(),
    
    body('employment.department')
      .notEmpty()
      .withMessage('Department is required')
      .trim(),
    
    body('employment.startDate')
      .isISO8601()
      .withMessage('Please provide a valid start date'),
    
    body('employment.employmentType')
      .isIn(['full_time', 'part_time', 'contract', 'temporary', 'intern'])
      .withMessage('Invalid employment type'),
    
    body('compensation.baseSalary.amount')
      .isFloat({ min: 0 })
      .withMessage('Base salary must be a positive number'),
    
    body('compensation.baseSalary.frequency')
      .isIn(['hourly', 'weekly', 'bi-weekly', 'monthly', 'annually'])
      .withMessage('Invalid salary frequency'),
    
    body('taxInfo.trn')
      .matches(/^\d{9}$/)
      .withMessage('TRN must be exactly 9 digits'),
    
    body('taxInfo.nis')
      .matches(/^\d{9}$/)
      .withMessage('NIS must be exactly 9 digits')
  ];
};

// Transaction validation rules
const transactionRules = () => {
  return [
    body('type')
      .isIn([
        'income',
        'expense',
        'asset_purchase',
        'asset_sale',
        'liability',
        'equity',
        'transfer',
        'adjustment'
      ])
      .withMessage('Invalid transaction type'),
    
    body('category')
      .notEmpty()
      .withMessage('Category is required'),
    
    body('description')
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ min: 1, max: 500 })
      .withMessage('Description must be between 1 and 500 characters')
      .trim(),
    
    body('amount')
      .isFloat({ min: 0 })
      .withMessage('Amount must be a positive number'),
    
    body('date')
      .optional()
      .isISO8601()
      .withMessage('Please provide a valid date'),
    
    body('paymentMethod')
      .optional()
      .isIn([
        'cash',
        'check',
        'bank_transfer',
        'credit_card',
        'debit_card',
        'mobile_payment',
        'other'
      ])
      .withMessage('Invalid payment method'),
    
    body('taxInfo.gctRate')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('GCT rate must be between 0 and 1')
  ];
};

// Payroll validation rules
const payrollRules = () => {
  return [
    body('employee')
      .notEmpty()
      .withMessage('Employee ID is required')
      .isMongoId()
      .withMessage('Invalid employee ID'),
    
    body('payPeriod.startDate')
      .isISO8601()
      .withMessage('Please provide a valid pay period start date'),
    
    body('payPeriod.endDate')
      .isISO8601()
      .withMessage('Please provide a valid pay period end date')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.payPeriod.startDate)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    
    body('payPeriod.type')
      .isIn(['weekly', 'bi-weekly', 'monthly'])
      .withMessage('Invalid pay period type'),
    
    body('earnings.basicSalary')
      .isFloat({ min: 0 })
      .withMessage('Basic salary must be a positive number'),
    
    body('earnings.overtime.hours')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Overtime hours must be a positive number'),
    
    body('earnings.overtime.rate')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Overtime rate must be a positive number'),
    
    body('paymentInfo.payDate')
      .isISO8601()
      .withMessage('Please provide a valid pay date'),
    
    body('paymentInfo.paymentMethod')
      .isIn(['bank_transfer', 'check', 'cash', 'mobile_payment'])
      .withMessage('Invalid payment method')
  ];
};

// Sanitize input middleware
const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS attempts
  const sanitizeObject = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        obj[key] = obj[key].replace(/javascript:/gi, '');
        obj[key] = obj[key].replace(/on\w+\s*=/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) {
    sanitizeObject(req.body);
  }
  
  next();
};

module.exports = {
  validateInput,
  userRegistrationRules,
  userLoginRules,
  businessCreationRules,
  employeeCreationRules,
  transactionRules,
  payrollRules,
  sanitizeInput
};
