/**
 * LifeLink — Auth Helper
 *
 * Reusable authentication utilities for the frontend.
 *
 * Depends on:  api.js (LifeLinkAPI) — must be loaded first.
 *
 * Usage:
 *   Auth.isLoggedIn()         — check if user has a token
 *   Auth.getUser()            — get stored user info
 *   Auth.logout()             — clear token & redirect to login
 *   Auth.requireAuth()        — redirect to login if not authenticated
 *   Auth.requireGuest()       — redirect to dashboard if already logged in
 *   Auth.redirectByRole(user) — send user to their role-specific dashboard
 */

var savedTheme = localStorage.getItem('lifelink_theme');
if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
  document.documentElement.dataset.theme = savedTheme;
}

var Auth = {
  // ---- Token helpers ----

  /** Check whether the user is logged in (token exists) */
  isLoggedIn: function () {
    return !!LifeLinkAPI.getToken();
  },

  // ---- User data helpers ----

  /** Get the stored user object from localStorage */
  getUser: function () {
    var userData = localStorage.getItem('lifelink_user');
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  /** Save user data to localStorage */
  setUser: function (user) {
    localStorage.setItem('lifelink_user', JSON.stringify(user));
  },

  /** Remove stored user data */
  removeUser: function () {
    localStorage.removeItem('lifelink_user');
  },

  // ---- Authentication actions ----

  /**
   * Log the user out.
   * Removes the token, keeps the cached profile for the next login, and
   * redirects to the login page.
   */
  logout: function () {
    if (document.body.classList.contains('logging-out')) return;

    document.body.classList.add('logging-out');
    var overlay = document.createElement('div');
    overlay.className = 'logout-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML =
      '<div class="logout-message">' +
      '<i class="bi bi-box-arrow-right" aria-hidden="true"></i>' +
      '<span>Logging out...</span>' +
      '</div>';
    document.body.appendChild(overlay);

    // Call the server logout endpoint (acknowledgement only — JWT is stateless)
    LifeLinkAPI.post('/auth/logout').catch(function () {
      // Even if the server call fails, still clear local data
    });

    // Clear only authentication state. The cached profile is retained so the
    // profile remains available after the next login and is refreshed by API.
    LifeLinkAPI.removeToken();

    // Give the feedback state a moment to render before redirecting.
    window.setTimeout(function () {
      window.location.href = '/login.html';
    }, 700);
  },

  // ---- Route guards ----

  /**
   * Require authentication — redirect to login if not logged in.
   * Call this at the top of protected pages.
   *
   * @returns {boolean} true if authenticated, false if redirecting
   */
  requireAuth: function () {
    if (!Auth.isLoggedIn()) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  },

  /**
   * Require guest — redirect to dashboard if already logged in.
   * Call this on login/register pages to prevent re-authentication.
   *
   * @returns {boolean} true if guest (not logged in), false if redirecting
   */
  requireGuest: function () {
    if (Auth.isLoggedIn()) {
      var user = Auth.getUser();
      Auth.redirectByRole(user);
      return false;
    }
    return true;
  },

  /**
   * Redirect user to their role-specific dashboard.
   *
   * @param {object} user — user object with a `role` field
   */
  redirectByRole: function (user) {
    if (user && user.role === 'ADMIN') {
      window.location.href = '/admin/dashboard.html';
    } else {
      window.location.href = '/user/dashboard.html';
    }
  },

  // ---- UI Helpers ----

  /**
   * Show an alert message inside a container element.
   *
   * The flexible argument order is retained for existing page scripts:
   * showAlert(containerId, message, type) and showAlert(message, type, containerId).
   */
  showAlert: function (arg1, arg2, arg3) {
    var containerId, message, type;
    var validTypes = ['success', 'danger', 'warning', 'info', 'primary', 'secondary', 'light', 'dark'];

    if (arg3 && validTypes.indexOf(arg3) !== -1) {
      // Called as: showAlert(containerId, message, type)
      containerId = arg1;
      message = arg2;
      type = arg3;
    } else if (arg2 && validTypes.indexOf(arg2) !== -1 && arg3) {
      // Called as: showAlert(message, type, containerId)
      message = arg1;
      type = arg2;
      containerId = arg3;
    } else {
      containerId = arg1;
      message = arg2 || '';
      type = arg3 || 'info';
    }

    var alertHTML =
      '<div class="alert alert-' + type + ' alert-dismissible fade show" role="alert">' +
      message +
      '<button type="button" class="btn-close" data-bs-dismiss="alert"></button>' +
      '</div>';

    $('#' + containerId).html(alertHTML);

    if (type === 'success') {
      setTimeout(function () {
        $('#' + containerId + ' .alert').alert('close');
      }, 5000);
    }
  },

  /**
   * Show form feedback in a native browser alert.
   *
   * Accepts the same argument order as showAlert. HTML is converted to
   * readable text so existing form messages remain safe and understandable.
   */
  showNativeAlert: function (arg1, arg2, arg3) {
    var message;
    var validTypes = ['success', 'danger', 'warning', 'info', 'primary', 'secondary', 'light', 'dark'];

    if (arg3 && validTypes.indexOf(arg3) !== -1) {
      message = arg2;
    } else {
      message = arg1;
    }

    var messageElement = document.createElement('div');
    messageElement.innerHTML = String(message || '');
    var plainMessage = (messageElement.textContent || messageElement.innerText || '').trim();

    if (plainMessage) {
      window.alert(plainMessage);
    }
  },

  /**
   * Clear all alerts from a container.
   *
   * @param {string} containerId — ID of the container element (without #)
   */
  clearAlerts: function (containerId) {
    if (containerId) {
      $('#' + containerId).empty();
    }
  }
};

/*
 * Keep the workspace available on every authenticated user page. Individual
 * pages may keep a small fallback nav in their HTML, but this single shell
 * prevents those copies from drifting apart.
 */
document.addEventListener('DOMContentLoaded', function () {
  setupDateTimePickerInteraction();

  var navbar = document.querySelector('.navbar');
  if (!navbar) return;

  var collapsed = localStorage.getItem('lifelink_sidebar_collapsed') === 'true';
  if (collapsed && window.innerWidth > 991) {
    document.body.classList.add('sidebar-collapsed');
  }

  var brand = navbar.querySelector('.navbar-brand');
  if (brand && !navbar.querySelector('.sidebar-toggle')) {
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'sidebar-toggle';
    toggle.setAttribute('aria-label', 'Collapse sidebar');
    toggle.setAttribute('title', 'Collapse sidebar');
    toggle.innerHTML = '<i class="bi bi-layout-sidebar-inset"></i>';
    brand.insertAdjacentElement('afterend', toggle);
    toggle.addEventListener('click', function () {
      var isCollapsed = document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem('lifelink_sidebar_collapsed', String(isCollapsed));
      toggle.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
      toggle.setAttribute('title', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
      toggle.innerHTML = '<i class="bi bi-' + (isCollapsed ? 'layout-sidebar-inset-reverse' : 'layout-sidebar-inset') + '"></i>';
    });

  }

  if (window.location.pathname.indexOf('/user/') !== 0) return;

  var nav = document.querySelector('.navbar .navbar-nav');
  if (!nav) return;

  var links = [
    ['dashboard.html', 'speedometer2', 'Dashboard'],
    ['emergency-requests.html', 'exclamation-triangle', 'Emergency Requests'],
    ['centres.html', 'geo-alt', 'Blood Centres & Camps'],
    ['appointments.html', 'calendar-check', 'Appointments'],
    ['requests.html', 'list-task', 'My Requests'],
    ['request.html', 'plus-circle', 'Create Request'],
    ['matches.html', 'people', 'Potential Matches'],
    ['donor.html', 'heart-pulse', 'Donor Profile'],
    ['donations.html', 'droplet', 'Donations'],
    ['notifications.html', 'bell', 'Notifications'],
    ['profile.html', 'person', 'Profile'],
    ['settings.html', 'gear', 'Settings']
  ];

  var current = window.location.pathname.split('/').pop();
  nav.innerHTML = links.map(function (link) {
    var active = current === link[0] ? ' active fw-semibold' : '';
    return '<li class="nav-item"><a class="nav-link' + active + '" href="/user/' + link[0] + '">' +
      '<i class="bi bi-' + link[1] + ' me-1"></i><span>' + link[2] + '</span></a></li>';
  }).join('');
  Array.prototype.forEach.call(nav.querySelectorAll('.nav-link'), function (link) {
    var label = link.textContent.trim();
    link.setAttribute('data-label', label);
    link.setAttribute('title', label);
  });

  /**
   * Opens native date/time pickers once per focus session while preserving
   * manual editing on subsequent clicks.
   */
  function setupDateTimePickerInteraction() {
    var fields = document.querySelectorAll('input[type="date"], input[type="time"]');

    Array.prototype.forEach.call(fields, function (field) {
      var interactionState = 'idle';

      function openPicker() {
        if (typeof field.showPicker !== 'function') return false;

        try {
          field.showPicker();
          return true;
        } catch (error) {
          // Browsers may reject showPicker outside a user-activated event.
          return false;
        }
      }

      field.addEventListener('pointerdown', function (event) {
        if (typeof field.showPicker !== 'function') return;

        if (interactionState === 'idle') {
          event.preventDefault();
          interactionState = 'picker';
          field.focus({ preventScroll: true });
          if (!openPicker()) interactionState = 'manual';
          return;
        }

        if (interactionState === 'picker') {
          event.preventDefault();
          interactionState = 'manual';
          field.focus({ preventScroll: true });
        }
      });

      field.addEventListener('focus', function () {
        if (interactionState !== 'idle') return;

        interactionState = 'picker';
        window.setTimeout(function () {
          if (!openPicker()) interactionState = 'manual';
        }, 0);
      });

      field.addEventListener('blur', function () {
        interactionState = 'idle';
      });
    });
  }

  var actions = document.querySelector('.navbar .navbar-collapse > .d-flex:last-child') ||
    document.querySelector('.navbar .container > .d-flex:last-child');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'd-flex align-items-center gap-3 sidebar-actions';
    var collapse = document.querySelector('.navbar .navbar-collapse');
    if (collapse) collapse.appendChild(actions);
  }
  if (actions) {
    actions.className = 'd-flex align-items-center gap-3 sidebar-actions';
    actions.innerHTML = '<button type="button" class="btn btn-danger btn-sm w-100 js-logout-button" data-action="logout">' +
      '<i class="bi bi-box-arrow-right me-1"></i>Log out</button>';
    var collapse = document.querySelector('.navbar .navbar-collapse');
    if (collapse && actions.parentElement !== collapse) {
      collapse.appendChild(actions);
    }
  }
});

document.addEventListener('click', function (event) {
  var logoutButton = event.target.closest('.js-logout-button, #logoutBtn, [data-action="logout"]');
  if (!logoutButton) return;

  event.preventDefault();
  Auth.logout();
});

document.addEventListener('DOMContentLoaded', function () {
  var tooltip = document.createElement('div');
  tooltip.className = 'sidebar-tooltip';
  document.body.appendChild(tooltip);

  document.addEventListener('mouseover', function (event) {
    var link = event.target.closest('.navbar .nav-link[data-label]');
    if (!link || !document.body.classList.contains('sidebar-collapsed')) return;

    tooltip.textContent = link.getAttribute('data-label');
    var bounds = link.getBoundingClientRect();
    tooltip.style.left = (bounds.right + 12) + 'px';
    tooltip.style.top = (bounds.top + (bounds.height / 2)) + 'px';
    tooltip.style.transform = 'translateY(-50%)';
  });

  document.addEventListener('mouseout', function (event) {
    var link = event.target.closest('.navbar .nav-link[data-label]');
    if (link && !link.contains(event.relatedTarget)) {
      tooltip.textContent = '';
    }
  });
});
