/**
 * LifeLink — My Blood Requests Controller (Phase 5)
 *
 * Responsibilities:
 *   - Require JWT authentication
 *   - Fetch real requests from GET /api/requests
 *   - Display requests list with status & priority badges
 *   - Show request details in a modal
 *   - Allow cancellation via PATCH /api/requests/:id/cancel
 */

var userRequests = [];
var selectedRequestId = null;

$(document).ready(function () {
  // 1. Require Auth
  if (!Auth.requireAuth()) return;

  // 2. Check for flash message from redirect
  var flashMsg = sessionStorage.getItem('requestFlashMessage');
  if (flashMsg) {
    Auth.showAlert('requestsAlert', flashMsg, 'success');
    sessionStorage.removeItem('requestFlashMessage');
  }

  // 3. Load user's blood requests
  loadMyRequests();

  // 4. Bind Confirm Cancel Button in Modal
  $('#confirmCancelRequestBtn').on('click', function () {
    if (selectedRequestId) {
      handleCancelRequest(selectedRequestId);
    }
  });

  $(document).on('click', '.js-view-request', function () {
    viewRequestDetails($(this).data('request-id'));
  });

  $(document).on('click', '.js-cancel-request', function () {
    promptCancelRequest($(this).data('request-id'));
  });
});

/**
 * Fetches real user blood requests from GET /api/requests
 */
function loadMyRequests() {
  $('#requestsLoadingSpinner').removeClass('d-none');
  $('#requestsTableContainer').addClass('d-none');
  $('#emptyRequestsState').addClass('d-none');

  LifeLinkAPI.get('/requests')
    .then(function (response) {
      $('#requestsLoadingSpinner').addClass('d-none');

      var reqList = (response && response.data && response.data.requests)
        ? response.data.requests
        : (response && response.requests ? response.requests : []);

      // Cancelled requests remain stored for audit history, but are removed
      // from the active request list shown to the user.
      reqList = reqList.filter(function (request) {
        return request.status !== 'CANCELLED';
      });

      if (reqList && reqList.length > 0) {
        userRequests = reqList;
        renderRequestsList(userRequests);
        $('#requestsTableContainer').removeClass('d-none');
      } else {
        userRequests = [];
        $('#emptyRequestsState').removeClass('d-none');
      }
    })
    .catch(function (error) {
      $('#requestsLoadingSpinner').addClass('d-none');
      var msg = (error && error.message) ? error.message : 'Failed to load blood requests.';
      Auth.showAlert('requestsAlert', msg, 'danger');
    });
}

/**
 * Renders the table of user requests.
 */
function renderRequestsList(requests) {
  var tbody = $('#requestsTableBody');
  tbody.empty();

  requests.forEach(function (req) {
    var dateFormatted = req.requiredDate ? new Date(req.requiredDate).toLocaleDateString() : 'N/A';
    var createdFormatted = req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'N/A';

    var priorityBadge = getPriorityBadge(req.priority);
    var statusBadge = getStatusBadge(req.status);

    var isCancellable = (req.status === 'SEARCHING' || req.status === 'DONOR_RESPONDED' || req.status === 'ACCEPTED');

    var actionButtons = `
      <div class="btn-group btn-group-sm">
        ${isCancellable ? `
          <a href="/user/matches.html?requestId=${req._id}" class="btn btn-outline-success" title="Find/View Potential Matches">
            <i class="bi bi-people me-1"></i> Matches
          </a>
        ` : ''}
        <button type="button" class="btn btn-outline-primary js-view-request" data-request-id="${req._id}" title="View Request Details">
          <i class="bi bi-eye me-1"></i> View
        </button>
        ${isCancellable ? `
          <button type="button" class="btn btn-outline-danger js-cancel-request" data-request-id="${req._id}" title="Cancel Request">
            <i class="bi bi-x-circle me-1"></i> Cancel
          </button>
        ` : ''}
      </div>
    `;

    var tr = `
      <tr>
        <td class="fw-bold text-center">
          <span class="badge bg-danger rounded-circle p-2 fs-6" style="min-width: 42px;">${req.bloodGroup}</span>
        </td>
        <td class="align-middle text-center fw-semibold">${req.unitsRequired} ${req.unitsRequired === 1 ? 'Unit' : 'Units'}</td>
        <td class="align-middle">
          <div class="fw-bold text-dark">${escapeHtml(req.hospitalName)}</div>
          <div class="small text-muted"><i class="bi bi-geo-alt me-1"></i>${escapeHtml(req.area)}</div>
        </td>
        <td class="align-middle">
          <div><i class="bi bi-calendar-event me-1 text-danger"></i>${dateFormatted}</div>
          <div class="small text-muted"><i class="bi bi-clock me-1"></i>${escapeHtml(req.requiredTime)}</div>
        </td>
        <td class="align-middle text-center">${priorityBadge}</td>
        <td class="align-middle text-center">${statusBadge}</td>
        <td class="align-middle text-muted small text-center">${createdFormatted}</td>
        <td class="align-middle text-center">${actionButtons}</td>
      </tr>
    `;

    tbody.append(tr);
  });
}

/**
 * Returns HTML badge for priority level
 */
function getPriorityBadge(priority) {
  switch (priority) {
    case 'EMERGENCY':
      return '<span class="badge bg-danger text-white fs-6"><i class="bi bi-exclamation-octagon-fill me-1"></i>EMERGENCY</span>';
    case 'URGENT':
      return '<span class="badge bg-warning text-dark fs-6"><i class="bi bi-exclamation-triangle-fill me-1"></i>URGENT</span>';
    case 'NORMAL':
    default:
      return '<span class="badge bg-secondary text-white">NORMAL</span>';
  }
}

/**
 * Returns HTML badge for request status
 */
function getStatusBadge(status) {
  switch (status) {
    case 'SEARCHING':
      return '<span class="badge bg-primary text-white"><i class="bi bi-search me-1"></i>SEARCHING</span>';
    case 'DONOR_RESPONDED':
      return '<span class="badge bg-info text-dark"><i class="bi bi-person-check me-1"></i>DONOR RESPONDED</span>';
    case 'ACCEPTED':
      return '<span class="badge bg-success text-white"><i class="bi bi-check-circle me-1"></i>ACCEPTED</span>';
    case 'COMPLETED':
      return '<span class="badge bg-success text-white"><i class="bi bi-check-all me-1"></i>COMPLETED</span>';
    case 'CANCELLED':
      return '<span class="badge bg-secondary text-white"><i class="bi bi-slash-circle me-1"></i>CANCELLED</span>';
    case 'EXPIRED':
      return '<span class="badge bg-dark text-white"><i class="bi bi-clock-history me-1"></i>EXPIRED</span>';
    default:
      return `<span class="badge bg-light text-dark">${status}</span>`;
  }
}

/**
 * View request details modal
 */
function viewRequestDetails(id) {
  var request = userRequests.find(function (r) { return r._id === id; });
  if (!request) {
    Auth.showAlert('requestsAlert', 'This blood request could not be found. Please refresh and try again.', 'danger');
    return;
  }

  $('#modalDetailBloodGroup').text(request.bloodGroup);
  $('#modalDetailUnits').text(request.unitsRequired + (request.unitsRequired === 1 ? ' Unit' : ' Units'));
  $('#modalDetailHospital').text(request.hospitalName);
  $('#modalDetailArea').text(request.area);
  $('#modalDetailDate').text(request.requiredDate ? new Date(request.requiredDate).toLocaleDateString() : 'N/A');
  $('#modalDetailTime').text(request.requiredTime);
  $('#modalDetailPriority').html(getPriorityBadge(request.priority));
  $('#modalDetailStatus').html(getStatusBadge(request.status));
  $('#modalDetailInfo').text(request.additionalInfo || 'None provided.');
  $('#modalDetailCreated').text(request.createdAt ? new Date(request.createdAt).toLocaleString() : 'N/A');

  var modalElem = document.getElementById('requestDetailsModal');
  showRequestModal(modalElem);
}

/**
 * Prompt cancellation modal
 */
function promptCancelRequest(id) {
  selectedRequestId = id;
  var modalElem = document.getElementById('cancelConfirmModal');
  showRequestModal(modalElem);
}

function showRequestModal(modalElem) {
  if (!modalElem) {
    Auth.showAlert('requestsAlert', 'The request dialog could not be opened. Please refresh and try again.', 'danger');
    return;
  }

  if (window.bootstrap && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(modalElem).show();
    return;
  }

  Auth.showAlert('requestsAlert', 'The request dialog is unavailable. Please reload the page and try again.', 'danger');
}

/**
 * Sends cancel request to PATCH /api/requests/:id/cancel
 */
function handleCancelRequest(id) {
  Auth.clearAlerts('requestsAlert');

  var confirmBtn = $('#confirmCancelRequestBtn');
  var originalBtnText = confirmBtn.html();
  confirmBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span> Cancelling...');

  LifeLinkAPI.request('PATCH', '/requests/' + id + '/cancel')
    .then(function (response) {
      confirmBtn.prop('disabled', false).html(originalBtnText);

      var modalElem = document.getElementById('cancelConfirmModal');
      var modalInstance = bootstrap.Modal.getInstance(modalElem) || bootstrap.Modal.getOrCreateInstance(modalElem);
      if (modalInstance) {
        modalInstance.hide();
      }

      if (response && response.success) {
        Auth.showAlert('requestsAlert', 'Blood request cancelled successfully.', 'success');
        loadMyRequests();
      } else {
        Auth.showAlert('requestsAlert', 'The blood request could not be cancelled. Please try again.', 'danger');
      }
      selectedRequestId = null;
    })
    .catch(function (error) {
      confirmBtn.prop('disabled', false).html(originalBtnText);

      var modalElem = document.getElementById('cancelConfirmModal');
      var modalInstance = bootstrap.Modal.getInstance(modalElem) || bootstrap.Modal.getOrCreateInstance(modalElem);
      if (modalInstance) {
        modalInstance.hide();
      }

      var msg = (error && error.message) ? error.message : 'Failed to cancel blood request.';
      Auth.showAlert('requestsAlert', msg, 'danger');
    });
}

/** Helper to escape HTML characters */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
