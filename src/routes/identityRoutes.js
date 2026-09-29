const express = require('express');
const requireCustomer = require('../middleware/requireCustomer');
const {verifyBvn, verifyNin,} = require('../controllers/identityController');
const router = express.Router();

router.post('/nin', requireCustomer, verifyNin);

module.exports = router;