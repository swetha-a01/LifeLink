/**
 * LifeLink — Notification Model
 *
 * Mongoose schema for the `notifications` collection.
 *
 * Types:
 *   DONOR_MATCHED     — Voluntary donor matched with a blood request
 *   DONOR_ACCEPTED    — Matched donor accepted a blood request
 *   DONOR_REJECTED    — Matched donor declined a blood request
 *   EMERGENCY_REQUEST — Emergency blood request notification
 *   REQUEST_CANCELLED — Blood request was cancelled
 *
 * Priorities:
 *   NORMAL, URGENT, EMERGENCY
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID is required'],
      index: true
    },

    type: {
      type: String,
      enum: {
        values: [
          'DONOR_MATCHED',
          'DONOR_ACCEPTED',
          'DONOR_REJECTED',
          'EMERGENCY_REQUEST',
          'REQUEST_CANCELLED',
          'DONOR_VERIFIED',
          'DONOR_SUSPENDED',
          'APPOINTMENT_BOOKED',
          'APPOINTMENT_CANCELLED'
        ],
        message: '{VALUE} is not a valid notification type'
      },
      required: [true, 'Notification type is required']
    },

    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },

    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters']
    },

    relatedRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BloodRequest',
      required: false
    },

    relatedMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: false
    },

    priority: {
      type: String,
      enum: {
        values: ['NORMAL', 'URGENT', 'EMERGENCY'],
        message: '{VALUE} is not a valid priority level'
      },
      default: 'NORMAL'
    },

    isRead: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Compound index to optimize recipient unread queries and prevent duplicates
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, isRead: 1 });

// JSON Transform — Strip internal __v field
notificationSchema.methods.toJSON = function () {
  const notifObject = this.toObject();
  delete notifObject.__v;
  return notifObject;
};

module.exports = mongoose.model('Notification', notificationSchema);
