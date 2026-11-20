/**
 * LifeLink — Blood Donation Centres Controller (Phase 10)
 *
 * Responsibilities:
 *   - Authenticate logged-in user
 *   - Fetch and check donor eligibility for appointment booking
 *   - Fetch active blood centres from GET /api/centres
 *   - Support city/area filtering
 *   - Render responsive centre cards
 *   - Handle appointment booking modal & submission to POST /api/appointments
 */

$(document).ready(function () {
  // 1. Auth Guard
  if (!Auth.requireAuth()) return;

  // 2. State
  var donorProfile = null;
  var allCentres = [];
  var bookingModal = null;

  if (typeof bootstrap !== 'undefined') {
    var modalEl = document.getElementById('bookAppointmentModal');
    if (modalEl) {
      bookingModal = new bootstrap.Modal(modalEl);
    }
  }

  // Set min date for datepicker to today
  var todayStr = new Date().toISOString().split('T')[0];
  $('#modalAppointmentDate').attr('min', todayStr);

  // 3. Load Notifications badge
  loadNavNotifications();

  // 4. Check Donor Profile Eligibility
  checkDonorEligibility();

  // 5. Load Blood Centres and published donation camps
  loadBloodCentres();

  // 6. Bind Search & Filter Events
  $('#searchCentresBtn').on('click', function () {
    var city = $('#cityFilterInput').val().trim();
    loadBloodCentres(city);
  });

  $('#cityFilterInput').on('keypress', function (e) {
    if (e.which === 13) {
      e.preventDefault();
      var city = $(this).val().trim();
      loadBloodCentres(city);
    }
  });

  $('#resetFilterBtn, #emptyResetBtn').on('click', function () {
    $('#cityFilterInput').val('');
    loadBloodCentres();
  });

  // 7. Bind Book Appointment Click Event
  $(document).on('click', '.btn-book-centre', function () {
    var centreId = $(this).data('id');
    var campId = $(this).data('camp-id');
    var centreName = $(this).data('name');
    var centreAddress = $(this).data('address');
    var centreHours = $(this).data('hours');

    openBookingModal(centreId, campId, centreName, centreAddress, centreHours);
  });

  // 8. Bind Booking Form Submission
  $('#bookAppointmentForm').on('submit', function (e) {
    e.preventDefault();
    submitAppointmentBooking();
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
   * Keeps the optional donor-profile guidance informational.
   */
  function checkDonorEligibility() {
    LifeLinkAPI.get('/donor/profile')
      .then(function (res) {
        if (res && res.exists && res.donor) {
          donorProfile = res.donor;
        } else {
          donorProfile = null;
        }
      })
      .catch(function (err) {
        console.warn('Could not check donor eligibility:', err);
      });
  }

  /**
   * Fetches active blood centres from GET /api/centres
   */
  function loadBloodCentres(cityQuery) {
    $('#centresLoading').removeClass('d-none');
    $('#centresEmpty').addClass('d-none');
    $('#centresContainer').empty();
    Auth.clearAlerts('centresAlert');

    var url = '/centres';
    if (cityQuery) {
      url += '?city=' + encodeURIComponent(cityQuery);
    }

    LifeLinkAPI.get(url)
      .then(function (res) {
        $('#centresLoading').addClass('d-none');

        var centres = (res && res.data && res.data.centres) ? res.data.centres : [];
        var camps = (res && res.data && res.data.camps) ? res.data.camps : [];
        allCentres = centres.concat(camps);
        var totalLocations = centres.length + camps.length;

        $('#centreCountDisplay').text('Showing ' + totalLocations + (totalLocations === 1 ? ' location' : ' locations'));

        if (totalLocations === 0) {
          $('#centresEmpty').removeClass('d-none');
          return;
        }

        renderCentres(centres, camps);

        // Check if query param specifies a centre to auto-book
        checkAutoBookParam();
      })
      .catch(function (err) {
        $('#centresLoading').addClass('d-none');
        var errorMsg = (err && err.message) ? err.message : 'Failed to load blood centres. Please try again.';
        Auth.showAlert(errorMsg, 'danger', 'centresAlert');
      });
  }

  /**
   * Renders centre cards dynamically
   */
  function renderCentres(centres, camps) {
    var container = $('#centresContainer');
    container.empty();

    function renderLocation(centre, isCamp) {
      var groupsHtml = '';
      if (Array.isArray(centre.supportedBloodGroups)) {
        groupsHtml = centre.supportedBloodGroups.map(function (g) {
          return '<span class="badge bg-danger-subtle text-danger border border-danger-subtle blood-badge">' + escapeHtml(g) + '</span>';
        }).join(' ');
      }

      var emailHtml = centre.email
        ? '<div class="small text-muted mb-1"><i class="bi bi-envelope me-1 text-danger"></i><a href="mailto:' + escapeHtml(centre.email) + '" class="text-decoration-none text-muted">' + escapeHtml(centre.email) + '</a></div>'
        : '';

      var cardHtml = `
        <div class="col-md-6 col-lg-4">
          <div class="card h-100 centre-card shadow-sm">
            <div class="card-body d-flex flex-column p-4">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h5 class="card-title fw-bold text-dark mb-1">${escapeHtml(centre.name)}</h5>
                <span class="badge ${isCamp ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle' : 'bg-success-subtle text-success border border-success-subtle'}">${isCamp ? 'Donation camp' : 'Active'}</span>
              </div>

              <div class="small text-muted mb-2">
                <i class="bi bi-geo-alt-fill text-danger me-1"></i>
                <strong>${escapeHtml(centre.area)}, ${escapeHtml(centre.city)}</strong>
              </div>

              <p class="small text-secondary mb-3">${escapeHtml(centre.address)}</p>

              <div class="small text-muted mb-1">
                <i class="bi bi-telephone-fill me-1 text-danger"></i>
                <a href="tel:${escapeHtml(centre.phone)}" class="text-decoration-none text-dark fw-semibold">${escapeHtml(centre.phone)}</a>
              </div>

              ${emailHtml}

              <div class="small text-muted mb-3">
                <i class="bi bi-clock-fill me-1 text-danger"></i>
                <span>${escapeHtml(centre.operatingHours)}</span>
              </div>
              ${isCamp ? `<div class="small text-muted mb-3"><i class="bi bi-calendar-event me-1 text-danger"></i> ${new Date(centre.eventDate).toLocaleDateString()} &bull; <i class="bi bi-clock me-1"></i>${escapeHtml(centre.eventTime || centre.operatingHours || 'Time not specified')} &bull; ${escapeHtml(String(centre.registeredCount || 0))}/${escapeHtml(String(centre.capacity))} spots</div>` : ''}

              <div class="mb-3">
                <div class="small text-muted fw-semibold mb-1">Supported Blood Groups:</div>
                <div>${groupsHtml}</div>
              </div>

              <div class="mt-auto pt-3 border-top">
                <button class="btn btn-outline-danger w-100 fw-semibold btn-book-centre"
                  data-id="${isCamp ? '' : centre._id}"
                  data-camp-id="${isCamp ? centre._id : ''}"
                  data-name="${escapeHtml(centre.name)}"
                  data-address="${escapeHtml(centre.address + ', ' + centre.area + ', ' + centre.city)}"
                  data-hours="${escapeHtml(centre.operatingHours)}">
                  <i class="bi bi-calendar-plus me-1"></i> Book Appointment
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      container.append(cardHtml);
    }

    centres.forEach(function (centre) { renderLocation(centre, false); });
    camps.forEach(function (camp) { renderLocation(camp, true); });
  }

  /**
   * Opens the booking modal and validates donor eligibility
   */
  function openBookingModal(centreId, campId, centreName, centreAddress, centreHours) {
    Auth.clearAlerts('modalAlert');
    Auth.clearAlerts('centresAlert');

    // Populate modal fields
    $('#modalCentreId').val(centreId);
    $('#modalCampId').val(campId || '');
    $('#modalCentreName').text(centreName);
    $('#modalCentreAddress').html('<i class="bi bi-geo-alt me-1"></i> ' + centreAddress);
    $('#modalCentreHours').html('<i class="bi bi-clock me-1"></i> ' + centreHours);
    $('#modalNotes').val('');

    // Pre-select tomorrow or today
    var defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    $('#modalAppointmentDate').val(defaultDate.toISOString().split('T')[0]);
    $('#modalAppointmentTime').val('10:00');

    if (bookingModal) {
      bookingModal.show();
    } else {
      $('#bookAppointmentModal').modal('show');
    }
  }

  /**
   * Submits the appointment booking to POST /api/appointments
   */
  function submitAppointmentBooking() {
    Auth.clearAlerts('modalAlert');

    var centreId = $('#modalCentreId').val();
    var campId = $('#modalCampId').val();
    var appointmentDate = $('#modalAppointmentDate').val();
    var appointmentTime = $('#modalAppointmentTime').val();
    var notes = $('#modalNotes').val().trim();

    if (!centreId && !campId) {
      Auth.showNativeAlert('Please select a valid donation location.', 'danger', 'modalAlert');
      return;
    }

    if (!appointmentDate) {
      Auth.showNativeAlert('Please choose an appointment date.', 'danger', 'modalAlert');
      return;
    }

    if (!appointmentTime) {
      Auth.showNativeAlert('Please select an appointment time slot.', 'danger', 'modalAlert');
      return;
    }

    // Disable submit button & show spinner
    var submitBtn = $('#submitAppointmentBtn');
    var spinner = $('#bookingSpinner');
    submitBtn.prop('disabled', true);
    spinner.removeClass('d-none');

    LifeLinkAPI.post('/appointments', {
      centreId: centreId || undefined,
      campId: campId || undefined,
      appointmentDate: appointmentDate,
      appointmentTime: appointmentTime,
      notes: notes
    })
      .then(function (res) {
        submitBtn.prop('disabled', false);
        spinner.addClass('d-none');

        // Hide modal
        if (bookingModal) {
          bookingModal.hide();
        } else {
          $('#bookAppointmentModal').modal('hide');
        }

        // Show success alert on main page
        Auth.showNativeAlert(
          'Donation appointment booked successfully! Status: <strong>PENDING</strong>. <a href="/user/appointments.html" class="alert-link fw-bold ms-1">View My Appointments</a>',
          'success',
          'centresAlert'
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function (err) {
        submitBtn.prop('disabled', false);
        spinner.addClass('d-none');
        var msg = (err && err.message) ? err.message : 'Failed to book appointment. Please check details and try again.';
        Auth.showNativeAlert(msg, 'danger', 'modalAlert');
      });
  }

  /**
   * Check URL params for ?bookCentreId=...
   */
  function checkAutoBookParam() {
    var params = new URLSearchParams(window.location.search);
    var targetCentreId = params.get('bookCentreId');
    if (targetCentreId && allCentres.length > 0) {
      var match = allCentres.find(function (c) { return c._id === targetCentreId; });
      if (match) {
        openBookingModal(
          match._id,
          match.eventDate ? match._id : '',
          match.name,
          match.address + ', ' + match.area + ', ' + match.city,
          match.operatingHours
        );
      }
    }
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
