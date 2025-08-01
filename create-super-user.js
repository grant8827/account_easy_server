const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Business = require('./models/Business');

const createSuperUser = async () => {
  try {
    // Connect to MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/account_easy';
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    if (existingSuperAdmin) {
      console.log('⚠️  Super admin already exists:');
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Name: ${existingSuperAdmin.firstName} ${existingSuperAdmin.lastName}`);
      console.log('   Use this account or delete it first to create a new one.');
      return;
    }

    // Super user details
    const superUserData = {
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@accounteasy.com',
      password: 'SuperAdmin2025!', // You should change this
      role: 'super_admin',
      phone: '+18765550001',
      address: {
        street: '1 Administrative Way',
        city: 'Kingston',
        parish: 'Kingston',
        postalCode: '10001',
        country: 'Jamaica'
      },
      trn: '123456789',
      nis: '987654321',
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved', // Super admin is pre-approved
      approvalDate: new Date()
    };

    console.log('🔐 Creating super user...');
    
    // Create super user (password will be hashed by the pre-save hook)
    const superUser = new User(superUserData);
    await superUser.save();

    // Create a default admin business
    const adminBusiness = new Business({
      name: 'Account Easy Administrative Services',
      registrationNumber: 'ADMIN001',
      trn: '100000001',
      nis: '100000001',
      businessType: 'Corporation',
      industry: 'Professional Services',
      address: {
        street: '1 Administrative Way',
        city: 'Kingston',
        parish: 'Kingston',
        postalCode: '10001',
        country: 'Jamaica'
      },
      contactInfo: {
        phone: '+18765550001',
        email: 'admin@accounteasy.com',
        website: 'https://accounteasy.com'
      },
      owner: superUser._id,
      taxSettings: {
        payeRegistered: true,
        nisRegistered: true,
        educationTaxRegistered: true,
        heartTrustRegistered: true,
        gctRegistered: true,
        taxYear: new Date().getFullYear()
      },
      isActive: true
    });

    await adminBusiness.save();

    // Update super user with business reference
    superUser.businesses.push(adminBusiness._id);
    superUser.currentBusiness = adminBusiness._id;
    await superUser.save();

    console.log('🎉 Super user created successfully!');
    console.log('');
    console.log('📋 Super User Details:');
    console.log(`   👤 Name: ${superUser.firstName} ${superUser.lastName}`);
    console.log(`   📧 Email: ${superUser.email}`);
    console.log(`   🔑 Password: SuperAdmin2025! (CHANGE THIS IMMEDIATELY)`);
    console.log(`   🏢 Role: ${superUser.role}`);
    console.log(`   🏪 Business: ${adminBusiness.name}`);
    console.log('');
    console.log('⚠️  IMPORTANT SECURITY NOTES:');
    console.log('   1. Change the default password immediately after first login');
    console.log('   2. This account has full system access');
    console.log('   3. Use this account to create other admin users');
    console.log('   4. Consider enabling two-factor authentication');
    console.log('');
    console.log('🌐 Login at: http://localhost:3000/login');

  } catch (error) {
    console.error('❌ Error creating super user:', error.message);
    if (error.code === 11000) {
      console.log('   This usually means a user with this email already exists.');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
if (require.main === module) {
  console.log('🚀 Account Easy - Super User Setup');
  console.log('=====================================');
  createSuperUser();
}

module.exports = createSuperUser;
