const mongoose = require('mongoose');

const checkMongoDB = async () => {
  try {
    console.log('🔍 Checking MongoDB connection...');
    
    // Try different connection strings
    const uris = [
      'mongodb://127.0.0.1:27017/account_easy',
      'mongodb://localhost:27017/account_easy',
      'mongodb://127.0.0.1:27017/financial_staffing',
      'mongodb://localhost:27017/financial_staffing'
    ];

    for (const uri of uris) {
      try {
        console.log(`   Trying: ${uri}`);
        await mongoose.connect(uri, { 
          serverSelectionTimeoutMS: 3000,
          connectTimeoutMS: 3000 
        });
        console.log(`✅ MongoDB connected successfully at: ${uri}`);
        await mongoose.disconnect();
        return uri;
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        await mongoose.disconnect();
      }
    }
    
    console.log('❌ No MongoDB connection available');
    console.log('');
    console.log('💡 To start MongoDB:');
    console.log('   brew services start mongodb-community');
    console.log('   or');
    console.log('   mongod');
    
  } catch (error) {
    console.error('Error checking MongoDB:', error.message);
  } finally {
    process.exit(0);
  }
};

checkMongoDB();
