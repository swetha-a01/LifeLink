/**
 * LifeLink — Notification Controller (Phase 8)
 *
 * Handles fetching, reading, and managing user notifications.
 *
 * Security:
 *   - All endpoints require JWT authentication (`protect`).
 *   - Users can ONLY view and update notifications where `recipientId === req.user._id`.
 *   - Recipient IDs sent in client payloads are strictly ignored.
 */

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// ================================================================
// GET /api/notifications — Fetch authenticated user's notifications
// ================================================================
const getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Retrieve notifications for authenticated user, sorted newest first
    const notifications = await Notification.find({ recipientId: userId })
      .populate({
        path: 'relatedRequestId',
        select: 'bloodGroup unitsRequired hospitalName area requiredDate requiredTime priority status'
      })
      .populate({
        path: 'relatedMatchId',
        select: 'matchScore status'
      })
      .sort({ createdAt: -1 });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return successResponse(res, 'Notifications retrieved successfully', {
      count: notifications.length,
      unreadCount,
      notifications
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PATCH /api/notifications/:id/read — Mark single notification as read
// ================================================================
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 'Invalid notification ID format.', 400);
    }

    const notification = await Notification.findById(id);

    if (!notification) {
      return errorResponse(res, 'Notification not found.', 404);
    }

    // Security check: Only recipient can mark as read
    if (notification.recipientId.toString() !== req.user._id.toString()) {
      return errorResponse(
        res,
        'Access denied. You can only update your own notifications.',
        403
      );
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
    }

    return successResponse(res, 'Notification marked as read', {
      notification
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PATCH /api/notifications/read-all — Mark all user notifications as read
// ================================================================
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const result = await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { $set: { isRead: true } }
    );

    return successResponse(res, 'All notifications marked as read', {
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead
};
