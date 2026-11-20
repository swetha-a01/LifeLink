/**
 * LifeLink — Centre Routes (Phase 10)
 *
 * All routes require JWT authentication (`protect`).
 *
 * Endpoints:
 *   GET /api/centres     — List all active blood centres
 *   GET /api/centres/:id — Get details of a specific centre
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getCentres,
  getCentreById
} = require('../controllers/centreController');

router.get('/', protect, getCentres);
router.get('/:id', protect, getCentreById);

module.exports = router;
