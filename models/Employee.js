const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: [true, 'Business reference is required']
  },
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true
  },
  personalInfo: {
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say']
    },
    maritalStatus: {
      type: String,
      enum: ['single', 'married', 'divorced', 'widowed', 'common_law']
    },
    nationality: {
      type: String,
      default: 'Jamaican'
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
      address: String
    }
  },
  employment: {
    position: {
      type: String,
      required: [true, 'Position is required']
    },
    department: {
      type: String,
      required: [true, 'Department is required']
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: Date,
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'temporary', 'intern'],
      default: 'full_time'
    },
    workSchedule: {
      hoursPerWeek: {
        type: Number,
        default: 40
      },
      workDays: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }],
      startTime: String,
      endTime: String
    },
    probationPeriod: {
      months: {
        type: Number,
        default: 3
      },
      endDate: Date
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    }
  },
  compensation: {
    baseSalary: {
      amount: {
        type: Number,
        required: [true, 'Base salary amount is required'],
        min: [0, 'Salary must be positive']
      },
      currency: {
        type: String,
        default: 'JMD'
      },
      frequency: {
        type: String,
        enum: ['hourly', 'weekly', 'bi-weekly', 'monthly', 'annually'],
        default: 'monthly'
      }
    },
    allowances: [{
      type: {
        type: String,
        enum: ['transport', 'meal', 'housing', 'communication', 'other']
      },
      amount: Number,
      taxable: {
        type: Boolean,
        default: true
      },
      description: String
    }],
    benefits: [{
      type: {
        type: String,
        enum: ['health_insurance', 'dental', 'vision', 'life_insurance', 'pension', 'vacation', 'sick_leave', 'other']
      },
      provider: String,
      coverage: String,
      employerContribution: Number,
      employeeContribution: Number,
      startDate: Date,
      endDate: Date
    }],
    overtimeEligible: {
      type: Boolean,
      default: true
    },
    overtimeRate: {
      type: Number,
      default: 1.5
    }
  },
  taxInfo: {
    trn: {
      type: String,
      required: [true, 'TRN is required'],
      match: [/^\d{9}$/, 'TRN must be exactly 9 digits']
    },
    nis: {
      type: String,
      required: [true, 'NIS is required'],
      match: [/^\d{9}$/, 'NIS must be exactly 9 digits']
    },
    taxStatus: {
      type: String,
      enum: ['single', 'married_joint', 'married_separate', 'head_of_household'],
      default: 'single'
    },
    dependents: {
      type: Number,
      default: 0,
      min: 0
    },
    educationCredit: {
      type: Boolean,
      default: false
    },
    pensionContribution: {
      rate: {
        type: Number,
        default: 0.05 // 5%
      },
      amount: Number
    }
  },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    routingNumber: String,
    accountType: {
      type: String,
      enum: ['savings', 'checking']
    }
  },
  documents: [{
    type: {
      type: String,
      enum: ['contract', 'tax_form', 'bank_form', 'id_copy', 'resume', 'certificate', 'other']
    },
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    path: String,
    uploadDate: {
      type: Date,
      default: Date.now
    },
    expiryDate: Date
  }],
  performance: {
    reviews: [{
      date: Date,
      reviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
      },
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comments: String,
      goals: [String]
    }],
    disciplinaryActions: [{
      date: Date,
      type: {
        type: String,
        enum: ['verbal_warning', 'written_warning', 'suspension', 'termination']
      },
      reason: String,
      issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
      },
      resolved: {
        type: Boolean,
        default: false
      }
    }]
  },
  leave: {
    vacationDays: {
      entitlement: {
        type: Number,
        default: 14
      },
      used: {
        type: Number,
        default: 0
      },
      remaining: {
        type: Number,
        default: 14
      }
    },
    sickDays: {
      entitlement: {
        type: Number,
        default: 10
      },
      used: {
        type: Number,
        default: 0
      },
      remaining: {
        type: Number,
        default: 10
      }
    },
    requests: [{
      type: {
        type: String,
        enum: ['vacation', 'sick', 'personal', 'maternity', 'paternity', 'bereavement', 'other']
      },
      startDate: Date,
      endDate: Date,
      days: Number,
      reason: String,
      status: {
        type: String,
        enum: ['pending', 'approved', 'denied'],
        default: 'pending'
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
      },
      requestDate: {
        type: Date,
        default: Date.now
      }
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  terminationInfo: {
    date: Date,
    reason: String,
    type: {
      type: String,
      enum: ['voluntary', 'involuntary', 'retirement', 'end_of_contract']
    },
    noticePeriod: Number,
    finalPayDate: Date,
    exitInterviewCompleted: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
employeeSchema.index({ user: 1 });
employeeSchema.index({ business: 1 });
employeeSchema.index({ employeeId: 1 });
employeeSchema.index({ 'taxInfo.trn': 1 });
employeeSchema.index({ 'taxInfo.nis': 1 });
employeeSchema.index({ isActive: 1 });

// Pre-save middleware to generate employee ID
employeeSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments({ business: this.business });
    const year = new Date().getFullYear();
    this.employeeId = `EMP-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  
  // Update leave remaining days
  this.leave.vacationDays.remaining = this.leave.vacationDays.entitlement - this.leave.vacationDays.used;
  this.leave.sickDays.remaining = this.leave.sickDays.entitlement - this.leave.sickDays.used;
  
  next();
});

// Virtual for full employment status
employeeSchema.virtual('employmentStatus').get(function() {
  if (!this.isActive) return 'terminated';
  if (this.employment.probationPeriod.endDate && new Date() < this.employment.probationPeriod.endDate) {
    return 'probation';
  }
  return 'active';
});

// Virtual for age
employeeSchema.virtual('age').get(function() {
  if (!this.personalInfo.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.personalInfo.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Method to calculate annual gross salary
employeeSchema.methods.calculateAnnualGrossSalary = function() {
  const { amount, frequency } = this.compensation.baseSalary;
  
  switch (frequency) {
    case 'hourly':
      return amount * this.employment.workSchedule.hoursPerWeek * 52;
    case 'weekly':
      return amount * 52;
    case 'bi-weekly':
      return amount * 26;
    case 'monthly':
      return amount * 12;
    case 'annually':
      return amount;
    default:
      return amount * 12;
  }
};

// Method to request leave
employeeSchema.methods.requestLeave = function(leaveData) {
  this.leave.requests.push({
    ...leaveData,
    requestDate: new Date()
  });
  return this.save();
};

// Method to approve/deny leave
employeeSchema.methods.processLeaveRequest = function(requestId, status, approverId) {
  const request = this.leave.requests.id(requestId);
  if (request) {
    request.status = status;
    request.approvedBy = approverId;
    
    // If approved, update used days
    if (status === 'approved') {
      if (request.type === 'vacation') {
        this.leave.vacationDays.used += request.days;
      } else if (request.type === 'sick') {
        this.leave.sickDays.used += request.days;
      }
    }
  }
  return this.save();
};

// Method to terminate employee
employeeSchema.methods.terminate = function(terminationData) {
  this.isActive = false;
  this.employment.endDate = terminationData.date || new Date();
  this.terminationInfo = {
    ...terminationData,
    date: terminationData.date || new Date()
  };
  return this.save();
};

module.exports = mongoose.model('Employee', employeeSchema);
