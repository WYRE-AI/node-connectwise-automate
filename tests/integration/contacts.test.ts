/**
 * Contacts integration tests — every route lives on /cwa/api/v2.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ConnectWiseAutomateClient } from '../../src/client.js';
import { server } from '../mocks/server.js';

const API_V2 = 'https://testserver.hostedrmm.com/cwa/api/v2';

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

const contact = {
  ContactId: 7,
  FirstName: 'Jane',
  LastName: 'Doe',
  EmailAddress: 'jane@acme.example',
  PhoneNumber: '555-123-4567',
  Client: { ClientId: 100, Name: 'Acme Corporation' },
  Location: { LocationId: 1, Name: 'Headquarters' },
  IsManaged: true,
  DateCreated: '2024-01-15T09:00:00Z',
};

/**
 * Serve `response` for one v2 route and record the request that hit it.
 */
function serve(method: 'get' | 'post' | 'put' | 'delete', path: string, response: unknown = {}) {
  const seen: { url?: string; body?: unknown } = {};
  server.use(
    http[method](`${API_V2}${path}`, async ({ request }) => {
      seen.url = request.url;
      // msw 3 gives bodiless requests (e.g. DELETE) an empty stream, so parse only non-empty text.
      const text = await request.text();
      seen.body = text ? JSON.parse(text) : undefined;
      return response === undefined ? new HttpResponse(null, { status: 204 }) : HttpResponse.json(response);
    })
  );
  return seen;
}

describe('Contacts Resource', () => {
  describe('list', () => {
    it('should GET the v2 bare array and forward condition', async () => {
      const client = createClient();
      const seen = serve('get', '/Contacts', [contact]);

      const response = await client.contacts.list({ condition: "EmailAddress like '%acme%'" });

      expect(seen.url).toContain(`${API_V2}/Contacts?`);
      expect(new URL(seen.url ?? '').searchParams.get('condition')).toBe("EmailAddress like '%acme%'");
      expect(response).toHaveLength(1);
      expect(response[0]?.ContactId).toBe(7);
      expect(response[0]?.Client?.ClientId).toBe(100);
    });
  });

  describe('listAll', () => {
    it('should paginate the v2 route', async () => {
      const client = createClient();
      serve('get', '/Contacts', [contact, { ...contact, ContactId: 8 }]);

      const contacts = await client.contacts.listAll().toArray();

      expect(contacts.map((c) => c.ContactId)).toEqual([7, 8]);
    });
  });

  describe('get', () => {
    it('should GET /api/v2/Contacts/{id}', async () => {
      const client = createClient();
      const seen = serve('get', '/Contacts/7', contact);

      const result = await client.contacts.get(7);

      expect(seen.url).toBe(`${API_V2}/Contacts/7`);
      expect(result.EmailAddress).toBe('jane@acme.example');
    });
  });

  describe('create', () => {
    it('should POST the v2 contact body', async () => {
      const client = createClient();
      const seen = serve('post', '/Contacts', contact);
      const data = {
        FirstName: 'Jane',
        LastName: 'Doe',
        EmailAddress: 'jane@acme.example',
        Client: { ClientId: 100 },
      };

      const result = await client.contacts.create(data);

      expect(seen.body).toEqual(data);
      expect(result.ContactId).toBe(7);
    });
  });

  describe('update', () => {
    it('should PUT the full record (v2 has no PATCH)', async () => {
      const client = createClient();
      const seen = serve('put', '/Contacts/7', contact);
      const data = { FirstName: 'Jane', LastName: 'Smith', Client: { ClientId: 100 } };

      await client.contacts.update(7, data);

      expect(seen.url).toBe(`${API_V2}/Contacts/7`);
      expect(seen.body).toEqual(data);
    });
  });

  describe('delete', () => {
    it('should DELETE /api/v2/Contacts/{id}', async () => {
      const client = createClient();
      const seen = serve('delete', '/Contacts/7', undefined);

      await expect(client.contacts.delete(7)).resolves.toBeUndefined();
      expect(seen.url).toBe(`${API_V2}/Contacts/7`);
    });
  });
});
