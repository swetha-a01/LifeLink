/**
 * LifeLink — Potential Donor Matching Algorithm
 *
 * Evaluates potential donors for a given BloodRequest based on donor data.
 *
 * Mandatory Conditions for Potential Matching:
 *   1. Compatible Blood Group Match (conservative red-cell compatibility)
 *   2. Donor Availability Status == 'AVAILABLE'
 *   3. Donor Verification Status == 'VERIFIED'
 *   4. Donor Eligibility (90-day donation cooldown check)
 *
 * Scoring Breakdown (Max 100):
 *   - Compatible Blood Group Match: +40
 *   - Verified Donor           : +20
 *   - Currently Available      : +20
 *   - Eligible Donor           : +10
 *   - Same Area / Location     : +10
 *
 * Disclaimer:
 *   This algorithm provides automated prototype software matching criteria only.
 *   Medical eligibility and transfusion compatibility must be confirmed by certified medical personnel.
 */

/**
 * Checks if a donor is eligible based on 90-day donation cooldown.
 * @param {Date|string} lastDonationDate
 * @returns {boolean}
 */
const isDonorEligible = (lastDonationDate) => {
  if (!lastDonationDate) return true; // Never donated before -> eligible

  const donationDate = new Date(lastDonationDate);
  if (isNaN(donationDate.getTime())) return true;

  const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;
  const cooldownEndDate = new Date(donationDate.getTime() + ninetyDaysInMs);

  return new Date() >= cooldownEndDate;
};

/**
 * Conservative red-cell compatibility matrix. The requester blood group is
 * treated as the recipient group and the donor blood group as the source.
 */
const isBloodGroupCompatible = (donorGroup, recipientGroup) => {
  const donor = String(donorGroup || '').toUpperCase();
  const recipient = String(recipientGroup || '').toUpperCase();
  const compatibility = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
  };
  return Boolean(compatibility[donor] && compatibility[donor].includes(recipient));
};

/**
 * Evaluates a single donor profile against a blood request.
 * Returns null if mandatory criteria fail, or a match evaluation object if eligible.
 *
 * @param {object} request - BloodRequest Mongoose document
 * @param {object} donor - DonorProfile Mongoose document (populated with userId)
 * @returns {object|null} Match details with matchScore and matchReasons
 */
const evaluateMatch = (request, donor, route = {}) => {
  // 1. Mandatory Check: Compatible blood group
  if (!isBloodGroupCompatible(donor.bloodGroup, request.bloodGroup)) {
    return null;
  }

  // 2. Mandatory Check: Availability Status == 'AVAILABLE'
  if (donor.availability !== 'AVAILABLE') {
    return null;
  }

  // 3. Mandatory Check: Verification Status == 'VERIFIED'
  if (donor.verificationStatus !== 'VERIFIED') {
    return null;
  }

  // 4. Mandatory Check: Eligibility (90-day cooldown)
  const eligible = isDonorEligible(donor.lastDonationDate);
  if (!eligible) {
    return null;
  }

  // --- Calculate Match Score ---
  let score = 0;
  const reasons = [];

  // Compatible blood group (+40)
  score += 40;
  reasons.push(donor.bloodGroup === request.bloodGroup
    ? 'Blood group matches'
    : `Compatible blood group: ${donor.bloodGroup} donor for ${request.bloodGroup} request`);

  // Verified donor (+20)
  score += 20;
  reasons.push('Donor is verified');

  // Currently available (+20)
  score += 20;
  reasons.push('Donor is currently available');

  // Eligible (+10)
  score += 10;
  reasons.push('Donor is currently eligible');

  // Road proximity (+10), with same-area fallback when routing is unavailable.
  const reqArea = (request.area || '').trim().toLowerCase();
  const donorArea = (donor.area || '').trim().toLowerCase();

  if (Number.isFinite(route.distanceKm)) {
    if (route.distanceKm <= 20) score += 10;
    else if (route.distanceKm <= 50) score += 7;
    else if (route.distanceKm <= 100) score += 4;
    reasons.push(`Road distance: ${route.distanceKm} km`);
  } else if (reqArea && donorArea && reqArea === donorArea) {
    score += 10;
    reasons.push('Same area');
  } else if (donor.area) {
    reasons.push(`Donor located in area: ${donor.area}`);
  }

  // Ensure score is clamped 0-100
  score = Math.min(100, Math.max(0, score));

  return {
    donorId: donor._id,
    donorUserId: donor.userId._id ? donor.userId._id : donor.userId,
    matchScore: score,
    matchReasons: reasons,
    roadDistanceKm: Number.isFinite(route.distanceKm) ? route.distanceKm : undefined,
    estimatedDurationMinutes: Number.isFinite(route.durationMinutes)
      ? route.durationMinutes
      : undefined,
    routeStatus: route.status || 'UNAVAILABLE',
    routeApproximate: Boolean(route.approximate)
  };
};

module.exports = {
  isDonorEligible,
  isBloodGroupCompatible,
  evaluateMatch
};
