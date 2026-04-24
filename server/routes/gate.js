const express = require('express');
const router = express.Router();
const gate = require('../controllers/gateController');

router.post('/log', gate.logAkses);
router.get('/status', gate.getStatus);
router.get('/logs', gate.getLogs);


module.exports = router;
