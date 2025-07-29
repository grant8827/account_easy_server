const express = require('express');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Business = require('../models/Business');
const Transaction = require('../models/Transaction');
const { auth, businessAccess, ownerOrAdminAccess } = require('../middleware/auth');
const router = express.Router();

// Helper function to calculate tax summary for a business
const calculateTaxSummary = async (business, period) => {
    // Get all payroll records for the period
    const payrolls = await Payroll.find({
        business: business._id,
        payPeriod: period
    });

    const summary = {
        paye: { gross: 0, deductions: 0, netPay: 0, tax: 0 },
        companyTax: { profit: 0, rate: 0.25, tax: 0 },
        nis: { employee: 0, employer: 0, total: 0 },
        education: { payroll: 0, rate: 0.025, tax: 0 },
        heartTrust: { payroll: 0, rate: 0.03, tax: 0 }
    };

    // Calculate totals from payroll records
    payrolls.forEach(payroll => {
        summary.paye.gross += payroll.grossPay || 0;
        summary.paye.deductions += payroll.totalDeductions || 0;
        summary.paye.netPay += payroll.netPay || 0;
        summary.paye.tax += payroll.paye || 0;
        
        summary.nis.employee += payroll.nis?.employee || 0;
        summary.nis.employer += payroll.nis?.employer || 0;
        summary.nis.total = summary.nis.employee + summary.nis.employer;

        summary.education.payroll += payroll.grossPay || 0;
        summary.education.tax += payroll.educationTax || 0;

        summary.heartTrust.payroll += payroll.grossPay || 0;
        summary.heartTrust.tax += payroll.heartTax || 0;
    });

    return summary;
};

// Jamaica Tax Constants for 2024
const JAMAICA_TAX_RATES = {
  PAYE: {
    PERSONAL_ALLOWANCE: 1500000, // JMD 1.5M
    BRACKETS: [
      { min: 0, max: 1500000, rate: 0 },
      { min: 1500001, max: 6000000, rate: 0.25 },
      { min: 6000001, max: Infinity, rate: 0.30 }
    ]
  },
  NIS: {
    RATE: 0.03, // 3%
    MAX_ANNUAL_INCOME: 1000000 // JMD 1M
  },
  EDUCATION_TAX: {
    RATE: 0.025, // 2.5%
    THRESHOLD: 500000 // JMD 500k
  },
  HEART_TRUST: {
    RATE: 0.03 // 3%
  },
  GCT: {
    STANDARD_RATE: 0.15, // 15%
    EXEMPT_CATEGORIES: ['education', 'healthcare', 'agriculture']
  }
};

// @route   GET /api/tax/rates
// @desc    Get current Jamaica tax rates
// @access  Private
router.get('/rates', auth, (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        taxYear: new Date().getFullYear(),
        rates: JAMAICA_TAX_RATES,
        lastUpdated: '2024-01-01'
      }
    });
  } catch (error) {
    console.error('Get tax rates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving tax rates'
    });
  }
});

// @route   POST /api/tax/calculate-paye
// @desc    Calculate PAYE tax for given income
// @access  Private
router.post('/calculate-paye', auth, (req, res) => {
  try {
    const { annualIncome, personalAllowance, dependents = 0 } = req.body;

    if (!annualIncome || annualIncome < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid annual income is required'
      });
    }

    // Calculate personal allowance (with dependent adjustments if any)
    const allowance = personalAllowance || JAMAICA_TAX_RATES.PAYE.PERSONAL_ALLOWANCE;
    const adjustedAllowance = allowance + (dependents * 100000); // JMD 100k per dependent

    // Calculate taxable income
    const taxableIncome = Math.max(0, annualIncome - adjustedAllowance);

    let payeAmount = 0;
    let breakdown = [];

    // Apply tax brackets
    for (const bracket of JAMAICA_TAX_RATES.PAYE.BRACKETS) {
      if (taxableIncome > bracket.min) {
        const taxableAtBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
        const taxAtBracket = taxableAtBracket * bracket.rate;
        payeAmount += taxAtBracket;
        
        breakdown.push({
          bracket: `${bracket.min.toLocaleString()} - ${bracket.max === Infinity ? 'Above' : bracket.max.toLocaleString()}`,
          rate: `${(bracket.rate * 100).toFixed(1)}%`,
          taxableAmount: taxableAtBracket,
          tax: taxAtBracket
        });
      }
    }

    const effectiveRate = annualIncome > 0 ? (payeAmount / annualIncome) * 100 : 0;
    const marginalRate = taxableIncome > 6000000 ? 30 : taxableIncome > 1500000 ? 25 : 0;

    res.json({
      success: true,
      data: {
        input: {
          annualIncome,
          personalAllowance: adjustedAllowance,
          dependents
        },
        calculation: {
          taxableIncome,
          payeAmount: Math.round(payeAmount),
          monthlyPaye: Math.round(payeAmount / 12),
          effectiveRate: parseFloat(effectiveRate.toFixed(2)),
          marginalRate,
          breakdown
        }
      }
    });
  } catch (error) {
    console.error('PAYE calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error calculating PAYE'
    });
  }
});

// @route   GET /api/tax/business/:businessId/annual-report/:year
// @desc    Generate annual tax report for Jamaica tax filing
// @access  Private (Owner or Accountant)
router.get('/business/:businessId/annual-report/:year', auth, ownerOrAdminAccess, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { year } = req.params;
    const taxYear = parseInt(year);

    if (!taxYear || taxYear < 2020 || taxYear > new Date().getFullYear()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tax year'
      });
    }

    // Get business information
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Generate payroll tax report
    const payrollTaxReport = await Payroll.generateTaxReport(businessId, taxYear);

    // Get business income and expenses from transactions
    const startOfYear = new Date(taxYear, 0, 1);
    const endOfYear = new Date(taxYear, 11, 31);

    const financialSummary = await Transaction.aggregate([
      {
        $match: {
          business: mongoose.Types.ObjectId(businessId),
          date: { $gte: startOfYear, $lte: endOfYear },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          gctCollected: { $sum: '$taxInfo.gctAmount' },
          transactions: { $sum: 1 }
        }
      }
    ]);

    const businessIncome = financialSummary.find(item => item._id === 'income')?.total || 0;
    const businessExpenses = financialSummary.find(item => item._id === 'expense')?.total || 0;
    const gctCollected = financialSummary.find(item => item._id === 'income')?.gctCollected || 0;
    const gctPaid = financialSummary.find(item => item._id === 'expense')?.gctCollected || 0;

    // Calculate corporate tax liability (if applicable)
    const netProfit = businessIncome - businessExpenses;
    let corporateTax = 0;
    
    if (business.businessType === 'Corporation' && netProfit > 0) {
      corporateTax = netProfit * 0.25; // 25% corporate tax rate in Jamaica
    }

    // Aggregate payroll totals
    const payrollTotals = payrollTaxReport.reduce((acc, emp) => {
      acc.totalGrossEarnings += emp.totalGrossEarnings;
      acc.totalPAYE += emp.totalPAYE;
      acc.totalNIS += emp.totalNIS;
      acc.totalEducationTax += emp.totalEducationTax;
      acc.totalHeartTrust += emp.totalHeartTrust;
      acc.totalPension += emp.totalPension;
      return acc;
    }, {
      totalGrossEarnings: 0,
      totalPAYE: 0,
      totalNIS: 0,
      totalEducationTax: 0,
      totalHeartTrust: 0,
      totalPension: 0
    });

    // Calculate GCT summary
    const gctSummary = {
      collected: gctCollected,
      paid: gctPaid,
      netPayable: Math.max(0, gctCollected - gctPaid)
    };

    // Generate filing requirements
    const filingRequirements = {
      corporateIncomeTax: business.businessType === 'Corporation',
      gctReturn: business.taxSettings.gctRegistered || gctCollected > 0,
      payeReturns: payrollTotals.totalPAYE > 0,
      nisReturns: payrollTotals.totalNIS > 0,
      educationTaxReturn: payrollTotals.totalEducationTax > 0,
      heartTrustReturn: payrollTotals.totalHeartTrust > 0
    };

    // Calculate due dates (Jamaica tax calendar)
    const dueDates = {
      corporateIncomeTax: new Date(taxYear + 1, 2, 31), // March 31st
      gctReturn: new Date(taxYear + 1, 0, 14), // January 14th (for December)
      payeReturns: new Date(taxYear + 1, 0, 14), // Monthly returns, last one January 14th
      annualPayrollSummary: new Date(taxYear + 1, 1, 28) // February 28th
    };

    res.json({
      success: true,
      data: {
        business: {
          name: business.name,
          trn: business.trn,
          registrationNumber: business.registrationNumber,
          businessType: business.businessType,
          industry: business.industry
        },
        taxYear,
        reportGeneratedDate: new Date(),
        financialSummary: {
          businessIncome,
          businessExpenses,
          netProfit,
          corporateTax
        },
        payrollSummary: {
          employeeCount: payrollTaxReport.length,
          ...payrollTotals
        },
        gctSummary,
        employeeDetails: payrollTaxReport,
        filingRequirements,
        dueDates,
        compliance: {
          payeRegistered: business.taxSettings.payeRegistered,
          nisRegistered: business.taxSettings.nisRegistered,
          gctRegistered: business.taxSettings.gctRegistered,
          educationTaxRegistered: business.taxSettings.educationTaxRegistered,
          heartTrustRegistered: business.taxSettings.heartTrustRegistered
        }
      }
    });
  } catch (error) {
    console.error('Annual tax report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating annual tax report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/tax/business/:businessId/monthly-returns/:year/:month
// @desc    Generate monthly tax returns (PAYE, NIS, etc.)
// @access  Private (Owner or Accountant)
router.get('/business/:businessId/monthly-returns/:year/:month', auth, ownerOrAdminAccess, async (req, res) => {
  try {
    const { businessId, year, month } = req.params;
    const taxYear = parseInt(year);
    const taxMonth = parseInt(month);

    if (!taxYear || !taxMonth || taxMonth < 1 || taxMonth > 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year or month'
      });
    }

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Get payroll data for the month
    const startOfMonth = new Date(taxYear, taxMonth - 1, 1);
    const endOfMonth = new Date(taxYear, taxMonth, 0);

    const monthlyPayroll = await Payroll.find({
      business: businessId,
      'payPeriod.startDate': { $gte: startOfMonth, $lte: endOfMonth },
      status: { $in: ['approved', 'paid'] }
    }).populate('employee', 'employeeId personalInfo taxInfo');

    // Calculate monthly totals
    const monthlyTotals = monthlyPayroll.reduce((acc, payroll) => {
      acc.totalGrossEarnings += payroll.earnings.grossEarnings;
      acc.totalPAYE += payroll.deductions.paye.amount;
      acc.totalNIS += payroll.deductions.nis.contribution;
      acc.totalEducationTax += payroll.deductions.educationTax.amount;
      acc.totalHeartTrust += payroll.deductions.heartTrust.amount;
      acc.totalEmployeePension += payroll.deductions.pension.employeeContribution;
      acc.totalEmployerPension += payroll.deductions.pension.employerContribution;
      acc.employeeCount++;
      return acc;
    }, {
      totalGrossEarnings: 0,
      totalPAYE: 0,
      totalNIS: 0,
      totalEducationTax: 0,
      totalHeartTrust: 0,
      totalEmployeePension: 0,
      totalEmployerPension: 0,
      employeeCount: 0
    });

    // Calculate employer contributions
    const employerNIS = monthlyTotals.totalNIS; // Employer pays same as employee
    const employerHeartTrust = monthlyTotals.totalHeartTrust; // Employer pays same as employee

    // Generate return forms data
    const returns = {
      paye: {
        form: 'IT03',
        dueDate: new Date(taxYear, taxMonth, 14), // 14th of following month
        totalPAYE: monthlyTotals.totalPAYE,
        employeeCount: monthlyTotals.employeeCount,
        status: monthlyTotals.totalPAYE > 0 ? 'required' : 'nil_return'
      },
      nis: {
        form: 'NIS Return',
        dueDate: new Date(taxYear, taxMonth, 15), // 15th of following month
        employeeContributions: monthlyTotals.totalNIS,
        employerContributions: employerNIS,
        totalContributions: monthlyTotals.totalNIS + employerNIS,
        employeeCount: monthlyTotals.employeeCount,
        status: monthlyTotals.totalNIS > 0 ? 'required' : 'nil_return'
      },
      educationTax: {
        form: 'Education Tax Return',
        dueDate: new Date(taxYear, taxMonth, 14), // 14th of following month
        totalTax: monthlyTotals.totalEducationTax,
        employeeCount: monthlyTotals.employeeCount,
        status: monthlyTotals.totalEducationTax > 0 ? 'required' : 'nil_return'
      },
      heartTrust: {
        form: 'HEART Trust/NTA Return',
        dueDate: new Date(taxYear, taxMonth, 14), // 14th of following month
        employeeContributions: monthlyTotals.totalHeartTrust,
        employerContributions: employerHeartTrust,
        totalContributions: monthlyTotals.totalHeartTrust + employerHeartTrust,
        employeeCount: monthlyTotals.employeeCount,
        status: monthlyTotals.totalHeartTrust > 0 ? 'required' : 'nil_return'
      }
    };

    // Employee breakdown for detailed reporting
    const employeeBreakdown = monthlyPayroll.map(payroll => ({
      employeeId: payroll.employee.employeeId,
      trn: payroll.employee.taxInfo.trn,
      nis: payroll.employee.taxInfo.nis,
      grossEarnings: payroll.earnings.grossEarnings,
      paye: payroll.deductions.paye.amount,
      nisContribution: payroll.deductions.nis.contribution,
      educationTax: payroll.deductions.educationTax.amount,
      heartTrust: payroll.deductions.heartTrust.amount,
      pensionContribution: payroll.deductions.pension.employeeContribution
    }));

    res.json({
      success: true,
      data: {
        business: {
          name: business.name,
          trn: business.trn,
          registrationNumber: business.registrationNumber
        },
        period: {
          year: taxYear,
          month: taxMonth,
          monthName: new Date(taxYear, taxMonth - 1).toLocaleString('default', { month: 'long' })
        },
        summary: monthlyTotals,
        returns,
        employeeBreakdown,
        reportGeneratedDate: new Date()
      }
    });
  } catch (error) {
    console.error('Monthly returns error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating monthly tax returns',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/tax/business/:businessId/compliance-check
// @desc    Check tax compliance status for a business
// @access  Private (Owner or Accountant)
router.get('/business/:businessId/compliance-check', auth, ownerOrAdminAccess, async (req, res) => {
  try {
    const { businessId } = req.params;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Check registration status
    const registrationStatus = {
      trn: business.trn ? 'registered' : 'not_registered',
      paye: business.taxSettings.payeRegistered ? 'registered' : 'not_registered',
      nis: business.taxSettings.nisRegistered ? 'registered' : 'not_registered',
      gct: business.taxSettings.gctRegistered ? 'registered' : 'not_registered',
      educationTax: business.taxSettings.educationTaxRegistered ? 'registered' : 'not_registered',
      heartTrust: business.taxSettings.heartTrustRegistered ? 'registered' : 'not_registered'
    };

    // Check recent filing obligations
    const filingChecks = [];

    // Check if PAYE returns are up to date
    if (business.taxSettings.payeRegistered) {
      const lastPayeReturn = await Payroll.findOne({
        business: businessId,
        status: 'paid',
        'payPeriod.startDate': {
          $gte: new Date(currentYear, currentMonth - 2, 1),
          $lt: new Date(currentYear, currentMonth - 1, 1)
        }
      });

      filingChecks.push({
        type: 'PAYE Return',
        period: `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}`,
        dueDate: new Date(currentYear, currentMonth - 1, 14),
        status: lastPayeReturn ? 'filed' : 'overdue',
        amount: lastPayeReturn?.deductions?.paye?.amount || 0
      });
    }

    // Check outstanding liabilities
    const outstandingLiabilities = await Payroll.aggregate([
      {
        $match: {
          business: mongoose.Types.ObjectId(businessId),
          status: 'paid',
          'payPeriod.startDate': {
            $gte: new Date(currentYear - 1, 0, 1)
          }
        }
      },
      {
        $group: {
          _id: null,
          totalPAYE: { $sum: '$deductions.paye.amount' },
          totalNIS: { $sum: '$deductions.nis.contribution' },
          totalEducationTax: { $sum: '$deductions.educationTax.amount' },
          totalHeartTrust: { $sum: '$deductions.heartTrust.amount' }
        }
      }
    ]);

    const liabilities = outstandingLiabilities[0] || {
      totalPAYE: 0,
      totalNIS: 0,
      totalEducationTax: 0,
      totalHeartTrust: 0
    };

    // Generate compliance score
    let complianceScore = 0;
    let maxScore = 0;

    // Registration compliance (40%)
    Object.values(registrationStatus).forEach(status => {
      maxScore += 10;
      if (status === 'registered') complianceScore += 10;
    });

    // Filing compliance (40%)
    filingChecks.forEach(check => {
      maxScore += 10;
      if (check.status === 'filed') complianceScore += 10;
    });

    // Payment compliance (20%)
    maxScore += 20;
    if (Object.values(liabilities).every(amount => amount >= 0)) {
      complianceScore += 20;
    }

    const compliancePercentage = maxScore > 0 ? Math.round((complianceScore / maxScore) * 100) : 0;

    // Generate recommendations
    const recommendations = [];
    
    if (!business.trn) {
      recommendations.push({
        priority: 'high',
        action: 'Register for TRN (Tax Registration Number)',
        description: 'All businesses in Jamaica must register for a TRN'
      });
    }

    if (!business.taxSettings.payeRegistered && business.employees.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Register for PAYE',
        description: 'Businesses with employees must register for PAYE'
      });
    }

    if (filingChecks.some(check => check.status === 'overdue')) {
      recommendations.push({
        priority: 'urgent',
        action: 'File overdue tax returns',
        description: 'Submit all outstanding tax returns to avoid penalties'
      });
    }

    res.json({
      success: true,
      data: {
        business: {
          name: business.name,
          trn: business.trn,
          businessType: business.businessType
        },
        complianceScore: compliancePercentage,
        registrationStatus,
        filingStatus: filingChecks,
        outstandingLiabilities: liabilities,
        recommendations,
        lastChecked: new Date()
      }
    });
  } catch (error) {
    console.error('Compliance check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during compliance check',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/tax/business/:businessId/register-tax
// @desc    Update business tax registration status
// @access  Private (Owner only)
// Get tax summary for a business
router.get('/summary', auth, async (req, res) => {
    try {
        const { period } = req.query;
        const user = req.userDoc;

        if (!period) {
            return res.status(400).json({
                success: false,
                message: 'Period parameter is required'
            });
        }

        // Get selected business
        const businessId = user.selectedBusiness;
        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: 'No business selected'
            });
        }

        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({
                success: false,
                message: 'Business not found'
            });
        }

        // Check business access
        if (!user.businesses.includes(business._id) && user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this business'
            });
        }

        const summary = await calculateTaxSummary(business, period);

        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Tax summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving tax summary'
        });
    }
});

// Get tax returns for a business
router.get('/returns', auth, async (req, res) => {
    try {
        const { period } = req.query;
        const user = req.userDoc;

        if (!period) {
            return res.status(400).json({
                success: false,
                message: 'Period parameter is required'
            });
        }

        // Get selected business
        const businessId = user.selectedBusiness;
        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: 'No business selected'
            });
        }

        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({
                success: false,
                message: 'Business not found'
            });
        }

        // Check business access
        if (!user.businesses.includes(business._id) && user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this business'
            });
        }

        // Get tax returns for the period
        const returns = await Transaction.find({
            business: businessId,
            type: { $in: ['gct', 'paye', 'company_tax', 'annual_return'] },
            period: period
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            returns: returns
        });
    } catch (error) {
        console.error('Tax returns error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving tax returns'
        });
    }
});

router.post('/business/:businessId/register-tax', auth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { taxType, registrationNumber, effectiveDate } = req.body;

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Check if user is business owner
    if (business.owner.toString() !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only business owner can update tax registration'
      });
    }

    const validTaxTypes = ['paye', 'nis', 'gct', 'educationTax', 'heartTrust'];
    if (!validTaxTypes.includes(taxType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tax type'
      });
    }

    // Update tax registration
    const registrationField = `${taxType}Registered`;
    business.taxSettings[registrationField] = true;

    if (registrationNumber) {
      business.taxSettings[`${taxType}RegistrationNumber`] = registrationNumber;
    }

    if (effectiveDate) {
      business.taxSettings[`${taxType}EffectiveDate`] = new Date(effectiveDate);
    }

    await business.save();

    res.json({
      success: true,
      message: `${taxType.toUpperCase()} registration updated successfully`,
      data: {
        taxSettings: business.taxSettings
      }
    });
  } catch (error) {
    console.error('Tax registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating tax registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
