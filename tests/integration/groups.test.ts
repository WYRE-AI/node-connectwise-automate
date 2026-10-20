/**
 * Groups integration tests
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ConnectWiseAutomateClient } from '../../src/client.js';
import { server } from '../mocks/server.js';

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

const groups = [
  {
    Id: 5,
    Name: 'Managed 24x7',
    FullName: 'Service Plans.Windows Servers.Managed 24x7',
    ParentId: 3,
    Depth: 2,
    TypeId: 1,
    TypeName: 'Computer',
    GUID: 'a1b2c3d4-0000-0000-0000-000000000005',
  },
  { Id: 6, Name: 'Workstations', FullName: 'Service Plans.Windows Workstations', ParentId: 3, Depth: 1 },
];

const memberships = [
  { Id: '5-42', GroupId: 5, ComputerId: 42 },
  { Id: '5-43', GroupId: 5, ComputerId: 43 },
];

/**
 * Serve `response` for one route and record the request that hit it.
 */
function serve(method: 'get' | 'post' | 'delete', path: string, response: unknown = {}) {
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

describe('Groups Resource', () => {
  describe('list', () => {
    it('should return the bare array and forward condition', async () => {
      const client = createClient();
      const seen = serve('get', '/Groups', groups);

      const response = await client.groups.list({ condition: 'ParentId = 3' });

      expect(new URL(seen.url ?? '').searchParams.get('condition')).toBe('ParentId = 3');
      expect(response).toHaveLength(2);
      expect(response[0]?.FullName).toBe('Service Plans.Windows Servers.Managed 24x7');
    });
  });

  describe('listAll', () => {
    it('should iterate a bare-array page', async () => {
      const client = createClient();
      serve('get', '/Groups', groups);

      const all = await client.groups.listAll().toArray();

      expect(all.map((g) => g.Id)).toEqual([5, 6]);
    });
  });

  describe('get', () => {
    it('should GET /Groups/{id}', async () => {
      const client = createClient();
      const seen = serve('get', '/Groups/5', groups[0]);

      const group = await client.groups.get(5);

      expect(seen.url).toBe(`${API_BASE}/Groups/5`);
      expect(group.Name).toBe('Managed 24x7');
    });
  });

  describe('computers', () => {
    it('should query /GroupComputers scoped by a GroupId condition', async () => {
      const client = createClient();
      const seen = serve('get', '/GroupComputers', memberships);

      const rows = await client.groups.computers(5);

      expect(new URL(seen.url ?? '').searchParams.get('condition')).toBe('GroupId = 5');
      expect(rows.map((r) => r.ComputerId)).toEqual([42, 43]);
    });

    it('should AND the group scope with a caller-supplied condition', async () => {
      const client = createClient();
      const seen = serve('get', '/GroupComputers', memberships);

      await client.groups.computers(5, { condition: 'ComputerId = 42', pageSize: 50 });

      const query = new URL(seen.url ?? '').searchParams;
      expect(query.get('condition')).toBe('(ComputerId = 42) and (GroupId = 5)');
      expect(query.get('pageSize')).toBe('50');
    });
  });

  describe('computersAll', () => {
    it('should paginate memberships scoped to the group', async () => {
      const client = createClient();
      const seen = serve('get', '/GroupComputers', memberships);

      const rows = await client.groups.computersAll(5).toArray();

      expect(rows).toHaveLength(2);
      expect(new URL(seen.url ?? '').searchParams.get('condition')).toBe('GroupId = 5');
    });
  });

  describe('addComputer', () => {
    it('should POST a GroupComputer row', async () => {
      const client = createClient();
      const seen = serve('post', '/GroupComputers', memberships[0]);

      const row = await client.groups.addComputer(5, 42);

      expect(seen.body).toEqual({ GroupId: 5, ComputerId: 42 });
      expect(row.Id).toBe('5-42');
    });
  });

  describe('removeComputer', () => {
    it('should DELETE /GroupComputers/{membershipId}', async () => {
      const client = createClient();
      const seen = serve('delete', '/GroupComputers/5-42', undefined);

      await expect(client.groups.removeComputer('5-42')).resolves.toBeUndefined();
      expect(seen.url).toBe(`${API_BASE}/GroupComputers/5-42`);
    });
  });
});
