/**
 * LifeLink — Appointments Controller (Phase 10)
 *
 * Responsibilities:
 *   - Authenticate logged-in user
 *   - Fetch current user's appointments (GET /api/appointments)
 *   - Render appointment history and upcoming visits
 *   - Handle status-based filtering (ALL, UPCOMING, PAST)
 *   - Handle appointment cancellation (PATCH /api/appointments/:id/cancel)
 */

$(document).ready(function () {
  // 1. Auth Guard
  if (!Auth.requireAuth()) return;

  // 2. State
  var allAppointments = [];
  var currentFilter = 'ALL';
  var cancelModal = null;

  if (typeof bootstrap !== 'undefined') {
    var modalEl = document.getElementById('cancelAppointmentModal');
    if (modalEl) {
      cancelModal = new bootstrap.Modal(modalEl);
    }
  }

  // 3. Load Notifications
  loadNavNotifications();

  // 4. Load Appointments
  loadAppointments();

  // 5. Filter Tabs Click Handlers
  $('#appointmentFilterTabs button').on('click', function () {
    $('#appointmentFilterTabs button').removeClass('active');
    $(this).addClass('active');

    currentFilter = $(this).data('filter') || 'ALL';
    applyFilterAndRender();
  });

  // 6. Open Cancel Confirmation Modal
  $(document).on('click', '.btn-open-cancel-modal', function () {
    var id = $(this).data('id');
    var centre = $(this).data('centre');
    var datetime = $(this).data('datetime');

    $('#cancelAppointmentId').val(id);
    $('#cancelCentreName').text(centre || 'Donation Centre');
    $('#cancelDateTime').text(datetime || 'Date & Time');

    if (cancelModal) {
      cancelModal.show();
    } else {
      $('#cancelAppointmentModal').modal('show');
    }
  });

  // 7. Confirm Cancellation
  $('#confirmCancelBtn').on('click', function () {
    handleAppointmentCancellation();
  });

  /**
   * Loads unread notifications count for navbar
   */
  function loadNavNotifications() {
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
      .catch(function () {});
  }

  /**
   * Fetches user's appointments from GET /api/appointments
   */
  function loadAppointments() {
    $('#appointmentsLoading').removeClass('d-none');
    $('#appointmentsEmpty').addClass('d-none');
    $('#appointmentsContainer').empty();
    Auth.clearAlerts('appointmentsAlert');

    LifeLinkAPI.get('/appointments')
      .then(function (res) {
        $('#appointmentsLoading').addClass('d-none');

        var appointments = (res && res.data && res.data.appointments)
          ? res.data.appointments
          : (res && res.appointments ? res.appointments : []);

        allAppointments = appointments;
        applyFilterAndRender();
      })
      .catch(function (err) {
        $('#appointmentsLoading').addClass('d-none');
        var msg = (err && err.message) ? err.message : 'Failed to load appointments.';
        Auth.showAlert(msg, 'danger', 'appointmentsAlert');
      });
  }

  /**
   * Applies the current tab filter and renders the appointment cards
   */
  function applyFilterAndRender() {
    // Cancellation is persisted for audit/history, but cancelled appointments
    // are removed from the user's active appointment workspace.
    var filtered = allAppointments.filter(function (app) {
      return app.status !== 'CANCELLED';
    });
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    if (currentFilter === 'UPCOMING') {
      filtered = filtered.filter(function (app) {
        var appDay = new Date(app.appointmentDate);
        appDay.setHours(0, 0, 0, 0);
        return (app.status === 'PENDING' || app.status === 'CONFIRMED') && appDay >= today;
      });
    } else if (currentFilter === 'PAST') {
      filtered = filtered.filter(function (app) {
        var appDay = new Date(app.appointmentDate);
        appDay.setHours(0, 0, 0, 0);
        return app.status === 'COMPLETED' || appDay < today;
      });
    }

    $('#appointmentsCountLabel').text(filtered.length + (filtered.length === 1 ? ' appointment' : ' appointments'));

    if (filtered.length === 0) {
      $('#appointmentsContainer').empty();
      if (currentFilter === 'UPCOMING') {
        $('#emptyMessageText').text('You have no upcoming blood donation appointments scheduled.');
      } else if (currentFilter === 'PAST') {
        $('#emptyMessageText').text('You have no past appointments.');
      } else {
        $('#emptyMessageText').text('You have not scheduled any blood donation appointments yet.');
      }
      $('#appointmentsEmpty').removeClass('d-none');
      return;
    }

    $('#appointmentsEmpty').addClass('d-none');
    renderAppointments(filtered);
  }

  /**
   * Renders appointment cards
   */
  function renderAppointments(appointments) {
    var container = $('#appointmentsContainer');
    container.empty();

    appointments.forEach(function (app) {
      var centre = app.centreId || {};
      var camp = app.campId || {};
      var centreName = centre.name || camp.name || app.locationName || 'Donation appointment';
      var centreLocation = [centre.area || camp.area, centre.city || camp.city, app.locationArea]
        .filter(Boolean).join(', ') || 'Location details unavailable';
      var centreAddress = centre.address || '';
      var centrePhone = centre.phone || camp.phone || '';
      var request = app.requestId || {};
      var appointmentContext = app.requesterUserId
        ? '<div class="small text-info mt-2"><i class="bi bi-link-45deg me-1"></i>Matched blood request appointment shared with the requester.</div>'
        : '';
      var requestDetailsHtml = app.matchId || app.requesterUserId
        ? `<div class="mt-3 p-3 rounded bg-light border">
             <div class="small text-muted mb-1"><i class="bi bi-link-45deg me-1"></i>Matched request details</div>
             <div class="row g-2 small">
               <div class="col-sm-6"><strong>Blood group:</strong> ${escapeHtml(request.bloodGroup || 'N/A')}</div>
               <div class="col-sm-6"><strong>Units:</strong> ${escapeHtml(request.unitsRequired || 'N/A')}</div>
               <div class="col-sm-6"><strong>Hospital:</strong> ${escapeHtml(request.hospitalName || app.locationName || 'N/A')}</div>
               <div class="col-sm-6"><strong>Area:</strong> ${escapeHtml(request.area || app.locationArea || 'N/A')}</div>
             </div>
           </div>`
        : '';

      var dateObj = new Date(app.appointmentDate);
      var formattedDate = isNaN(dateObj.getTime())
        ? 'N/A'
        : dateObj.toLocaleDateString(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });

      var timeStr = app.appointmentTime || 'N/A';
      var statusBadge = getStatusBadge(app.status);

      var isEligibleForCancel = (app.status === 'PENDING' || app.status === 'CONFIRMED');

      var actionHtml = '';
      if (isEligibleForCancel) {
        actionHtml = `
          <button class="btn btn-outline-danger btn-sm fw-semibold btn-open-cancel-modal"
            data-id="${app._id}"
            data-centre="${escapeHtml(centreName)}"
            data-datetime="${formattedDate} at ${escapeHtml(timeStr)}">
            <i class="bi bi-x-circle me-1"></i> Cancel Appointment
          </button>
        `;
      } else if (app.status === 'COMPLETED') {
        actionHtml = '<span class="text-success small fw-semibold"><i class="bi bi-check-circle-fill me-1"></i> Donation Completed</span>';
      } else if (app.status === 'CANCELLED') {
        actionHtml = '<span class="text-secondary small fw-semibold"><i class="bi bi-slash-circle me-1"></i> Cancelled</span>';
      }

      var notesHtml = app.notes
        ? `<div class="mt-2 p-2 bg-light rounded small text-secondary">
             <strong>Notes:</strong> ${escapeHtml(app.notes)}
           </div>`
        : '';

      var cardHtml = `
        <div class="col-12">
          <div class="card appointment-card shadow-sm p-4">
            <div class="row align-items-center">
              <div class="col-md-7 col-lg-8 mb-3 mb-md-0">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <h5 class="fw-bold text-dark mb-0">${escapeHtml(centreName)}</h5>
                  ${statusBadge}
                </div>

                <div class="small text-muted mb-1">
                  <i class="bi bi-geo-alt-fill text-danger me-1"></i>
                  <strong>${escapeHtml(centreLocation)}</strong>
                  ${centreAddress ? ' &bull; ' + escapeHtml(centreAddress) : ''}
                </div>

                ${centrePhone ? `<div class="small text-muted mb-2"><i class="bi bi-telephone me-1"></i>${escapeHtml(centrePhone)}</div>` : ''}
                ${requestDetailsHtml}

                <div class="d-flex flex-wrap align-items-center gap-3 mt-2">
                  <div class="badge bg-light text-dark border px-3 py-2 fs-6">
                    <i class="bi bi-calendar-event text-danger me-1"></i> ${formattedDate}
                  </div>
                  <div class="badge bg-light text-dark border px-3 py-2 fs-6">
                    <i class="bi bi-clock text-danger me-1"></i> ${escapeHtml(timeStr)}
                  </div>
                </div>

                ${notesHtml}
                ${appointmentContext}
              </div>

              <div class="col-md-5 col-lg-4 text-md-end">
                ${actionHtml}
              </div>
            </div>
          </div>
        </div>
      `;

      container.append(cardHtml);
    });
  }

  /**
   * Returns styled status badge
   */
  function getStatusBadge(status) {
    switch (status) {
      case 'PENDING':
        return '<span class="badge bg-warning text-dark status-badge"><i class="bi bi-hourglass-split me-1"></i>Pending</span>';
      case 'CONFIRMED':
        return '<span class="badge bg-info text-dark status-badge"><i class="bi bi-check2-circle me-1"></i>Confirmed</span>';
      case 'COMPLETED':
        return '<span class="badge bg-success status-badge"><i class="bi bi-check-circle-fill me-1"></i>Completed</span>';
      case 'CANCELLED':
        return '<span class="badge bg-secondary status-badge"><i class="bi bi-x-circle-fill me-1"></i>Cancelled</span>';
      default:
        return `<span class="badge bg-light text-dark status-badge">${status || 'Unknown'}</span>`;
    }
  }

  /**
   * Submits appointment cancellation
   */
  function handleAppointmentCancellation() {
    var appointmentId = $('#cancelAppointmentId').val();
    if (!appointmentId) return;

    var confirmBtn = $('#confirmCancelBtn');
    var spinner = $('#cancelSpinner');
    confirmBtn.prop('disabled', true);
    spinner.removeClass('d-none');

    LifeLinkAPI.patch('/appointments/' + appointmentId + '/cancel')
      .then(function (res) {
        confirmBtn.prop('disabled', false);
        spinner.addClass('d-none');

        if (cancelModal) {
          cancelModal.hide();
        } else {
          $('#cancelAppointmentModal').modal('hide');
        }

        // Update local state
        allAppointments = allAppointments.map(function (app) {
          if (app._id === appointmentId) {
            app.status = 'CANCELLED';
          }
          return app;
        });

        Auth.showAlert('Appointment has been successfully cancelled.', 'success', 'appointmentsAlert');
        applyFilterAndRender();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function (err) {
        confirmBtn.prop('disabled', false);
        spinner.addClass('d-none');

        if (cancelModal) {
          cancelModal.hide();
        } else {
          $('#cancelAppointmentModal').modal('hide');
        }

        var msg = (err && err.message) ? err.message : 'Failed to cancel appointment. Please try again.';
        Auth.showAlert(msg, 'danger', 'appointmentsAlert');
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
});
