/**
 * LifeLink — Match Routes (Phase 6)
 *
 * All routes require JWT authentication (`protect`).
 *
 * Endpoints:
 *   POST /api/matches/generate/:requestId — Generate matches for a specific blood request
 *   GET  /api/matches/request/:requestId  — Get matches for a specific blood request
 *   GET  /api/matches                    — Get all matches for authenticated user's requests
 */

const express = require('express');
const router = express.Router();
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const {
  generateMatches,
  getMatchesForRequest,
  getUserMatches,
  getDonorMatches,
  respondToMatch,
  getEmailAction
} = require('../controllers/matchController');

router.post('/generate/:requestId', protect, generateMatches);
router.get('/request/:requestId', protect, getMatchesForRequest);
router.get('/donor', protect, getDonorMatches);
router.get('/email-action', optionalProtect, getEmailAction);
router.get('/', protect, getUserMatches);
router.patch('/:matchId/respond', protect, respondToMatch);

module.exports = router;
