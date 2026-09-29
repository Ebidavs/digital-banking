const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

async function requireCustomer(req, res, next) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Customer token required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    const customer = await Customer.findById(payload.customerId);

    if (!customer) {
      return res.status(401).json({ message: 'Customer no longer exists' });
    }

    req.customer = customer;
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired customer token',
    });
  }
}

module.exports = requireCustomer;