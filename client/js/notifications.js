/**
 * LifeLink — Notifications Controller (Phase 8)
 *
 * Responsibilities:
 *   - Require JWT authentication
 *   - Fetch notifications from GET /api/notifications
 *   - Render responsive notification cards with priority indicators
 *   - Support marking single notification as read (PATCH /api/notifications/:id/read)
 *   - Support marking all notifications as read (PATCH /api/notifications/read-all)
 *   - Update unread badge in top navbar
 */

$(document).ready(function () {
  // 1. Require Auth
  if (!Auth.requireAuth()) return;

  // 2. Load Notifications
  loadNotifications();

  // 3. Bind "Mark All as Read" button
  $('#markAllReadBtn').on('click', function () {
    handleMarkAllAsRead();
  });

  // 4. Delegated handler for single "Mark as Read" button
  $(document).on('click', '.btn-mark-read', function () {
    var id = $(this).data('id');
    var cardElem = $(this).closest('.notif-card');
    handleMarkAsRead(id, cardElem);
  });
});

/**
 * Fetches notifications from GET /api/notifications
 */
function loadNotifications() {
  $('#notificationsLoadingSpinner').removeClass('d-none');
  $('#notificationsList').addClass('d-none');
  $('#emptyNotificationsState').addClass('d-none');
  Auth.clearAlerts('notificationsAlert');

  LifeLinkAPI.get('/notifications')
    .then(function (response) {
      $('#notificationsLoadingSpinner').addClass('d-none');

      var data = (response && response.data) ? response.data : {};
      var notifList = data.notifications || [];
      var unreadCount = data.unreadCount || 0;

      // Update Navbar Unread Badge
      updateNavbarUnreadBadge(unreadCount);

      if (notifList && notifList.length > 0) {
        renderNotificationsList(notifList);
        $('#notificationsList').removeClass('d-none');
      } else {
        $('#emptyNotificationsState').removeClass('d-none');
      }
    })
    .catch(function (error) {
      $('#notificationsLoadingSpinner').addClass('d-none');
      var msg = (error && error.message) ? error.message : 'Failed to load notifications.';
      Auth.showAlert('notificationsAlert', msg, 'danger');
    });
}

/**
 * Renders list of notification cards
 */
function renderNotificationsList(notifications) {
  var list = $('#notificationsList');
  list.empty();

  notifications.forEach(function (notif) {
    var isEmergency = (notif.priority === 'EMERGENCY' || notif.type === 'EMERGENCY_REQUEST');
    var isUnread = !notif.isRead;

    var dateStr = notif.createdAt ? new Date(notif.createdAt).toLocaleString() : 'N/A';
    var title = escapeHtml(notif.title || 'Notification');
    var message = escapeHtml(notif.message || '');

    var priorityBadge = '';
    if (isEmergency) {
      priorityBadge = '<span class="badge bg-danger text-white border border-light"><i class="bi bi-exclamation-octagon-fill me-1"></i>🚨 EMERGENCY</span>';
    } else if (notif.priority === 'URGENT') {
      priorityBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-exclamation-triangle-fill me-1"></i>URGENT</span>';
    } else {
      priorityBadge = '<span class="badge bg-secondary">NORMAL</span>';
    }

    var cardClasses = 'card shadow-sm border-0 notif-card p-3';
    if (isEmergency) {
      cardClasses += ' notif-card-emergency';
    } else if (isUnread) {
      cardClasses += ' notif-card-unread';
    }

    var unreadBadge = isUnread ? '<span class="badge bg-danger text-white ms-2">UNREAD</span>' : '';

    var actionLink = '';
    if (notif.relatedRequestId) {
      var reqId = typeof notif.relatedRequestId === 'object' ? notif.relatedRequestId._id : notif.relatedRequestId;
      actionLink = `<a href="/user/matches.html?requestId=${reqId}" class="btn btn-sm btn-outline-danger fw-semibold"><i class="bi bi-eye me-1"></i> View Matches</a>`;
    } else if (notif.relatedMatchId) {
      actionLink = `<a href="/user/matches.html" class="btn btn-sm btn-outline-danger fw-semibold"><i class="bi bi-people me-1"></i> View Matches</a>`;
    }

    var markReadBtn = isUnread
      ? `<button class="btn btn-sm btn-outline-secondary btn-mark-read" data-id="${notif._id}"><i class="bi bi-check2 me-1"></i> Mark as Read</button>`
      : '<span class="small text-muted"><i class="bi bi-check2-all me-1"></i> Read</span>';

    var cardHTML = `
      <div class="${cardClasses}" id="notif-card-${notif._id}">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <div class="d-flex align-items-center gap-2">
            ${priorityBadge}
            ${unreadBadge}
            <h3 class="h6 fw-bold mb-0 text-dark">${title}</h3>
          </div>
          <span class="small text-muted"><i class="bi bi-clock me-1"></i>${dateStr}</span>
        </div>

        <p class="text-dark mb-3 small">${message}</p>

        <div class="d-flex align-items-center justify-content-between pt-2 border-top">
          <div>${actionLink}</div>
          <div class="read-status-container">${markReadBtn}</div>
        </div>
      </div>
    `;

    list.append(cardHTML);
  });
}

/**
 * Handles single notification mark as read via PATCH /api/notifications/:id/read
 */
function handleMarkAsRead(id, cardElem) {
  LifeLinkAPI.patch('/notifications/' + id + '/read')
    .then(function () {
      cardElem.removeClass('notif-card-unread');
      cardElem.find('.read-status-container').html('<span class="small text-muted"><i class="bi bi-check2-all me-1"></i> Read</span>');
      cardElem.find('.badge.bg-danger:contains("UNREAD")').remove();

      // Refresh unread count
      refreshUnreadCount();
    })
    .catch(function (error) {
      console.warn('Could not mark notification as read:', error);
    });
}

/**
 * Handles mark all notifications as read via PATCH /api/notifications/read-all
 */
function handleMarkAllAsRead() {
  Auth.clearAlerts('notificationsAlert');

  LifeLinkAPI.patch('/notifications/read-all')
    .then(function () {
      Auth.showAlert('notificationsAlert', 'All notifications marked as read.', 'success');
      loadNotifications();
    })
    .catch(function (error) {
      var msg = (error && error.message) ? error.message : 'Failed to mark notifications as read.';
      Auth.showAlert('notificationsAlert', msg, 'danger');
    });
}

/**
 * Refreshes the unread notification badge count in navbar
 */
function refreshUnreadCount() {
  LifeLinkAPI.get('/notifications')
    .then(function (res) {
      var unread = (res && res.data && res.data.unreadCount) ? res.data.unreadCount : 0;
      updateNavbarUnreadBadge(unread);
    });
}

function updateNavbarUnreadBadge(count) {
  var badge = $('#navUnreadBadge');
  if (badge.length) {
    if (count > 0) {
      badge.text(count).removeClass('d-none');
    } else {
      badge.addClass('d-none');
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
