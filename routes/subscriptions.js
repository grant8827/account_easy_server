const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const Business = require('../models/Business');

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
router.put('/businesses/:businessId/subscription', auth, async (req, res) => {
  try {
    const { plan, billingCycle } = req.body;
    
    // Calculate subscription amount based on plan and billing cycle
    const amount = calculateSubscriptionAmount(plan, billingCycle);
    
    // Calculate end date based on billing cycle
    const startDate = new Date();
    const endDate = new Date();
    if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

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
    const subscription = await Subscription.findOneAndUpdate(
      { business: req.params.businessId, status: 'active' },
      { status: 'cancelled' },
      { new: true }
    );

    await Business.findByIdAndUpdate(req.params.businessId, {
      subscriptionStatus: 'cancelled'
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

  const amount = monthlyRates[plan];
  return billingCycle === 'yearly' ? amount * 12 * 0.9 : amount; // 10% discount for yearly
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
