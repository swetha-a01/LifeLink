/**
 * LifeLink — Potential Donor Matches Controller (Phase 6 & Phase 7)
 *
 * Responsibilities:
 *   - Require JWT authentication
 *   - Load received donor match requests (GET /api/matches/donor)
 *   - Support donor ACCEPT / REJECT responses (PATCH /api/matches/:matchId/respond)
 *   - Load requester matches for specific blood requests (GET /api/matches/request/:requestId)
 *   - Support generating matches (POST /api/matches/generate/:requestId)
 *   - Render responsive cards with match scores and reasons
 */

var currentRequestId = null;
var userRequestsList = [];

$(document).ready(function () {
  // 1. Require Auth
  if (!Auth.requireAuth()) return;

  // 2. Parse URL Params
  var urlParams = new URLSearchParams(window.location.search);
  currentRequestId = urlParams.get('requestId');

  // Check flash message
  var flashMsg = sessionStorage.getItem('matchesFlashMessage');
  if (flashMsg) {
    Auth.showAlert('matchesAlert', flashMsg, 'success');
    sessionStorage.removeItem('matchesFlashMessage');
  }

  // 3. Always load donor received matches first
  loadDonorMatches();

  // 4. Load user requests for requester selector dropdown
  loadUserRequestsDropdown();

  // 5. If requestId URL parameter exists, switch to Requester tab
  if (currentRequestId) {
    var tabTriggerEl = document.querySelector('#requester-tab');
    if (tabTriggerEl) {
      var tab = new bootstrap.Tab(tabTriggerEl);
      tab.show();
    }
  }

  // 6. Bind "Generate Matches" button
  $('#generateMatchesBtn').on('click', function () {
    if (currentRequestId) {
      handleGenerateMatches(currentRequestId);
    } else {
      Auth.showAlert('matchesAlert', 'Please select a blood request to generate matches.', 'warning');
    }
  });

  // 7. Bind Request Selector Dropdown Change
  $('#selectBloodRequest').on('change', function () {
    var val = $(this).val();
    if (val) {
      currentRequestId = val;
      var newUrl = window.location.pathname + '?requestId=' + val;
      window.history.pushState({ path: newUrl }, '', newUrl);
      loadMatchesForRequest(val);
    }
  });

  // 8. Bind Response Buttons (ACCEPT / REJECT)
  $(document).on('click', '.btn-respond-accept', function () {
    var matchId = $(this).data('match-id');
    var cardCol = $(this).closest('.match-card-col');
    handleMatchResponse(matchId, 'ACCEPT', cardCol);
  });

  $(document).on('click', '.btn-respond-reject', function () {
    var matchId = $(this).data('match-id');
    var cardCol = $(this).closest('.match-card-col');
    handleMatchResponse(matchId, 'REJECT', cardCol);
  });
});

/**
 * Loads matches directed to the current user as a donor (GET /api/matches/donor)
 */
function loadDonorMatches() {
  $('#donorMatchesLoading').removeClass('d-none');
  $('#donorMatchesGrid').addClass('d-none');
  $('#emptyDonorMatches').addClass('d-none');

  LifeLinkAPI.get('/matches/donor')
    .then(function (response) {
      $('#donorMatchesLoading').addClass('d-none');

      var matchList = (response && response.data && response.data.matches)
        ? response.data.matches
        : (response && response.matches ? response.matches : []);

      // The received-request inbox is actionable only while a match is
      // pending. Accepted matches are shown in Appointments and rejected
      // matches remain stored only as history.
      matchList = matchList.filter(function (match) {
        return match.status === 'PENDING';
      });

      if (matchList && matchList.length > 0) {
        renderDonorMatchesGrid(matchList);
        $('#donorMatchesGrid').removeClass('d-none');
      } else {
        $('#emptyDonorMatches').removeClass('d-none');
      }
    })
    .catch(function (error) {
      $('#donorMatchesLoading').addClass('d-none');
      console.warn('Could not load donor matches:', error);
    });
}

/**
 * Renders incoming match request cards for the donor
 */
function renderDonorMatchesGrid(matches) {
  var grid = $('#donorMatchesGrid');
  grid.empty();

  matches.forEach(function (match) {
    var req = match.requestId || {};
    var requester = req.requesterId || {};

    var bloodGroup = req.bloodGroup || 'N/A';
    var unitsRequired = req.unitsRequired || 1;
    var hospitalName = escapeHtml(req.hospitalName || 'Hospital N/A');
    var area = escapeHtml(req.area || 'Location N/A');
    var requiredDate = req.requiredDate ? new Date(req.requiredDate).toLocaleDateString() : 'N/A';
    var requiredTime = escapeHtml(req.requiredTime || 'N/A');
    var priority = req.priority || 'NORMAL';
    var requesterName = escapeHtml(requester.name || 'Anonymous Requester');
    var routeInfo = formatRouteInfo(match);

    var score = match.matchScore || 0;
    var reasons = match.matchReasons || [];
    var matchStatus = match.status || 'PENDING';

    var scoreColorClass = score >= 80 ? 'bg-success' : (score >= 50 ? 'bg-warning text-dark' : 'bg-secondary');

    var reasonsHTML = reasons.map(function (r) {
      return `<li><i class="bi bi-check-circle-fill text-success me-2"></i>${escapeHtml(r)}</li>`;
    }).join('');

    var priorityBadge = priority === 'EMERGENCY'
      ? '<span class="badge bg-danger">EMERGENCY</span>'
      : (priority === 'URGENT' ? '<span class="badge bg-warning text-dark">URGENT</span>' : '<span class="badge bg-secondary">NORMAL</span>');

    var actionSection = '';
    if (matchStatus === 'PENDING') {
      actionSection = `
        <div class="action-btn-group d-flex gap-2">
          <button class="btn btn-success btn-sm btn-respond-accept fw-semibold" data-match-id="${match._id}">
            <i class="bi bi-check-circle me-1"></i> ACCEPT
          </button>
          <button class="btn btn-outline-danger btn-sm btn-respond-reject fw-semibold" data-match-id="${match._id}">
            <i class="bi bi-x-circle me-1"></i> REJECT
          </button>
        </div>
      `;
    } else if (matchStatus === 'ACCEPTED') {
      actionSection = `
        <div class="action-btn-group">
          <span class="badge bg-success fs-6 px-3 py-2">
            <i class="bi bi-check-circle-fill me-1"></i> ✓ ACCEPTED
          </span>
        </div>
      `;
    } else if (matchStatus === 'REJECTED') {
      actionSection = `
        <div class="action-btn-group">
          <span class="badge bg-danger fs-6 px-3 py-2">
            <i class="bi bi-x-circle-fill me-1"></i> ✕ REJECTED
          </span>
        </div>
      `;
    }

    var cardHTML = `
      <div class="col-lg-6 mb-4 match-card-col">
        <div class="card h-100 shadow-sm border-0 match-card position-relative">
          <div class="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-danger rounded-circle p-2 fs-6" style="min-width: 42px;">${bloodGroup}</span>
              <div>
                <h3 class="h6 fw-bold mb-0 text-dark">${hospitalName}</h3>
                <span class="small text-muted"><i class="bi bi-geo-alt me-1"></i>${area}</span>
              </div>
            </div>
            <div class="text-end">
              <span class="badge ${scoreColorClass} fs-6 px-3 py-2">
                Match Score: ${score}/100
              </span>
            </div>
          </div>

          <div class="card-body p-4">
            <div class="row g-2 mb-3">
              <div class="col-6">
                <span class="text-muted d-block small">Units Required</span>
                <span class="fw-bold text-dark"><i class="bi bi-droplet me-1 text-danger"></i>${unitsRequired} Unit(s)</span>
              </div>

              <div class="border rounded-3 bg-light-subtle p-3 mb-3">
                <div class="small text-muted mb-1"><i class="bi bi-signpost-2 me-1"></i>Road estimate</div>
                <div class="fw-semibold text-dark">${routeInfo}</div>
              </div>
              <div class="col-6">
                <span class="text-muted d-block small">Urgency Level</span>
                ${priorityBadge}
              </div>
            </div>

            <div class="row g-2 mb-3">
              <div class="col-6">
                <span class="text-muted d-block small">Required Date</span>
                <span class="fw-semibold text-dark"><i class="bi bi-calendar-event me-1"></i>${requiredDate}</span>
              </div>
              <div class="col-6">
                <span class="text-muted d-block small">Required Time</span>
                <span class="fw-semibold text-dark"><i class="bi bi-clock me-1"></i>${requiredTime}</span>
              </div>
            </div>

            <div class="mb-3">
              <span class="text-muted d-block small">Requester</span>
              <span class="fw-semibold text-dark"><i class="bi bi-person me-1"></i>${requesterName}</span>
            </div>

            <div class="border-top pt-3">
              <h4 class="h6 fw-bold text-dark mb-2">Match Algorithm Highlights</h4>
              <ul class="list-unstyled mb-0 small text-dark match-reasons-list">
                ${reasonsHTML}
              </ul>
            </div>
          </div>

          <div class="card-footer bg-light border-0 py-3 d-flex justify-content-between align-items-center">
            <span class="small text-muted">Your Response Status:</span>
            ${actionSection}
          </div>
        </div>
      </div>
    `;

    grid.append(cardHTML);
  });
}

/**
 * Handles Donor Response (ACCEPT or REJECT) via PATCH /api/matches/:matchId/respond
 */
function handleMatchResponse(matchId, responseType, cardCol) {
  Auth.clearAlerts('matchesAlert');
  var btnGroup = cardCol.find('.action-btn-group');
  btnGroup.find('button').prop('disabled', true);

  LifeLinkAPI.patch('/matches/' + matchId + '/respond', { response: responseType })
    .then(function (response) {
      Auth.showAlert('matchesAlert', `Match response recorded: ${responseType}ED!`, 'success');

      if (responseType === 'ACCEPT') {
        btnGroup.html(`
          <span class="badge bg-success fs-6 px-3 py-2">
            <i class="bi bi-check-circle-fill me-1"></i> ✓ ACCEPTED
          </span>
        `);
      } else {
        cardCol.fadeOut(180, function () {
          $(this).remove();
          if ($('#donorMatchesGrid .match-card-col').length === 0) {
            $('#donorMatchesGrid').addClass('d-none');
            $('#emptyDonorMatches').removeClass('d-none');
          }
        });
      }
    })
    .catch(function (error) {
      btnGroup.find('button').prop('disabled', false);
      var msg = (error && error.message) ? error.message : 'Failed to record response.';
      Auth.showAlert('matchesAlert', msg, 'danger');
    });
}

/**
 * Loads user's requests into the dropdown selector for Requester tab
 */
function loadUserRequestsDropdown() {
  LifeLinkAPI.get('/requests')
    .then(function (response) {
      var select = $('#selectBloodRequest');
      select.empty();

      var reqList = (response && response.data && response.data.requests)
        ? response.data.requests
        : (response && response.requests ? response.requests : []);

      if (reqList && reqList.length > 0) {
        userRequestsList = reqList;
        select.append('<option value="" disabled>-- Select a Blood Request --</option>');

        userRequestsList.forEach(function (req) {
          var label = req.bloodGroup + ' | ' + escapeHtml(req.hospitalName) + ' (' + req.status + ')';
          var selected = (req._id === currentRequestId) ? 'selected' : '';
          select.append(`<option value="${req._id}" ${selected}>${label}</option>`);
        });

        if (!currentRequestId && userRequestsList.length > 0) {
          currentRequestId = userRequestsList[0]._id;
          select.val(currentRequestId);
        }

        if (currentRequestId) {
          loadMatchesForRequest(currentRequestId);
        }
      } else {
        select.append('<option value="" disabled selected>No blood requests found</option>');
        showEmptyState('You have not created any blood requests yet. Please create a blood request first.');
      }
    })
    .catch(function (error) {
      console.warn('Could not load user requests for selector:', error);
    });
}

/**
 * Fetches existing matches for a request from GET /api/matches/request/:requestId
 */
function loadMatchesForRequest(requestId) {
  $('#matchesLoadingSpinner').removeClass('d-none');
  $('#matchesGrid').addClass('d-none');
  $('#emptyMatchesState').addClass('d-none');
  Auth.clearAlerts('matchesAlert');

  LifeLinkAPI.get('/matches/request/' + requestId)
    .then(function (response) {
      $('#matchesLoadingSpinner').addClass('d-none');

      var matchList = (response && response.data && response.data.matches)
        ? response.data.matches
        : (response && response.matches ? response.matches : []);

      if (matchList && matchList.length > 0) {
        renderMatchesGrid(matchList);
        $('#matchesGrid').removeClass('d-none');
      } else {
        handleGenerateMatches(requestId, true);
      }
    })
    .catch(function (error) {
      $('#matchesLoadingSpinner').addClass('d-none');
      var msg = (error && error.message) ? error.message : 'Failed to retrieve potential matches.';
      Auth.showAlert('matchesAlert', msg, 'danger');
    });
}

/**
 * Triggers match generation via POST /api/matches/generate/:requestId
 */
function handleGenerateMatches(requestId, silent = false) {
  if (!silent) {
    $('#matchesLoadingSpinner').removeClass('d-none');
    $('#matchesGrid').addClass('d-none');
    $('#emptyMatchesState').addClass('d-none');
  }

  var genBtn = $('#generateMatchesBtn');
  var originalBtnText = genBtn.html();
  genBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span> Matching...');

  LifeLinkAPI.post('/matches/generate/' + requestId)
    .then(function (response) {
      genBtn.prop('disabled', false).html(originalBtnText);
      $('#matchesLoadingSpinner').addClass('d-none');

      var matchList = (response && response.data && response.data.matches)
        ? response.data.matches
        : (response && response.matches ? response.matches : []);

      if (matchList && matchList.length > 0) {
        renderMatchesGrid(matchList);
        $('#matchesGrid').removeClass('d-none');
        if (!silent) {
          Auth.showAlert('matchesAlert', `Successfully generated ${matchList.length} potential donor match(es)!`, 'success');
        }
      } else {
        showEmptyState('No potential donors found matching all criteria (exact blood group, verified status, availability, and eligibility cooldown). Try again later.');
      }
    })
    .catch(function (error) {
      genBtn.prop('disabled', false).html(originalBtnText);
      $('#matchesLoadingSpinner').addClass('d-none');
      var msg = (error && error.message) ? error.message : 'Failed to generate donor matches.';
      Auth.showAlert('matchesAlert', msg, 'danger');
    });
}

/**
 * Renders potential donor match cards for Requester view
 */
function renderMatchesGrid(matches) {
  var grid = $('#matchesGrid');
  grid.empty();

  matches.forEach(function (match) {
    var donorUser = match.donorUserId || {};
    var donorProfile = match.donorId || {};

    var donorName = escapeHtml(donorUser.name || 'Anonymous Donor');
    var bloodGroup = donorProfile.bloodGroup || 'N/A';
    var area = escapeHtml(donorProfile.area || 'Location N/A');
    var availability = donorProfile.availability || 'AVAILABLE';
    var verificationStatus = donorProfile.verificationStatus || 'VERIFIED';
    var score = match.matchScore || 0;
    var reasons = match.matchReasons || [];
    var matchStatus = match.status || 'PENDING';
    var routeInfo = formatRouteInfo(match);

    var scoreColorClass = score >= 80 ? 'bg-success' : (score >= 50 ? 'bg-warning text-dark' : 'bg-secondary');

    var reasonsHTML = reasons.map(function (r) {
      return `<li><i class="bi bi-check-circle-fill text-success me-2"></i>${escapeHtml(r)}</li>`;
    }).join('');

    var matchStatusBadge = matchStatus === 'ACCEPTED'
      ? '<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>ACCEPTED</span>'
      : (matchStatus === 'REJECTED' ? '<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>REJECTED</span>' : '<span class="badge bg-warning text-dark"><i class="bi bi-clock me-1"></i>PENDING</span>');

    var donorPhone = donorUser.phone ? escapeHtml(donorUser.phone) : 'Not shared';
    var donorEmail = donorUser.email ? escapeHtml(donorUser.email) : 'Not shared';

    var contactSectionHtml = '';
    if (matchStatus === 'ACCEPTED') {
      contactSectionHtml = `
        <div class="alert alert-success border-0 p-3 mb-3">
          <div class="fw-bold mb-2 text-success d-flex align-items-center">
            <i class="bi bi-telephone-fill me-2"></i>Donor Contact Information:
          </div>
          <div class="row g-2 small">
            <div class="col-sm-6">
              <span class="text-muted d-block">Phone Number:</span>
              <a href="tel:${donorPhone}" class="fw-bold text-success text-decoration-none">
                <i class="bi bi-telephone-outbound me-1"></i>${donorPhone}
              </a>
            </div>
            <div class="col-sm-6">
              <span class="text-muted d-block">Email Address:</span>
              <a href="mailto:${donorEmail}" class="fw-bold text-success text-decoration-none">
                <i class="bi bi-envelope me-1"></i>${donorEmail}
              </a>
            </div>
          </div>
        </div>
      `;
    } else {
      contactSectionHtml = `
        <div class="alert alert-light border small text-muted mb-3 py-2">
          <i class="bi bi-shield-lock text-secondary me-1"></i>
          <strong>Privacy Protection:</strong> Donor's direct phone number and email will be unlocked here as soon as they accept your request.
        </div>
      `;
    }

    var cardHTML = `
      <div class="col-lg-6 mb-4">
        <div class="card h-100 shadow-sm border-0 match-card position-relative">
          <div class="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-danger rounded-circle p-2 fs-6" style="min-width: 42px;">${bloodGroup}</span>
              <div>
                <h3 class="h6 fw-bold mb-0 text-dark">${donorName}</h3>
                <span class="small text-muted"><i class="bi bi-geo-alt me-1"></i>${area}</span>
              </div>
            </div>
            <div class="text-end">
              <span class="badge ${scoreColorClass} fs-6 px-3 py-2">
                Match Score: ${score}/100
              </span>
            </div>
          </div>

          <div class="card-body p-4">
            <div class="row g-2 mb-3">
              <div class="col-6">
                <span class="text-muted d-block small">Availability</span>
                <span class="badge bg-success-subtle text-success border border-success-subtle fw-semibold">
                  <i class="bi bi-toggle-on me-1"></i>${availability}
                </span>
              </div>

              <div class="border rounded-3 bg-light-subtle p-3 mb-3">
                <div class="small text-muted mb-1"><i class="bi bi-signpost-2 me-1"></i>Road estimate</div>
                <div class="fw-semibold text-dark">${routeInfo}</div>
              </div>
              <div class="col-6">
                <span class="text-muted d-block small">Verification Status</span>
                <span class="badge bg-success text-white fw-semibold">
                  <i class="bi bi-shield-check me-1"></i>${verificationStatus}
                </span>
              </div>
            </div>

            <!-- Donor Contact Info Section -->
            ${contactSectionHtml}

            <div class="border-top pt-3">
              <h4 class="h6 fw-bold text-dark mb-2">Why this potential match?</h4>
              <ul class="list-unstyled mb-0 small text-dark match-reasons-list">
                ${reasonsHTML}
              </ul>
            </div>
          </div>

          <div class="card-footer bg-light border-0 py-2 d-flex justify-content-between align-items-center">
            <span class="small text-muted">Donor Response: ${matchStatusBadge}</span>
            <span class="badge bg-outline-secondary text-muted small">Potential Software Match</span>
          </div>
        </div>
      </div>
    `;

    grid.append(cardHTML);
  });
}

function formatRouteInfo(match) {
  var distance = Number.isFinite(Number(match.roadDistanceKm))
    ? escapeHtml(Number(match.roadDistanceKm).toFixed(1) + ' km')
    : 'Distance unavailable';
  var durationMinutes = Number(match.estimatedDurationMinutes);
  var duration = Number.isFinite(durationMinutes)
    ? formatDuration(durationMinutes)
    : 'Driving time unavailable';
  var approximate = match.routeApproximate
    ? ' <span class="text-muted small">(approximate)</span>'
    : '';
  return distance + ' · ' + escapeHtml(duration) + approximate;
}

function formatDuration(minutes) {
  var totalMinutes = Math.max(0, Math.round(minutes));
  var hours = Math.floor(totalMinutes / 60);
  var remainingMinutes = totalMinutes % 60;
  if (!hours) return remainingMinutes + ' min';
  return hours + ' hr' + (remainingMinutes ? ' ' + remainingMinutes + ' min' : '');
}

/**
 * Shows empty state when no matches exist
 */
function showEmptyState(message) {
  $('#emptyMatchesState').removeClass('d-none');
  $('#emptyMatchesMessage').text(message);
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
