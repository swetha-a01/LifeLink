/**
 * LifeLink — Create Blood Request Controller (Phase 5)
 *
 * Responsibilities:
 *   - Require JWT authentication
 *   - Set min date for requiredDate to today
 *   - Validate form input fields
 *   - Submit request to POST /api/requests
 *   - Redirect to /user/requests.html on success with feedback
 */

$(document).ready(function () {
  // 1. Require Auth
  if (!Auth.requireAuth()) return;

  // 2. Set min date for requiredDate to today YYYY-MM-DD
  var todayStr = new Date().toISOString().split('T')[0];
  $('#inputRequiredDate').attr('min', todayStr);
  loadRequesterProfile();

  // 3. Form submission
  $('#createRequestForm').on('submit', function (e) {
    e.preventDefault();
    handleRequestSubmit();
  });

  function loadRequesterProfile() {
    LifeLinkAPI.get('/user/profile').then(function (response) {
      var user = response.data && response.data.user;
      if (!user) return;
      $('#requesterName').val(user.name || '');
      $('#requesterEmail').val(user.email || '');
      $('#requesterPhone').val(user.phone || '');
      if (user.dateOfBirth) {
        var dob = new Date(user.dateOfBirth);
        var age = new Date().getFullYear() - dob.getFullYear();
        if (new Date() < new Date(new Date().getFullYear(), dob.getMonth(), dob.getDate())) age--;
        $('#requesterDobAge').val(dob.toLocaleDateString() + ' (age ' + age + ')');
      } else {
        $('#requesterDobAge').val('Not provided');
      }
    });
  }
});

function handleRequestSubmit() {
  Auth.clearAlerts('requestAlert');

  var bloodGroup = $('#selectBloodGroup').val();
  var unitsRequired = parseInt($('#inputUnitsRequired').val(), 10);
  var hospitalName = $('#inputHospitalName').val().trim();
  var area = $('#inputArea').val().trim();
  var requiredDate = $('#inputRequiredDate').val();
  var requiredTime = $('#inputRequiredTime').val().trim();
  var priority = $('#selectPriority').val() || 'NORMAL';
  var additionalInfo = $('#inputAdditionalInfo').val().trim();
  var hospitalAddress = $('#inputHospitalAddress').val().trim();
  var city = $('#inputRequestCity').val().trim();
  var district = $('#inputRequestDistrict').val().trim();
  var state = $('#inputRequestState').val().trim();
  var pinCode = $('#inputRequestPinCode').val().trim();
  var landmark = $('#inputRequestLandmark').val().trim();

  // Validations
  if (!bloodGroup) {
    Auth.showNativeAlert('requestAlert', 'Please select a required blood group.', 'warning');
    return;
  }

  if (isNaN(unitsRequired) || unitsRequired < 1 || unitsRequired > 20) {
    Auth.showNativeAlert('requestAlert', 'Units required must be between 1 and 20.', 'warning');
    return;
  }

  if (!hospitalName || hospitalName.length < 2) {
    Auth.showNativeAlert('requestAlert', 'Please enter a valid hospital name.', 'warning');
    return;
  }

  if (!area || area.length < 2) {
    Auth.showNativeAlert('requestAlert', 'Please enter a valid area or city name.', 'warning');
    return;
  }
  if (!district || !state) {
    Auth.showNativeAlert('requestAlert', 'Please enter the request location district and state.', 'warning');
    return;
  }
  if (pinCode && !/^\d{4,10}$/.test(pinCode)) {
    Auth.showNativeAlert('requestAlert', 'Please enter a valid PIN code.', 'warning');
    return;
  }

  if (!requiredDate) {
    Auth.showNativeAlert('requestAlert', 'Please select the date when blood is required.', 'warning');
    return;
  }

  if (!requiredTime) {
    Auth.showNativeAlert('requestAlert', 'Please select the time when blood is required.', 'warning');
    return;
  }

  var payload = {
    bloodGroup: bloodGroup,
    unitsRequired: unitsRequired,
    hospitalName: hospitalName,
    hospitalAddress: hospitalAddress,
    city: city,
    district: district,
    state: state,
    pinCode: pinCode,
    landmark: landmark,
    area: area,
    requiredDate: requiredDate,
    requiredTime: requiredTime,
    priority: priority,
    additionalInfo: additionalInfo
  };
  var requesterPhone = $('#requesterPhone').val().trim().replace(/[\s()-]/g, '');
  if (!/^\+?[1-9]\d{9,14}$/.test(requesterPhone)) {
    Auth.showNativeAlert('requestAlert', 'Please enter a valid requester mobile number.', 'warning');
    return;
  }

  var submitBtn = $('#submitRequestBtn');
  var originalBtnText = submitBtn.html();
  submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span> Submitting Request...');

  LifeLinkAPI.put('/user/profile', {
    name: $('#requesterName').val().trim(),
    phone: requesterPhone
  }).then(function () {
    return LifeLinkAPI.post('/requests', payload);
  })
    .then(function (response) {
      submitBtn.prop('disabled', false).html(originalBtnText);
      if (response && response.success && response.data && response.data.request) {
        var createdReq = response.data.request;
        window.alert('Blood request created successfully! Generating potential donor matches...');
        window.location.href = '/user/matches.html?requestId=' + createdReq._id;
      } else {
        window.alert('Blood request submitted successfully.');
        window.location.href = '/user/requests.html';
      }
    })
    .catch(function (error) {
      submitBtn.prop('disabled', false).html(originalBtnText);
      var msg = (error && error.message) ? error.message : 'Failed to submit blood request. Please try again.';
      Auth.showNativeAlert('requestAlert', msg, 'danger');
    });
}
