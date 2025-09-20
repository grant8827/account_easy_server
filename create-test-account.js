const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Business = require('./models/Business');

async function upsertTestUser() {
  const email = process.env.TEST_USER_EMAIL || 'test.user@accounteezy.com';
  const password = process.env.TEST_USER_PASSWORD || 'TestUser2025!';
  const firstName = 'Test';
  const lastName = 'User';
  const role = 'business_owner';

  let user = await User.findOne({ email });
  if (user) {
    return { user, created: false, email, password };
  }
  user = new User({
    email,
    password,
    firstName,
    lastName,
    role,
    phone: '+18765550123',
    address: { street: '1 Test Way', city: 'Kingston', parish: 'Kingston', postalCode: '00000', country: 'Jamaica' },
    emailVerified: true,
    isActive: true
  });
  await user.save();
  return { user, created: true, email, password };
}

async function upsertDemoBusiness(ownerId) {
  const name = 'Demo Biz Ltd';
  const registrationNumber = 'DEMO-001';

  let biz = await Business.findOne({ registrationNumber });
  if (biz) return { business: biz, created: false };

  biz = new Business({
    owner: ownerId,
    name,
    registrationNumber,
    trn: '111222333',
    businessType: 'Corporation',
    industry: 'Information Technology',
    address: {
      street: '100 Demo Street',
      city: 'Kingston',
      parish: 'Kingston',
      postalCode: '00000',
      country: 'Jamaica'
    },
    contactInfo: {
      phone: '+1876-555-0100',
      email: 'demo@biz.com'
    }
  });
  await biz.save();
  return { business: biz, created: true };
}

async function main() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/accounteezy';
    console.log('Connecting to', uri);
    await mongoose.connect(uri);

    const { user, created, email, password } = await upsertTestUser();
    console.log(created ? '✅ Test user created' : 'ℹ️  Test user already exists', email);

    const { business, created: bizCreated } = await upsertDemoBusiness(user._id);
    console.log(bizCreated ? '✅ Demo business created' : 'ℹ️  Demo business already exists', business.name);

    // link business to user
    if (!user.businesses?.includes(business._id)) {
      user.businesses = [...(user.businesses || []), business._id];
      user.currentBusiness = business._id;
      await user.save();
      console.log('🔗 Linked business to user');
    }

    console.log('\nLogin credentials:');
    console.log('  Email   :', email);
    console.log('  Password:', password);
    console.log('\nBusiness:');
    console.log('  Name    :', business.name);
    console.log('  Reg No  :', business.registrationNumber);
    console.log('  TRN     :', business.trn);
  } catch (err) {
    console.error('Error seeding test account:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

main();
