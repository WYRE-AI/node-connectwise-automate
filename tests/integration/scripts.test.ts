/**
 * Scripts integration tests
 *
 * These model the REAL Automate contract, as published in ConnectWise's own
 * OpenAPI spec (Automate API v1): scripts are launched through
 * POST /Batch/ScriptExecute, list endpoints return bare JSON arrays, and a
 * run's outcome is only observable through script history. There is no job
 * handle, so results must be correlated by history row identity.
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

/** A script-history row as Automate returns it. */
const historyRow = (
  id: number,
  scriptId: number,
  overrides: Record<string, unknown> = {}
) => ({
  Id: id,
  ScriptId: scriptId,
  ComputerId: 1,
  Name: 'Restart Spooler',
  User: 'integrator',
  Status: 'Completed',
  State: 'Success',
  HistoryDate: '2024-01-15T10:35:00Z',
  ...overrides,
});

/**
 * Serve a scripted sequence of history responses (one per poll, per computer)
 * and record the batch launch request.
 */
function mockRun(
  historyPages: Record<number, unknown[][]>,
  batchResponse: unknown = { ScriptResults: [], ContainsUnsuccessfulResults: false }
) {
  const state = { launched: null as unknown, polls: {} as Record<number, number> };

  server.use(
    http.post(`${API_BASE}/Batch/ScriptExecute`, async ({ request }) => {
      state.launched = await request.json();
      return HttpResponse.json(batchResponse);
    }),
    http.get(`${API_BASE}/Computers/:id/ScriptHistory`, ({ params }) => {
      const id = Number(params['id']);
      const pages = historyPages[id] ?? [[]];
      const n = state.polls[id] ?? 0;
      state.polls[id] = n + 1;
      return HttpResponse.json(pages[Math.min(n, pages.length - 1)]);
    })
  );

  return state;
}

describe('Scripts Resource', () => {
  describe('executeBatch', () => {
    it('should default the entity type to Computer', async () => {
      const client = createClient();
      const state = mockRun({});

      await client.scripts.executeBatch({ EntityIds: [1, 2], ScriptId: 42 });

      expect(state.launched).toEqual({
        EntityType: 'Computer',
        EntityIds: [1, 2],
        ScriptId: 42,
      });
    });
  });

  describe('runAndWait', () => {
    it('should return the history row that appears after launch', async () => {
      const client = createClient();
      mockRun({
        1: [
          [], // baseline
          [], // still running
          [historyRow(1001, 42)], // finished
        ],
      });

      const [result] = await client.scripts.runAndWait(
        [1],
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result?.completed).toBe(true);
      expect(result?.state).toBe('Success');
      expect(result?.history?.Id).toBe(1001);
    });

    it('should surface the diagnostic message on a failed run', async () => {
      const client = createClient();
      mockRun({
        1: [
          [],
          [
            historyRow(1002, 42, {
              State: 'Failure',
              DiagnosticMessage: 'Agent offline at execution time',
            }),
          ],
        ],
      });

      const [result] = await client.scripts.runAndWait(
        [1],
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result?.state).toBe('Failure');
      expect(result?.diagnosticMessage).toBe('Agent offline at execution time');
    });

    it('should not mistake a pre-existing run of the same script for this one', async () => {
      const client = createClient();
      // The same script already has a completed history row before launch.
      // Correlating on scriptId alone would return this stale row instantly.
      const stale = historyRow(1000, 42, { HistoryDate: '2024-01-01T00:00:00Z' });
      mockRun({
        1: [
          [stale], // baseline
          [stale], // nothing new
          [stale, historyRow(1003, 42)], // our run lands
        ],
      });

      const [result] = await client.scripts.runAndWait(
        [1],
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result?.history?.Id).toBe(1003);
    });

    it('should ignore history rows belonging to a different script', async () => {
      const client = createClient();
      mockRun({
        1: [
          [],
          [historyRow(1004, 99)], // a different script finished
          [historyRow(1004, 99), historyRow(1005, 42)],
        ],
      });

      const [result] = await client.scripts.runAndWait(
        [1],
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result?.history?.Id).toBe(1005);
    });

    it('should not treat a still-running row as terminal', async () => {
      const client = createClient();
      mockRun({
        1: [[], [historyRow(1006, 42, { Status: 'Running', State: undefined })]],
      });

      const [result] = await client.scripts.runAndWait(
        [1],
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 40 }
      );

      expect(result?.completed).toBe(false);
    });

    it('should return completed:false when the timeout elapses', async () => {
      const client = createClient();
      mockRun({ 1: [[]] });

      const [result] = await client.scripts.runAndWait(
        [1],
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 40 }
      );

      expect(result?.completed).toBe(false);
      expect(result?.launched).toBe(true);
      expect(result?.history).toBeUndefined();
    });

    it('should report a target the server refused without polling it', async () => {
      const client = createClient();
      mockRun(
        { 2: [[]] },
        {
          ScriptResults: [
            {
              EntityId: 2,
              ResultDetails: {
                ResultStatus: 1,
                ReasonCode: 7,
                Message: 'Insufficient permissions to run script on this agent',
              },
            },
          ],
          ContainsUnsuccessfulResults: true,
        }
      );

      const [result] = await client.scripts.runAndWait(
        [2],
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result?.launched).toBe(false);
      expect(result?.launchMessage).toBe(
        'Insufficient permissions to run script on this agent'
      );
      expect(result?.waitedMs).toBe(0);
    });

    it('should track each computer independently in one batch', async () => {
      const client = createClient();
      mockRun({
        1: [[], [historyRow(2001, 42)]],
        2: [[], [], [historyRow(2002, 42, { ComputerId: 2, State: 'Failure' })]],
      });

      const results = await client.scripts.runAndWait(
        [1, 2],
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(results).toHaveLength(2);
      expect(results[0]?.state).toBe('Success');
      expect(results[1]?.state).toBe('Failure');
    });
  });

  describe('folders', () => {
    it('should read from /ScriptFolders', async () => {
      const client = createClient();
      server.use(
        http.get(`${API_BASE}/ScriptFolders`, () =>
          HttpResponse.json([{ Id: 3, Name: 'Maintenance' }])
        )
      );

      const folders = await client.scripts.folders();

      expect(folders[0]?.Name).toBe('Maintenance');
    });
  });
});
