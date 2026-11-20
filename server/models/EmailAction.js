/**
 * Single-use actions embedded in LifeLink email links.
 */

const mongoose = require('mongoose');

const emailActionSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true
    },
    donorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    },
    usedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmailAction', emailActionSchema);
