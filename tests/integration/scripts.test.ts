/**
 * Scripts integration tests
 *
 * These model the REAL Automate contract: scripts are started by creating a
 * scheduled-script row, list endpoints return bare JSON arrays, and a run's
 * outcome is only observable through script history. There is no job handle.
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

/** A history row as Automate returns it. */
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
 * Install handlers that serve a scripted sequence of history responses, one
 * per poll, and record the scheduling request.
 */
function mockRun(historyPages: unknown[][]) {
  const state = { scheduled: null as unknown, polls: 0 };

  server.use(
    http.post(`${API_BASE}/Computers/:id/Scheduledscripts`, async ({ request }) => {
      state.scheduled = await request.json();
      return HttpResponse.json({ Id: 900, ScriptId: 42, ComputerId: 1 });
    }),
    http.get(`${API_BASE}/Computers/:id/Scripthistory`, () => {
      const page = historyPages[Math.min(state.polls, historyPages.length - 1)];
      state.polls += 1;
      return HttpResponse.json(page);
    })
  );

  return state;
}

describe('Scripts Resource', () => {
  describe('scheduleForComputer', () => {
    it('should post to Scheduledscripts with the computer id in the body', async () => {
      const client = createClient();
      const state = mockRun([[]]);

      const schedule = await client.scripts.scheduleForComputer(1, {
        ScriptId: 42,
        Parameters: 'spooler',
      });

      expect(state.scheduled).toEqual({
        ScriptId: 42,
        Parameters: 'spooler',
        ComputerId: 1,
      });
      expect(schedule.Id).toBe(900);
    });
  });

  describe('runAndWait', () => {
    it('should return the history row that appears after launch', async () => {
      const client = createClient();
      mockRun([
        [], // baseline: nothing in history
        [], // first poll: still running
        [historyRow(1001, 42)], // second poll: finished
      ]);

      const result = await client.scripts.runAndWait(
        1,
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result.completed).toBe(true);
      expect(result.state).toBe('Success');
      expect(result.history?.Id).toBe(1001);
    });

    it('should surface the diagnostic message on a failed run', async () => {
      const client = createClient();
      mockRun([
        [],
        [
          historyRow(1002, 42, {
            State: 'Failure',
            DiagnosticMessage: 'Agent offline at execution time',
          }),
        ],
      ]);

      const result = await client.scripts.runAndWait(
        1,
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result.completed).toBe(true);
      expect(result.state).toBe('Failure');
      expect(result.diagnosticMessage).toBe('Agent offline at execution time');
    });

    it('should not mistake a pre-existing run of the same script for this one', async () => {
      const client = createClient();
      // The same script already has a completed history row before we launch.
      // Correlating on scriptId alone would return this stale row instantly.
      const stale = historyRow(1000, 42, { HistoryDate: '2024-01-01T00:00:00Z' });
      mockRun([
        [stale], // baseline
        [stale], // poll 1 — nothing new
        [stale, historyRow(1003, 42)], // poll 2 — our run lands
      ]);

      const result = await client.scripts.runAndWait(
        1,
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result.history?.Id).toBe(1003);
    });

    it('should ignore history rows belonging to a different script', async () => {
      const client = createClient();
      mockRun([
        [],
        [historyRow(1004, 99)], // a different script finished
        [historyRow(1004, 99), historyRow(1005, 42)],
      ]);

      const result = await client.scripts.runAndWait(
        1,
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result.history?.ScriptId).toBe(42);
      expect(result.history?.Id).toBe(1005);
    });

    it('should return completed:false when the timeout elapses', async () => {
      const client = createClient();
      mockRun([[]]); // never produces a new row

      const result = await client.scripts.runAndWait(
        1,
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 50 }
      );

      expect(result.completed).toBe(false);
      expect(result.history).toBeUndefined();
      // The schedule is still returned so the caller can follow up later.
      expect(result.schedule.Id).toBe(900);
    });

    it('should not treat a still-running row as terminal', async () => {
      const client = createClient();
      mockRun([
        [],
        [historyRow(1006, 42, { Status: 'Running', State: undefined })],
      ]);

      const result = await client.scripts.runAndWait(
        1,
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 50 }
      );

      expect(result.completed).toBe(false);
    });
  });

  describe('folders', () => {
    it('should read from /Scriptfolders', async () => {
      const client = createClient();
      server.use(
        http.get(`${API_BASE}/Scriptfolders`, () =>
          HttpResponse.json([{ Id: 3, Name: 'Maintenance' }])
        )
      );

      const folders = await client.scripts.folders();

      expect(folders[0]?.Name).toBe('Maintenance');
    });
  });
});
