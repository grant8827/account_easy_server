const express = require('express');
const mongoose = require('mongoose');
const Business = require('./models/Business');
const User = require('./models/User');
require('dotenv').config();

async function testBusinessCreationEndpoint() {
  try {
    // Connect to database
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/accounteezy';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // Check if we have any users to test with
    const users = await User.find().limit(1);
    if (users.length === 0) {
      console.log('No users found. Creating a test user...');
      
      const testUser = new User({
        email: 'test@example.com',
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'User',
        role: 'business_owner',
        isActive: true
      });
      
      await testUser.save();
      console.log('Test user created:', testUser._id);
    }

    const testUser = await User.findOne();
    console.log('Using test user:', testUser._id);

    // Sample business data exactly as it would come from the BusinessForm
    const timestamp = Date.now();
    const businessData = {
      name: `Test Business Ltd ${timestamp}`,
      registrationNumber: `TEST${timestamp}`,
      trn: `${timestamp.toString().slice(-9)}`, // Use last 9 digits of timestamp
      nis: `${(timestamp + 1).toString().slice(-9)}`, // Use different 9 digits
      businessType: 'Limited Liability Company',
      industry: 'Information Technology', // This should now match the server enum
      address: {
        street: '123 Test Street',
        city: 'Kingston',
        parish: 'Kingston',
        postalCode: '12345',
        country: 'Jamaica'
      },
      contactInfo: {
        phone: '876-555-1234', // Test with Jamaica format
        email: 'test@testbusiness.com',
        website: 'https://www.testbusiness.com'
      },
      payrollSettings: {
        payPeriod: 'monthly',
        payDay: 25,
        taxCalculationMethod: 'standard'
      },
      taxSettings: {
        gctRegistered: false,
        payeRegistered: true,
        nisRegistered: true,
        fiscalYearEnd: '12-31'
      },
      settings: {
        currency: 'JMD',
        timeZone: 'America/Jamaica',
        dateFormat: 'MM/DD/YYYY'
      }
    };

    console.log('Testing business creation with data:', JSON.stringify(businessData, null, 2));

    // Simulate the exact creation logic from the route handler
    const {
      name,
      registrationNumber,
      trn,
      nis,
      businessType,
      industry,
      address,
      contactInfo,
      payrollSettings,
      taxSettings,
      fiscalYearEnd,
      settings
    } = businessData;

    // Check if business with same TRN or registration number exists
    const existingBusiness = await Business.findOne({
      $or: [
        { trn },
        { registrationNumber }
      ]
    });

    if (existingBusiness) {
      console.log('❌ Business with this TRN or registration number already exists');
      return;
    }

    // Create new business
    const business = new Business({
      name,
      registrationNumber,
      trn,
      nis,
      businessType,
      industry,
      address,
      contactInfo,
      owner: testUser._id,
      payrollSettings: payrollSettings || {},
      taxSettings: taxSettings || {},
      fiscalYearEnd,
      settings: settings || {}
    });

    // Validate before saving
    const validationResult = business.validateSync();
    if (validationResult) {
      console.error('❌ Validation errors:', validationResult.errors);
      Object.keys(validationResult.errors).forEach(key => {
        console.error(`- ${key}: ${validationResult.errors[key].message}`);
      });
      return;
    }

    console.log('✅ Business validation passed');

    // Actually save the business
    await business.save();
    console.log('✅ Business saved successfully:', business._id);

    // Add business to user's businesses array
    testUser.businesses.push(business._id);
    if (!testUser.currentBusiness) {
      testUser.currentBusiness = business._id;
    }
    await testUser.save();
    console.log('✅ Business added to user');

    // Clean up - remove the test business
    await Business.findByIdAndDelete(business._id);
    await User.findByIdAndUpdate(testUser._id, {
      $pull: { businesses: business._id },
      $unset: { currentBusiness: 1 }
    });
    console.log('✅ Test cleanup completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error.name === 'ValidationError') {
      console.error('Validation errors:');
      Object.values(error.errors).forEach(err => {
        console.error(`- ${err.path}: ${err.message}`);
      });
    }
    if (error.code === 11000) {
      console.error('Duplicate key error:', error.keyPattern);
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testBusinessCreationEndpoint();
