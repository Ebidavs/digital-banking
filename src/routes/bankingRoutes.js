const express = require('express');
const requireCustomer = require('../middleware/requireCustomer');
const banking = require('../controllers/bankingController');

const router = express.Router();

router.use(requireCustomer);

router.get('/balance', banking.getBalance);
router.get('/name-enquiry/:accountNumber', banking.nameEnquiry);
router.post('/transfers', banking.transfer);
router.get('/transfers', banking.myHistory);
router.get('/transfers/:id', banking.getTransaction);

module.exports = router;