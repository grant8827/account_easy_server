const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const checkSuperUser = async () => {
  try {
    // Connect to MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/account_easy';
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    // Find the super admin
    const superAdmin = await User.findOne({ role: 'super_admin' }).select('+password');
    if (!superAdmin) {
      console.log('❌ No super admin found');
      return;
    }

    console.log('📋 Super Admin Details:');
    console.log(`   👤 Name: ${superAdmin.firstName} ${superAdmin.lastName}`);
    console.log(`   📧 Email: ${superAdmin.email}`);
    console.log(`   🏢 Role: ${superAdmin.role}`);
    console.log(`   ✅ Active: ${superAdmin.isActive}`);
    console.log(`   📝 Approval Status: ${superAdmin.approvalStatus}`);
    console.log(`   📅 Approval Date: ${superAdmin.approvalDate}`);
    console.log(`   🔐 Has Password: ${!!superAdmin.password}`);
    console.log(`   📧 Email Verified: ${superAdmin.emailVerified}`);

    // Update approval status if needed
    if (superAdmin.approvalStatus !== 'approved') {
      console.log('🔧 Updating approval status to approved...');
      superAdmin.approvalStatus = 'approved';
      superAdmin.approvalDate = new Date();
      await superAdmin.save();
      console.log('✅ Super admin approval status updated');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

checkSuperUser();
