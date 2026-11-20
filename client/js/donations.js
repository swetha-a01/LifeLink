/**
 * LifeLink — Completed donation history.
 * Completed appointments are the persisted donation records in the current API.
 */
(function () {
  $(document).ready(function () {
    if (!Auth.requireAuth()) return;

    var list = $('#donationHistoryList');
    LifeLinkAPI.get('/appointments')
      .then(function (response) {
        var appointments = response && response.data && response.data.appointments
          ? response.data.appointments
          : [];
        var donations = appointments.filter(function (appointment) {
          return appointment.status === 'COMPLETED';
        });

        if (!donations.length) {
          list.html(
            '<div class="card p-5 text-center donation-empty-state">' +
              '<div class="text-danger mb-3 fs-1"><i class="bi bi-droplet"></i></div>' +
              '<h2 class="h4 fw-bold mb-2">No donations yet</h2>' +
              '<p class="text-muted mb-4">Your completed blood donations will appear here after an appointment is marked completed.</p>' +
              '<a href="/user/centres.html" class="btn btn-danger fw-semibold">' +
                '<i class="bi bi-hospital me-1"></i> Find a Donation Centre</a>' +
            '</div>'
          );
          return;
        }

        list.html(
          '<div class="row g-3">' +
          donations.map(function (appointment) {
            var date = appointment.appointmentDate
              ? new Date(appointment.appointmentDate).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric'
              })
              : 'Date not available';
            var location = appointment.locationName ||
              (appointment.centreId && appointment.centreId.name) ||
              (appointment.campId && appointment.campId.name) ||
              'Donation centre';
            var area = appointment.locationArea ||
              (appointment.centreId && appointment.centreId.area) ||
              (appointment.campId && appointment.campId.area) || '';
            return '<div class="col-md-6">' +
              '<article class="card h-100 p-4 donation-history-card">' +
                '<div class="d-flex align-items-start justify-content-between gap-3">' +
                  '<div><h2 class="h5 fw-bold mb-1">' + escapeHtml(location) + '</h2>' +
                    '<p class="text-muted mb-0">' + escapeHtml(area) + '</p></div>' +
                  '<span class="badge bg-success">Completed</span>' +
                '</div>' +
                '<hr><p class="mb-0"><i class="bi bi-calendar-check text-danger me-2"></i>' +
                  escapeHtml(date) + '</p>' +
              '</article></div>';
          }).join('') +
          '</div>'
        );
      })
      .catch(function (error) {
        $('#donationHistoryAlert').html(
          '<div class="alert alert-danger" role="alert">' +
            escapeHtml(error.message || 'Could not load donation history.') + '</div>'
        );
      });
  });

  function escapeHtml(value) {
    return $('<div>').text(value == null ? '' : String(value)).html();
  }
}());
