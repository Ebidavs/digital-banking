const IdentityVerification = require('../models/IdentityVerification');
const { providerRequest } = require('../services/nibssClient');

exports.verifyBvn = async (req, res) => {
  const { bvn, firstName, lastName, dob, phone } = req.body;

  if (
    typeof bvn !== 'string' || !/^\d{11}$/.test(bvn) ||
    typeof firstName !== 'string' || !firstName.trim() ||
    typeof lastName !== 'string' || !lastName.trim() ||
    typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
    typeof phone !== 'string' || !phone.trim()
  ) {
    return res.status(400).json({
      message: 'Provide a test 11-digit BVN, firstName, lastName, dob (YYYY-MM-DD), and phone',
    });
  }

  try {
    const existing = await IdentityVerification.findOne({
      customerId: req.customer.id,
    });

    if (existing) {
      return res.status(409).json({
        message: 'This customer has already completed identity verification',
      });
    }

    // The provider requires an identity record before it can validate it.
    try {
      await providerRequest({
        method: 'post',
        url: '/api/insertBvn',
        data: {
          bvn,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dob,
          phone: phone.trim(),
        },
      });
    } catch (error) {
      // Your test BVN may already exist because you created it in Postman.
      // We still require a successful validation and matching details below.
      if (error.response?.status !== 409) throw error;
    }

    const validation = await providerRequest({
      method: 'post',
      url: '/api/validateBvn',
      data: { bvn },
    });

    const result = validation.data;
    const data = result?.data;

    const sameText = (a, b) =>
      String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

    const matches =
      result?.success === true &&
      data &&
      data.bvn === bvn &&
      sameText(data.firstName, firstName) &&
      sameText(data.lastName, lastName) &&
      typeof data.dob === 'string' &&
      data.dob.slice(0, 10) === dob;

    if (!matches) {
      return res.status(422).json({
        message: 'Provider verification did not match the submitted identity',
      });
    }

    const verification = await IdentityVerification.create({
      customerId: req.customer.id,
      kycType: 'bvn',
      kycID: bvn,
      firstName: data.firstName,
      lastName: data.lastName,
      dob,
      status: 'verified',
    });

    return res.status(201).json({
      message: 'Customer BVN verified',
      verification: {
        id: verification.id,
        kycType: verification.kycType,
        status: verification.status,
        verifiedAt: verification.verifiedAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'This customer or test identity is already registered',
      });
    }

    if (error.response) {
      console.error('Provider verification failed:', error.response.status);
      return res.status(502).json({
        message: 'Identity provider rejected the request',
        providerStatus: error.response.status,
      });
    }

    console.error('Verification error:', error.message);
    return res.status(500).json({ message: 'Identity verification failed' });
  }
};

exports.verifyNin = async (req, res) => {
  const { nin, firstName, lastName, dob } = req.body;

  if (
    typeof nin !== 'string' || !/^\d{11}$/.test(nin) ||
    typeof firstName !== 'string' || !firstName.trim() ||
    typeof lastName !== 'string' || !lastName.trim() ||
    typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob)
  ) {
    return res.status(400).json({
      message: 'Provide a test 11-digit NIN, firstName, lastName, and dob (YYYY-MM-DD)',
    });
  }

  try {
    const existing = await IdentityVerification.findOne({
      customerId: req.customer.id,
    });

    if (existing) {
      return res.status(409).json({
        message: 'This customer has already completed identity verification',
      });
    }

    try {
      await providerRequest({
        method: 'post',
        url: '/api/insertNin',
        data: {
          nin,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dob,
        },
      });
    } catch (error) {
  const alreadyExists =
    error.response?.status === 409 ||
    (
      error.response?.status === 400 &&
      String(error.response?.data?.error || '')
        .includes('NIN already exists')
    );

  if (!alreadyExists) throw error;
}

    const validation = await providerRequest({
      method: 'post',
      url: '/api/validateNin',
      data: { nin },
    });

    const result = validation.data;
    const data = result?.response;
    const sameText = (a, b) =>
      String(a || '').trim().toLowerCase() ===
      String(b || '').trim().toLowerCase();

    if (
      result?.message !== 'NIN Verified!!' ||
      !data ||
      data.nin !== nin ||
      !sameText(data.firstName, firstName) ||
      !sameText(data.lastName, lastName) ||
      typeof data.dob !== 'string' ||
      data.dob.slice(0, 10) !== dob
    ) {
      return res.status(422).json({
        message: 'Provider verification did not match the submitted identity',
      });
    }

    const verification = await IdentityVerification.create({
      customerId: req.customer.id,
      kycType: 'nin',
      kycID: nin,
      firstName: data.firstName,
      lastName: data.lastName,
      dob,
      status: 'verified',
    });

    return res.status(201).json({
      message: 'Customer NIN verified',
      verification: {
        id: verification.id,
        kycType: verification.kycType,
        status: verification.status,
        verifiedAt: verification.verifiedAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'This customer or test identity is already registered',
      });
    }

    console.error(
  'NIN verification error:',
  error.response?.status,
  error.response?.data || error.message
);
    return res.status(502).json({ message: 'NIN verification failed' });
  }
};