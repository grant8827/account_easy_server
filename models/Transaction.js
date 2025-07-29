const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: [true, 'Business is required']
  },
  transactionNumber: {
    type: String,
    required: [true, 'Transaction number is required'],
    index: true
  },
  type: {
    type: String,
    required: [true, 'Transaction type is required'],
    enum: [
      'income',
      'expense',
      'asset_purchase',
      'asset_sale',
      'liability',
      'equity',
      'transfer',
      'adjustment'
    ]
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      // Income categories
      'sales_revenue',
      'service_revenue',
      'interest_income',
      'rental_income',
      'other_income',
      
      // Expense categories
      'salaries_wages',
      'rent_utilities',
      'office_supplies',
      'marketing_advertising',
      'professional_fees',
      'insurance',
      'depreciation',
      'interest_expense',
      'travel_entertainment',
      'maintenance_repairs',
      'taxes_licenses',
      'other_expenses',
      
      // Asset categories
      'cash',
      'accounts_receivable',
      'inventory',
      'equipment',
      'buildings',
      'land',
      'investments',
      'other_assets',
      
      // Liability categories
      'accounts_payable',
      'loans_payable',
      'accrued_expenses',
      'other_liabilities',
      
      // Equity categories
      'owner_equity',
      'retained_earnings',
      'capital_contributions'
    ]
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount must be positive']
  },
  currency: {
    type: String,
    default: 'JMD',
    enum: ['JMD', 'USD', 'EUR', 'GBP', 'CAD']
  },
  exchangeRate: {
    type: Number,
    default: 1
  },
  date: {
    type: Date,
    required: [true, 'Transaction date is required'],
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: [
      'cash',
      'check',
      'bank_transfer',
      'credit_card',
      'debit_card',
      'mobile_payment',
      'other'
    ]
  },
  reference: {
    type: String,
    trim: true
  },
  vendor: {
    name: String,
    trn: String,
    address: String,
    phone: String,
    email: String
  },
  customer: {
    name: String,
    trn: String,
    address: String,
    phone: String,
    email: String
  },
  taxInfo: {
    isTaxable: {
      type: Boolean,
      default: true
    },
    gctRate: {
      type: Number,
      default: 0.15 // 15% GCT in Jamaica
    },
    gctAmount: {
      type: Number,
      default: 0
    },
    withholdingTax: {
      rate: Number,
      amount: Number
    }
  },
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    path: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'on_hold'],
    default: 'completed'
  },
  reconciled: {
    type: Boolean,
    default: false
  },
  reconciledDate: Date,
  reconciledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedDate: Date,
  notes: String,
  tags: [String]
}, {
  timestamps: true
});

// Indexes for better query performance
transactionSchema.index({ business: 1, date: -1 });
transactionSchema.index({ transactionNumber: 1 }, { unique: true });
transactionSchema.index({ type: 1, category: 1 });
transactionSchema.index({ createdBy: 1 });
transactionSchema.index({ date: 1 });
transactionSchema.index({ status: 1 });

// Pre-save middleware to generate transaction number
transactionSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments({ business: this.business });
    const year = new Date().getFullYear();
    this.transactionNumber = `TXN-${year}-${String(count + 1).padStart(6, '0')}`;
  }
  
  // Calculate GCT amount if taxable
  if (this.taxInfo.isTaxable && this.taxInfo.gctRate > 0) {
    this.taxInfo.gctAmount = this.amount * this.taxInfo.gctRate;
  }
  
  next();
});

// Virtual for total amount including tax
transactionSchema.virtual('totalAmount').get(function() {
  return this.amount + (this.taxInfo.gctAmount || 0);
});

// Method to mark as reconciled
transactionSchema.methods.markReconciled = function(userId) {
  this.reconciled = true;
  this.reconciledDate = new Date();
  this.reconciledBy = userId;
  return this.save();
};

// Static method to get transactions by date range
transactionSchema.statics.getByDateRange = function(businessId, startDate, endDate) {
  return this.find({
    business: businessId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1 });
};

// Static method to get financial summary
transactionSchema.statics.getFinancialSummary = async function(businessId, startDate, endDate) {
  const result = await this.aggregate([
    {
      $match: {
        business: mongoose.Types.ObjectId(businessId),
        date: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  return result.reduce((summary, item) => {
    summary[item._id] = {
      total: item.totalAmount,
      count: item.count
    };
    return summary;
  }, {});
};

module.exports = mongoose.model('Transaction', transactionSchema);
