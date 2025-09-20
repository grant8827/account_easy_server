const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Business = require('./models/Business');
const Employee = require('./models/Employee');
const Transaction = require('./models/Transaction');

async function findDemoBiz() {
  const owner = await User.findOne({ email: 'test.user@accounteezy.com' });
  if (!owner) throw new Error('Test user not found');
  const biz = await Business.findOne({ owner: owner._id, registrationNumber: 'DEMO-001' });
  if (!biz) throw new Error('Demo Biz Ltd not found');
  return { owner, biz };
}

async function upsertEmployee(biz, owner) {
  let emp = await Employee.findOne({ business: biz._id, user: owner._id });
  if (!emp) {
    emp = new Employee({
      user: owner._id,
      business: biz._id,
      employeeId: `EMP-${new Date().getFullYear()}-0001`,
      personalInfo: {
        dateOfBirth: new Date(1990, 0, 1),
        gender: 'other',
        maritalStatus: 'single',
        nationality: 'Jamaican'
      },
      employment: {
        position: 'Owner',
        department: 'Management',
        startDate: new Date(),
        employmentType: 'full_time',
        workSchedule: { hoursPerWeek: 40 }
      },
      compensation: {
        baseSalary: { amount: 300000, currency: 'JMD', frequency: 'monthly' },
        allowances: []
      },
      taxInfo: { trn: '222333444', nis: '333444555', taxStatus: 'single', dependents: 0 },
      isActive: true
    });
    await emp.save();
    console.log('✅ Employee created:', emp.employeeId);
  } else {
    console.log('ℹ️  Employee already exists:', emp.employeeId);
  }
}

async function addTransactions(biz, owner) {
  const existing = await Transaction.countDocuments({ business: biz._id });
  if (existing >= 2) {
    console.log(`ℹ️  Transactions already present: ${existing}`);
    return;
  }

  const base = {
    business: biz._id,
    createdBy: owner._id,
    currency: 'JMD',
    taxInfo: { isTaxable: true, gctRate: 0.15 }
  };

  const t1 = new Transaction({
    ...base,
    type: 'income',
    category: 'consulting',
    description: 'Consulting revenue',
    amount: 500000,
    date: new Date(),
    paymentMethod: 'bank_transfer',
    customer: { name: 'Client A' },
  });
  await t1.save();

  const t2 = new Transaction({
    ...base,
    type: 'expense',
    category: 'office_supplies',
    description: 'Office supplies purchase',
    amount: 45000,
    date: new Date(),
    paymentMethod: 'credit_card',
    vendor: { name: 'Stationery Store' },
  });
  await t2.save();

  console.log('✅ Seeded transactions:', [t1.transactionNumber, t2.transactionNumber]);
}

async function main() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/accounteezy';
    console.log('Connecting to', uri);
    await mongoose.connect(uri);

    const { owner, biz } = await findDemoBiz();
    await upsertEmployee(biz, owner);
    await addTransactions(biz, owner);
  } catch (err) {
    console.error('Error seeding demo data:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}
