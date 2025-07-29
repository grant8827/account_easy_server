const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscriptionStatus: {
    type: String,
    enum: ['trial', 'active', 'suspended', 'cancelled'],
    default: 'trial'
  },
  subscriptionPlan: {
    type: String,
    enum: ['basic', 'premium', 'enterprise'],
    default: 'basic'
  },
  subscriptionStartDate: {
    type: Date,
    default: Date.now
  },
  subscriptionEndDate: {
    type: Date,
    default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000) // 30 days trial
  },
  billing: {
    lastBillingDate: Date,
    nextBillingDate: Date,
    billingAmount: Number,
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'debit_card', 'bank_transfer']
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'failed'],
      default: 'pending'
    }
  },
  name: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
    maxlength: [100, 'Business name cannot exceed 100 characters']
  },
  registrationNumber: {
    type: String,
    required: [true, 'Business registration number is required'],
    unique: true,
    trim: true
  },
  trn: {
    type: String,
    required: [true, 'TRN is required'],
    unique: true,
    match: [/^\d{9}$/, 'TRN must be exactly 9 digits']
  },
  nis: {
    type: String,
    match: [/^\d{9}$/, 'NIS must be exactly 9 digits']
  },
  businessType: {
    type: String,
    required: [true, 'Business type is required'],
    enum: [
      'Sole Proprietorship',
      'Partnership',
      'Limited Liability Company',
      'Corporation',
      'Non-Profit Organization',
      'Cooperative',
      'Other'
    ]
  },
  industry: {
    type: String,
    required: [true, 'Industry is required'],
    enum: [
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
    ]
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    parish: {
      type: String,
      required: [true, 'Parish is required'],
      enum: [
        'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 
        'St. Mary', 'St. Ann', 'Trelawny', 'St. James', 
        'Hanover', 'Westmoreland', 'St. Elizabeth', 
        'Manchester', 'Clarendon', 'St. Catherine'
      ]
    },
    postalCode: String,
    country: {
      type: String,
      default: 'Jamaica'
    }
  },
  contactInfo: {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email'
      ]
    },
    website: {
      type: String,
      match: [
        /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
        'Please enter a valid website URL'
      ]
    }
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Business owner is required']
  },
  employees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    position: String,
    department: String,
    startDate: Date,
    endDate: Date,
    salary: {
      amount: Number,
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
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  payrollSettings: {
    payPeriod: {
      type: String,
      enum: ['weekly', 'bi-weekly', 'monthly'],
      default: 'monthly'
    },
    payDay: {
      type: Number,
      min: 1,
      max: 31,
      default: 28
    },
    overtimeRate: {
      type: Number,
      default: 1.5
    },
    publicHolidayRate: {
      type: Number,
      default: 2.0
    }
  },
  taxSettings: {
    payeRegistered: {
      type: Boolean,
      default: false
    },
    nisRegistered: {
      type: Boolean,
      default: false
    },
    educationTaxRegistered: {
      type: Boolean,
      default: false
    },
    heartTrustRegistered: {
      type: Boolean,
      default: false
    },
    gctRegistered: {
      type: Boolean,
      default: false
    },
    taxYear: {
      type: Number,
      default: () => new Date().getFullYear()
    }
  },
  fiscalYearEnd: {
    type: Date,
    default: () => new Date(new Date().getFullYear(), 2, 31) // March 31st
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    currency: {
      type: String,
      default: 'JMD'
    },
    timezone: {
      type: String,
      default: 'America/Jamaica'
    },
    dateFormat: {
      type: String,
      default: 'DD/MM/YYYY'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
businessSchema.index({ owner: 1 });
businessSchema.index({ trn: 1 });
businessSchema.index({ registrationNumber: 1 });
businessSchema.index({ 'employees.user': 1 });

// Virtual for employee count
businessSchema.virtual('employeeCount').get(function() {
  return this.employees.filter(emp => emp.isActive).length;
});

// Method to add employee
businessSchema.methods.addEmployee = function(employeeData) {
  this.employees.push(employeeData);
  return this.save();
};

// Method to deactivate employee
businessSchema.methods.deactivateEmployee = function(userId) {
  const employee = this.employees.find(emp => emp.user.toString() === userId.toString());
  if (employee) {
    employee.isActive = false;
    employee.endDate = new Date();
  }
  return this.save();
}

// Method to get active employees
businessSchema.methods.getActiveEmployees = function() {
  return this.employees.filter(emp => emp.isActive);
};

module.exports = mongoose.model('Business', businessSchema);