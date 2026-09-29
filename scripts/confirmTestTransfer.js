require('dotenv').config();

const mongoose = require('mongoose');
const Transaction = require('../src/models/Transaction');
const { providerRequest } = require('../src/services/nibssClient');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const transaction = await Transaction.findById(
    '6aba54e4118563692e82a30d'
  );

  if (
    !transaction ||
    transaction.status !== 'needs_review' ||
    transaction.fromAccount !== '1503190869' ||
    transaction.toAccount !== '1502880126' ||
    transaction.amount !== '100'
  ) {
    throw new Error('Test transaction does not match the expected details');
  }

  const [sender, recipient] = await Promise.all([
    providerRequest({
      method: 'get',
      url: '/api/account/balance/1503190869',
    }),
    providerRequest({
      method: 'get',
      url: '/api/account/balance/1502880126',
    }),
  ]);

  if (
    sender.data?.balance !== 14900 ||
    recipient.data?.balance !== 15100
  ) {
    throw new Error('Balances do not match this controlled test');
  }

  transaction.status = 'successful';
  transaction.providerStatus = 'confirmed_by_test_balances';
  await transaction.save();

  console.log('Test transfer marked successful in local history.');
  console.log('Provider transaction ID remains unavailable.');
}

main()
  .catch((error) => {
    console.error('Confirmation stopped:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });