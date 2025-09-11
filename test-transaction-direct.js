const mongoose = require('mongoose');
require('dotenv').config();

// Import the updated Transaction model
const Transaction = require('./models/Transaction');
const Business = require('./models/Business');

async function testTransactionCreation() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/accounteezy');
    console.log('✅ Connected to MongoDB');

    // Use the existing business ID we created
    const businessId = '68c33acca09b6c66814fbede';
    
    // Create a test transaction directly using the model
    const transactionData = {
      business: businessId,
      type: 'income',
      category: 'sales_revenue',
      description: 'Direct model test transaction',
      amount: 150,
      currency: 'JMD',
      paymentMethod: 'cash',
      createdBy: '6894d40cfc6b2f99617d7893', // admin user ID
      taxInfo: {
        isTaxable: true,
        gctRate: 0.15,
        gctAmount: 0
      }
    };

    console.log('📝 Creating transaction with data:', JSON.stringify(transactionData, null, 2));

    const transaction = new Transaction(transactionData);
    
    console.log('💾 Saving transaction...');
    const savedTransaction = await transaction.save();
    
    console.log('✅ Transaction created successfully!');
    console.log('📋 Transaction details:', {
      id: savedTransaction._id,
      transactionNumber: savedTransaction.transactionNumber,
      type: savedTransaction.type,
      amount: savedTransaction.amount,
      description: savedTransaction.description,
      totalAmount: savedTransaction.totalAmount
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', Object.keys(error.errors));
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
      });
    }
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testTransactionCreation();