const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

function createCustomerToken(customerId) {
  return jwt.sign(
    { customerId: customerId.toString() },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (
      typeof firstName !== 'string' || !firstName.trim() ||
      typeof lastName !== 'string' || !lastName.trim() ||
      typeof email !== 'string' || !email.trim() ||
      typeof password !== 'string' || password.length < 8
    ) {
      return res.status(400).json({
        message: 'Provide firstName, lastName, email, and a password of at least 8 characters',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (await Customer.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const customer = await Customer.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    return res.status(201).json({
      message: 'Customer registered',
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
      },
      token: createCustomerToken(customer.id),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const customer = await Customer.findOne({
      email: email.trim().toLowerCase(),
    }).select('+passwordHash');

    const validPassword = customer
      ? await bcrypt.compare(password, customer.passwordHash)
      : false;

    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    return res.json({
      message: 'Login successful',
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
      },
      token: createCustomerToken(customer.id),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed' });
  }
};