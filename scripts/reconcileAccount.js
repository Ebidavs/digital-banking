require('dotenv').config();

const mongoose = require('mongoose');
const Customer = require('../src/models/Customer');
const IdentityVerification = require('../src/models/IdentityVerification');
const Account = require('../src/models/Account');
const { providerRequest } = require('../src/services/nibssClient');

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    throw new Error('Provide the test customer email as an argument');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const customer = await Customer.findOne({ email });
  if (!customer) throw new Error('Customer not found');

  const identity = await IdentityVerification.findOne({
    customerId: customer.id,
    status: 'verified',
  }).select('+kycID');

  if (!identity) throw new Error('Verified identity not found');

  const localAccount = await Account.findOne({
    customerId: customer.id,
    status: 'needs_review',
  });

  if (!localAccount) {
    throw new Error('No needs_review account found for this customer');
  }

  const response = await providerRequest({
    method: 'get',
    url: '/api/accounts',
  });

  const accounts = response.data?.accounts;
  if (!Array.isArray(accounts)) {
    throw new Error('Unexpected provider account-list response');
  }

  const expectedName =
    `${identity.firstName} ${identity.lastName}`.trim().toLowerCase();

  const matches = accounts.filter((item) =>
    item.kycType === identity.kycType &&
    item.kycID === identity.kycID &&
    String(item.accountName || '').trim().toLowerCase() === expectedName &&
    /^\d{10}$/.test(String(item.accountNumber || ''))
  );

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one matching provider account; found ${matches.length}`);
  }

  const providerAccount = matches[0];

  if (providerAccount.balance !== 15000) {
    throw new Error('Provider opening balance is not ₦15,000; review manually');
  }

  localAccount.accountNumber = providerAccount.accountNumber;
  localAccount.bankCode = String(providerAccount.bankCode);
  localAccount.status = 'active';
  await localAccount.save();

  console.log('Account reconciled and marked active.');
  console.log(`Account number ends in ${localAccount.accountNumber.slice(-4)}.`);
}

main()
  .catch((error) => {
    console.error('Reconciliation stopped:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });