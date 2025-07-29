const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['super_admin', 'business_owner', 'accountant', 'employee', 'hr_manager'],
    default: 'employee'
  },
  phone: {
    type: String,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  address: {
    street: String,
    city: String,
    parish: {
      type: String,
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
  businesses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business'
  }],
  currentBusiness: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business'
  },
  trn: {
    type: String,
    match: [/^\d{9}$/, 'TRN must be exactly 9 digits']
  },
  nis: {
    type: String,
    match: [/^\d{9}$/, 'NIS must be exactly 9 digits']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 604800 // 7 days
    }
  }]
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ businesses: 1 });
userSchema.index({ trn: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Get full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Clean up expired refresh tokens
userSchema.methods.cleanupExpiredTokens = function() {
  this.refreshTokens = this.refreshTokens.filter(
    tokenObj => new Date() < new Date(tokenObj.createdAt.getTime() + 604800000)
  );
};

module.exports = mongoose.model('User', userSchema);
