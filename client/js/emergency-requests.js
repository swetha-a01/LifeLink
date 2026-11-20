$(document).ready(function () {
  if (!Auth.requireAuth()) return;

  LifeLinkAPI.get('/requests/emergency/all')
    .then(function (response) {
      $('#emergencyLoading').addClass('d-none');
      var requests = response && response.data && response.data.requests
        ? response.data.requests
        : [];

      if (!requests.length) {
        $('#emergencyEmpty').removeClass('d-none');
        return;
      }

      var list = $('#emergencyList');
      requests.forEach(function (request) {
        var date = request.requiredDate
          ? new Date(request.requiredDate).toLocaleDateString()
          : 'Date not specified';
        list.append(`
          <div class="col-md-6">
            <article class="card h-100 border-danger-subtle">
              <div class="card-body">
                <div class="d-flex justify-content-between gap-2 mb-3">
                  <span class="badge bg-danger"><i class="bi bi-exclamation-octagon-fill me-1"></i>EMERGENCY</span>
                  <span class="badge bg-light text-dark border">${escapeHtml(request.status)}</span>
                </div>
                <h2 class="h5 fw-bold">${escapeHtml(request.bloodGroup)} blood needed</h2>
                <p class="mb-2"><strong>${escapeHtml(String(request.unitsRequired))}</strong> unit(s) at <strong>${escapeHtml(request.hospitalName)}</strong></p>
                <p class="text-muted small mb-3"><i class="bi bi-geo-alt me-1"></i>${escapeHtml(request.area)} &middot; <i class="bi bi-calendar-event me-1"></i>${escapeHtml(date)} at ${escapeHtml(request.requiredTime)}</p>
                <a href="/user/matches.html?requestId=${encodeURIComponent(request._id)}" class="btn btn-outline-danger btn-sm">View matching progress</a>
              </div>
            </article>
          </div>
        `);
      });
      list.removeClass('d-none');
    })
    .catch(function (error) {
      $('#emergencyLoading').addClass('d-none');
      Auth.showAlert('emergencyAlert', error.message || 'Could not load emergency requests.', 'danger');
    });
});

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
