const express = require('express');
const { register, login } = require('../controllers/authController');
const requireCustomer = require('../middleware/requireCustomer');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/me', requireCustomer, (req, res) => {
  res.json({
    customer: {
      id: req.customer.id,
      firstName: req.customer.firstName,
      lastName: req.customer.lastName,
      email: req.customer.email,
    },
  });
});

module.exports = router;

