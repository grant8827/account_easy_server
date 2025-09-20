const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: [true, 'Business is required']
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required']
  },
  payrollNumber: {
    type: String,
    // Generated in pre-save hook; not required at input time
  },
  payPeriod: {
    startDate: {
      type: Date,
      required: [true, 'Pay period start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'Pay period end date is required']
    },
    type: {
      type: String,
      enum: ['weekly', 'bi-weekly', 'monthly'],
      required: [true, 'Pay period type is required']
    }
  },
  earnings: {
    basicSalary: {
      type: Number,
      required: [true, 'Basic salary is required'],
      min: 0
    },
    overtime: {
      hours: {
        type: Number,
        default: 0,
        min: 0
      },
      rate: {
        type: Number,
        default: 0,
        min: 0
      },
      amount: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    allowances: [{
      type: {
        type: String,
        enum: ['transport', 'meal', 'housing', 'communication', 'other']
      },
      amount: {
        type: Number,
        min: 0
      },
      taxable: {
        type: Boolean,
        default: true
      },
      description: String
    }],
    bonus: {
      type: Number,
      default: 0,
      min: 0
    },
    commission: {
      type: Number,
      default: 0,
      min: 0
    },
    backPay: {
      type: Number,
      default: 0,
      min: 0
    },
    grossEarnings: {
      type: Number,
      required: true,
      min: 0
    }
  },
  deductions: {
    paye: {
      taxableIncome: {
        type: Number,
        default: 0
      },
      rate: {
        type: Number,
        default: 0
      },
      amount: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    nis: {
      contribution: {
        type: Number,
        default: 0,
        min: 0
      },
      rate: {
        type: Number,
        default: 0.03 // 3% for employee
      }
    },
    educationTax: {
      rate: {
        type: Number,
        default: 0.025 // 2.5%
      },
      amount: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    heartTrust: {
      rate: {
        type: Number,
        default: 0.03 // 3%
      },
      amount: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    pension: {
      employeeRate: {
        type: Number,
        default: 0.05 // 5%
      },
      employerRate: {
        type: Number,
        default: 0.05 // 5%
      },
      employeeContribution: {
        type: Number,
        default: 0,
        min: 0
      },
      employerContribution: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    otherDeductions: [{
      type: {
        type: String,
        enum: ['loan_repayment', 'union_dues', 'insurance', 'garnishment', 'advance', 'other']
      },
      amount: {
        type: Number,
        min: 0
      },
      description: String,
      recurring: {
        type: Boolean,
        default: false
      }
    }],
    totalDeductions: {
      type: Number,
      required: true,
      min: 0
    }
  },
  netPay: {
    type: Number,
    required: true,
    min: 0
  },
  paymentInfo: {
    payDate: {
      type: Date,
      required: [true, 'Pay date is required']
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'check', 'cash', 'mobile_payment'],
      default: 'bank_transfer'
    },
    bankDetails: {
      bankName: String,
      accountNumber: String,
      routingNumber: String
    },
    checkNumber: String,
    isPaid: {
      type: Boolean,
      default: false
    },
    paidDate: Date
  },
  workRecord: {
    regularHours: {
      type: Number,
      default: 0,
      min: 0
    },
    overtimeHours: {
      type: Number,
      default: 0,
      min: 0
    },
    holidayHours: {
      type: Number,
      default: 0,
      min: 0
    },
    sickHours: {
      type: Number,
      default: 0,
      min: 0
    },
    vacationHours: {
      type: Number,
      default: 0,
      min: 0
    },
    unpaidLeaveHours: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  jamaicaTaxCalculation: {
    payeThreshold: {
      type: Number,
      default: 1000000 // JMD 1M annually threshold for 2024
    },
    taxBrackets: [{
      min: Number,
      max: Number,
      rate: Number
    }],
    personalAllowance: {
      type: Number,
      default: 1500000 // JMD 1.5M personal allowance for 2024
    },
    educationTaxThreshold: {
      type: Number,
      default: 500000 // JMD 500k threshold
    }
  },
  status: {
    type: String,
    enum: ['draft', 'calculated', 'approved', 'paid', 'cancelled'],
    default: 'draft'
  },
  approvals: [{
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedDate: Date,
    comments: String
  }],
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedDate: Date
}, {
  timestamps: true
});

// Indexes for better query performance
payrollSchema.index({ business: 1, 'payPeriod.startDate': -1 });
payrollSchema.index({ employee: 1, 'payPeriod.startDate': -1 });
payrollSchema.index({ payrollNumber: 1 });
payrollSchema.index({ status: 1 });
payrollSchema.index({ 'paymentInfo.payDate': 1 });

// Pre-save middleware to generate payroll number and calculate amounts
payrollSchema.pre('save', async function(next) {
  try {
    if (this.isNew) {
      const count = await this.constructor.countDocuments({ business: this.business });
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      this.payrollNumber = `PAY-${year}${month}-${String(count + 1).padStart(5, '0')}`;
    }
    
    // Calculate gross earnings
    let grossEarnings = this.earnings.basicSalary + this.earnings.overtime.amount + this.earnings.bonus + this.earnings.commission + this.earnings.backPay;
    
    // Add taxable allowances
    this.earnings.allowances.forEach(allowance => {
      if (allowance.taxable) {
        grossEarnings += allowance.amount;
      }
    });
    
    this.earnings.grossEarnings = grossEarnings;
    
    // Calculate Jamaica tax deductions
    await this.calculateJamaicaTaxes();
    
    // Calculate total deductions
    let totalDeductions = this.deductions.paye.amount + 
                         this.deductions.nis.contribution + 
                         this.deductions.educationTax.amount + 
                         this.deductions.heartTrust.amount + 
                         this.deductions.pension.employeeContribution;
    
    // Add other deductions
    this.deductions.otherDeductions.forEach(deduction => {
      totalDeductions += deduction.amount;
    });
    
    this.deductions.totalDeductions = totalDeductions;
    
    // Calculate net pay
    this.netPay = this.earnings.grossEarnings - this.deductions.totalDeductions;
    
    next();
  } catch (error) {
    next(error);
  }
});

// Method to calculate Jamaica taxes (PAYE, NIS, Education Tax, HEART Trust)
payrollSchema.methods.calculateJamaicaTaxes = async function() {
  const annualGross = this.earnings.grossEarnings * 12; // Assuming monthly payroll
  
  // PAYE Calculation (Jamaica Income Tax)
  const personalAllowance = this.jamaicaTaxCalculation.personalAllowance;
  const taxableIncome = Math.max(0, annualGross - personalAllowance);
  
  let payeAmount = 0;
  if (taxableIncome > 0) {
    // Jamaica tax brackets for 2024
    const taxBrackets = [
      { min: 0, max: 1500000, rate: 0 },
      { min: 1500001, max: 6000000, rate: 0.25 },
      { min: 6000001, max: Infinity, rate: 0.30 }
    ];
    
    for (const bracket of taxBrackets) {
      if (taxableIncome > bracket.min) {
        const taxableAtBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
        payeAmount += taxableAtBracket * bracket.rate;
      }
    }
  }
  
  this.deductions.paye.taxableIncome = taxableIncome;
  this.deductions.paye.amount = payeAmount / 12; // Monthly amount
  
  // NIS Contribution (3% on income up to JMD 1M annually)
  const nisableIncome = Math.min(annualGross, 1000000);
  this.deductions.nis.contribution = (nisableIncome * this.deductions.nis.rate) / 12;
  
  // Education Tax (2.5% on income above JMD 500k annually)
  const educationTaxableIncome = Math.max(0, annualGross - this.jamaicaTaxCalculation.educationTaxThreshold);
  this.deductions.educationTax.amount = (educationTaxableIncome * this.deductions.educationTax.rate) / 12;
  
  // HEART Trust/NTA (3% on income)
  this.deductions.heartTrust.amount = (annualGross * this.deductions.heartTrust.rate) / 12;
  
  // Pension contribution (if applicable)
  if (this.deductions.pension.employeeRate > 0) {
    this.deductions.pension.employeeContribution = (this.earnings.grossEarnings * this.deductions.pension.employeeRate);
    this.deductions.pension.employerContribution = (this.earnings.grossEarnings * this.deductions.pension.employerRate);
  }
};

// Method to approve payroll
payrollSchema.methods.approve = function(approverId, comments) {
  this.approvals.push({
    approver: approverId,
    approvedDate: new Date(),
    comments: comments
  });
  this.status = 'approved';
  return this.save();
};

// Method to mark as paid
payrollSchema.methods.markAsPaid = function(userId) {
  this.paymentInfo.isPaid = true;
  this.paymentInfo.paidDate = new Date();
  this.status = 'paid';
  this.processedBy = userId;
  this.processedDate = new Date();
  return this.save();
};

// Static method to get payroll summary for a business
payrollSchema.statics.getPayrollSummary = async function(businessId, startDate, endDate) {
  const result = await this.aggregate([
    {
      $match: {
        business: mongoose.Types.ObjectId(businessId),
        'payPeriod.startDate': { $gte: startDate },
        'payPeriod.endDate': { $lte: endDate },
        status: { $in: ['approved', 'paid'] }
      }
    },
    {
      $group: {
        _id: null,
        totalGrossEarnings: { $sum: '$earnings.grossEarnings' },
        totalDeductions: { $sum: '$deductions.totalDeductions' },
        totalNetPay: { $sum: '$netPay' },
        totalPAYE: { $sum: '$deductions.paye.amount' },
        totalNIS: { $sum: '$deductions.nis.contribution' },
        totalEducationTax: { $sum: '$deductions.educationTax.amount' },
        totalHeartTrust: { $sum: '$deductions.heartTrust.amount' },
        employeeCount: { $sum: 1 }
      }
    }
  ]);
  
  return result[0] || {};
};

// Static method to generate tax report for Jamaica tax filing
payrollSchema.statics.generateTaxReport = async function(businessId, taxYear) {
  const startDate = new Date(taxYear, 0, 1); // January 1st
  const endDate = new Date(taxYear, 11, 31); // December 31st
  
  const result = await this.aggregate([
    {
      $match: {
        business: mongoose.Types.ObjectId(businessId),
        'payPeriod.startDate': { $gte: startDate },
        'payPeriod.endDate': { $lte: endDate },
        status: { $in: ['approved', 'paid'] }
      }
    },
    {
      $group: {
        _id: '$employee',
        totalGrossEarnings: { $sum: '$earnings.grossEarnings' },
        totalPAYE: { $sum: '$deductions.paye.amount' },
        totalNIS: { $sum: '$deductions.nis.contribution' },
        totalEducationTax: { $sum: '$deductions.educationTax.amount' },
        totalHeartTrust: { $sum: '$deductions.heartTrust.amount' },
        totalPension: { $sum: '$deductions.pension.employeeContribution' },
        payrollCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'employees',
        localField: '_id',
        foreignField: '_id',
        as: 'employeeDetails'
      }
    },
    {
      $unwind: '$employeeDetails'
    },
    {
      $lookup: {
        from: 'users',
        localField: 'employeeDetails.user',
        foreignField: '_id',
        as: 'userDetails'
      }
    },
    {
      $unwind: '$userDetails'
    }
  ]);
  
  return result;
};

module.exports = mongoose.model('Payroll', payrollSchema);
