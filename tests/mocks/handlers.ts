/**
 * MSW request handlers for mocking the ConnectWise Automate API
 */

import { http, HttpResponse } from 'msw';
import * as fixtures from '../fixtures/index.js';

const BASE_URL = 'https://testserver.hostedrmm.com';
const API_BASE = `${BASE_URL}/cwa/api/v1`;

export const handlers = [
  // OAuth token endpoint
  http.post(`${API_BASE}/apitoken`, async ({ request }) => {
    const body = await request.json() as Record<string, string>;

    // Check for bad credentials
    if (body['UserName'] === 'bad-user' || body['Password'] === 'bad-password') {
      return HttpResponse.json(
        { Message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    return HttpResponse.json(fixtures.auth.tokenSuccess);
  }),

  // Computers endpoints
  http.get(`${API_BASE}/Computers`, ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    if (page === '2') {
      return HttpResponse.json(fixtures.computers.listPage2);
    }
    return HttpResponse.json(fixtures.computers.listPage1);
  }),

  http.get(`${API_BASE}/Computers/:id`, ({ params }) => {
    const id = Number(params['id']);
    if (id === 999) {
      return HttpResponse.json(
        { Message: 'Computer not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json(fixtures.computers.single);
  }),

  http.post(`${API_BASE}/Computers`, () => {
    return HttpResponse.json(fixtures.computers.created);
  }),

  http.patch(`${API_BASE}/Computers/:id`, () => {
    return HttpResponse.json(fixtures.computers.updated);
  }),

  http.delete(`${API_BASE}/Computers/:id`, () => {
    return HttpResponse.json({});
  }),

  http.post(`${API_BASE}/Computers/:id/CommandExecute`, () => {
    return HttpResponse.json(fixtures.computers.commandResult);
  }),

  http.post(`${API_BASE}/Computers/:id/Restart`, () => {
    return HttpResponse.json({});
  }),

  http.post(`${API_BASE}/Computers/:id/Shutdown`, () => {
    return HttpResponse.json({});
  }),

  http.post(`${API_BASE}/Computers/:id/WakeUp`, () => {
    return HttpResponse.json({});
  }),

  // Clients endpoints
  http.get(`${API_BASE}/Clients`, () => {
    return HttpResponse.json(fixtures.clients.list);
  }),

  http.get(`${API_BASE}/Clients/:id`, () => {
    return HttpResponse.json(fixtures.clients.single);
  }),

  http.post(`${API_BASE}/Clients`, () => {
    return HttpResponse.json(fixtures.clients.created);
  }),

  http.patch(`${API_BASE}/Clients/:id`, () => {
    return HttpResponse.json(fixtures.clients.updated);
  }),

  http.delete(`${API_BASE}/Clients/:id`, () => {
    return HttpResponse.json({});
  }),

  // Locations endpoints
  http.get(`${API_BASE}/Locations`, () => {
    return HttpResponse.json(fixtures.clients.locations);
  }),

  http.get(`${API_BASE}/Locations/:id`, () => {
    return HttpResponse.json(fixtures.clients.singleLocation);
  }),

  // Alerts endpoints - note: more specific routes before parameterized routes
  http.get(`${API_BASE}/Alerts/Statistics`, () => {
    return HttpResponse.json(fixtures.alerts.statistics);
  }),

  http.post(`${API_BASE}/Alerts/Acknowledge`, () => {
    return HttpResponse.json(fixtures.alerts.acknowledgeResult);
  }),

  http.post(`${API_BASE}/Alerts/Close`, () => {
    return HttpResponse.json(fixtures.alerts.closeResult);
  }),

  http.get(`${API_BASE}/Alerts`, () => {
    return HttpResponse.json(fixtures.alerts.list);
  }),

  http.get(`${API_BASE}/Alerts/:id`, () => {
    return HttpResponse.json(fixtures.alerts.single);
  }),

  // Rate limit test endpoint
  http.get(`${API_BASE}/rate-limited`, () => {
    return HttpResponse.json(
      { Message: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }),

  // 401 test endpoint
  http.get(`${API_BASE}/unauthorized`, () => {
    return HttpResponse.json(
      { Message: 'Unauthorized' },
      { status: 401 }
    );
  }),

  // 403 test endpoint
  http.get(`${API_BASE}/forbidden`, () => {
    return HttpResponse.json(
      { Message: 'Access denied' },
      { status: 403 }
    );
  }),

  // 404 test endpoint
  http.get(`${API_BASE}/not-found`, () => {
    return HttpResponse.json(
      { Message: 'Not found' },
      { status: 404 }
    );
  }),

  // 500 test endpoint
  http.get(`${API_BASE}/server-error`, () => {
    return HttpResponse.json(
      { Message: 'Internal server error' },
      { status: 500 }
    );
  }),

  // Validation error test endpoint
  http.post(`${API_BASE}/validation-error`, () => {
    return HttpResponse.json(
      {
        ModelState: {
          'Name': ['Name is required'],
          'ClientId': ['ClientId must be a positive number'],
        },
      },
      { status: 400 }
    );
  }),
];
