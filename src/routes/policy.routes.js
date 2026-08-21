const router = require('express').Router();
const { search, aggregateByUser } = require('../controllers/policy.controller');

router.get('/search', search);
router.get('/aggregate', aggregateByUser);

module.exports = router;
