const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/accounteezy');
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Check existing users
const checkUsers = async () => {
  try {
    const User = require('./models/User');
    const users = await User.find({}).select('email firstName lastName role');
    
    console.log('\n📋 Existing users:');
    if (users.length === 0) {
      console.log('No users found');
    } else {
      users.forEach(user => {
        console.log(`- ${user.email} (${user.firstName} ${user.lastName}) - Role: ${user.role}`);
      });
    }
  } catch (error) {
    console.error('Error checking users:', error);
  }
};

// Check businesses
const checkBusinesses = async () => {
  try {
    const Business = require('./models/Business');
    const businesses = await Business.find({}).select('name type owner');
    
    console.log('\n🏢 Existing businesses:');
    if (businesses.length === 0) {
      console.log('No businesses found');
    } else {
      businesses.forEach(business => {
        console.log(`- ${business.name} (${business.type}) - Owner: ${business.owner}`);
      });
    }
  } catch (error) {
    console.error('Error checking businesses:', error);
  }
};

const main = async () => {
  await connectDB();
  await checkUsers();
  await checkBusinesses();
  mongoose.connection.close();
};

main();