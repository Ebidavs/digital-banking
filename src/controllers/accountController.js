const Account = require('../models/Account');
const IdentityVerification = require('../models/IdentityVerification');
const { providerRequest } = require('../services/nibssClient');

exports.createAccount = async (req, res) => {
  const customerId = req.customer.id;

  const identity = await IdentityVerification.findOne({
    customerId,
    status: 'verified',
  }).select('+kycID');

  if (!identity) {
    return res.status(403).json({
      message: 'Complete BVN or NIN verification before creating an account',
    });
  }

  let account;

  try {
    // This reserves the customer's one permitted account slot.
    account = await Account.create({
      customerId,
      status: 'creating',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'This customer already has an account or account creation in progress',
      });
    }

    console.error('Account reservation error:', error);
    return res.status(500).json({ message: 'Could not start account creation' });
  }

  try {
    const response = await providerRequest({
      method: 'post',
      url: '/api/account/create',
      data: {
        kycType: identity.kycType,
        kycID: identity.kycID,
        dob: identity.dob,
      },
    });

    const result = response.data;

    if (!/^\d{10}$/.test(String(result?.accountNumber || ''))) {
      throw new Error('Provider did not return a valid account number');
    }

    account.accountNumber = String(result.accountNumber);
    account.bankCode = String(result.bankCode || '');
    account.bankName = result.bankName || '';
    account.status = 'active';
    await account.save();

    return res.status(201).json({
      message: 'Account created',
      account: {
        accountNumber: account.accountNumber,
        bankCode: account.bankCode,
        bankName: account.bankName,
        status: account.status,
        openingBalance: result.balance,
      },
    });
  } catch (error) {
    // The provider may have created an account even if our request timed out
    // or saving its response failed. Block retries until we investigate.
    account.status = 'needs_review';

    try {
      await account.save();
    } catch (saveError) {
      console.error('Could not save account review status:', saveError);
    }

    console.error(
      'Provider account creation error:',
      error.response?.status || error.message
    );

    return res.status(502).json({
      message: 'Account creation could not be confirmed. Do not retry yet.',
    });
  }
};

exports.getMyAccount = async (req, res) => {
  const account = await Account.findOne({
    customerId: req.customer.id,
  });

  if (!account) {
    return res.status(404).json({ message: 'You do not have an account yet' });
  }

  return res.json({
    account: {
      accountNumber: account.accountNumber,
      bankCode: account.bankCode,
      bankName: account.bankName,
      status: account.status,
    },
  });
};