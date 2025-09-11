const mongoose = require('mongoose');
const Employee = require('./models/Employee');
const Business = require('./models/Business');
const User = require('./models/User');

// Load environment variables
require('dotenv').config();

async function testEmployees() {
  try {
    await mongoose.connect('mongodb://mongo:gIujiaNqJTUNURpHaGhRmOmpPelSCfHD@switchyard.proxy.rlwy.net:24191');
    console.log('Connected to MongoDB');
    
    // Count employees
    const employeeCount = await Employee.countDocuments();
    console.log(`Total employees in database: ${employeeCount}`);
    
    // Get all employees with basic info
    const employees = await Employee.find({}).select('employeeId isActive business employment.position');
    console.log('\nEmployee summary:');
    employees.forEach((emp, index) => {
      console.log(`${index + 1}. ID: ${emp.employeeId}, Business: ${emp.business}, Position: ${emp.employment?.position}, Active: ${emp.isActive}`);
    });
    
    // Get all businesses
    const businesses = await Business.find({}).select('name owner');
    console.log(`\nTotal businesses: ${businesses.length}`);
    businesses.forEach((business, index) => {
      console.log(`${index + 1}. Name: ${business.name}, ID: ${business._id}, Owner: ${business.owner}`);
    });
    
    // Get all users
    const users = await User.find({}).select('firstName lastName email businesses');
    console.log(`\nTotal users: ${users.length}`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. Name: ${user.firstName} ${user.lastName}, Email: ${user.email}, Businesses: ${user.businesses?.length || 0}`);
    });
    
    console.log('\nTest completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testEmployees();