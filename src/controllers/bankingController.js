const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { providerRequest } = require('../services/nibssClient');

async function myActiveAccount(customerId) {
  return Account.findOne({ customerId, status: 'active' });
}

function providerError(error) {
  console.error(
    'Banking provider error:',
    error.response?.status || error.message
  );
}

exports.getBalance = async (req, res) => {
  try {
    const account = await myActiveAccount(req.customer.id);

    if (!account) {
      return res.status(404).json({ message: 'Active account not found' });
    }

    const response = await providerRequest({
      method: 'get',
      url: `/api/account/balance/${account.accountNumber}`,
    });

    const data = response.data;

    if (String(data?.accountNumber) !== account.accountNumber) {
      return res.status(502).json({
        message: 'Provider returned a different account',
      });
    }

    return res.json({
      accountNumber: account.accountNumber,
      accountName: data.accountName,
      balance: data.balance,
    });
  } catch (error) {
    providerError(error);
    return res.status(502).json({ message: 'Could not retrieve balance' });
  }
};

exports.nameEnquiry = async (req, res) => {
  const { accountNumber } = req.params;

  if (!/^\d{10}$/.test(accountNumber)) {
    return res.status(400).json({
      message: 'Provide a 10-digit account number',
    });
  }

  try {
    const response = await providerRequest({
      method: 'get',
      url: `/api/account/name-enquiry/${accountNumber}`,
    });

    // The manual omits the response example, so accept either common shape.
    const data = response.data?.data || response.data;
    const name = data?.accountName || data?.name;

    if (!name) {
      return res.status(502).json({
        message: 'Provider did not return an account name',
      });
    }

    return res.json({
      accountNumber,
      accountName: name,
      bankCode: data.bankCode,
      bankName: data.bankName,
    });
  } catch (error) {
    providerError(error);
    return res.status(error.response?.status === 404 ? 404 : 502).json({
      message: 'Name enquiry failed',
    });
  }
};

exports.transfer = async (req, res) => {
  const { toAccount, recipientName, amount, requestId } = req.body;

  if (
    typeof toAccount !== 'string' || !/^\d{10}$/.test(toAccount) ||
    typeof recipientName !== 'string' || !recipientName.trim() ||
    typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(requestId) ||
    typeof amount !== 'string' ||
    !/^\d+(\.\d{1,2})?$/.test(amount) ||
    Number(amount) <= 0
  ) {
    return res.status(400).json({
      message: 'Provide toAccount, recipientName, positive amount as a string, and a unique requestId',
    });
  }

  try {
    const account = await myActiveAccount(req.customer.id);

    if (!account) {
      return res.status(403).json({ message: 'Active sender account required' });
    }

    if (account.accountNumber === toAccount) {
      return res.status(400).json({
        message: 'Sender and recipient accounts must differ',
      });
    }

    const existing = await Transaction.findOne({
      customerId: req.customer.id,
      requestId,
    });

    if (existing) {
      return res.status(409).json({
        message: 'This requestId has already been used; check transaction status',
        transactionId: existing.id,
        status: existing.status,
      });
    }

    // Resolve the recipient before sending money.
    const enquiry = await providerRequest({
      method: 'get',
      url: `/api/account/name-enquiry/${toAccount}`,
    });

    const recipient = enquiry.data?.data || enquiry.data;
    const actualName = recipient?.accountName || recipient?.name;

    if (
      !actualName ||
      actualName.trim().toLowerCase() !== recipientName.trim().toLowerCase()
    ) {
      return res.status(422).json({
        message: 'Recipient name does not match name enquiry',
        accountName: actualName || null,
      });
    }

    // Create our tracking record before the external transfer.
    let transaction;

    try {
      transaction = await Transaction.create({
        customerId: req.customer.id,
        requestId,
        fromAccount: account.accountNumber,
        toAccount,
        recipientName: actualName,
        amount,
        status: 'pending',
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: 'This requestId has already been used',
        });
      }
      throw error;
    }

    try {
      const response = await providerRequest({
        method: 'post',
        url: '/api/transfer',
        data: {
          from: account.accountNumber,
          to: toAccount,
          amount,
        },
      });

      const result = response.data?.data || response.data;

      // The manual does not show the transfer response JSON.
      const providerId =
        result?.transactionId ||
        result?.transactionID ||
        result?.tsq ||
        result?.TSQ ||
        result?.reference ||
        result?.transaction?.transactionId ||
        result?.transaction?.tsq ||
        response.data?.transactionId ||
        response.data?.tsq;  

      if (!providerId) {
        transaction.status = 'needs_review';
        await transaction.save();
        return res.status(202).json({
          message: 'Transfer response received without a transaction ID; investigate before retrying',
          transactionId: transaction.id,
          status: transaction.status,
        });
      }

      transaction.providerTransactionId = String(providerId);
      transaction.providerStatus = String(result.status || 'pending');
      transaction.status = 'pending';
      await transaction.save();

      return res.status(202).json({
        message: 'Transfer submitted; check its status',
        transactionId: transaction.id,
        providerTransactionId: transaction.providerTransactionId,
        status: transaction.status,
      });
    } catch (error) {
      providerError(error);
      transaction.status = 'needs_review';
      await transaction.save();

      return res.status(502).json({
        message: 'Transfer outcome is uncertain. Do not retry; investigate its status.',
        transactionId: transaction.id,
      });
    }
  } catch (error) {
    providerError(error);
    return res.status(502).json({
      message: 'Could not prepare transfer',
    });
  }
};

exports.getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      customerId: req.customer.id,
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.providerTransactionId) {
      const response = await providerRequest({
        method: 'get',
        url: `/api/transaction/${encodeURIComponent(
          transaction.providerTransactionId
        )}`,
      });

      const result = response.data?.data || response.data;
      const providerStatus = String(result?.status || '').toLowerCase();

      transaction.providerStatus = providerStatus;

      if (['success', 'successful', 'completed'].includes(providerStatus)) {
        transaction.status = 'successful';
      } else if (['failed', 'failure', 'reversed'].includes(providerStatus)) {
        transaction.status = 'failed';
      }

      await transaction.save();
    }

    return res.json({
      transaction: {
        id: transaction.id,
        fromAccount: transaction.fromAccount,
        toAccount: transaction.toAccount,
        recipientName: transaction.recipientName,
        amount: transaction.amount,
        providerTransactionId: transaction.providerTransactionId,
        status: transaction.status,
        providerStatus: transaction.providerStatus,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    providerError(error);
    return res.status(502).json({ message: 'Could not check transaction status' });
  }
};

exports.myHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      customerId: req.customer.id,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .select('-customerId -__v');

    return res.json({ transactions });
  } catch (error) {
    console.error('History error:', error);
    return res.status(500).json({ message: 'Could not retrieve history' });
  }
};