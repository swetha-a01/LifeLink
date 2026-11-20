/**
 * LifeLink — User Dashboard Controller (Phase 3, 4 & 5)
 *
 * Responsibilities:
 *   - Authenticate logged-in user via GET /api/auth/me
 *   - Populate user profile details dynamically
 *   - Enforce role-based access (ADMIN -> /admin/dashboard.html)
 *   - Fetch real-time Donor Profile status via GET /api/donor/profile (Phase 4)
 *   - Fetch real-time Blood Requests count & summary via GET /api/requests (Phase 5)
 *   - Render demo statistics, potential donor availability, emergency requests, and activity table
 *   - Handle user logout cleanly
 */

$(document).ready(function () {
  // 1. Initial Auth Check
  checkAuthentication();

  // 2. Load User Profile
  loadCurrentUser();

  // 3. Load Real Donor Profile Status (Phase 4 Integration)
  loadDonorProfileStatus();

  // 4. Load Real User Requests Summary (Phase 5 Integration)
  loadUserRequestsSummary();

  // 5. Load Real Potential Matches Summary (Phase 6 Integration)
  loadUserMatchesSummary();

  // 6. Load Notifications Summary (Phase 8 Integration)
  loadNotificationsSummary();

  // 7. Load Appointments Summary (Phase 10 Integration)
  loadAppointmentsSummary();

  // 8. Load live emergency requests and initialize remaining UI sections
  loadEmergencyRequestsSummary();
  initializeDemoStatistics();
  initializeDemoAvailability();

  // 9. Bind Logout Button Event
  $('#confirmLogoutBtn').on('click', function () {
    handleLogout();
  });
});

/**
 * Verifies that a valid JWT token exists in client storage.
 * If no token is present, redirects immediately to login.html.
 */
function checkAuthentication() {
  if (!Auth.isLoggedIn()) {
    console.warn('No authentication token found. Redirecting to login.');
    window.location.href = '/login.html';
  }
}

/**
 * Fetches the currently authenticated user details from GET /api/auth/me.
 * Handles errors gracefully and verifies role authorization.
 */
function loadCurrentUser() {
  LifeLinkAPI.get('/auth/me')
    .then(function (response) {
      if (response && response.data && response.data.user) {
        var user = response.data.user;

        // Verify Role: If ADMIN accesses user dashboard, redirect to admin dashboard
        if (user.role === 'ADMIN') {
          console.log('Admin user detected. Redirecting to admin dashboard.');
          window.location.href = '/admin/dashboard.html';
          return;
        }

        // Cache user info locally for quick reference
        Auth.setUser(user);

        // Populate UI elements with user data
        populateUserDetails(user);
      } else {
        handleAuthFailure('Invalid user response format received from server.');
      }
    })
    .catch(function (error) {
      console.error('Failed to fetch authenticated user profile:', error);
      handleAuthFailure('Session expired or invalid authentication. Please log in again.');
    });
}

/**
 * Populates dynamic user details across navbar, welcome card, and profile summary.
 * @param {object} user - User object from GET /api/auth/me
 */
function populateUserDetails(user) {
  // Top Navbar User Name
  $('#navUserName').text(user.name || 'User');

  // Welcome Section
  $('#welcomeUserName').text(user.name || 'User');

  // Profile Summary Section
  $('#profileName').text(user.name || 'N/A');
  $('#profileEmail').text(user.email || 'N/A');
  $('#profilePhone').text(user.phone || 'N/A');
  $('#profileRole').text(user.role || 'USER');

  // Status Badge
  var statusBadge = $('#profileStatus');
  if (user.accountStatus === 'ACTIVE') {
    statusBadge.text('ACTIVE').removeClass('bg-secondary bg-danger').addClass('bg-success');
  } else {
    statusBadge.text(user.accountStatus || 'UNKNOWN').removeClass('bg-success').addClass('bg-secondary');
  }
}

/**
 * Fetches real donor profile status from GET /api/donor/profile (Phase 4 integration).
 * Updates dashboard action button and profile summary donor status badge.
 */
function loadDonorProfileStatus() {
  LifeLinkAPI.get('/donor/profile')
    .then(function (response) {
      var donorBadge = $('#dashboardDonorStatus');
      var actionBtn = $('#donateBloodActionBtn');
      var actionDesc = $('#donateBloodActionDesc');

      if (response && response.exists && response.donor) {
        var donor = response.donor;
        var status = donor.verificationStatus || 'PENDING';

        // Update Status Badge in Profile Summary
        donorBadge.text(status);
        donorBadge.removeClass('bg-secondary bg-warning bg-success bg-danger text-dark text-white');

        switch (status) {
          case 'VERIFIED':
            donorBadge.addClass('bg-success text-white');
            break;
          case 'REJECTED':
            donorBadge.addClass('bg-danger text-white');
            break;
          case 'SUSPENDED':
            donorBadge.addClass('bg-secondary text-white');
            break;
          case 'PENDING':
          default:
            donorBadge.addClass('bg-warning text-dark');
            break;
        }

        // Update Donate Blood Action Card to Manage Profile
        actionBtn.html('<i class="bi bi-gear me-1"></i> Manage Donor Profile');
        if (actionDesc.length) {
          actionDesc.html('Blood Group: <strong>' + donor.bloodGroup + '</strong> | Status: <strong>' + status + '</strong>');
        }
      } else {
        // No Donor Profile Exists
        donorBadge.text('Not Registered').removeClass('bg-warning bg-success bg-danger text-dark').addClass('bg-secondary text-white');
        actionBtn.html('<i class="bi bi-heart me-1"></i> Create Donor Profile');
        if (actionDesc.length) {
          actionDesc.text('Create or update your donor profile and help someone in need.');
        }
      }
    })
    .catch(function (error) {
      console.warn('Could not fetch donor profile status:', error);
    });
}

/**
 * Fetches real user requests from GET /api/requests (Phase 5 integration).
 * Updates active requests counter and renders real activity table rows.
 */
function loadUserRequestsSummary() {
  LifeLinkAPI.get('/requests')
    .then(function (response) {
      var requests = (response && response.data && response.data.requests)
        ? response.data.requests
        : (response && response.requests ? response.requests : []);

      var activeRequests = requests.filter(function (r) {
        return r.status === 'SEARCHING' || r.status === 'DONOR_RESPONDED';
      });

      $('#activeRequestsCount').text(activeRequests.length);

      var tbody = $('#dashboardActivityBody');
      if (tbody.length && requests.length > 0) {
        tbody.empty();
        requests.slice(0, 5).forEach(function (req) {
          var typeBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Blood Request</span>';
          var details = req.bloodGroup + ' request (' + req.unitsRequired + (req.unitsRequired === 1 ? ' unit' : ' units') + ') - ' + escapeHtml(req.hospitalName);
          var dateStr = req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'N/A';
          var statusBadge = getStatusBadgeHTML(req.status);

          tbody.append(`
            <tr>
              <td>${typeBadge}</td>
              <td class="fw-semibold">${details}</td>
              <td class="text-muted small">${dateStr}</td>
              <td>${statusBadge}</td>
            </tr>
          `);
        });
      }

    })
    .catch(function (error) {
      console.warn('Could not fetch user requests summary:', error);
    });
}

function loadEmergencyRequestsSummary() {
  var container = $('#dashboardEmergencyRequests');
  if (!container.length) return;

  LifeLinkAPI.get('/requests/emergency/all')
    .then(function (response) {
      var requests = response && response.data && response.data.requests
        ? response.data.requests
        : [];

      if (!requests.length) {
        container.html('<div class="col-12"><div class="card p-4 text-center text-muted">No active emergency requests.</div></div>');
        return;
      }

      container.html(requests.slice(0, 3).map(function (request) {
        var priorityClass = request.priority === 'EMERGENCY' ? 'bg-danger' : 'bg-warning text-dark';
        var date = request.requiredDate
          ? new Date(request.requiredDate).toLocaleDateString()
          : 'Date unavailable';
        return '<div class="col-md-4"><div class="card emergency-card h-100 shadow-sm"><div class="card-body">' +
          '<div class="d-flex justify-content-between align-items-center mb-2">' +
          '<span class="badge bg-danger fs-6 px-3 py-2">' + escapeHtml(request.bloodGroup) + '</span>' +
          '<span class="badge ' + priorityClass + '">' + escapeHtml(request.priority) + '</span></div>' +
          '<h5 class="card-title h6 fw-bold text-dark mb-1">' + escapeHtml(request.hospitalName) + '</h5>' +
          '<p class="card-text text-muted small mb-2"><i class="bi bi-geo-alt me-1"></i>' + escapeHtml(request.area) + '</p>' +
          '<div class="border-top pt-2 mt-2 d-flex justify-content-between small text-secondary">' +
          '<span>Required: ' + escapeHtml(date) + '</span><span class="text-danger fw-semibold">Status: Searching</span>' +
          '</div></div></div></div>';
      }).join(''));
    })
    .catch(function () {
      container.html('<div class="col-12"><div class="alert alert-warning mb-0">Emergency requests are temporarily unavailable.</div></div>');
    });
}

/**
 * Fetches notifications summary for navbar badge (Phase 8 integration).
 */
function loadNotificationsSummary() {
  LifeLinkAPI.get('/notifications')
    .then(function (res) {
      var unread = (res && res.data && res.data.unreadCount) ? res.data.unreadCount : 0;
      var badge = $('#navUnreadBadge');
      if (badge.length) {
        if (unread > 0) {
          badge.text(unread).removeClass('d-none');
        } else {
          badge.addClass('d-none');
        }
      }
    })
    .catch(function (err) {
      console.warn('Could not fetch notifications summary:', err);
    });
}

/**
 * Fetches real user matches count from GET /api/matches (Phase 6 integration).
 */
function loadUserMatchesSummary() {
  LifeLinkAPI.get('/matches')
    .then(function (response) {
      var matches = (response && response.data && response.data.matches)
        ? response.data.matches
        : (response && response.matches ? response.matches : []);

      $('#potentialMatchesCount').text(matches.length);
    })
    .catch(function (error) {
      console.warn('Could not fetch matches summary:', error);
    });
}

/**
 * Returns HTML badge for request status in dashboard activity table
 */
function getStatusBadgeHTML(status) {
  switch (status) {
    case 'SEARCHING':
      return '<span class="badge bg-primary text-white">Searching</span>';
    case 'DONOR_RESPONDED':
      return '<span class="badge bg-info text-dark">Responded</span>';
    case 'ACCEPTED':
      return '<span class="badge bg-success text-white">Accepted</span>';
    case 'COMPLETED':
      return '<span class="badge bg-success text-white">Completed</span>';
    case 'CANCELLED':
      return '<span class="badge bg-secondary text-white">Cancelled</span>';
    case 'EXPIRED':
      return '<span class="badge bg-dark text-white">Expired</span>';
    default:
      return `<span class="badge bg-light text-dark">${status}</span>`;
  }
}

/**
 * Fetches real appointments from GET /api/appointments (Phase 10 integration).
 * Updates appointments counter in quick overview and renders next upcoming appointment summary card.
 */
function loadAppointmentsSummary() {
  LifeLinkAPI.get('/appointments')
    .then(function (res) {
      var appointments = (res && res.data && res.data.appointments)
        ? res.data.appointments
        : (res && res.appointments ? res.appointments : []);

      var today = new Date();
      today.setHours(0, 0, 0, 0);

      // Active / upcoming appointments
      var activeAppointments = appointments.filter(function (app) {
        var appDay = new Date(app.appointmentDate);
        appDay.setHours(0, 0, 0, 0);
        return (app.status === 'PENDING' || app.status === 'CONFIRMED') && appDay >= today;
      });

      // Update stat counter
      $('#appointmentsCount').text(activeAppointments.length);

      // Sort upcoming by earliest date first
      activeAppointments.sort(function (a, b) {
        return new Date(a.appointmentDate) - new Date(b.appointmentDate);
      });

      var container = $('#upcomingAppointmentContent');
      if (!container.length) return;

      if (activeAppointments.length > 0) {
        var nextApp = activeAppointments[0];
        var centre = nextApp.centreId || {};
        var centreName = centre.name || 'Blood Donation Centre';
        var locationStr = [centre.area, centre.city].filter(Boolean).join(', ');
        var dateObj = new Date(nextApp.appointmentDate);
        var dateFormatted = dateObj.toLocaleDateString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        var timeStr = nextApp.appointmentTime || 'N/A';

        var statusBadge = nextApp.status === 'CONFIRMED'
          ? '<span class="badge bg-info text-dark">Confirmed</span>'
          : '<span class="badge bg-warning text-dark">Pending</span>';

        container.html(`
          <div class="row align-items-center">
            <div class="col-md-8">
              <div class="d-flex align-items-center gap-2 mb-2">
                <h5 class="fw-bold text-dark mb-0">${escapeHtml(centreName)}</h5>
                ${statusBadge}
              </div>
              <p class="text-muted small mb-2">
                <i class="bi bi-geo-alt text-danger me-1"></i>${escapeHtml(locationStr)}
              </p>
              <div class="d-flex flex-wrap gap-2">
                <span class="badge bg-light text-dark border px-3 py-2">
                  <i class="bi bi-calendar-event text-danger me-1"></i> ${dateFormatted}
                </span>
                <span class="badge bg-light text-dark border px-3 py-2">
                  <i class="bi bi-clock text-danger me-1"></i> ${escapeHtml(timeStr)}
                </span>
              </div>
            </div>
            <div class="col-md-4 text-md-end mt-3 mt-md-0">
              <a href="/user/appointments.html" class="btn btn-outline-danger btn-sm fw-semibold">
                View Details <i class="bi bi-arrow-right ms-1"></i>
              </a>
            </div>
          </div>
        `);
      } else {
        container.html(`
          <div class="text-center py-2 text-muted">
            <i class="bi bi-calendar-plus fs-3 d-block text-secondary mb-2"></i>
            <p class="mb-2">No upcoming donation appointments scheduled.</p>
            <a href="/user/centres.html" class="btn btn-outline-danger btn-sm fw-semibold">
              <i class="bi bi-hospital me-1"></i> Browse Centres & Schedule
            </a>
          </div>
        `);
      }
    })
    .catch(function (err) {
      console.warn('Could not load appointments summary:', err);
      $('#upcomingAppointmentContent').html(`
        <div class="text-center py-2 text-muted">
          <p class="mb-2">Unable to load appointment schedule right now.</p>
          <a href="/user/centres.html" class="btn btn-outline-danger btn-sm fw-semibold">
            <i class="bi bi-hospital me-1"></i> Browse Centres
          </a>
        </div>
      `);
    });
}

/**
 * Initializes quick statistics cards with demo values for static counters.
 */
function initializeDemoStatistics() {
  // activeRequestsCount and appointmentsCount are set dynamically
  $('#donationsCount').text('0');
  $('#notificationsCount').text('0');
}

/**
 * Initializes potential donor availability counts per blood group.
 */
function initializeDemoAvailability() {
  var demoAvailability = [
    { group: 'A+', count: 14, status: 'Available' },
    { group: 'A-', count: 6, status: 'Available' },
    { group: 'B+', count: 18, status: 'Available' },
    { group: 'B-', count: 4, status: 'Available' },
    { group: 'AB+', count: 7, status: 'Available' },
    { group: 'AB-', count: 2, status: 'Limited' },
    { group: 'O+', count: 25, status: 'Available' },
    { group: 'O-', count: 5, status: 'Available' }
  ];

  var container = $('#bloodAvailabilityGrid');
  if (!container.length) return;

  container.empty();

  demoAvailability.forEach(function (item) {
    var statusClass = item.status === 'Available' ? 'bg-success' : 'bg-warning text-dark';
    var cardHTML = `
      <div class="col-lg-3 col-md-4 col-6 mb-3">
        <div class="blood-group-card h-100">
          <div class="blood-group-badge mx-auto">${item.group}</div>
          <div class="blood-group-count mt-1">${item.count}</div>
          <div class="text-muted small mb-2">Potential Donors</div>
          <span class="badge ${statusClass} rounded-pill">${item.status}</span>
        </div>
      </div>
    `;
    container.append(cardHTML);
  });
}

function handleAuthFailure(message) {
  console.warn('Authentication failure:', message);
  LifeLinkAPI.removeToken();
  Auth.removeUser();
  window.location.href = '/login.html';
}

function handleLogout() {
  Auth.logout();
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
