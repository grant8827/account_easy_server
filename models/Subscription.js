const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  plan: {
    type: String,
    enum: ['basic', 'premium', 'enterprise'],
    required: true
  },
  status: {
    type: String,
    enum: ['trial', 'active', 'suspended', 'cancelled'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  amount: {
    type: Number,
    required: true
  },
  features: [{
    name: String,
    enabled: Boolean
  }],
  paymentHistory: [{
    date: Date,
    amount: Number,
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      required: true
    },
    transactionId: String,
    paymentMethod: String
  }]
}, {
  timestamps: true
});

// Add indexes
subscriptionSchema.index({ business: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endDate: 1 }); // For finding expiring subscriptions

const Subscription = mongoose.model('Subscription', subscriptionSchema);
module.exports = Subscription;
