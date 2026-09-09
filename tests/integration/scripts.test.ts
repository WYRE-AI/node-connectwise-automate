/**
 * Scripts integration tests
 *
 * These model the REAL Automate contract, as published in ConnectWise's own
 * OpenAPI spec (Automate API v1 — Scripts.json, Batch.json, Computers.json):
 *
 *  - GET /Scripts and every other list route return a bare JSON array, and
 *    accept only the generic query options (page, pageSize, condition,
 *    orderBy, includeFields, excludeFields, ids, expand). There are no
 *    script-specific filters such as `name` or `folderId`.
 *  - The spec lists script detail only on API v2 (GET /api/v2/Scripts/{scriptId})
 *    and omits GET /api/v1/Scripts/{id}, but live instances serve the v1 route
 *    and at least one hosted instance terminates v2 requests — so get() is v1
 *    and getDetail() is the v2 contract.
 *  - Scripts are launched through POST /Batch/ScriptExecute, and a run's
 *    outcome is only observable through GET /Computers/{id}/ScriptHistory.
 *    Nothing in the spec links the launch to a history row, so results are
 *    correlated by history-row identity against a pre-launch baseline.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ConnectWiseAutomateClient } from '../../src/client.js';
import { ConnectWiseAutomateNotFoundError } from '../../src/errors.js';
import { server } from '../mocks/server.js';
import type { ScriptListParams } from '../../src/types/scripts.js';

const BASE_URL = 'https://testserver.hostedrmm.com';
const API_BASE = `${BASE_URL}/cwa/api/v1`;
const API_V2_BASE = `${BASE_URL}/cwa/api/v2`;

const createClient = () =>
  new ConnectWiseAutomateClient({
    serverUrl: BASE_URL,
    clientId: 'test-client-id',
    credentials: {
      method: 'integrator',
      integratorUsername: 'test-user',
      integratorPassword: 'test-password',
    },
  });

/** A LabTech.Models.Script row as GET /Scripts returns it (note: Id is a string). */
const scriptRow = (id: string, name: string) => ({
  Id: id,
  Folder: { Id: '3', ParentId: '0', Name: 'Maintenance', GUID: 'f0ld3r' },
  Name: name,
  Comments: 'Restarts the print spooler',
  IsComputerScript: true,
  IsFunctionScript: false,
  IsMaintenanceScript: false,
  Version: 4,
  GUID: '9c0f1e2d',
  Parameters: ['ServiceName=Spooler'],
  FullFolderPath: 'Maintenance',
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
 * and record the batch launch request plus the query string of each history
 * fetch.
 */
function mockRun(
  historyPages: Record<number, unknown[][]>,
  batchResponse: unknown = { ScriptResults: [], ContainsUnsuccessfulResults: false }
) {
  const state = {
    launched: null as unknown,
    polls: {} as Record<number, number>,
    historyQueries: [] as URLSearchParams[],
  };

  server.use(
    http.post(`${API_BASE}/Batch/ScriptExecute`, async ({ request }) => {
      state.launched = await request.json();
      return HttpResponse.json(batchResponse);
    }),
    http.get(`${API_BASE}/Computers/:id/ScriptHistory`, ({ params, request }) => {
      state.historyQueries.push(new URL(request.url).searchParams);
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
  describe('list', () => {
    it('should return the bare array GET /Scripts serves', async () => {
      const client = createClient();
      server.use(
        http.get(`${API_BASE}/Scripts`, () =>
          HttpResponse.json([scriptRow('12', 'Restart Spooler'), scriptRow('13', 'Reboot')])
        )
      );

      const scripts = await client.scripts.list();

      expect(scripts).toHaveLength(2);
      expect(scripts[0]?.Id).toBe('12');
      expect(scripts[0]?.Folder?.Name).toBe('Maintenance');
      expect(scripts[0]?.Parameters).toEqual(['ServiceName=Spooler']);
    });

    it('should send only the query options GET /Scripts defines', async () => {
      const client = createClient();
      let query: URLSearchParams | undefined;
      server.use(
        http.get(`${API_BASE}/Scripts`, ({ request }) => {
          query = new URL(request.url).searchParams;
          return HttpResponse.json([]);
        })
      );

      await client.scripts.list({
        condition: "Name like '%Spooler%'",
        pageSize: 25,
        page: 2,
        orderBy: 'Name asc',
      });

      expect(Object.fromEntries(query?.entries() ?? [])).toEqual({
        condition: "Name like '%Spooler%'",
        pageSize: '25',
        page: '2',
        orderBy: 'Name asc',
      });
    });

    it('should not forward filters the API does not have (name, folderId, scriptType)', async () => {
      const client = createClient();
      let query: URLSearchParams | undefined;
      server.use(
        http.get(`${API_BASE}/Scripts`, ({ request }) => {
          query = new URL(request.url).searchParams;
          return HttpResponse.json([]);
        })
      );

      // These used to be accepted and silently ignored by Automate. They are
      // no longer part of ScriptListParams; smuggle them in to prove they are
      // dropped rather than passed through.
      await client.scripts.list({
        name: 'Spooler',
        folderId: 3,
        scriptType: 'Script',
        pageSize: 10,
      } as unknown as ScriptListParams);

      expect(Object.fromEntries(query?.entries() ?? [])).toEqual({ pageSize: '10' });
    });
  });

  describe('get', () => {
    it('should read a script from API v1 GET /Scripts/{id}, the route live instances serve', async () => {
      const client = createClient();
      let hit: string | undefined;
      server.use(
        http.get(`${API_BASE}/Scripts/:id`, ({ params, request }) => {
          hit = request.url;
          return HttpResponse.json({
            Id: String(params['id']),
            Name: 'Restart Spooler',
            Folder: { Id: '3', Name: 'Maintenance' },
            Parameters: ['ServiceName'],
          });
        })
      );

      const script = await client.scripts.get(42);

      expect(script.Id).toBe('42');
      expect(script.Folder?.Id).toBe('3');
      expect(hit).toBe(`${API_BASE}/Scripts/42`);
    });

    it('getDetail should read script detail from API v2, the only route with steps', async () => {
      const client = createClient();
      let query: URLSearchParams | undefined;
      server.use(
        http.get(`${API_V2_BASE}/Scripts/:id`, ({ params, request }) => {
          query = new URL(request.url).searchParams;
          return HttpResponse.json({
            ScriptId: Number(params['id']),
            Name: 'Restart Spooler',
            Description: 'Restarts the print spooler',
            Folder: { ScriptFolderId: 3, Name: 'Maintenance' },
            Parameters: ['ServiceName'],
            ScriptOptions: { IsFunctionScript: false, IsMaintenanceScript: false },
            Steps: [{ IsEnabled: true, Function: { ScriptFunctionId: 70 } }],
          });
        })
      );

      const script = await client.scripts.getDetail(42, { includeSteps: true });

      expect(script.ScriptId).toBe(42);
      expect(script.Folder?.ScriptFolderId).toBe(3);
      expect(script.Steps?.[0]?.Function?.ScriptFunctionId).toBe(70);
      expect(query?.get('includeSteps')).toBe('true');
    });

    it('should surface a 404 as ConnectWiseAutomateNotFoundError', async () => {
      const client = createClient();
      server.use(
        http.get(`${API_BASE}/Scripts/:id`, () =>
          HttpResponse.json({ Message: 'Script not found' }, { status: 404 })
        )
      );

      await expect(client.scripts.get(999)).rejects.toBeInstanceOf(
        ConnectWiseAutomateNotFoundError
      );
    });
  });

  describe('scheduleForComputer', () => {
    it('should POST a LabTech.Models.ScheduledScript to /Computers/{id}/ScheduledScripts', async () => {
      const client = createClient();
      let body: unknown;
      server.use(
        http.post(`${API_BASE}/Computers/:id/ScheduledScripts`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            Id: 5001,
            ScriptId: 42,
            ComputerId: 7,
            Parameters: 'ServiceName=Spooler',
            Priority: 2,
            SkipOffline: true,
            User: 'integrator',
          });
        })
      );

      const schedule = await client.scripts.scheduleForComputer(7, {
        ScriptId: 42,
        Parameters: 'ServiceName=Spooler',
        Priority: 2,
        SkipOffline: true,
      });

      expect(body).toEqual({
        ScriptId: 42,
        ComputerId: 7,
        Parameters: 'ServiceName=Spooler',
        Priority: 2,
        SkipOffline: true,
      });
      expect(schedule.Id).toBe(5001);
    });
  });

  describe('runningOnComputer / historyForComputer', () => {
    it('should read the bare array from /Computers/{id}/RunningScripts', async () => {
      const client = createClient();
      server.use(
        http.get(`${API_BASE}/Computers/:id/RunningScripts`, () =>
          HttpResponse.json([
            { Id: 9, ScriptId: 42, ComputerId: 7, Name: 'Restart Spooler', Status: 'Running', StartDate: '2024-01-15T10:34:00Z' },
          ])
        )
      );

      const running = await client.scripts.runningOnComputer(7);

      expect(running[0]?.Status).toBe('Running');
      expect(running[0]?.ScriptId).toBe(42);
    });

    it('should pass list options through to /Computers/{id}/ScriptHistory', async () => {
      const client = createClient();
      let query: URLSearchParams | undefined;
      server.use(
        http.get(`${API_BASE}/Computers/:id/ScriptHistory`, ({ request }) => {
          query = new URL(request.url).searchParams;
          return HttpResponse.json([historyRow(1, 42, { State: 'Information' })]);
        })
      );

      const history = await client.scripts.historyForComputer(7, { pageSize: 5 });

      expect(query?.get('pageSize')).toBe('5');
      expect(history[0]?.State).toBe('Information');
    });
  });

  describe('executeBatch', () => {
    it('should default the entity type to Computer and pass the spec body through', async () => {
      const client = createClient();
      const state = mockRun({});

      await client.scripts.executeBatch({
        EntityIds: [1, 2],
        ScriptId: 42,
        Parameters: [{ Key: 'ServiceName', Value: 'Spooler' }],
        OfflineActionFlags: { SkipsOfflineAgents: true },
        Priority: 2,
      });

      expect(state.launched).toEqual({
        EntityType: 'Computer',
        EntityIds: [1, 2],
        ScriptId: 42,
        Parameters: [{ Key: 'ServiceName', Value: 'Spooler' }],
        OfflineActionFlags: { SkipsOfflineAgents: true },
        Priority: 2,
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

    it('should fetch history newest-first and bounded, for the baseline and every poll', async () => {
      const client = createClient();
      const state = mockRun({ 1: [[], [historyRow(1001, 42)]] });

      await client.scripts.runAndWait(
        [1],
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      // The spec defines neither a default sort nor a default page size for
      // ScriptHistory, so the baseline approach is only sound if we ask for
      // the newest rows explicitly and read the same window every time.
      expect(state.historyQueries.length).toBeGreaterThanOrEqual(2);
      for (const query of state.historyQueries) {
        expect(query.get('orderBy')).toBe('HistoryDate desc');
        expect(query.get('pageSize')).toBe('100');
      }
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
          [historyRow(1003, 42), stale], // our run lands (newest first)
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
          [historyRow(1005, 42), historyRow(1004, 99)],
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

    it('should trust ContainsUnsuccessfulResults=false over an unexpected ResultStatus', async () => {
      const client = createClient();
      // The spec types ResultStatus as a bare int32 with no enum, so the
      // "0 means accepted" reading is an assumption. ContainsUnsuccessfulResults
      // IS spec-defined; when the server says nothing failed, believe it.
      mockRun(
        { 1: [[], [historyRow(1007, 42)]] },
        {
          ScriptResults: [{ EntityId: 1, ResultDetails: { ResultStatus: 1, ReasonCode: 0 } }],
          ContainsUnsuccessfulResults: false,
        }
      );

      const [result] = await client.scripts.runAndWait(
        [1],
        { ScriptId: 42 },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result?.launched).toBe(true);
      expect(result?.completed).toBe(true);
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
    it('should read the LabTech.Models.ScriptFolder array from /ScriptFolders', async () => {
      const client = createClient();
      server.use(
        http.get(`${API_BASE}/ScriptFolders`, () =>
          HttpResponse.json([
            {
              Id: '3',
              ParentId: '0',
              Name: 'Maintenance',
              GUID: 'f0ld3r',
              SubFolders: [{ Id: '7', ParentId: '3', Name: 'Printers' }],
            },
          ])
        )
      );

      const folders = await client.scripts.folders();

      expect(folders[0]?.Id).toBe('3');
      expect(folders[0]?.Name).toBe('Maintenance');
      expect(folders[0]?.SubFolders?.[0]?.Name).toBe('Printers');
    });

    it('should read a single folder from /ScriptFolders/{entityId}', async () => {
      const client = createClient();
      server.use(
        http.get(`${API_BASE}/ScriptFolders/:id`, ({ params }) =>
          HttpResponse.json({ Id: String(params['id']), ParentId: '0', Name: 'Maintenance' })
        )
      );

      const folder = await client.scripts.getFolder(3);

      expect(folder.Id).toBe('3');
    });
  });
});
