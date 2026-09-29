const express = require('express');
const requireCustomer = require('../middleware/requireCustomer');
const {
  createAccount,
  getMyAccount,
} = require('../controllers/accountController');

const router = express.Router();

router.post('/', requireCustomer, createAccount);
router.get('/me', requireCustomer, getMyAccount);

module.exports = router;