/**
 * LifeLink — User Profile Controller (Phase 4)
 *
 * Responsibilities:
 *   - Require JWT authentication
 *   - Fetch current user profile via GET /api/user/profile
 *   - Populate profile view & form
 *   - Handle profile updates via PUT /api/user/profile (editable details only)
 *   - Display client-side and server-side validation feedback
 */

$(document).ready(function () {
  // 1. Auth check
  if (!Auth.requireAuth()) return;

  // 2. Fetch User Profile
  loadUserProfile();

  // 3. Bind Profile Form Submission
  $('#profileForm').on('submit', function (e) {
    e.preventDefault();
    handleProfileUpdate();
  });

  $('#profilePhoto').on('change', function () {
    var file = this.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      Auth.showNativeAlert('profileAlert', 'Profile photo must be JPG, PNG, or WebP and no larger than 5 MB.', 'warning');
      this.value = '';
      return;
    }
    var previewUrl = URL.createObjectURL(file);
    $('#profilePhotoPreview, #profileAvatar').attr('src', previewUrl).removeClass('d-none');
    $('#profileAvatarPlaceholder').addClass('d-none');
  });
});

/**
 * Fetches current user profile from GET /api/user/profile and populates the UI.
 */
function loadUserProfile() {
  $('#profileLoadingSpinner').removeClass('d-none');
  $('#profileCardContent').addClass('d-none');
  Auth.clearAlerts('profileAlert');

  LifeLinkAPI.get('/user/profile')
    .then(function (response) {
      $('#profileLoadingSpinner').addClass('d-none');
      $('#profileCardContent').removeClass('d-none');

      var userObj = (response && response.data && response.data.user)
        ? response.data.user
        : (response && response.user ? response.user : null);

      if (userObj) {
        populateProfileForm(userObj);
        // Cache user info locally
        Auth.setUser(userObj);
      }
    })
    .catch(function (error) {
      $('#profileLoadingSpinner').addClass('d-none');
      var msg = (error && error.message) ? error.message : 'Failed to load profile details.';
      Auth.showNativeAlert('profileAlert', msg, 'danger');
    });
}

/**
 * Populates form inputs and read-only elements with user data.
 * @param {object} user - User object from GET /api/user/profile
 */
function populateProfileForm(user) {
  $('#inputName').val(user.name || '');
  $('#inputEmail').val(user.email || ''); // Read-only
  $('#inputPhone').val(user.phone || '');
  $('#inputDateOfBirth').val(user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '');
  var address = user.address || {};
  $('#profileStreet').val(address.street || '');
  $('#profileCity').val(address.city || '');
  $('#profileDistrict').val(address.district || '');
  $('#profileState').val(address.state || '');
  $('#profilePinCode').val(address.pinCode || '');
  if (user.profilePhotoUrl) {
    $('#profilePhotoPreview, #profileAvatar').attr('src', user.profilePhotoUrl).removeClass('d-none');
    $('#profileAvatarPlaceholder').addClass('d-none');
  } else {
    $('#profilePhotoPreview, #profileAvatar').addClass('d-none');
    $('#profileAvatarPlaceholder').removeClass('d-none');
  }
  updateProfileAge();
  $('#userRoleBadge').text(user.role || 'USER');
  
  var statusBadge = $('#userStatusBadge');
  if (user.accountStatus === 'ACTIVE') {
    statusBadge.text('ACTIVE').removeClass('bg-secondary bg-danger').addClass('bg-success');
  } else {
    statusBadge.text(user.accountStatus || 'UNKNOWN').removeClass('bg-success').addClass('bg-secondary');
  }
}

/**
 * Validates and submits updated name & phone to PUT /api/user/profile.
 */
function handleProfileUpdate() {
  Auth.clearAlerts('profileAlert');

  var name = $('#inputName').val().trim();
  var phone = $('#inputPhone').val().trim();
  var address = {
    street: $('#profileStreet').val().trim(),
    city: $('#profileCity').val().trim(),
    district: $('#profileDistrict').val().trim(),
    state: $('#profileState').val().trim(),
    pinCode: $('#profilePinCode').val().trim()
  };

  // Client-side Validation
  if (!name || name.length < 2 || name.length > 100) {
    Auth.showNativeAlert('profileAlert', 'Name must be between 2 and 100 characters.', 'warning');
    return;
  }

  var phoneRegex = /^\+?[1-9]\d{9,14}$/;
  phone = phone.replace(/[\s()-]/g, '');
  if (!phone || !phoneRegex.test(phone)) {
    Auth.showNativeAlert('profileAlert', 'Please enter a valid phone number (10 to 15 digits).', 'warning');
    return;
  }
  var submitBtn = $('#saveProfileBtn');
  var originalBtnText = submitBtn.html();
  submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span> Saving...');

  LifeLinkAPI.put('/user/profile', {
    name: name,
    phone: phone,
    address: Object.values(address).some(Boolean) ? address : undefined
  })
    .then(function (response) {
      return uploadProfilePhotoIfSelected().then(function (photoResponse) {
        var photoUrl = photoResponse && photoResponse.data && photoResponse.data.profilePhotoUrl;
        if (photoUrl && response && response.data && response.data.user) {
          response.data.user.profilePhotoUrl = photoUrl;
        }
        return response;
      });
    })
    .then(function (response) {
      submitBtn.prop('disabled', false).html(originalBtnText);
      var userObj = (response && response.data && response.data.user)
        ? response.data.user
        : (response && response.user ? response.user : null);

      if (userObj) {
        Auth.setUser(userObj);
        populateProfileForm(userObj);
        Auth.showNativeAlert('profileAlert', 'Profile updated successfully!', 'success');
      }

    })
    .catch(function (error) {
      submitBtn.prop('disabled', false).html(originalBtnText);
      var msg = (error && error.message) ? error.message : 'Failed to update profile. Please try again.';
      Auth.showNativeAlert('profileAlert', msg, 'danger');
    });
}

function updateProfileAge() {
  var value = $('#inputDateOfBirth').val();
  if (!value) return $('#profileAgeText').text('');
  var dob = new Date(value);
  var age = new Date().getFullYear() - dob.getFullYear();
  if (new Date() < new Date(new Date().getFullYear(), dob.getMonth(), dob.getDate())) age--;
  $('#profileAgeText').text(age >= 0 ? 'Calculated age: ' + age : '');
}

$('#inputDateOfBirth').on('change input', updateProfileAge);

function uploadProfilePhotoIfSelected() {
  var file = $('#profilePhoto')[0] && $('#profilePhoto')[0].files[0];
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
