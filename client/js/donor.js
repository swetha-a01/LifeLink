/**
 * LifeLink — Donor Profile Controller (Phase 4)
 *
 * Responsibilities:
 *   - Require JWT authentication
 *   - Fetch current user's donor profile via GET /api/donor/profile
 *   - If no profile exists: Render Create Mode (POST /api/donor/profile)
 *   - If profile exists: Render Edit Mode (PUT /api/donor/profile)
 *   - Validate inputs (blood group, availability, area, max date = today)
 *   - Read-only display of verificationStatus badge
 */

var isEditMode = false;

$(document).ready(function () {
  // 1. Require Auth
  if (!Auth.requireAuth()) return;

  // 2. Set max date for lastDonationDate to today YYYY-MM-DD
  var todayStr = new Date().toISOString().split('T')[0];
  $('#inputLastDonationDate').attr('max', todayStr);
  $('#inputDonorDob').attr('max', todayStr);

  // 3. Load Donor Profile
  loadDonorProfile();

  // 4. Bind Form Submit
  $('#donorForm').on('submit', function (e) {
    e.preventDefault();
    handleDonorProfileSubmit();
  });

  $('#availabilityToggle').on('change', updateAvailabilityToggleLabel);
  $('#inputDonorDob').on('change input', updateDonorAge);
  $('#inputDonorPhoto').on('change', previewDonorPhoto);
  updateAvailabilityToggleLabel();
});

/**
 * Calls GET /api/donor/profile to check if user has a donor profile.
 */
function loadDonorProfile() {
  $('#donorLoadingSpinner').removeClass('d-none');
  $('#donorCardContent').addClass('d-none');
  Auth.clearAlerts('donorAlert');

  Promise.all([LifeLinkAPI.get('/user/profile'), LifeLinkAPI.get('/donor/profile')])
    .then(function (responses) {
      $('#donorLoadingSpinner').addClass('d-none');
      $('#donorCardContent').removeClass('d-none');

      var userResponse = responses[0];
      var donorResponse = responses[1];
      var userData = userResponse && userResponse.data ? userResponse.data.user : userResponse.user;
      renderSharedDonorProfile(userData || {});
      var donorData = (donorResponse && donorResponse.data) ? donorResponse.data : donorResponse;

      if (donorData && donorData.exists && donorData.donor) {
        isEditMode = true;
        renderDonorForm(donorData.donor);
      } else {
        isEditMode = false;
        renderNewDonorForm();
      }
    })
    .catch(function (error) {
      $('#donorLoadingSpinner').addClass('d-none');
      var msg = (error && error.message) ? error.message : 'Failed to retrieve donor profile.';
      Auth.showNativeAlert('donorAlert', msg, 'danger');
    });
}

/**
 * Pre-fills the form for editing an existing donor profile.
 * @param {object} donor - DonorProfile document from MongoDB
 */
function renderDonorForm(donor) {
  $('#donorFormTitle').html('<i class="bi bi-pencil-square text-danger me-2"></i>Edit Donor Profile');
  $('#submitDonorBtn').html('<i class="bi bi-check-circle me-1"></i> Update Donor Profile');

  $('#selectBloodGroup').val(donor.bloodGroup || '');
  $('#selectBloodGroup').prop('disabled', true);
  $('#availabilityToggle').prop('checked', donor.availability !== 'UNAVAILABLE');
  updateAvailabilityToggleLabel();
  $('#inputArea').val(donor.area || '');
  $('#interestedInDonation').prop('checked', donor.interestedInDonation === true);
  $('#termsAccepted').prop('checked', donor.termsAccepted === true);

  if (donor.lastDonationDate) {
    var dateVal = donor.lastDonationDate.split('T')[0];
    $('#inputLastDonationDate').val(dateVal);
  } else {
    $('#inputLastDonationDate').val('');
  }

  // Render Verification Status Badge
  updateVerificationBadge(donor.verificationStatus || 'PENDING');
}

/**
 * Populates shared user details used by the donor profile form.
 * This must remain outside renderDonorForm because it is also called when
 * creating a donor profile for the first time.
 */
function renderSharedDonorProfile(user) {
  $('#inputDonorName').val(user.name || '');
  $('#inputDonorEmail').val(user.email || '');
  $('#inputDonorPhone').val(user.phone || '');
  $('#inputDonorDob').val(user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '');
  var address = user.address || {};
  $('#inputDonorStreet').val(address.street || '');
  $('#inputDonorCity').val(address.city || '');
  $('#inputDonorDistrict').val(address.district || '');
  $('#inputDonorState').val(address.state || 'Tamil Nadu');
  $('#inputDonorPinCode').val(address.pinCode || '');
  if (user.profilePhotoUrl) {
    $('#donorPhotoPreview').attr('src', user.profilePhotoUrl).removeClass('d-none');
  }
  updateDonorAge();
}

/**
 * Pre-fills the form for creating a new donor profile.
 */
function renderNewDonorForm() {
  $('#donorFormTitle').html('<i class="bi bi-plus-circle text-danger me-2"></i>Create Donor Profile');
  $('#submitDonorBtn').html('<i class="bi bi-heart-fill me-1"></i> Create Donor Profile');

  $('#selectBloodGroup').val('');
  $('#selectBloodGroup').prop('disabled', false);
  $('#inputDonorDob').prop('readonly', false);
  $('#availabilityToggle').prop('checked', true);
  updateAvailabilityToggleLabel();
  $('#inputArea').val('');
  $('#inputLastDonationDate').val('');
  $('#interestedInDonation').prop('checked', false);
  $('#termsAccepted').prop('checked', false);

  // Default Status for new registration
  updateVerificationBadge('PENDING');
}

/**
 * Updates the verification status badge UI element.
 * @param {string} status - PENDING, VERIFIED, REJECTED, SUSPENDED
 */
function updateVerificationBadge(status) {
  var badgeElem = $('#verificationStatusBadge');
  badgeElem.text(status);

  badgeElem.removeClass('bg-warning bg-success bg-danger bg-secondary text-dark text-white');

  switch (status) {
    case 'VERIFIED':
      badgeElem.addClass('bg-success text-white');
      break;
    case 'REJECTED':
      badgeElem.addClass('bg-danger text-white');
      break;
    case 'SUSPENDED':
      badgeElem.addClass('bg-secondary text-white');
      break;
    case 'PENDING':
    default:
      badgeElem.addClass('bg-warning text-dark');
      break;
  }
}

/**
 * Handles creation or update of donor profile.
 */
function handleDonorProfileSubmit() {
  Auth.clearAlerts('donorAlert');

  var bloodGroup = $('#selectBloodGroup').val();
  var availability = $('#availabilityToggle').is(':checked') ? 'AVAILABLE' : 'UNAVAILABLE';
  var area = $('#inputArea').val().trim();
  var lastDonationDate = $('#inputLastDonationDate').val();
  var interestedInDonation = $('#interestedInDonation').is(':checked');
  var termsAccepted = $('#termsAccepted').is(':checked');
  var dob = $('#inputDonorDob').val();
  var address = {
    street: $('#inputDonorStreet').val().trim(),
    city: $('#inputDonorCity').val().trim(),
    district: $('#inputDonorDistrict').val().trim(),
    state: $('#inputDonorState').val().trim(),
    pinCode: $('#inputDonorPinCode').val().trim()
  };

  // Client-side Validations
  if (!bloodGroup) {
    Auth.showNativeAlert('donorAlert', 'Please select your blood group.', 'warning');
    return;
  }

  if (!area || area.length < 2) {
    Auth.showNativeAlert('donorAlert', 'Please enter a valid area or city name.', 'warning');
    return;
  }
  if (!$('#inputDonorName').val().trim() || !dob || new Date(dob) > new Date()) {
    Auth.showNativeAlert('donorAlert', 'Please enter your full name and a valid date of birth.', 'warning');
    return;
  }
  if (!/^\+?[1-9]\d{9,14}$/.test($('#inputDonorPhone').val().trim().replace(/[\s()-]/g, ''))) {
    Auth.showNativeAlert('donorAlert', 'Please enter a valid mobile number.', 'warning');
    return;
  }
  if (!address.street || !address.city || !address.district || !address.state || !/^\d{4,10}$/.test(address.pinCode)) {
    Auth.showNativeAlert('donorAlert', 'Please complete your residential address and PIN code.', 'warning');
    return;
  }

  if (!interestedInDonation) {
    Auth.showNativeAlert('donorAlert', 'Please confirm that you are interested in donating blood.', 'warning');
    return;
  }

  if (!termsAccepted) {
    Auth.showNativeAlert('donorAlert', 'Please agree to the donor terms and conditions.', 'warning');
    return;
  }

  if (lastDonationDate) {
    var selectedDate = new Date(lastDonationDate);
    var today = new Date();
    // Compare date parts only
    today.setHours(23, 59, 59, 999);

    if (selectedDate > today) {
      Auth.showNativeAlert('donorAlert', 'Last donation date cannot be in the future.', 'warning');
      return;
    }
  }

  var payload = {
    bloodGroup: bloodGroup,
    availability: availability,
    area: area,
    lastDonationDate: lastDonationDate || null,
    interestedInDonation: interestedInDonation,
    termsAccepted: termsAccepted
  };

  var submitBtn = $('#submitDonorBtn');
  var originalBtnText = submitBtn.html();
  submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span> Processing...');

  var apiMethod = isEditMode ? LifeLinkAPI.put : LifeLinkAPI.post;

  LifeLinkAPI.put('/user/profile', {
    name: $('#inputDonorName').val().trim(),
    phone: $('#inputDonorPhone').val().trim(),
    address: address
  }).then(function () {
    return uploadDonorPhotoIfSelected();
  }).then(function () {
    return apiMethod.call(LifeLinkAPI, '/donor/profile', payload);
  }).then(function (response) {
    submitBtn.prop('disabled', false).html(originalBtnText);

      var donorDoc = (response && response.data && response.data.donor)
        ? response.data.donor
        : (response && response.donor ? response.donor : null);

      if (donorDoc) {
        isEditMode = true;
        renderDonorForm(donorDoc);

        var successMsg = isEditMode
          ? 'Donor profile updated successfully!'
          : 'Donor profile created successfully! Status is set to PENDING verification.';

        Auth.showNativeAlert('donorAlert', successMsg, 'success');
    }
  }).catch(function (error) {
      submitBtn.prop('disabled', false).html(originalBtnText);
      var msg = (error && error.message) ? error.message : 'Failed to save donor profile. Please try again.';
      Auth.showNativeAlert('donorAlert', msg, 'danger');
    });
}

function uploadDonorPhotoIfSelected() {
    var file = $('#inputDonorPhoto')[0].files[0];
    if (!file) return Promise.resolve();
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return Promise.reject({ message: 'Profile photo must be JPG, PNG, or WebP and no larger than 5 MB.' });
    }
    var formData = new FormData();
    formData.append('photo', file);
    return $.ajax({
      url: '/api/user/profile/photo',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + LifeLinkAPI.getToken() },
      data: formData,
      processData: false,
      contentType: false
    });
}

function updateDonorAge() {
    var value = $('#inputDonorDob').val();
    if (!value) return $('#donorAgeText').text('');
    var dob = new Date(value);
    var today = new Date();
    var age = today.getFullYear() - dob.getFullYear();
    if (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate())) age--;
    $('#donorAgeText').text(age >= 0 ? 'Calculated age: ' + age : '');
}

function previewDonorPhoto() {
    var file = $('#inputDonorPhoto')[0].files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      Auth.showNativeAlert('donorAlert', 'Profile photo must be JPG, PNG, or WebP and no larger than 5 MB.', 'warning');
      this.value = '';
      return;
    }
    $('#donorPhotoPreview').attr('src', URL.createObjectURL(file)).removeClass('d-none');
}

/**
 * Keeps the visible availability label synchronized with the switch.
 */
function updateAvailabilityToggleLabel() {
    var isAvailable = $('#availabilityToggle').is(':checked');
    $('#availabilityToggleLabel')
      .text(isAvailable ? 'ON - Ready to donate' : 'OFF - Currently unavailable')
      .toggleClass('text-success', isAvailable)
      .toggleClass('text-muted', !isAvailable);
}
