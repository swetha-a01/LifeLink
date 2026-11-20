/**
 * LifeLink — Notification Routes (Phase 8)
 *
 * All routes require JWT authentication (`protect`).
 *
 * Endpoints:
 *   GET   /api/notifications          — List user's notifications
 *   PATCH /api/notifications/read-all — Mark all user notifications as read
 *   PATCH /api/notifications/:id/read — Mark single notification as read
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead
} = require('../controllers/notificationController');

router.get('/', protect, getUserNotifications);
router.patch('/read-all', protect, markAllAsRead);
router.patch('/:id/read', protect, markAsRead);

module.exports = router;
