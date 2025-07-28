const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    await mongoose.connect('mongodb://127.0.0.1:27017/test', {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ MongoDB connection successful!');
    mongoose.disconnect();
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  }
}

testConnection();
