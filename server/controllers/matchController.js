
/**
 * LifeLink — Match Controller
 *
 * Handles generating, retrieving, and responding to donor matches.
 * Sends email notifications while preserving existing in-app notifications.
 */
const Match = require('../models/Match');
const {
  sendDonorRequestEmail,
  sendRequesterAcceptedEmail
} = require('../utils/emailService');
const mongoose = require('mongoose');
const BloodRequest = require('../models/BloodRequest');
const DonorProfile = require('../models/DonorProfile');
const Appointment = require('../models/Appointment');

const Notification = require('../models/Notification');
const User = require('../models/User');
const crypto = require('crypto');
const EmailAction = require('../models/EmailAction');
const { successResponse, errorResponse } = require('../utils/apiResponse');



console.log('Match import:', Match);
console.log('Mongoose model:', mongoose.models.Match);
console.log('Match export keys:', Object.keys(Match || {}));
console.log('Match model diagnostic:', {
  type: typeof Match,
  modelName: Match?.modelName,
  find: typeof Match?.find,
  findOne: typeof Match?.findOne,
  findById: typeof Match?.findById
});



const { evaluateMatch } = require('../utils/matchingAlgorithm');
const { getDonorRequestRoute } = require('../utils/locationRoutingService');

// ================================================================
// POST /api/matches/generate/:requestId
// Generate potential donor matches
// ================================================================
const generateMatches = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return errorResponse(res, 'Invalid request ID format.', 400);
    }

    const request = await BloodRequest.findById(requestId);

    if (!request) {
      return errorResponse(res, 'Blood request not found.', 404);
    }

    if (request.requesterId.toString() !== req.user._id.toString()) {
      return errorResponse(
        res,
        'Access denied. You can only generate matches for your own blood request.',
        403
      );
    }

    if (['CANCELLED', 'COMPLETED', 'EXPIRED'].includes(request.status)) {
      return errorResponse(
        res,
        `Cannot generate matches for a blood request with status '${request.status}'.`,
        400
      );
    }

    // Find all available, verified donors. Blood compatibility and cooldown
    // are evaluated below so compatible donors from every district remain
    // discoverable.
    const candidateDonors = await DonorProfile.find({
      availability: 'AVAILABLE',
      verificationStatus: 'VERIFIED',
      userId: { $ne: req.user._id }
    }).populate('userId', 'name email phone role accountStatus preferences');

    const createdMatches = [];

    for (const donor of candidateDonors) {
      const route = await getDonorRequestRoute(request, donor);
      const matchEval = evaluateMatch(request, donor, route);

      if (!matchEval) {
        continue;
      }

      // Check whether the match already exists.
      const existingMatch = await Match.findOne({
        requestId: request._id,
        donorId: donor._id
      });

      const isNewMatch = !existingMatch;

      // Create a match if new; otherwise update its scoring information.
      // Do not reset ACCEPTED or REJECTED matches to PENDING.
      const matchDoc = await Match.findOneAndUpdate(
        {
          requestId: request._id,
          donorId: donor._id
        },
        {
          $set: {
            donorUserId: matchEval.donorUserId,
            matchScore: matchEval.matchScore,
            matchReasons: matchEval.matchReasons,
            roadDistanceKm: matchEval.roadDistanceKm,
            estimatedDurationMinutes: matchEval.estimatedDurationMinutes,
            routeStatus: matchEval.routeStatus,
            routeApproximate: matchEval.routeApproximate
          },
          $setOnInsert: {
            requestId: request._id,
            donorId: donor._id,
            status: 'PENDING'
          }
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );

      createdMatches.push(matchDoc);

      const recipientUserId = donor.userId?._id || donor.userId;

      // Preserve existing in-app notification behavior.
      const existingNotif = await Notification.findOne({
        recipientId: recipientUserId,
        relatedMatchId: matchDoc._id
      });

      if (!existingNotif) {
        const isEmergency = request.priority === 'EMERGENCY';

        const type = isEmergency
          ? 'EMERGENCY_REQUEST'
          : 'DONOR_MATCHED';

        const priority = isEmergency
          ? 'EMERGENCY'
          : request.priority || 'NORMAL';

        const title = isEmergency
          ? '🚨 Emergency Blood Request Match'
          : 'New Blood Request Match';

        const message = isEmergency
          ? `🚨 Emergency ${request.bloodGroup} blood request matching your donor profile at ${request.hospitalName} (${request.area}).`
          : `You have been matched as a potential donor for a ${request.bloodGroup} blood request at ${request.hospitalName} (${request.area}).`;

        await Notification.create({
          recipientId: recipientUserId,
          type,
          title,
          message,
          relatedRequestId: request._id,
          relatedMatchId: matchDoc._id,
          priority,
          isRead: false
        });
      }

      // Email only when a new match is created.
      // Email errors must not interrupt match generation.
      if (isNewMatch && donor.userId?.preferences?.emailNotifications !== false) {
        try {
          await sendDonorRequestEmail({
            donor: {
              id: donor.userId?._id,
              name: donor.userId?.name,
              email: donor.userId?.email
            },
            request,
            matchId: matchDoc._id
          });
        } catch (emailError) {
          console.error(
            'LifeLink donor email error:',
            emailError.message
          );
        }
      }
    }

    const populatedMatches = await Match.find({
      requestId: request._id
    })
      .populate('donorUserId', 'name email phone role')
      .populate(
        'donorId',
        'bloodGroup availability area verificationStatus lastDonationDate latitude longitude'
      )
      .sort({ matchScore: -1, roadDistanceKm: 1, createdAt: -1 });

    return successResponse(
      res,
      `Generated ${populatedMatches.length} potential donor matches`,
      {
        count: populatedMatches.length,
        matches: populatedMatches
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/matches/request/:requestId
// Get matches for a specific request
// ================================================================
const getMatchesForRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return errorResponse(res, 'Invalid request ID format.', 400);
    }

    const request = await BloodRequest.findById(requestId);

    if (!request) {
      return errorResponse(res, 'Blood request not found.', 404);
    }

    if (
      request.requesterId.toString() !== req.user._id.toString() &&
      req.user.role !== 'ADMIN'
    ) {
      return errorResponse(
        res,
        'Access denied. You can only view matches for your own blood request.',
        403
      );
    }

    const matches = await Match.find({
      requestId: request._id
    })
      .populate('donorUserId', 'name email phone role')
      .populate(
        'donorId',
        'bloodGroup availability area verificationStatus lastDonationDate latitude longitude'
      )
      .sort({ matchScore: -1, roadDistanceKm: 1, createdAt: -1 });

    return successResponse(res, 'Request matches retrieved', {
      count: matches.length,
      matches
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/matches
// Get matches for the current user's blood requests
// ================================================================
const getUserMatches = async (req, res, next) => {
  try {
    const userRequests = await BloodRequest.find({
      requesterId: req.user._id
    });

    const requestIds = userRequests.map((request) => request._id);

    const matches = await Match.find({
      requestId: { $in: requestIds }
    })
      .populate(
        'requestId',
        'bloodGroup unitsRequired hospitalName area requiredDate requiredTime status priority latitude longitude'
      )
      .populate('donorUserId', 'name email phone role')
      .populate(
        'donorId',
        'bloodGroup availability area verificationStatus lastDonationDate latitude longitude'
      )
      .sort({ matchScore: -1, roadDistanceKm: 1, createdAt: -1 });

    return successResponse(res, 'User matches retrieved', {
      count: matches.length,
      matches
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/matches/donor
// Get matches directed to the current donor
// ================================================================
const getDonorMatches = async (req, res, next) => {
  try {
    const matches = await Match.find({
      donorUserId: req.user._id,
      status: 'PENDING'
    })
      .populate({
        path: 'requestId',
        select:
          'bloodGroup unitsRequired hospitalName area requiredDate requiredTime priority additionalInfo status requesterId',
        populate: {
          path: 'requesterId',
          select: 'name email phone'
        }
      })
      .populate('donorUserId', 'name email phone role')
      .populate(
        'donorId',
        'bloodGroup availability area verificationStatus lastDonationDate latitude longitude'
      )
      .sort({ createdAt: -1 });

    return successResponse(res, 'Donor matches retrieved', {
      count: matches.length,
      matches
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PATCH /api/matches/:matchId/respond
// Donor accepts or rejects a match
// ================================================================
const respondToMatch = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { response } = req.body;

    if (!response || !['ACCEPT', 'REJECT'].includes(response)) {
      return errorResponse(
        res,
        "Invalid response value. Must be 'ACCEPT' or 'REJECT'.",
        400
      );
    }

    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return errorResponse(res, 'Invalid match ID format.', 400);
    }

    const match = await Match.findById(matchId);

    if (!match) {
      return errorResponse(res, 'Match record not found.', 404);
    }

    let emailAction = null;
    if (req.body.actionToken) {
      emailAction = await EmailAction.findOne({
        tokenHash: hashEmailActionToken(String(req.body.actionToken)),
        matchId: match._id,
        donorUserId: req.user._id,
        usedAt: null,
        expiresAt: { $gt: new Date() }
      });

      if (!emailAction) {
        return errorResponse(
          res,
          'This email action is invalid, expired, or has already been used.',
          410
        );
      }
    }

    // Ensure the logged-in user is the matched donor.
    if (match.donorUserId.toString() !== req.user._id.toString()) {
      return errorResponse(
        res,
        'Access denied. You can only respond to match requests directed to you.',
        403
      );
    }

    // Ensure the donor profile belongs to the logged-in user.
    const donorProfile = await DonorProfile.findOne({
      userId: req.user._id
    });

    if (
      !donorProfile ||
      match.donorId.toString() !== donorProfile._id.toString()
    ) {
      return errorResponse(
        res,
        'Access denied. Donor profile mismatch.',
        403
      );
    }

    if (match.status !== 'PENDING') {
      return errorResponse(
        res,
        `Cannot respond. This match has already been ${match.status.toLowerCase()}.`,
        400
      );
    }

    const bloodRequest = await BloodRequest.findById(match.requestId);

    if (!bloodRequest) {
      return errorResponse(
        res,
        'Associated blood request not found.',
        404
      );
    }

    if (
      ['CANCELLED', 'COMPLETED', 'EXPIRED'].includes(
        bloodRequest.status
      )
    ) {
      return errorResponse(
        res,
        `Cannot respond to a blood request with status '${bloodRequest.status}'.`,
        400
      );
    }

    if (emailAction) {
      const claimedAction = await EmailAction.findOneAndUpdate(
        {
          _id: emailAction._id,
          usedAt: null,
          expiresAt: { $gt: new Date() }
        },
        { $set: { usedAt: new Date() } },
        { new: true }
      );

      if (!claimedAction) {
        return errorResponse(res, 'This email action has already been used.', 409);
      }
    }

    if (response === 'ACCEPT') {
      match.status = 'ACCEPTED';
      bloodRequest.status = 'DONOR_RESPONDED';

      await bloodRequest.save();

      const existingAppointment = await Appointment.findOne({ matchId: match._id });
      if (!existingAppointment) {
        const appointmentDate = new Date(bloodRequest.requiredDate);
        appointmentDate.setHours(0, 0, 0, 0);

        await Appointment.create({
          donorUserId: match.donorUserId,
          donorProfileId: match.donorId,
          requesterUserId: bloodRequest.requesterId,
          matchId: match._id,
          requestId: bloodRequest._id,
          appointmentDate,
          appointmentTime: bloodRequest.requiredTime,
          status: 'PENDING',
          locationName: bloodRequest.hospitalName,
          locationArea: bloodRequest.area,
          notes: 'Created from an accepted donor match. Confirm the donation location with the requester.'
        });

        await Notification.create({
          recipientId: match.donorUserId,
          type: 'APPOINTMENT_BOOKED',
          title: 'Donation Appointment Added',
          message: `Your accepted donor match is now listed as a pending appointment for ${bloodRequest.hospitalName} on ${appointmentDate.toLocaleDateString()} at ${bloodRequest.requiredTime}.`,
          relatedRequestId: bloodRequest._id,
          relatedMatchId: match._id,
          priority: bloodRequest.priority || 'NORMAL',
          isRead: false
        });
      }

      const existingAcceptNotif = await Notification.findOne({
        recipientId: bloodRequest.requesterId,
        type: 'DONOR_ACCEPTED',
        relatedMatchId: match._id
      });

      if (!existingAcceptNotif) {
        const isEmergency =
          bloodRequest.priority === 'EMERGENCY';

        await Notification.create({
          recipientId: bloodRequest.requesterId,
          type: 'DONOR_ACCEPTED',
          title: 'Donor Accepted Your Request',
          message: `A matched donor has accepted your ${bloodRequest.bloodGroup} blood request for ${bloodRequest.hospitalName}.`,
          relatedRequestId: bloodRequest._id,
          relatedMatchId: match._id,
          priority: isEmergency
            ? 'EMERGENCY'
            : bloodRequest.priority || 'NORMAL',
          isRead: false
        });
      }

      // Email the requester when the donor accepts.
      // A failed email must not cancel the donor's response.
      try {
        const requester = await User.findById(
          bloodRequest.requesterId
        ).select('name email preferences');

        const donorUser = await User.findById(
          match.donorUserId
        ).select('name email');

        if (requester?.preferences?.emailNotifications !== false) {
          await sendRequesterAcceptedEmail({
            requester,
            donor: donorUser,
            request: bloodRequest
          });
        }
      } catch (emailError) {
        console.error(
          'LifeLink requester email error:',
          emailError.message
        );
      }
    } else if (response === 'REJECT') {
      match.status = 'REJECTED';

      const existingRejectNotif = await Notification.findOne({
        recipientId: bloodRequest.requesterId,
        type: 'DONOR_REJECTED',
        relatedMatchId: match._id
      });

      if (!existingRejectNotif) {
        const isEmergency =
          bloodRequest.priority === 'EMERGENCY';

        await Notification.create({
          recipientId: bloodRequest.requesterId,
          type: 'DONOR_REJECTED',
          title: 'Donor Response Update',
          message: `A potential donor has declined your ${bloodRequest.bloodGroup} blood request for ${bloodRequest.hospitalName}.`,
          relatedRequestId: bloodRequest._id,
          relatedMatchId: match._id,
          priority: isEmergency
            ? 'EMERGENCY'
            : bloodRequest.priority || 'NORMAL',
          isRead: false
        });
      }
    }

    await match.save();


    return successResponse(
      res,
      `Match request ${response.toLowerCase()}ed successfully`,
      {
        match,
        request: bloodRequest
      }
    );
  } catch (error) {
    next(error);
  }
};

const hashEmailActionToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// GET /api/matches/email-action?token=...
const getEmailAction = async (req, res, next) => {
  try {
    const token = String(req.query.token || '');
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return errorResponse(res, 'This email action link is invalid.', 400);
    }

    const action = await EmailAction.findOne({
      tokenHash: hashEmailActionToken(token)
    });

    if (!action || action.expiresAt <= new Date()) {
      return errorResponse(res, 'This email action link has expired or is invalid.', 410);
    }

    if (action.usedAt) {
      return errorResponse(res, 'This email action has already been used.', 409);
    }

    if (req.user && req.user._id.toString() !== action.donorUserId.toString()) {
      return errorResponse(
        res,
        'This email action belongs to a different donor account. Log out and sign in as the intended donor.',
        403
      );
    }

    const match = await Match.findById(action.matchId).select(
      'requestId donorUserId matchScore status matchReasons roadDistanceKm estimatedDurationMinutes routeStatus routeApproximate'
    );
    const request = match
      ? await BloodRequest.findById(match.requestId).select(
          'bloodGroup unitsRequired hospitalName area requiredDate requiredTime priority status'
        )
      : null;

    if (!match || !request) {
      return errorResponse(res, 'The blood request or match is no longer available.', 404);
    }

    return successResponse(res, 'Email action retrieved', {
      authenticated: Boolean(req.user),
      matchId: match._id,
      matchStatus: match.status,
      request
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateMatches,
  getMatchesForRequest,
  getUserMatches,
  getDonorMatches,
  respondToMatch,
  getEmailAction,
  hashEmailActionToken
};



console.log('Match module path:', require.resolve('../models/Match'));
console.log('Match type:', typeof Match);
console.log('Match keys:', Object.keys(Match));
console.log('Match find:', typeof Match.find);
console.log('Match findOne:', typeof Match.findOne);
console.log('Match modelName:', Match.modelName);