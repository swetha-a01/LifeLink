var actionToken = new URLSearchParams(window.location.search).get('token');
var requestedAction = new URLSearchParams(window.location.search).get('action') || 'accept';
var actionMatchId = null;

$(function () {
  if (!actionToken) {
    showActionError('This email link is missing its secure action token.');
    return;
  }

  loadEmailAction();
});

function loadEmailAction() {
  LifeLinkAPI.get('/matches/email-action?token=' + encodeURIComponent(actionToken))
    .then(function (response) {
      var data = response.data || {};
      actionMatchId = data.matchId;
      renderRequest(data.request || {});

      if (data.authenticated) {
        if (data.matchStatus !== 'PENDING' || ['CANCELLED', 'COMPLETED', 'EXPIRED'].includes(data.request.status)) {
          showActionError('This request is no longer available for a donor response.');
          return;
        }
        $('#actionButtons').removeClass('d-none');
        if (requestedAction === 'reject') {
          $('#rejectBtn').trigger('focus');
        } else {
          $('#acceptBtn').trigger('focus');
        }
      } else {
        sessionStorage.setItem('lifelink_pending_email_action', actionToken);
        $('#authNotice').removeClass('d-none').text('Please sign in as the donor who received this email to respond.');
        $('#loginAction').removeClass('d-none');
        $('#loginActionLink').attr('href', '/login.html?emailAction=1');
      }

      $('#actionLoading').addClass('d-none');
      $('#requestCard').removeClass('d-none');
    })
    .catch(function (error) {
      $('#actionLoading').addClass('d-none');
      showActionError(error.message || 'This email action cannot be completed.');
        if ((error.message || '').toLowerCase().includes('different donor account')) {
          sessionStorage.setItem('lifelink_pending_email_action', actionToken);
          $('#switchAccountAction').removeClass('d-none');
        }
      });
}

$('#switchAccountBtn').on('click', function () {
    LifeLinkAPI.removeToken();
    localStorage.removeItem('lifelink_user');
    window.location.href = '/login.html?emailAction=1';
});

function renderRequest(request) {
  $('#bloodGroup').text(request.bloodGroup || 'Not specified');
  $('#unitsRequired').text(request.unitsRequired || 'Not specified');
  $('#hospitalName').text(request.hospitalName || 'Not specified');
  $('#area').text(request.area || 'Not specified');
  $('#requiredDate').text(request.requiredDate ? new Date(request.requiredDate).toLocaleDateString() : 'Not specified');
  $('#requiredTime').text(request.requiredTime || 'Not specified');
  $('#requestStatus').text(request.status || 'Unknown');
  $('#priorityBadge')
    .text(request.priority || 'NORMAL')
    .addClass(request.priority === 'EMERGENCY' ? 'bg-danger' : request.priority === 'URGENT' ? 'bg-warning text-dark' : 'bg-secondary');
}

$('#acceptBtn, #rejectBtn').on('click', function () {
  var response = this.id === 'acceptBtn' ? 'ACCEPT' : 'REJECT';
  var button = $(this);
  button.prop('disabled', true);

  LifeLinkAPI.patch('/matches/' + encodeURIComponent(actionMatchId) + '/respond', {
    response: response,
    actionToken: actionToken
  })
    .then(function (result) {
      sessionStorage.removeItem('lifelink_pending_email_action');
      $('#actionButtons').addClass('d-none');
      showActionSuccess(result.message || ('Request ' + response.toLowerCase() + 'ed successfully.'));
    })
    .catch(function (error) {
      button.prop('disabled', false);
      showActionError(error.message || 'Your response could not be saved.');
    });
});

function showActionError(message) {
  $('#actionAlert').html('<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>' + escapeHtml(message) + '</div>');
}

function showActionSuccess(message) {
  $('#actionAlert').html('<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>' + escapeHtml(message) + '</div>');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}
