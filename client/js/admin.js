/**
 * LifeLink — Admin Portal Controller (Phase 9)
 *
 * Responsibilities:
 *   - Enforce ADMIN authentication guard
 *   - Load MongoDB dashboard statistics (GET /api/admin/dashboard)
 *   - Render and process pending donor verification requests (GET /api/admin/donors/pending, PATCH /api/admin/donors/:id/verify)
 *   - Render and manage all donors (GET /api/admin/donors)
 *   - Render and manage user account statuses (GET /api/admin/users, PATCH /api/admin/users/:id/status)
 */

$(document).ready(function () {
  // 1. Auth Guard
  if (!Auth.requireAuth()) return;

  var user = Auth.getUser();
  if (!user || user.role !== 'ADMIN') {
    window.location.href = '/user/dashboard.html';
    return;
  }

  $('#adminName').text('Admin: ' + (user.name || 'Administrator'));

  // 2. Load Data
  loadAllAdminData();

  $('#campForm').on('submit', function (event) {
    event.preventDefault();
    createDonationCamp();
  });

  // 3. Bind Refresh Button
  $('#refreshAdminBtn').on('click', function () {
    loadAllAdminData();
  });

  // 4. Bind Logout Button
  $('#logoutBtn').on('click', function () {
    Auth.logout();
  });

  // 5. Delegated Event Handlers for Actions
  $(document).on('click', '.btn-verify-donor', function () {
    var id = $(this).data('id');
    handleDonorVerification(id, 'VERIFY');
  });

  $(document).on('click', '.btn-reject-donor', function () {
    var id = $(this).data('id');
    handleDonorVerification(id, 'REJECT');
  });

  $(document).on('click', '.btn-suspend-donor', function () {
    var id = $(this).data('id');
    handleDonorVerification(id, 'SUSPEND');
  });

  $(document).on('click', '.btn-toggle-user-status', function () {
    var id = $(this).data('id');
    var currentStatus = $(this).data('status');
    var newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    handleUserStatusChange(id, newStatus);
  });

  $(document).on('click', '.btn-complete-appointment', function () {
    var id = $(this).data('id');
    handleCompleteAppointment(id);
  });
});

/**
 * Loads all admin dashboard data
 */
function loadAllAdminData() {
  Auth.clearAlerts('adminAlert');
  loadDashboardStats();
  loadPendingDonors();
  loadAllDonors();
  loadUsersList();
  loadAdminAppointments();
  loadDonationCamps();
}

function loadDonationCamps() {
  LifeLinkAPI.get('/admin/camps')
    .then(function (res) {
      var camps = (res && res.data && res.data.camps) ? res.data.camps : [];
      var tbody = $('#campsTbody');
      tbody.empty();
      $('#campsEmptyState').toggleClass('d-none', camps.length > 0);
      camps.forEach(function (camp) {
        var eventDate = camp.eventDate ? new Date(camp.eventDate).toLocaleDateString() : 'N/A';
        var eventTime = camp.eventTime || 'N/A';
        tbody.append(`
          <tr>
            <td><strong>${escapeHtml(camp.name)}</strong><div class="small text-muted">${escapeHtml(camp.phone)}</div></td>
            <td>${escapeHtml(camp.area)}, ${escapeHtml(camp.city)}</td>
            <td>${eventDate}<div class="small text-muted">${escapeHtml(eventTime)}</div></td>
            <td>${escapeHtml(String(camp.registeredCount || 0))}/${escapeHtml(String(camp.capacity))}</td>
            <td><span class="badge bg-success">${escapeHtml(camp.status)}</span></td>
          </tr>
        `);
      });
    })
    .catch(function (error) {
      Auth.showAlert('adminAlert', error.message || 'Could not load donation camps.', 'danger');
    });
}

function createDonationCamp() {
  var payload = {
    name: $('#campName').val().trim(),
    address: $('#campAddress').val().trim(),
    area: $('#campArea').val().trim(),
    city: $('#campCity').val().trim(),
    phone: $('#campPhone').val().trim(),
    operatingHours: $('#campHours').val().trim(),
    eventDate: $('#campEventDate').val(),
    eventTime: $('#campEventTime').val(),
    capacity: Number($('#campCapacity').val()),
    notes: $('#campNotes').val().trim()
  };

  if (!payload.name || !payload.address || !payload.area || !payload.city ||
      !payload.phone || !payload.operatingHours || !payload.eventDate || !payload.eventTime || payload.capacity < 1) {
    Auth.showNativeAlert('campFormAlert', 'Complete all required camp fields.', 'warning');
    return;
  }

  LifeLinkAPI.post('/admin/camps', payload)
    .then(function () {
      Auth.showNativeAlert('campFormAlert', 'Donation camp published successfully.', 'success');
      $('#campForm')[0].reset();
      loadDonationCamps();
    })
    .catch(function (error) {
      Auth.showNativeAlert('campFormAlert', error.message || 'Could not publish donation camp.', 'danger');
    });
}

/**
 * Fetches dashboard stats (GET /api/admin/dashboard)
 */
function loadDashboardStats() {
  LifeLinkAPI.get('/admin/dashboard')
    .then(function (res) {
      var data = (res && res.data) ? res.data : {};
      $('#statTotalUsers').text(data.totalUsers || 0);
      $('#statPendingDonors').text(data.pendingDonors || 0);
      $('#statVerifiedDonors').text(data.verifiedDonors || 0);
      $('#statActiveRequests').text(data.activeRequests || 0);

      $('#pendingBadgeCount').text((data.pendingDonors || 0) + ' Pending');
      $('#totalDonorsBadge').text((data.totalDonors || 0) + ' Donors');
      $('#totalUsersBadge').text((data.totalUsers || 0) + ' Users');
    })
    .catch(function (err) {
      console.warn('Could not load admin stats:', err);
    });
}

/**
 * Fetches pending donors (GET /api/admin/donors/pending)
 */
function loadPendingDonors() {
  $('#pendingDonorsLoading').removeClass('d-none');
  $('#pendingDonorsTableContainer').addClass('d-none');
  $('#emptyPendingState').addClass('d-none');

  LifeLinkAPI.get('/admin/donors/pending')
    .then(function (res) {
      $('#pendingDonorsLoading').addClass('d-none');
      var donors = (res && res.data && res.data.donors) ? res.data.donors : [];

      if (donors && donors.length > 0) {
        renderPendingDonorsTable(donors);
        $('#pendingDonorsTableContainer').removeClass('d-none');
      } else {
        $('#emptyPendingState').removeClass('d-none');
      }
    })
    .catch(function (err) {
      $('#pendingDonorsLoading').addClass('d-none');
      console.warn('Could not load pending donors:', err);
    });
}

/**
 * Renders pending donors table
 */
function renderPendingDonorsTable(donors) {
  var tbody = $('#pendingDonorsTbody');
  tbody.empty();

  donors.forEach(function (donor) {
    var userObj = donor.userId || {};
    var donorName = escapeHtml(userObj.name || 'Anonymous');
    var email = escapeHtml(userObj.email || 'N/A');
    var phone = escapeHtml(userObj.phone || 'N/A');
    var bloodGroup = donor.bloodGroup || 'N/A';
    var area = escapeHtml(donor.area || 'N/A');
    var availability = donor.availability || 'AVAILABLE';
    var appliedDate = donor.createdAt ? new Date(donor.createdAt).toLocaleDateString() : 'N/A';

    var tr = `
      <tr>
        <td class="fw-bold text-dark">${donorName}</td>
        <td>
          <div class="small fw-semibold text-dark">${email}</div>
          <div class="small text-muted"><i class="bi bi-telephone me-1"></i>${phone}</div>
        </td>
        <td class="fw-bold text-danger">${bloodGroup}</td>
        <td>${area}</td>
        <td><span class="badge bg-success">${availability}</span></td>
        <td class="small text-muted">${appliedDate}</td>
        <td class="text-center">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-success btn-verify-donor fw-semibold" data-id="${donor._id}">
              <i class="bi bi-check-circle me-1"></i> VERIFY
            </button>
            <button class="btn btn-outline-danger btn-reject-donor fw-semibold" data-id="${donor._id}">
              <i class="bi bi-x-circle me-1"></i> REJECT
            </button>
          </div>
        </td>
      </tr>
    `;
    tbody.append(tr);
  });
}

/**
 * Fetches all donors overview (GET /api/admin/donors)
 */
function loadAllDonors() {
  LifeLinkAPI.get('/admin/donors')
    .then(function (res) {
      var donors = (res && res.data && res.data.donors) ? res.data.donors : [];
      renderAllDonorsTable(donors);
    })
    .catch(function (err) {
      console.warn('Could not load all donors:', err);
    });
}

/**
 * Renders all donors table
 */
function renderAllDonorsTable(donors) {
  var tbody = $('#allDonorsTbody');
  tbody.empty();

  donors.forEach(function (donor) {
    var userObj = donor.userId || {};
    var donorName = escapeHtml(userObj.name || 'Anonymous');
    var bloodGroup = donor.bloodGroup || 'N/A';
    var area = escapeHtml(donor.area || 'N/A');
    var availability = donor.availability || 'AVAILABLE';
    var status = donor.verificationStatus || 'PENDING';

    var statusBadge = '';
    var actionBtn = '';

    if (status === 'VERIFIED') {
      statusBadge = '<span class="badge bg-success"><i class="bi bi-shield-check me-1"></i>VERIFIED</span>';
      actionBtn = `<button class="btn btn-sm btn-outline-secondary btn-suspend-donor" data-id="${donor._id}"><i class="bi bi-pause-circle me-1"></i> Suspend</button>`;
    } else if (status === 'PENDING') {
      statusBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-clock me-1"></i>PENDING</span>';
      actionBtn = `
        <button class="btn btn-sm btn-success btn-verify-donor me-1" data-id="${donor._id}">Verify</button>
        <button class="btn btn-sm btn-outline-danger btn-reject-donor" data-id="${donor._id}">Reject</button>
      `;
    } else if (status === 'REJECTED') {
      statusBadge = '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>REJECTED</span>';
      actionBtn = `<span class="small text-muted">No Actions</span>`;
    } else if (status === 'SUSPENDED') {
      statusBadge = '<span class="badge bg-secondary"><i class="bi bi-slash-circle me-1"></i>SUSPENDED</span>';
      actionBtn = `<button class="btn btn-sm btn-success btn-verify-donor" data-id="${donor._id}"><i class="bi bi-check-circle me-1"></i> Re-Verify</button>`;
    }

    var tr = `
      <tr>
        <td class="fw-bold text-dark">${donorName}</td>
        <td class="fw-bold text-danger">${bloodGroup}</td>
        <td>${area}</td>
        <td><span class="badge bg-success-subtle text-success border border-success-subtle">${availability}</span></td>
        <td>${statusBadge}</td>
        <td class="text-center">${actionBtn}</td>
      </tr>
    `;
    tbody.append(tr);
  });
}

/**
 * Handles donor verification action (PATCH /api/admin/donors/:id/verify)
 */
function handleDonorVerification(id, action) {
  Auth.clearAlerts('adminAlert');

  LifeLinkAPI.patch('/admin/donors/' + id + '/verify', { action: action })
    .then(function (res) {
      var updatedStatus = res.data?.donor?.verificationStatus || action;
      Auth.showAlert('adminAlert', `Donor profile status updated to ${updatedStatus}!`, 'success');
      loadAllAdminData();
    })
    .catch(function (err) {
      var msg = (err && err.message) ? err.message : 'Failed to update donor verification status.';
      Auth.showAlert('adminAlert', msg, 'danger');
    });
}

/**
 * Fetches users list (GET /api/admin/users)
 */
function loadUsersList() {
  LifeLinkAPI.get('/admin/users')
    .then(function (res) {
      var users = (res && res.data && res.data.users) ? res.data.users : [];
      renderUsersTable(users);
    })
    .catch(function (err) {
      console.warn('Could not load users list:', err);
    });
}

/**
 * Renders users table
 */
function renderUsersTable(users) {
  var tbody = $('#usersTbody');
  tbody.empty();

  var currentUser = Auth.getUser();

  users.forEach(function (userObj) {
    var name = escapeHtml(userObj.name || 'N/A');
    var email = escapeHtml(userObj.email || 'N/A');
    var phone = escapeHtml(userObj.phone || 'N/A');
    var role = userObj.role || 'USER';
    var status = userObj.accountStatus || 'ACTIVE';
    var joinedDate = userObj.createdAt ? new Date(userObj.createdAt).toLocaleDateString() : 'N/A';

    var roleBadge = role === 'ADMIN'
      ? '<span class="badge bg-warning text-dark"><i class="bi bi-shield-lock me-1"></i>ADMIN</span>'
      : '<span class="badge bg-secondary">USER</span>';

    var statusBadge = status === 'ACTIVE'
      ? '<span class="badge bg-success">ACTIVE</span>'
      : '<span class="badge bg-danger">SUSPENDED</span>';

    var actionBtn = '';
    if (userObj.id === currentUser.id || userObj._id === currentUser.id) {
      actionBtn = '<span class="small text-muted">Current Admin</span>';
    } else {
      var btnText = status === 'ACTIVE' ? 'Suspend' : 'Activate';
      var btnClass = status === 'ACTIVE' ? 'btn-outline-danger' : 'btn-outline-success';
      actionBtn = `<button class="btn btn-sm ${btnClass} btn-toggle-user-status" data-id="${userObj.id || userObj._id}" data-status="${status}">${btnText}</button>`;
    }

    var tr = `
      <tr>
        <td class="fw-bold text-dark">${name}</td>
        <td>${email}</td>
        <td>${phone}</td>
        <td>${roleBadge}</td>
        <td>${statusBadge}</td>
        <td class="small text-muted">${joinedDate}</td>
        <td class="text-center">${actionBtn}</td>
      </tr>
    `;
    tbody.append(tr);
  });
}

/**
 * Handles user account status update (PATCH /api/admin/users/:id/status)
 */
function handleUserStatusChange(userId, newStatus) {
  Auth.clearAlerts('adminAlert');

  LifeLinkAPI.patch('/admin/users/' + userId + '/status', { accountStatus: newStatus })
    .then(function () {
      Auth.showAlert('adminAlert', `User account status updated to ${newStatus}!`, 'success');
      loadAllAdminData();
    })
    .catch(function (err) {
      var msg = (err && err.message) ? err.message : 'Failed to update user account status.';
      Auth.showAlert('adminAlert', msg, 'danger');
    });
}

/**
 * Loads all appointments for administrator overview (GET /api/admin/appointments)
 */
function loadAdminAppointments() {
  LifeLinkAPI.get('/admin/appointments')
    .then(function (res) {
      var appointments = (res && res.data && res.data.appointments)
        ? res.data.appointments
        : [];

      $('#totalAppointmentsBadge').text(appointments.length + ' Appointments');
      renderAdminAppointmentsTable(appointments);
    })
    .catch(function (err) {
      console.warn('Could not load admin appointments:', err);
    });
}

/**
 * Renders the admin appointments table
 */
function renderAdminAppointmentsTable(appointments) {
  var tbody = $('#appointmentsTbody');
  tbody.empty();

  if (!appointments || appointments.length === 0) {
    tbody.html('<tr><td colspan="6" class="text-center py-4 text-muted">No appointments found in the system.</td></tr>');
    return;
  }

  appointments.forEach(function (app) {
    var donor = app.donorUserId || {};
    var centre = app.centreId || {};
    var camp = app.campId || {};

    var donorName = escapeHtml(donor.name || 'Unknown Donor');
    var donorContact = escapeHtml(donor.email || donor.phone || 'N/A');

    var centreName = escapeHtml(centre.name || camp.name || app.locationName || 'Request location');
    var centreLoc = escapeHtml([centre.area || camp.area, centre.city || camp.city, app.locationArea].filter(Boolean).join(', ') || 'N/A');

    var dateStr = app.appointmentDate ? new Date(app.appointmentDate).toLocaleDateString() : 'N/A';
    var timeStr = escapeHtml(app.appointmentTime || 'N/A');

    var statusBadge = '';
    var actionBtn = '';

    switch (app.status) {
      case 'PENDING':
        statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
        actionBtn = `<button class="btn btn-sm btn-success btn-complete-appointment fw-semibold" data-id="${app._id}"><i class="bi bi-check2-circle me-1"></i>Mark Completed</button>`;
        break;
      case 'CONFIRMED':
        statusBadge = '<span class="badge bg-info text-dark">Confirmed</span>';
        actionBtn = `<button class="btn btn-sm btn-success btn-complete-appointment fw-semibold" data-id="${app._id}"><i class="bi bi-check2-circle me-1"></i>Mark Completed</button>`;
        break;
      case 'COMPLETED':
        statusBadge = '<span class="badge bg-success">Completed</span>';
        actionBtn = '<span class="text-success small fw-semibold"><i class="bi bi-check-all me-1"></i>Completed</span>';
        break;
      case 'CANCELLED':
        statusBadge = '<span class="badge bg-secondary">Cancelled</span>';
        actionBtn = '<span class="text-muted small">Cancelled</span>';
        break;
      default:
        statusBadge = `<span class="badge bg-light text-dark">${app.status}</span>`;
        actionBtn = '-';
        break;
    }

    var notes = app.notes ? escapeHtml(app.notes) : '<span class="text-muted small">None</span>';

    var tr = `
      <tr>
        <td>
          <div class="fw-bold text-dark">${donorName}</div>
          <div class="text-muted small">${donorContact}</div>
        </td>
        <td>
          <div class="fw-semibold text-dark">${centreName}</div>
          <div class="text-muted small">${centreLoc}</div>
        </td>
        <td>
          <div class="fw-semibold text-dark">${dateStr}</div>
          <div class="text-muted small">${timeStr}</div>
        </td>
        <td>${statusBadge}</td>
        <td>${notes}</td>
        <td class="text-center">${actionBtn}</td>
      </tr>
    `;
    tbody.append(tr);
  });
}

/**
 * Handles completing an appointment via admin endpoint (PATCH /api/admin/appointments/:id/complete)
 */
function handleCompleteAppointment(appointmentId) {
  Auth.clearAlerts('adminAlert');

  LifeLinkAPI.patch('/admin/appointments/' + appointmentId + '/complete')
    .then(function (res) {
      Auth.showAlert('adminAlert', 'Appointment marked as completed successfully!', 'success');
      loadAllAdminData();
    })
    .catch(function (err) {
      var msg = (err && err.message) ? err.message : 'Failed to complete appointment.';
      Auth.showAlert('adminAlert', msg, 'danger');
    });
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
