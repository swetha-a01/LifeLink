const assert = require('assert');
const http = require('http');

async function run() {
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url.includes('13.081')) {
      response.end(JSON.stringify({ code: 'NoRoute', routes: [] }));
      return;
    }
    response.end(JSON.stringify({
      code: 'Ok',
      routes: [{ distance: 12345, duration: 3720 }]
    }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  process.env.OSRM_ROUTING_URL = `http://127.0.0.1:${port}/route`;
  process.env.LOCATION_SERVICE_TIMEOUT_MS = '1000';

  const { calculateRoadRoute, isValidCoordinate } = require('../server/utils/locationRoutingService');
  const { isBloodGroupCompatible, evaluateMatch } = require('../server/utils/matchingAlgorithm');

  assert.strictEqual(isValidCoordinate(12.9, 79.1), true);
  assert.strictEqual(isValidCoordinate(91, 79.1), false);
  assert.strictEqual(isBloodGroupCompatible('O-', 'AB+'), true);
  assert.strictEqual(isBloodGroupCompatible('A+', 'B+'), false);

  const route = await calculateRoadRoute(
    { latitude: 12.9, longitude: 79.1, approximate: true },
    { latitude: 13.08, longitude: 80.27, approximate: true }
  );
  assert.strictEqual(route.status, 'AVAILABLE');
  assert.strictEqual(route.distanceKm, 12.3);
  assert.strictEqual(route.durationMinutes, 62);
  assert.strictEqual(route.approximate, true);

  const match = evaluateMatch(
    { bloodGroup: 'AB+', area: 'Vellore' },
    {
      bloodGroup: 'O-',
      availability: 'AVAILABLE',
      verificationStatus: 'VERIFIED',
      lastDonationDate: null,
      area: 'Chennai',
      userId: { _id: 'donor-user-id' }
    },
    route
  );
  assert.ok(match);
  assert.ok(match.matchReasons.some((reason) => reason.includes('Road distance')));

  const noRoute = await calculateRoadRoute(
    { latitude: 12.9, longitude: 79.1 },
  { latitude: 13.081, longitude: 80.27 }
  );
  assert.strictEqual(noRoute.status, 'NO_ROUTE');

  server.close();
  console.log('Routing and compatibility tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
