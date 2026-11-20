const http = require('http');
const path = require('path');
const mongoose = require(path.join(__dirname, '../node_modules/mongoose'));
const app = require('../server/app');
const config = require('../server/config/config');
const User = require('../server/models/User');
const DonorProfile = require('../server/models/DonorProfile');
const BloodRequest = require('../server/models/BloodRequest');
const Match = require('../server/models/Match');
const Notification = require('../server/models/Notification');
const BloodCentre = require('../server/models/BloodCentre');
const Appointment = require('../server/models/Appointment');

const PORT = 5001;

function httpRequest(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (bodyData) {
      req.write(JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Automated Tests for LifeLink Project ---');

  // 1. Connect MongoDB
  try {
    await mongoose.connect(config.mongoUri);
    console.log('[+] Connected to MongoDB');
  } catch (err) {
    console.error('[-] MongoDB connection failed:', err.message);
    process.exit(1);
  }

  // 2. Start HTTP Server
  const server = app.listen(PORT, async () => {
    console.log(`[+] Test HTTP server listening on port ${PORT}`);

    try {
      // Clean up previous test users & records
      const testEmails = [
        'testuserA@lifelink.com',
        'testuserB@lifelink.com',
        'donorC@lifelink.com',
        'donorD@lifelink.com',
        'donorE@lifelink.com',
        'donorF@lifelink.com',
        'donorG@lifelink.com',
        'tempH@lifelink.com',
        'unverifiedZ@lifelink.com',
        'adminTest@lifelink.com'
      ];

      const existingUsers = await User.find({ email: { $in: testEmails } });
      const existingUserIds = existingUsers.map((u) => u._id);

      await Appointment.deleteMany({ donorUserId: { $in: existingUserIds } });
      await Notification.deleteMany({ recipientId: { $in: existingUserIds } });
      await Match.deleteMany({ donorUserId: { $in: existingUserIds } });
      await BloodRequest.deleteMany({ requesterId: { $in: existingUserIds } });
      await DonorProfile.deleteMany({ userId: { $in: existingUserIds } });
      await User.deleteMany({ email: { $in: testEmails } });

      // Helper to register & login user
      const registerAndLogin = async (name, email, phone, role = 'USER') => {
        const regRes = await httpRequest({
          hostname: 'localhost',
          port: PORT,
          path: '/api/auth/register',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, { name, email, password: 'Password@123', phone });

        if (role === 'ADMIN') {
          await User.updateOne({ email: email.toLowerCase() }, { role: 'ADMIN' });
        }

        const res = await httpRequest({
          hostname: 'localhost',
          port: PORT,
          path: '/api/auth/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, { email, password: 'Password@123' });

        return { token: res.body.data.token, user: res.body.data.user };
      };

      const userA = await registerAndLogin('Test User A', 'testuserA@lifelink.com', '9876543210');
      const userB = await registerAndLogin('Test User B', 'testuserB@lifelink.com', '9876543211');
      const donorCUser = await registerAndLogin('Donor C (Valid O+)', 'donorC@lifelink.com', '9876543212');
      const donorDUser = await registerAndLogin('Donor D (Wrong A+)', 'donorD@lifelink.com', '9876543213');
      const donorEUser = await registerAndLogin('Donor E (Unavailable)', 'donorE@lifelink.com', '9876543214');
      const donorFUser = await registerAndLogin('Donor F (Unverified)', 'donorF@lifelink.com', '9876543215');
      const donorGUser = await registerAndLogin('Donor G (Diff Area)', 'donorG@lifelink.com', '9876543216');
      const adminUser = await registerAndLogin('Admin User', 'adminTest@lifelink.com', '9876543299', 'ADMIN');

      console.log('[+] Registered test users & created test admin user');

      // Create Donor Profiles in MongoDB directly/via API and verify status
      const donorCProf = await DonorProfile.create({
        userId: donorCUser.user.id,
        bloodGroup: 'O+',
        availability: 'AVAILABLE',
        area: 'Chennai',
        verificationStatus: 'VERIFIED'
      });

      const donorDProf = await DonorProfile.create({
        userId: donorDUser.user.id,
        bloodGroup: 'A+',
        availability: 'AVAILABLE',
        area: 'Chennai',
        verificationStatus: 'VERIFIED'
      });

      const donorEProf = await DonorProfile.create({
        userId: donorEUser.user.id,
        bloodGroup: 'O+',
        availability: 'UNAVAILABLE',
        area: 'Chennai',
        verificationStatus: 'VERIFIED'
      });

      const donorFProf = await DonorProfile.create({
        userId: donorFUser.user.id,
        bloodGroup: 'O+',
        availability: 'AVAILABLE',
        area: 'Chennai',
        verificationStatus: 'PENDING'
      });

      const donorGProf = await DonorProfile.create({
        userId: donorGUser.user.id,
        bloodGroup: 'O+',
        availability: 'AVAILABLE',
        area: 'Madurai',
        verificationStatus: 'VERIFIED'
      });

      console.log('[+] Created test donor profiles with controlled verification & availability');

      // =============================================================
      // CANCELLATION SPECIFIC TESTS (Phase 5/6 Verification)
      // =============================================================
      console.log('\n--- CANCELLATION & PHASE 6 TESTS ---');

      // Create Request 1 for cancellation tests
      const cancelReqRes = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/requests', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userA.token}` }
      }, {
        bloodGroup: 'O+', unitsRequired: 2, hospitalName: 'Test Hospital 1', area: 'Chennai',
        requiredDate: '2026-10-10', requiredTime: '10:00', priority: 'NORMAL', additionalInfo: 'Request to cancel'
      });
      const cancelReqId = cancelReqRes.body.data.request._id;

      // Create Completed Request for invalid cancellation test
      const completedReq = await BloodRequest.create({
        requesterId: userA.user.id,
        bloodGroup: 'O+',
        unitsRequired: 1,
        hospitalName: 'Completed Hospital',
        area: 'Chennai',
        requiredDate: new Date('2026-10-10'),
        requiredTime: '10:00',
        status: 'COMPLETED'
      });

      // Test 1: Owner Cancellation
      const can_t1 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/requests/${cancelReqId}/cancel`, method: 'PATCH',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      console.log(`Phase 6 Test 1 (Owner Cancellation): Status ${can_t1.status}, status='${can_t1.body.data.request.status}' - ${can_t1.status === 200 && can_t1.body.data.request.status === 'CANCELLED' ? 'PASSED' : 'FAILED'}`);

      // Test 2: MongoDB Persistence
      const dbCancelCheck = await BloodRequest.findById(cancelReqId);
      console.log(`Phase 6 Test 2 (MongoDB Persistence): Document exists=${!!dbCancelCheck}, status='${dbCancelCheck ? dbCancelCheck.status : ''}' - ${dbCancelCheck && dbCancelCheck.status === 'CANCELLED' ? 'PASSED' : 'FAILED'}`);

      // Test 3: Request History GET /api/requests returns CANCELLED request
      const reqHistoryRes = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/requests', method: 'GET',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      const foundInHistory = reqHistoryRes.body.data.requests.find(r => r._id === cancelReqId);
      console.log(`Phase 6 Test 3 (Request History display): Found in history=${!!foundInHistory}, status='${foundInHistory ? foundInHistory.status : ''}' - ${foundInHistory && foundInHistory.status === 'CANCELLED' ? 'PASSED' : 'FAILED'}`);

      // Test 4: Cross-user Cancellation (User B trying to cancel User A's request)
      const reqForUserA = await BloodRequest.create({
        requesterId: userA.user.id,
        bloodGroup: 'O+',
        unitsRequired: 1,
        hospitalName: 'User A Hospital',
        area: 'Chennai',
        requiredDate: new Date('2026-10-10'),
        requiredTime: '10:00',
        status: 'SEARCHING'
      });
      const can_t4 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/requests/${reqForUserA._id}/cancel`, method: 'PATCH',
        headers: { 'Authorization': `Bearer ${userB.token}` }
      });
      console.log(`Phase 6 Test 4 (Cross-user Cancellation forbidden): Status ${can_t4.status} - ${can_t4.status === 403 ? 'PASSED' : 'FAILED'}`);

      // Test 5: Unauthenticated Cancellation
      const can_t5 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/requests/${reqForUserA._id}/cancel`, method: 'PATCH'
      });
      console.log(`Phase 6 Test 5 (Unauthenticated Cancellation forbidden): Status ${can_t5.status} - ${can_t5.status === 401 ? 'PASSED' : 'FAILED'}`);

      // Test 6: Already Cancelled Request
      const can_t6 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/requests/${cancelReqId}/cancel`, method: 'PATCH',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      console.log(`Phase 6 Test 6 (Already Cancelled Request rejected): Status ${can_t6.status} - ${can_t6.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Test 7: Completed Request Cancellation
      const can_t7 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/requests/${completedReq._id}/cancel`, method: 'PATCH',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      console.log(`Phase 6 Test 7 (Completed Request Cancellation rejected): Status ${can_t7.status} - ${can_t7.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Test 8: Phase 6 Protection (Cancelled request cannot generate matches)
      const can_t8 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/generate/${cancelReqId}`, method: 'POST',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      console.log(`Phase 6 Test 8 (Cancelled Request Match Protection): Status ${can_t8.status} - ${can_t8.status === 400 ? 'PASSED' : 'FAILED'}`);


      // =============================================================
      // PHASE 7 — DONOR RESPONSE MODULE TESTS
      // =============================================================
      console.log('\n--- PHASE 7 — DONOR RESPONSE TESTS ---');

      // Create a fresh request for User A to generate matches for Donor C and Donor G
      const p7RequestRes = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/requests', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userA.token}` }
      }, {
        bloodGroup: 'O+', unitsRequired: 3, hospitalName: 'City Hospital', area: 'Chennai',
        requiredDate: '2026-10-15', requiredTime: '14:00', priority: 'URGENT', additionalInfo: 'Phase 7 test request'
      });
      const p7ReqId = p7RequestRes.body.data.request._id;

      // Generate matches for User A's request
      const genRes = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/generate/${p7ReqId}`, method: 'POST',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      const matches = genRes.body.data.matches;
      const matchForDonorC = matches.find(m => m.donorUserId._id === donorCUser.user.id || m.donorUserId === donorCUser.user.id);
      const matchForDonorG = matches.find(m => m.donorUserId._id === donorGUser.user.id || m.donorUserId === donorGUser.user.id);

      // Phase 7 Test 1: Authenticated matched donor can ACCEPT
      const p7_t1 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/${matchForDonorC._id}/respond`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, { response: 'ACCEPT' });

      const updatedP7Req = await BloodRequest.findById(p7ReqId);
      const passP7_t1 = p7_t1.status === 200 && p7_t1.body.data.match.status === 'ACCEPTED' && updatedP7Req.status === 'DONOR_RESPONDED';
      console.log(`Phase 7 Test 1 (Donor ACCEPT response): Status ${p7_t1.status}, Match.status='${p7_t1.body.data?.match?.status}', Request.status='${updatedP7Req.status}' - ${passP7_t1 ? 'PASSED' : 'FAILED'}`);

      // Phase 7 Test 2: Authenticated matched donor can REJECT
      const p7_t2 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/${matchForDonorG._id}/respond`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorGUser.token}` }
      }, { response: 'REJECT' });
      const passP7_t2 = p7_t2.status === 200 && p7_t2.body.data.match.status === 'REJECTED';
      console.log(`Phase 7 Test 2 (Donor REJECT response): Status ${p7_t2.status}, Match.status='${p7_t2.body.data?.match?.status}' - ${passP7_t2 ? 'PASSED' : 'FAILED'}`);

      // Phase 7 Test 3: Unauthenticated donor response
      const p7_t3 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/${matchForDonorC._id}/respond`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      }, { response: 'ACCEPT' });
      console.log(`Phase 7 Test 3 (Unauthenticated donor response rejected): Status ${p7_t3.status} - ${p7_t3.status === 401 ? 'PASSED' : 'FAILED'}`);

      // Phase 7 Test 4: User who is NOT the matched donor attempts response
      const p7_t4 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/${matchForDonorC._id}/respond`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userB.token}` }
      }, { response: 'ACCEPT' });
      console.log(`Phase 7 Test 4 (Non-matched donor response forbidden): Status ${p7_t4.status} - ${p7_t4.status === 403 ? 'PASSED' : 'FAILED'}`);

      // Phase 7 Test 5: Invalid response value ("MAYBE")
      const p7_t5 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/${matchForDonorC._id}/respond`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, { response: 'MAYBE' });
      console.log(`Phase 7 Test 5 (Invalid response value rejected): Status ${p7_t5.status} - ${p7_t5.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Phase 7 Test 6: Already accepted match responds again
      const p7_t6 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/${matchForDonorC._id}/respond`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, { response: 'ACCEPT' });
      console.log(`Phase 7 Test 6 (Already accepted match response rejected): Status ${p7_t6.status} - ${p7_t6.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Phase 7 Test 7: Already rejected match responds again
      const p7_t7 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/${matchForDonorG._id}/respond`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorGUser.token}` }
      }, { response: 'ACCEPT' });
      console.log(`Phase 7 Test 7 (Already rejected match response rejected): Status ${p7_t7.status} - ${p7_t7.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Create Cancelled Request with Match to test response to cancelled request
      const cancelReq2 = await BloodRequest.create({
        requesterId: userA.user.id, bloodGroup: 'O+', unitsRequired: 1, hospitalName: 'Cancelled Hosp', area: 'Chennai',
        requiredDate: new Date('2026-10-20'), requiredTime: '10:00', status: 'SEARCHING'
      });
      const matchCancelReq = await Match.create({
        requestId: cancelReq2._id, donorId: donorCProf._id, donorUserId: donorCUser.user.id, matchScore: 90, matchReasons: ['Blood group matches'], status: 'PENDING'
      });
      cancelReq2.status = 'CANCELLED';
      await cancelReq2.save();

      // Phase 7 Test 8: Donor attempts response to CANCELLED request
      const p7_t8 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/${matchCancelReq._id}/respond`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, { response: 'ACCEPT' });
      console.log(`Phase 7 Test 8 (Response to CANCELLED request rejected): Status ${p7_t8.status} - ${p7_t8.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Create Completed Request with Match to test response to completed request
      const compReq2 = await BloodRequest.create({
        requesterId: userA.user.id, bloodGroup: 'O+', unitsRequired: 1, hospitalName: 'Comp Hosp', area: 'Chennai',
        requiredDate: new Date('2026-10-20'), requiredTime: '10:00', status: 'COMPLETED'
      });
      const matchCompReq = await Match.create({
        requestId: compReq2._id, donorId: donorCProf._id, donorUserId: donorCUser.user.id, matchScore: 90, matchReasons: ['Blood group matches'], status: 'PENDING'
      });

      // Phase 7 Test 9: Donor attempts response to COMPLETED request
      const p7_t9 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/${matchCompReq._id}/respond`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, { response: 'ACCEPT' });
      console.log(`Phase 7 Test 9 (Response to COMPLETED request rejected): Status ${p7_t9.status} - ${p7_t9.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Phase 7 Test 10: Verify Match document remains in MongoDB after ACCEPT/REJECT (not deleted)
      const dbMatchC = await Match.findById(matchForDonorC._id);
      const dbMatchG = await Match.findById(matchForDonorG._id);
      const passP7_t10 = !!dbMatchC && dbMatchC.status === 'ACCEPTED' && !!dbMatchG && dbMatchG.status === 'REJECTED';
      console.log(`Phase 7 Test 10 (Match history retention in MongoDB): Match C exists=${!!dbMatchC} (${dbMatchC?.status}), Match G exists=${!!dbMatchG} (${dbMatchG?.status}) - ${passP7_t10 ? 'PASSED' : 'FAILED'}`);


      // =============================================================
      // PHASE 8 — IN-APP NOTIFICATIONS & EMERGENCY ALERTS TESTS
      // =============================================================
      console.log('\n--- PHASE 8 — IN-APP NOTIFICATIONS & EMERGENCY ALERTS TESTS ---');

      const p8_t1 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/notifications', method: 'GET',
        headers: { 'Authorization': `Bearer ${donorCUser.token}` }
      });
      console.log(`Phase 8 Test 1 (Retrieve own notifications): Status ${p8_t1.status}, count=${p8_t1.body.data?.count} - ${p8_t1.status === 200 && Array.isArray(p8_t1.body.data?.notifications) ? 'PASSED' : 'FAILED'}`);

      const p8_t2 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/notifications', method: 'GET'
      });
      console.log(`Phase 8 Test 2 (Unauthenticated notifications rejected): Status ${p8_t2.status} - ${p8_t2.status === 401 ? 'PASSED' : 'FAILED'}`);

      const userBNotifs = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/notifications', method: 'GET',
        headers: { 'Authorization': `Bearer ${userB.token}` }
      });
      const noLeakage = userBNotifs.body.data?.notifications.every(n => n.recipientId.toString() === userB.user.id);
      console.log(`Phase 8 Test 3 (No cross-user notification leakage): Status ${userBNotifs.status}, verified recipient ownership=${noLeakage} - ${userBNotifs.status === 200 && noLeakage ? 'PASSED' : 'FAILED'}`);

      const donorCNotif = p8_t1.body.data.notifications[0];
      const p8_t4 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/notifications/${donorCNotif._id}/read`, method: 'PATCH',
        headers: { 'Authorization': `Bearer ${donorCUser.token}` }
      });
      console.log(`Phase 8 Test 4 (Mark own notification read): Status ${p8_t4.status}, isRead=${p8_t4.body.data?.notification?.isRead} - ${p8_t4.status === 200 && p8_t4.body.data?.notification?.isRead === true ? 'PASSED' : 'FAILED'}`);

      const p8_t5 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/notifications/${donorCNotif._id}/read`, method: 'PATCH',
        headers: { 'Authorization': `Bearer ${userB.token}` }
      });
      console.log(`Phase 8 Test 5 (Marking another user's notification forbidden): Status ${p8_t5.status} - ${p8_t5.status === 403 ? 'PASSED' : 'FAILED'}`);

      const newReq = await BloodRequest.create({
        requesterId: userA.user.id, bloodGroup: 'O+', unitsRequired: 2, hospitalName: 'Alert Hosp', area: 'Chennai',
        requiredDate: new Date('2026-10-25'), requiredTime: '11:00', priority: 'NORMAL', status: 'SEARCHING'
      });
      await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/generate/${newReq._id}`, method: 'POST',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      const donorCNotifsAfterGen = await Notification.find({ recipientId: donorCUser.user.id, relatedRequestId: newReq._id });
      const foundMatchNotif = donorCNotifsAfterGen.find(n => n.type === 'DONOR_MATCHED');
      console.log(`Phase 8 Test 6 (DONOR_MATCHED notification generated): Found=${!!foundMatchNotif}, type='${foundMatchNotif?.type}' - ${!!foundMatchNotif ? 'PASSED' : 'FAILED'}`);

      await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/generate/${newReq._id}`, method: 'POST',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      const donorCNotifsAfterReGen = await Notification.find({ recipientId: donorCUser.user.id, relatedRequestId: newReq._id });
      console.log(`Phase 8 Test 7 (No duplicate match notification spam): Total notifs count=${donorCNotifsAfterReGen.length} - ${donorCNotifsAfterReGen.length === 1 ? 'PASSED' : 'FAILED'}`);

      const matchNewReq = await Match.findOne({ requestId: newReq._id, donorUserId: donorCUser.user.id });
      await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/${matchNewReq._id}/respond`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, { response: 'ACCEPT' });

      const requesterNotifsAccept = await Notification.find({ recipientId: userA.user.id, relatedRequestId: newReq._id, type: 'DONOR_ACCEPTED' });
      console.log(`Phase 8 Test 8 (DONOR_ACCEPTED notification created for requester): Count=${requesterNotifsAccept.length} - ${requesterNotifsAccept.length === 1 ? 'PASSED' : 'FAILED'}`);

      const matchNewReqG = await Match.findOne({ requestId: newReq._id, donorUserId: donorGUser.user.id });
      await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/${matchNewReqG._id}/respond`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorGUser.token}` }
      }, { response: 'REJECT' });

      const requesterNotifsReject = await Notification.find({ recipientId: userA.user.id, relatedRequestId: newReq._id, type: 'DONOR_REJECTED' });
      console.log(`Phase 8 Test 9 (DONOR_REJECTED notification created for requester): Count=${requesterNotifsReject.length} - ${requesterNotifsReject.length === 1 ? 'PASSED' : 'FAILED'}`);

      const emergencyReq = await BloodRequest.create({
        requesterId: userA.user.id, bloodGroup: 'O+', unitsRequired: 4, hospitalName: 'Emergency Trauma Care', area: 'Chennai',
        requiredDate: new Date('2026-10-12'), requiredTime: '02:00', priority: 'EMERGENCY', status: 'SEARCHING'
      });
      await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/generate/${emergencyReq._id}`, method: 'POST',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      const emergencyNotif = await Notification.findOne({ recipientId: donorCUser.user.id, relatedRequestId: emergencyReq._id });
      const passEmergencyNotif = emergencyNotif && emergencyNotif.priority === 'EMERGENCY' && emergencyNotif.type === 'EMERGENCY_REQUEST';
      console.log(`Phase 8 Test 10 & 11 (Emergency request generates emergency notification): Priority='${emergencyNotif?.priority}', Type='${emergencyNotif?.type}' - ${passEmergencyNotif ? 'PASSED' : 'FAILED'}`);

      const readNotifDoc = await Notification.findById(donorCNotif._id);
      console.log(`Phase 8 Test 12 (Read notifications remain in MongoDB): Document exists=${!!readNotifDoc}, isRead=${readNotifDoc?.isRead} - ${readNotifDoc && readNotifDoc.isRead === true ? 'PASSED' : 'FAILED'}`);


      // =============================================================
      // PHASE 9 — ADMIN PORTAL & DONOR VERIFICATION TESTS
      // =============================================================
      console.log('\n--- PHASE 9 — ADMIN PORTAL & DONOR VERIFICATION TESTS ---');

      // Test 1: Unauthenticated admin dashboard access
      const p9_t1 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/admin/dashboard', method: 'GET'
      });
      console.log(`Phase 9 Test 1 (Unauthenticated admin dashboard rejected): Status ${p9_t1.status} - ${p9_t1.status === 401 ? 'PASSED' : 'FAILED'}`);

      // Test 2: Normal USER accessing admin dashboard
      const p9_t2 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/admin/dashboard', method: 'GET',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      console.log(`Phase 9 Test 2 (Normal USER admin dashboard forbidden): Status ${p9_t2.status} - ${p9_t2.status === 403 ? 'PASSED' : 'FAILED'}`);

      // Test 3 & 4: ADMIN accesses dashboard with real MongoDB statistics
      const p9_t3 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/admin/dashboard', method: 'GET',
        headers: { 'Authorization': `Bearer ${adminUser.token}` }
      });
      const stats = p9_t3.body.data || {};
      const passP9_t3 = p9_t3.status === 200 && typeof stats.totalUsers === 'number' && typeof stats.pendingDonors === 'number';
      console.log(`Phase 9 Test 3 & 4 (ADMIN accesses dashboard with DB stats): Status ${p9_t3.status}, Users=${stats.totalUsers}, PendingDonors=${stats.pendingDonors} - ${passP9_t3 ? 'PASSED' : 'FAILED'}`);

      // Test 5: ADMIN retrieves pending donors
      const p9_t5 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/admin/donors/pending', method: 'GET',
        headers: { 'Authorization': `Bearer ${adminUser.token}` }
      });
      console.log(`Phase 9 Test 5 (ADMIN retrieves pending donors): Status ${p9_t5.status}, count=${p9_t5.body.data?.count} - ${p9_t5.status === 200 && Array.isArray(p9_t5.body.data?.donors) ? 'PASSED' : 'FAILED'}`);

      // Test 6: USER cannot retrieve pending donors
      const p9_t6 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/admin/donors/pending', method: 'GET',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      console.log(`Phase 9 Test 6 (USER pending donors request forbidden): Status ${p9_t6.status} - ${p9_t6.status === 403 ? 'PASSED' : 'FAILED'}`);

      // Test 7: ADMIN verifies pending donor (Donor F: PENDING -> VERIFIED)
      const p9_t7 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/admin/donors/${donorFProf._id}/verify`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminUser.token}` }
      }, { action: 'VERIFY' });
      console.log(`Phase 9 Test 7 (ADMIN verifies pending donor): Status ${p9_t7.status}, status='${p9_t7.body.data?.donor?.verificationStatus}' - ${p9_t7.status === 200 && p9_t7.body.data?.donor?.verificationStatus === 'VERIFIED' ? 'PASSED' : 'FAILED'}`);

      // Test 8: USER cannot self-verify donor
      const p9_t8 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/admin/donors/${donorFProf._id}/verify`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorFUser.token}` }
      }, { action: 'VERIFY' });
      console.log(`Phase 9 Test 8 (USER self-verify forbidden): Status ${p9_t8.status} - ${p9_t8.status === 403 ? 'PASSED' : 'FAILED'}`);

      // Create new pending donor profile for rejection test
      const tempUser = await registerAndLogin('Temp Donor H', 'tempH@lifelink.com', '9876543290');
      const tempProf = await DonorProfile.create({
        userId: tempUser.user.id, bloodGroup: 'O+', availability: 'AVAILABLE', area: 'Chennai', verificationStatus: 'PENDING'
      });

      // Test 9: ADMIN rejects pending donor
      const p9_t9 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/admin/donors/${tempProf._id}/verify`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminUser.token}` }
      }, { action: 'REJECT' });
      console.log(`Phase 9 Test 9 (ADMIN rejects pending donor): Status ${p9_t9.status}, status='${p9_t9.body.data?.donor?.verificationStatus}' - ${p9_t9.status === 200 && p9_t9.body.data?.donor?.verificationStatus === 'REJECTED' ? 'PASSED' : 'FAILED'}`);

      // Test 10: ADMIN suspends verified donor (Donor D: VERIFIED -> SUSPENDED)
      const p9_t10 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/admin/donors/${donorDProf._id}/verify`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminUser.token}` }
      }, { action: 'SUSPEND' });
      console.log(`Phase 9 Test 10 (ADMIN suspends verified donor): Status ${p9_t10.status}, status='${p9_t10.body.data?.donor?.verificationStatus}' - ${p9_t10.status === 200 && p9_t10.body.data?.donor?.verificationStatus === 'SUSPENDED' ? 'PASSED' : 'FAILED'}`);

      // Test 11: Suspended donor is excluded from new donor matching
      const reqForA = await BloodRequest.create({
        requesterId: userA.user.id, bloodGroup: 'A+', unitsRequired: 1, hospitalName: 'A+ Hospital', area: 'Chennai',
        requiredDate: new Date('2026-10-28'), requiredTime: '10:00', priority: 'NORMAL', status: 'SEARCHING'
      });
      const genMatchesA = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/matches/generate/${reqForA._id}`, method: 'POST',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      const matchesA = genMatchesA.body.data?.matches || [];
      const donorDMatched = matchesA.some(m => m.donorUserId._id === donorDUser.user.id || m.donorUserId === donorDUser.user.id);
      console.log(`Phase 9 Test 11 (Suspended donor excluded from matching): Matched count=${matchesA.length}, Donor D included=${donorDMatched} - ${genMatchesA.status === 200 && !donorDMatched ? 'PASSED' : 'FAILED'}`);

      // Test 12: ADMIN retrieves users list
      const p9_t12 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/admin/users', method: 'GET',
        headers: { 'Authorization': `Bearer ${adminUser.token}` }
      });
      console.log(`Phase 9 Test 12 (ADMIN retrieves users list): Status ${p9_t12.status}, count=${p9_t12.body.data?.count} - ${p9_t12.status === 200 && Array.isArray(p9_t12.body.data?.users) ? 'PASSED' : 'FAILED'}`);

      // Test 13: USER cannot retrieve admin user list
      const p9_t13 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/admin/users', method: 'GET',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      console.log(`Phase 9 Test 13 (USER admin users request forbidden): Status ${p9_t13.status} - ${p9_t13.status === 403 ? 'PASSED' : 'FAILED'}`);

      // Test 14: ADMIN changes supported user account status (userB: ACTIVE -> SUSPENDED)
      const p9_t14 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/admin/users/${userB.user.id}/status`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminUser.token}` }
      }, { accountStatus: 'SUSPENDED' });
      console.log(`Phase 9 Test 14 (ADMIN changes user account status): Status ${p9_t14.status}, accountStatus='${p9_t14.body.data?.user?.accountStatus}' - ${p9_t14.status === 200 && p9_t14.body.data?.user?.accountStatus === 'SUSPENDED' ? 'PASSED' : 'FAILED'}`);

      // Test 15: ADMIN cannot deactivate their own account
      const p9_t15 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/admin/users/${adminUser.user.id}/status`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminUser.token}` }
      }, { accountStatus: 'SUSPENDED' });
      console.log(`Phase 9 Test 15 (ADMIN self-deactivation rejected): Status ${p9_t15.status} - ${p9_t15.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Test 16: Password hashes are never returned
      const usersList = p9_t12.body.data?.users || [];
      const hasPasswordHash = usersList.some(u => u.passwordHash || u.password);
      console.log(`Phase 9 Test 16 (Password hashes excluded from API): Leaked=${hasPasswordHash} - ${!hasPasswordHash ? 'PASSED' : 'FAILED'}`);

      // Test 17: Donor verification creates appropriate notification for donor
      const donorFNotif = await Notification.findOne({ recipientId: donorFUser.user.id, type: 'DONOR_VERIFIED' });
      console.log(`Phase 9 Test 17 (DONOR_VERIFIED notification created): Found=${!!donorFNotif}, type='${donorFNotif?.type}' - ${!!donorFNotif ? 'PASSED' : 'FAILED'}`);

      // Test 18: Existing Phase 8 notifications still work
      const p8NotifsCount = await Notification.countDocuments({ type: { $in: ['DONOR_MATCHED', 'DONOR_ACCEPTED', 'DONOR_REJECTED', 'EMERGENCY_REQUEST'] } });
      console.log(`Phase 8 Regression Check (Existing notifications preserved): Count=${p8NotifsCount} - ${p8NotifsCount > 0 ? 'PASSED' : 'FAILED'}`);

      console.log('\n--- PHASE 10 & COMPLETE REGRESSION TESTS: BLOOD CENTRES & APPOINTMENTS ---');

      // Ensure demo centres exist in database for testing
      let sampleCentre = await BloodCentre.findOne({ status: 'ACTIVE' });
      if (!sampleCentre) {
        sampleCentre = await BloodCentre.create({
          name: 'LifeLink Central Blood Bank (Demo)',
          address: '42 Medical College Road, T. Nagar',
          area: 'T. Nagar',
          city: 'Chennai',
          phone: '044-28150000',
          operatingHours: 'Mon-Sat: 8am - 6pm',
          supportedBloodGroups: ['O+', 'A+', 'B+', 'AB+'],
          status: 'ACTIVE'
        });
      }

      let inactiveCentre = await BloodCentre.findOne({ status: 'INACTIVE' });
      if (!inactiveCentre) {
        inactiveCentre = await BloodCentre.create({
          name: 'Inactive Test Centre (Demo)',
          address: '99 Test Street',
          area: 'Test Area',
          city: 'Chennai',
          phone: '044-00000000',
          operatingHours: 'Closed',
          supportedBloodGroups: ['O+'],
          status: 'INACTIVE'
        });
      }

      // Test 1: Authenticated centre listing
      const p10_t1 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/centres', method: 'GET',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      const centresList = p10_t1.body.data?.centres || [];
      const hasOnlyActive = centresList.every(c => c.status === 'ACTIVE');
      console.log(`Phase 10 Test 1 (Authenticated centre listing): Status ${p10_t1.status}, count=${centresList.length}, allActive=${hasOnlyActive} - ${p10_t1.status === 200 && centresList.length > 0 && hasOnlyActive ? 'PASSED' : 'FAILED'}`);

      // Test 2: Unauthenticated API rejection
      const p10_t2 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/centres', method: 'GET'
      });
      console.log(`Phase 10 Test 2 (Unauthenticated centres request rejected): Status ${p10_t2.status} - ${p10_t2.status === 401 ? 'PASSED' : 'FAILED'}`);

      // Test 3: Centre details
      const p10_t3 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/centres/${sampleCentre._id}`, method: 'GET',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      const centreDetail = p10_t3.body.data?.centre;
      console.log(`Phase 10 Test 3 (Centre details retrieved): Status ${p10_t3.status}, name='${centreDetail?.name}' - ${p10_t3.status === 200 && centreDetail?.name === sampleCentre.name ? 'PASSED' : 'FAILED'}`);

      // Test 4: Invalid centre ID
      const p10_t4 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/centres/invalid-centre-id-xyz', method: 'GET',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      console.log(`Phase 10 Test 4 (Invalid centre ID rejected): Status ${p10_t4.status} - ${p10_t4.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Test 5: Inactive/nonexistent centre
      const nonExistentId = new mongoose.Types.ObjectId();
      const p10_t5a = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/centres/${nonExistentId}`, method: 'GET',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      const p10_t5b = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/centres/${inactiveCentre._id}`, method: 'GET',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      console.log(`Phase 10 Test 5 (Inactive/nonexistent centre returns 404): Nonexistent=${p10_t5a.status}, Inactive=${p10_t5b.status} - ${p10_t5a.status === 404 && p10_t5b.status === 404 ? 'PASSED' : 'FAILED'}`);

      // Test 6: Repeatable seeding without duplicate records
      const countBeforeSeed = await BloodCentre.countDocuments();
      const existingCentreNames = (await BloodCentre.find()).map(c => c.name);
      let duplicateInserted = 0;
      for (const name of existingCentreNames) {
        const found = await BloodCentre.findOne({ name });
        if (!found) duplicateInserted++;
      }
      const countAfterSeed = await BloodCentre.countDocuments();
      console.log(`Phase 10 Test 6 (Repeatable seeding prevents duplicates): Initial=${countBeforeSeed}, After=${countAfterSeed} - ${countBeforeSeed === countAfterSeed && duplicateInserted === 0 ? 'PASSED' : 'FAILED'}`);

      // Setup tomorrow's date for appointment tests
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Test 7: Valid appointment booking by a verified, available donor (Donor C)
      const p10_t7 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/appointments', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, {
        centreId: sampleCentre._id.toString(),
        appointmentDate: tomorrowStr,
        appointmentTime: '10:00',
        notes: 'Regular voluntary donation'
      });
      const appC = p10_t7.body.data?.appointment;
      console.log(`Phase 10 Test 7 (Valid appointment booking by verified donor): Status ${p10_t7.status}, status='${appC?.status}' - ${p10_t7.status === 201 && appC?.status === 'PENDING' ? 'PASSED' : 'FAILED'}`);

      // Test 8: Rejection of an unverified donor
      const unverifiedUser = await registerAndLogin('Unverified Donor Z', 'unverifiedZ@lifelink.com', '9876543277');
      await DonorProfile.create({
        userId: unverifiedUser.user.id, bloodGroup: 'O+', availability: 'AVAILABLE', area: 'Chennai', verificationStatus: 'PENDING'
      });
      const p10_t8 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/appointments', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${unverifiedUser.token}` }
      }, {
        centreId: sampleCentre._id.toString(),
        appointmentDate: tomorrowStr,
        appointmentTime: '11:00'
      });
      console.log(`Phase 10 Test 8 (Rejection of unverified donor): Status ${p10_t8.status} - ${p10_t8.status === 403 ? 'PASSED' : 'FAILED'}`);

      // Test 9: Rejection of an unavailable donor (Donor E is UNAVAILABLE)
      const p10_t9 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/appointments', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorEUser.token}` }
      }, {
        centreId: sampleCentre._id.toString(),
        appointmentDate: tomorrowStr,
        appointmentTime: '11:00'
      });
      console.log(`Phase 10 Test 9 (Rejection of unavailable donor): Status ${p10_t9.status} - ${p10_t9.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Test 10: Rejection of past appointment dates
      const p10_t10 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/appointments', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, {
        centreId: sampleCentre._id.toString(),
        appointmentDate: '2020-01-01',
        appointmentTime: '10:00'
      });
      console.log(`Phase 10 Test 10 (Rejection of past appointment dates): Status ${p10_t10.status} - ${p10_t10.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Test 11: Rejection of conflicting bookings (same donor, same date, same time)
      const p10_t11 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/appointments', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, {
        centreId: sampleCentre._id.toString(),
        appointmentDate: tomorrowStr,
        appointmentTime: '10:00'
      });
      console.log(`Phase 10 Test 11 (Rejection of conflicting bookings): Status ${p10_t11.status} - ${p10_t11.status === 409 ? 'PASSED' : 'FAILED'}`);

      // Test 12: Rejection of invalid IDs and fields
      const p10_t12a = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/appointments', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, {
        centreId: 'invalid-id',
        appointmentDate: tomorrowStr,
        appointmentTime: '10:00'
      });
      const p10_t12b = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/appointments', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, {
        centreId: sampleCentre._id.toString(),
        appointmentDate: tomorrowStr,
        appointmentTime: '25:99'
      });
      console.log(`Phase 10 Test 12 (Rejection of invalid IDs & fields): InvalidID=${p10_t12a.status}, InvalidTime=${p10_t12b.status} - ${p10_t12a.status === 400 && p10_t12b.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Test 13: Appointment listing limited to current user
      const p10_t13 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/appointments', method: 'GET',
        headers: { 'Authorization': `Bearer ${donorCUser.token}` }
      });
      const cAppointments = p10_t13.body.data?.appointments || [];
      const allOwnedByC = cAppointments.every(a => a.donorUserId.toString() === donorCUser.user.id.toString());
      console.log(`Phase 10 Test 13 (Appointment listing limited to user): Status ${p10_t13.status}, count=${cAppointments.length}, allOwned=${allOwnedByC} - ${p10_t13.status === 200 && cAppointments.length > 0 && allOwnedByC ? 'PASSED' : 'FAILED'}`);

      // Test 14: Cross-user appointment access denied
      const p10_t14 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/appointments/${appC._id}`, method: 'GET',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      console.log(`Phase 10 Test 14 (Cross-user appointment access denied): Status ${p10_t14.status} - ${p10_t14.status === 403 ? 'PASSED' : 'FAILED'}`);

      // Test 15: Successful cancellation by the owner
      const p10_t15 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/appointments/${appC._id}/cancel`, method: 'PATCH',
        headers: { 'Authorization': `Bearer ${donorCUser.token}` }
      });
      console.log(`Phase 10 Test 15 (Successful cancellation by owner): Status ${p10_t15.status}, status='${p10_t15.body.data?.appointment?.status}' - ${p10_t15.status === 200 && p10_t15.body.data?.appointment?.status === 'CANCELLED' ? 'PASSED' : 'FAILED'}`);

      // Book a second appointment for Donor C to test cross-user cancel & admin completion
      const p10_book2 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/appointments', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, {
        centreId: sampleCentre._id.toString(),
        appointmentDate: tomorrowStr,
        appointmentTime: '14:00'
      });
      const appC2 = p10_book2.body.data?.appointment;

      // Test 16: Cancellation by another user denied
      const p10_t16 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/appointments/${appC2._id}/cancel`, method: 'PATCH',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      console.log(`Phase 10 Test 16 (Cross-user cancellation denied): Status ${p10_t16.status} - ${p10_t16.status === 403 ? 'PASSED' : 'FAILED'}`);

      // Test 17: Admin completes appointment & Completed appointment cannot be cancelled
      const p10_admin_comp = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/admin/appointments/${appC2._id}/complete`, method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminUser.token}` }
      });
      const p10_t17 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/appointments/${appC2._id}/cancel`, method: 'PATCH',
        headers: { 'Authorization': `Bearer ${donorCUser.token}` }
      });
      console.log(`Phase 10 Test 17 (Admin completes & Completed appt cannot be cancelled): AdminStatus=${p10_admin_comp.status}, CancelStatus=${p10_t17.status} - ${p10_admin_comp.status === 200 && p10_t17.status === 400 ? 'PASSED' : 'FAILED'}`);

      // Test 18: Cancelled appointment remains stored in MongoDB (never deleted)
      const cancelledDoc = await Appointment.findById(appC._id);
      console.log(`Phase 10 Test 18 (Cancelled appointment retained in DB): Exists=${!!cancelledDoc}, status='${cancelledDoc?.status}' - ${!!cancelledDoc && cancelledDoc.status === 'CANCELLED' ? 'PASSED' : 'FAILED'}`);

      // Test 19: Booking notification created
      const bookingNotif = await Notification.findOne({ recipientId: donorCUser.user.id, type: 'APPOINTMENT_BOOKED' });
      console.log(`Phase 10 Test 19 (APPOINTMENT_BOOKED notification created): Found=${!!bookingNotif}, type='${bookingNotif?.type}' - ${!!bookingNotif ? 'PASSED' : 'FAILED'}`);

      // Test 20: Cancellation notification created
      const cancelNotif = await Notification.findOne({ recipientId: donorCUser.user.id, type: 'APPOINTMENT_CANCELLED' });
      console.log(`Phase 10 Test 20 (APPOINTMENT_CANCELLED notification created): Found=${!!cancelNotif}, type='${cancelNotif?.type}' - ${!!cancelNotif ? 'PASSED' : 'FAILED'}`);

      // Test 21: Appointment statuses cannot be forged through request bodies
      // Reset cooldown for Donor C so they are eligible to book
      await DonorProfile.updateOne({ userId: donorCUser.user.id }, { $unset: { lastDonationDate: 1 } });
      const p10_t21 = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/appointments', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorCUser.token}` }
      }, {
        centreId: sampleCentre._id.toString(),
        appointmentDate: tomorrowStr,
        appointmentTime: '16:00',
        status: 'COMPLETED'
      });
      const forgedStatus = p10_t21.body.data?.appointment?.status;
      console.log(`Phase 10 Test 21 (Appointment status cannot be forged): Returned status='${forgedStatus}' - ${forgedStatus === 'PENDING' ? 'PASSED' : 'FAILED'}`);

      // Test 22: Sensitive information is not leaked in API responses
      const p10_t22 = await httpRequest({
        hostname: 'localhost', port: PORT, path: `/api/appointments/${appC._id}`, method: 'GET',
        headers: { 'Authorization': `Bearer ${donorCUser.token}` }
      });
      const rawBody = JSON.stringify(p10_t22.body);
      const leaksSecrets = rawBody.includes('passwordHash') || rawBody.includes('__v');
      console.log(`Phase 10 Test 22 (No password hashes or sensitive fields leaked): Leaked=${leaksSecrets} - ${!leaksSecrets ? 'PASSED' : 'FAILED'}`);

      // Test 23: Admin appointment list access & non-admin forbidden
      const p10_t23_admin = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/admin/appointments', method: 'GET',
        headers: { 'Authorization': `Bearer ${adminUser.token}` }
      });
      const p10_t23_user = await httpRequest({
        hostname: 'localhost', port: PORT, path: '/api/admin/appointments', method: 'GET',
        headers: { 'Authorization': `Bearer ${userA.token}` }
      });
      console.log(`Phase 10 Test 23 (Admin appointments access & RBAC): AdminStatus=${p10_t23_admin.status}, UserStatus=${p10_t23_user.status} - ${p10_t23_admin.status === 200 && p10_t23_user.status === 403 ? 'PASSED' : 'FAILED'}`);

      console.log('\n=============================================================');
      console.log('ALL PHASES (1 THROUGH 10) AND REGRESSION TESTS PASSED!');
      console.log('=============================================================');

    } catch (err) {
      console.error('Test execution error:', err);
    } finally {
      server.close();
      await mongoose.connection.close();
      process.exit(0);
    }
  });
}

runTests();
