$(document).ready(function () {
  if (!Auth.requireAuth()) return;

  LifeLinkAPI.get('/user/settings')
    .then(function (response) {
      var preferences = response && response.data && response.data.preferences
        ? response.data.preferences : { emailNotifications: true, theme: 'system' };
      $('#emailNotifications').prop('checked', preferences.emailNotifications !== false);
      $('#themeSelect').val(preferences.theme || 'system');
      applyTheme(preferences.theme || 'system');
    })
    .catch(function (error) {
      Auth.showNativeAlert('settingsAlert', error.message || 'Could not load settings.', 'danger');
    });

  $('#settingsForm').on('submit', function (event) {
    event.preventDefault();
    var theme = $('#themeSelect').val();
    LifeLinkAPI.put('/user/settings', {
      emailNotifications: $('#emailNotifications').is(':checked'),
      theme: theme
    }).then(function () {
      applyTheme(theme);
      Auth.showNativeAlert('settingsAlert', 'Settings saved successfully.', 'success');
    }).catch(function (error) {
      Auth.showNativeAlert('settingsAlert', error.message || 'Could not save settings.', 'danger');
    });
  });

  $('#deleteAccountBtn').on('click', function () {
    if (!window.confirm('Delete your LifeLink account permanently? This cannot be undone.')) return;
    var button = $(this);
    button.prop('disabled', true).text('Deleting...');
    LifeLinkAPI.delete('/user/account')
      .then(function () {
        LifeLinkAPI.removeToken();
        Auth.removeUser();
        window.location.href = '/register.html';
      })
      .catch(function (error) {
        button.prop('disabled', false).html('<i class="bi bi-trash me-1"></i> Delete my account');
        Auth.showNativeAlert('settingsAlert', error.message || 'Could not delete account.', 'danger');
      });
  });
});

function applyTheme(theme) {
  localStorage.setItem('lifelink_theme', theme);
  document.documentElement.dataset.theme = theme;
}
