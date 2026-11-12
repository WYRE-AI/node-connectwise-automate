/**
 * Clients and Locations integration tests
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ConnectWiseAutomateClient } from '../../src/client.js';
import { server } from '../mocks/server.js';
import * as fixtures from '../fixtures/index.js';

const API_BASE = 'https://testserver.hostedrmm.com/cwa/api/v1';

const createClient = () =>
  new ConnectWiseAutomateClient({
    serverUrl: 'https://testserver.hostedrmm.com',
    clientId: 'test-client-id',
    credentials: {
      method: 'integrator',
      integratorUsername: 'test-user',
      integratorPassword: 'test-password',
    },
  });

/**
 * Serve `response` for one route and record the request that hit it.
 */
function serve(method: 'get' | 'post' | 'patch' | 'delete', path: string, response: unknown = {}) {
  const seen: { url?: string; body?: unknown } = {};
  server.use(
    http[method](`${API_BASE}${path}`, async ({ request }) => {
      seen.url = request.url;
      // msw 3 gives bodiless requests (e.g. DELETE) an empty stream, so parse only non-empty text.
      const text = await request.text();
      seen.body = text ? JSON.parse(text) : undefined;
      return response === undefined ? new HttpResponse(null, { status: 204 }) : HttpResponse.json(response);
    })
  );
  return seen;
}

describe('Clients Resource', () => {
  describe('list', () => {
    it('should return the bare array Automate sends', async () => {
      const client = createClient();
      const response = await client.clients.list();

      expect(Array.isArray(response)).toBe(true);
      expect(response).toHaveLength(2);
      expect(response[0]?.Name).toBe('Acme Corporation');
      expect(response[0]?.PhoneNumber).toBe('555-123-4567');
    });

    it('should pass filters through condition and the shared list options', async () => {
      const client = createClient();
      const seen = serve('get', '/Clients', fixtures.clients.list);

      await client.clients.list({ condition: "Name like '%acme%'", pageSize: 10, page: 2 });

      const query = new URL(seen.url ?? '').searchParams;
      expect(query.get('condition')).toBe("Name like '%acme%'");
      expect(query.get('pageSize')).toBe('10');
      expect(query.get('page')).toBe('2');
    });
  });

  describe('listAll', () => {
    it('should iterate a bare-array page', async () => {
      const client = createClient();
      const clients = await client.clients.listAll().toArray();

      expect(clients.map((c) => c.Id)).toEqual([100, 101]);
    });
  });

  describe('get', () => {
    it('should get a single client', async () => {
      const client = createClient();
      const result = await client.clients.get(100);

      expect(result.Id).toBe(100);
      expect(result.Name).toBe('Acme Corporation');
      expect(result.City).toBe('New York');
      expect(result.FaxNumber).toBe('555-123-4568');
    });
  });

  describe('create', () => {
    it('should POST the client body as-is', async () => {
      const client = createClient();
      const seen = serve('post', '/Clients', fixtures.clients.created);
      const data = {
        Name: 'New Customer Corp',
        Address1: '789 Business Park',
        City: 'Chicago',
        State: 'IL',
        ZipCode: '60601',
        Country: 'USA',
        PhoneNumber: '555-000-0000',
      };

      const result = await client.clients.create(data);

      expect(seen.body).toEqual(data);
      expect(result.Id).toBe(102);
    });
  });

  describe('update', () => {
    it('should PATCH a JSON Patch replace operation per defined field', async () => {
      const client = createClient();
      const seen = serve('patch', '/Clients/100', fixtures.clients.updated);

      const result = await client.clients.update(100, {
        Name: 'Acme Corporation Updated',
        Comment: 'Updated company info',
        City: undefined,
      });

      expect(seen.body).toEqual([
        { Op: 'replace', Path: '/Name', Value: 'Acme Corporation Updated' },
        { Op: 'replace', Path: '/Comment', Value: 'Updated company info' },
      ]);
      expect(result.Name).toBe('Acme Corporation Updated');
    });
  });

  describe('delete', () => {
    it('should DELETE the client and resolve on 204', async () => {
      const client = createClient();
      const seen = serve('delete', '/Clients/100', undefined);

      await expect(client.clients.delete(100)).resolves.toBeUndefined();
      expect(seen.url).toBe(`${API_BASE}/Clients/100`);
    });
  });
});

describe('Locations Resource', () => {
  describe('list', () => {
    it('should return the bare array with the nested client reference', async () => {
      const client = createClient();
      const response = await client.locations.list();

      expect(response).toHaveLength(2);
      expect(response[0]?.Name).toBe('Headquarters');
      expect(response[0]?.Client?.Id).toBe(100);
    });

    it('should turn clientId into a Client.Id condition', async () => {
      const client = createClient();
      const seen = serve('get', '/Locations', fixtures.clients.locations);

      await client.locations.list({ clientId: 100 });

      const query = new URL(seen.url ?? '').searchParams;
      expect(query.get('condition')).toBe('Client.Id = 100');
      expect(query.has('clientId')).toBe(false);
    });

    it('should AND clientId with a caller-supplied condition', async () => {
      const client = createClient();
      const seen = serve('get', '/Locations', fixtures.clients.locations);

      await client.locations.list({ clientId: 100, condition: "Name like '%HQ%'" });

      const query = new URL(seen.url ?? '').searchParams;
      expect(query.get('condition')).toBe("(Name like '%HQ%') and (Client.Id = 100)");
    });
  });

  describe('listAll', () => {
    it('should scope pagination to the client', async () => {
      const client = createClient();
      const seen = serve('get', '/Locations', fixtures.clients.locations);

      const locations = await client.locations.listAll({ clientId: 100 }).toArray();

      expect(locations).toHaveLength(2);
      expect(new URL(seen.url ?? '').searchParams.get('condition')).toBe('Client.Id = 100');
    });
  });

  describe('get', () => {
    it('should get a single location', async () => {
      const client = createClient();
      const location = await client.locations.get(1);

      expect(location.Id).toBe(1);
      expect(location.Name).toBe('Headquarters');
      expect(location.Client?.Id).toBe(100);
      expect(location.PhoneNumber).toBe('555-123-4567');
    });
  });

  describe('create', () => {
    it('should POST the location with its nested client reference', async () => {
      const client = createClient();
      const seen = serve('post', '/Locations', fixtures.clients.singleLocation);
      const data = { Name: 'Headquarters', Client: { Id: 100 }, City: 'New York' };

      const result = await client.locations.create(data);

      expect(seen.body).toEqual(data);
      expect(result.Id).toBe(1);
    });
  });

  describe('update', () => {
    it('should PATCH JSON Patch replace operations', async () => {
      const client = createClient();
      const seen = serve('patch', '/Locations/1', fixtures.clients.singleLocation);

      await client.locations.update(1, { Name: 'HQ', Comments: 'Renamed' });

      expect(seen.body).toEqual([
        { Op: 'replace', Path: '/Name', Value: 'HQ' },
        { Op: 'replace', Path: '/Comments', Value: 'Renamed' },
      ]);
    });
  });

  describe('delete', () => {
    it('should DELETE the location', async () => {
      const client = createClient();
      const seen = serve('delete', '/Locations/1', undefined);

      await expect(client.locations.delete(1)).resolves.toBeUndefined();
      expect(seen.url).toBe(`${API_BASE}/Locations/1`);
    });
  });
});
