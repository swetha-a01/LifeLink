const https = require('https');
const http = require('http');
const config = require('../config/config');

const geocodeCache = new Map();
const routeCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isValidCoordinate(latitude, longitude) {
  return Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Number(latitude) >= -90 && Number(latitude) <= 90 &&
    Number(longitude) >= -180 && Number(longitude) <= 180;
}

function requestJson(url, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'http:' ? http : https;
    const request = transport.get(url, { headers }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Location service returned HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Location service returned invalid JSON'));
        }
      });
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error('Location service request timed out'));
    });
    request.on('error', reject);
  });
}

function getCached(cache, key) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(cache, key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

async function geocodePlace(query) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return null;

  const cacheKey = normalizedQuery.toLowerCase();
  const cached = getCached(geocodeCache, cacheKey);
  if (cached) return cached;

  const url = new URL(config.location.geocodingUrl);
  url.searchParams.set('q', normalizedQuery);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');

  try {
    const results = await requestJson(url, {
      Accept: 'application/json',
      'User-Agent': config.location.userAgent
    }, config.location.timeoutMs);
    const result = Array.isArray(results) ? results[0] : null;
    if (!result || !isValidCoordinate(result.lat, result.lon)) return null;

    return setCached(geocodeCache, cacheKey, {
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      approximate: true
    });
  } catch (error) {
    console.warn('LifeLink geocoding unavailable:', error.message);
    return null;
  }
}

async function resolveLocation({ latitude, longitude, query }) {
  if (isValidCoordinate(latitude, longitude)) {
    return {
      latitude: Number(latitude),
      longitude: Number(longitude),
      approximate: false
    };
  }
  return geocodePlace(query);
}

async function calculateRoadRoute(from, to) {
  if (!from || !to) {
    return {
      status: 'UNAVAILABLE',
      distanceKm: null,
      durationMinutes: null,
      approximate: true
    };
  }

  const cacheKey = [
    from.latitude.toFixed(5),
    from.longitude.toFixed(5),
    to.latitude.toFixed(5),
    to.longitude.toFixed(5)
  ].join(':');
  const cached = getCached(routeCache, cacheKey);
  if (cached) return cached;

  const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = `${config.location.routingUrl.replace(/\/+$/, '')}/${coordinates}`;
  const routeUrl = new URL(url);
  routeUrl.searchParams.set('overview', 'false');
  routeUrl.searchParams.set('alternatives', 'false');

  try {
    const result = await requestJson(routeUrl, {
      Accept: 'application/json',
      'User-Agent': config.location.userAgent
    }, config.location.timeoutMs);
    const route = result && result.routes && result.routes[0];
    if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
      return {
        status: 'NO_ROUTE',
        distanceKm: null,
        durationMinutes: null,
        approximate: Boolean(from.approximate || to.approximate)
      };
    }

    return setCached(routeCache, cacheKey, {
      status: 'AVAILABLE',
      distanceKm: Number((route.distance / 1000).toFixed(1)),
      durationMinutes: Math.round(route.duration / 60),
      approximate: Boolean(from.approximate || to.approximate)
    });
  } catch (error) {
    console.warn('LifeLink routing unavailable:', error.message);
    return {
      status: 'UNAVAILABLE',
      distanceKm: null,
      durationMinutes: null,
      approximate: Boolean(from.approximate || to.approximate)
    };
  }
}

async function getDonorRequestRoute(request, donor) {
  if (!config.location.enabled) {
    return {
      status: 'UNAVAILABLE',
      distanceKm: null,
      durationMinutes: null,
      approximate: true
    };
  }

  const donorLocation = await resolveLocation({
    latitude: donor.latitude,
    longitude: donor.longitude,
    query: `${donor.area || ''}, Tamil Nadu, India`
  });
  const requestLocation = await resolveLocation({
    latitude: request.latitude,
    longitude: request.longitude,
    query: [
      request.hospitalName,
      request.hospitalAddress,
      request.landmark,
      request.city,
      request.district || request.area,
      request.state || 'Tamil Nadu',
      'India'
    ].filter(Boolean).join(', ')
  });

  return calculateRoadRoute(donorLocation, requestLocation);
}

module.exports = {
  calculateRoadRoute,
  getDonorRequestRoute,
  geocodePlace,
  isValidCoordinate
};
