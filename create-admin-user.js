const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

async function createAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  const email = 'admin@accounteezy.com';
  const password = 'Admin2025!';
  const firstName = 'Admin';
  const lastName = 'User';
  const role = 'super_admin';

  let user = await User.findOne({ email });
  if (user) {
    console.log('Admin user already exists:', email);
    await mongoose.disconnect();
    return;
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  user = new User({
    email,
    password: hashedPassword,
    firstName,
    lastName,
    role,
    isActive: true,
    emailVerified: true
  });

  await user.save();
  console.log('Admin user created:', email);
  await mongoose.disconnect();
}

createAdmin();
