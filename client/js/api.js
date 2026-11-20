/**
 * LifeLink — API Helper (jQuery AJAX)
 *
 * Provides a centralized way to make API requests.
 *
 * Usage:
 *   LifeLinkAPI.post('/auth/login', { email, password })
 *     .then(data => console.log(data))
 *     .catch(err => console.error(err));
 *
 * All requests:
 *   - Are sent as JSON
 *   - Automatically include the JWT token (if stored)
 *   - Return parsed JSON responses
 *
 * This file must be loaded BEFORE auth.js and page-specific scripts.
 */

// Base URL for all API calls
const API_BASE_URL = '/api';

const LifeLinkAPI = {
  // ---- Token management ----

  /** Get the stored JWT token */
  getToken: function () {
    return localStorage.getItem('lifelink_token');
  },

  /** Save the JWT token */
  setToken: function (token) {
    localStorage.setItem('lifelink_token', token);
  },

  /** Remove the stored JWT token */
  removeToken: function () {
    localStorage.removeItem('lifelink_token');
  },

  // ---- Request headers ----

  /**
   * Build request headers.
   * Automatically adds "Authorization: Bearer <token>" if a token exists.
   */
  getHeaders: function () {
    var headers = {
      'Content-Type': 'application/json'
    };

    var token = this.getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    return headers;
  },

  // ---- Core AJAX request ----

  /**
   * Make an AJAX request using jQuery.
   *
   * @param {string} method   HTTP method (GET, POST, PUT, DELETE)
   * @param {string} url      API path (e.g., '/auth/login')
   * @param {object} [data]   Request body (for POST/PUT)
   * @returns {Promise}        Resolves with response data, rejects with error
   */
  request: function (method, url, data) {
    var self = this;

    return new Promise(function (resolve, reject) {
      var options = {
        url: API_BASE_URL + url,
        method: method,
        headers: self.getHeaders(),
        dataType: 'json',
        success: function (response) {
          resolve(response);
        },
        error: function (xhr) {
          // Try to parse the JSON error response from the server
          var errorResponse = xhr.responseJSON || {
            success: false,
            message: 'Something went wrong. Please try again.'
          };
          reject(errorResponse);
        }
      };

      // Only add body for methods that support it
      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.data = JSON.stringify(data);
        options.contentType = 'application/json';
      }

      $.ajax(options);
    });
  },

  // ---- Convenience methods ----

  get: function (url) {
    return this.request('GET', url);
  },

  post: function (url, data) {
    return this.request('POST', url, data);
  },

  put: function (url, data) {
    return this.request('PUT', url, data);
  },

  patch: function (url, data) {
    return this.request('PATCH', url, data);
  },

  delete: function (url) {
    return this.request('DELETE', url);
  }
};

