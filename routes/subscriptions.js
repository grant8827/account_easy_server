const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const Business = require('../models/Business');

// Middleware to validate subscription plan changes
const validateSubscriptionUpdate = async (req, res, next) => {
  try {
    const { plan, billingCycle } = req.body;
    const { businessId } = req.params;

    // Validate plan
    if (!['basic', 'premium', 'enterprise'].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription plan'
      });
    }

    // Validate billing cycle
    if (!['monthly', 'yearly'].includes(billingCycle)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing cycle'
      });
    }

    // Check business ownership
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this business subscription'
      });
    }

    // Attach business to request for later use
    req.business = business;
    next();
  } catch (error) {
    console.error('Subscription validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating subscription update'
    });
  }
};

// Get subscription details for a business
router.get('/businesses/:businessId/subscription', auth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      business: req.params.businessId
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found for this business'
      });
    }

    res.json({
      success: true,
      data: { subscription }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving subscription details'
    });
  }
});

// Update subscription plan
router.put('/businesses/:businessId/subscription', auth, validateSubscriptionUpdate, async (req, res) => {
  try {
    const { plan, billingCycle } = req.body;
    const business = req.business;
    
    // Check for existing active subscription
    const existingSubscription = await Subscription.findOne({
      business: business._id,
      status: 'active'
    });

    // Calculate dates and amounts
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Calculate new subscription amount
    const amount = calculateSubscriptionAmount(plan, billingCycle);
    
    // If there's an existing subscription, handle proration
    let proratedCredit = 0;
    if (existingSubscription && existingSubscription.status === 'active') {
      // Calculate remaining days in current subscription
      const remainingDays = Math.max(0, Math.ceil((existingSubscription.endDate - startDate) / (1000 * 60 * 60 * 24)));
      const totalDays = Math.ceil((existingSubscription.endDate - existingSubscription.startDate) / (1000 * 60 * 60 * 24));
      proratedCredit = (existingSubscription.amount * remainingDays) / totalDays;
      
      // Update existing subscription to cancelled
      existingSubscription.status = 'cancelled';
      await existingSubscription.save();
    }

    // Create new subscription with adjusted amount
    const finalAmount = Math.max(0, amount - proratedCredit);
    const subscription = await Subscription.create({
      business: req.params.businessId,
      plan,
      status: 'active',
      startDate,
      endDate,
      billingCycle,
      amount,
      features: getFeaturesByPlan(plan)
    });

    // Update business subscription status
    await Business.findByIdAndUpdate(req.params.businessId, {
      subscriptionStatus: 'active',
      subscriptionPlan: plan,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      'billing.nextBillingDate': endDate,
      'billing.billingAmount': amount
    });

    res.json({
      success: true,
      data: { subscription }
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating subscription'
    });
  }
});

// Cancel subscription
router.post('/businesses/:businessId/subscription/cancel', auth, async (req, res) => {
  try {
    // Verify business ownership
    const business = await Business.findById(req.params.businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this business subscription'
      });
    }

    // Find and update active subscription
    const subscription = await Subscription.findOneAndUpdate(
      { business: req.params.businessId, status: 'active' },
      { 
        status: 'cancelled',
        cancellationDate: new Date(),
        cancellationReason: req.body.reason || 'User requested cancellation'
      },
      { new: true }
    );

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    // Update business subscription status
    await Business.findByIdAndUpdate(req.params.businessId, {
      subscriptionStatus: 'cancelled',
      'billing.nextBillingDate': null
    });

    res.json({
      success: true,
      data: { subscription }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling subscription'
    });
  }
});

// Helper functions
function calculateSubscriptionAmount(plan, billingCycle) {
  const monthlyRates = {
    basic: 29.99,
    premium: 49.99,
    enterprise: 99.99
  };

  if (!monthlyRates[plan]) {
    throw new Error('Invalid subscription plan');
  }

  const amount = monthlyRates[plan];
  
  if (billingCycle === 'yearly') {
    // 10% discount for yearly subscriptions
    return Number((amount * 12 * 0.9).toFixed(2));
  }
  
  return Number(amount.toFixed(2));
}

function getFeaturesByPlan(plan) {
  const features = {
    basic: [
      { name: 'employeeManagement', enabled: true },
      { name: 'payrollProcessing', enabled: true },
      { name: 'basicReporting', enabled: true },
      { name: 'maxEmployees', enabled: true, limit: 10 }
    ],
    premium: [
      { name: 'employeeManagement', enabled: true },
      { name: 'payrollProcessing', enabled: true },
      { name: 'advancedReporting', enabled: true },
      { name: 'taxCalculation', enabled: true },
      { name: 'maxEmployees', enabled: true, limit: 50 }
    ],
    enterprise: [
      { name: 'employeeManagement', enabled: true },
      { name: 'payrollProcessing', enabled: true },
      { name: 'advancedReporting', enabled: true },
      { name: 'taxCalculation', enabled: true },
      { name: 'customReports', enabled: true },
      { name: 'api', enabled: true },
      { name: 'maxEmployees', enabled: true, limit: 'unlimited' }
    ]
  };

  return features[plan];
}

module.exports = router;
