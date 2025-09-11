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

// Check businesses more thoroughly
const checkBusinesses = async () => {
  try {
    const Business = require('./models/Business');
    const businesses = await Business.find({});
    
    console.log('\n🏢 All businesses in database:');
    if (businesses.length === 0) {
      console.log('No businesses found');
    } else {
      businesses.forEach((business, index) => {
        console.log(`\n${index + 1}. Business ID: ${business._id}`);
        console.log(`   Name: ${business.name}`);
        console.log(`   Type: ${business.businessType}`);
        console.log(`   TRN: ${business.trn}`);
        console.log(`   Registration: ${business.registrationNumber}`);
        console.log(`   Owner: ${business.owner}`);
      });
    }
  } catch (error) {
    console.error('Error checking businesses:', error);
  }
};

const main = async () => {
  await connectDB();
  await checkBusinesses();
  mongoose.connection.close();
};

main();