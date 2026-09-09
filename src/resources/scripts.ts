/**
 * Scripts resource operations
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import type { BaseListParams } from '../types/common.js';
import { buildBaseListParams } from '../params.js';
import type {
  Script,
  ScriptDetail,
  ScriptListParams,
  ScriptFolder,
  ScheduleScriptRequest,
  ScheduledScript,
  RunningScript,
  ScriptHistoryEntry,
  ScriptRunResult,
  ScriptRunWaitOptions,
  ScriptExecuteBatchRequest,
  ScriptExecuteBatchResponse,
} from '../types/scripts.js';

/** Resolve after `ms` milliseconds. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * How many of a computer's newest history rows `runAndWait` reads per poll.
 * The spec defines no default sort or page size for ScriptHistory, so the
 * window is pinned explicitly (see `runAndWait`).
 */
const HISTORY_WINDOW: BaseListParams = { orderBy: 'HistoryDate desc', pageSize: 100 };

/**
 * Scripts resource operations
 */
export class ScriptsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List scripts (`GET /Scripts`). Returns the bare array Automate serves.
   *
   * There are no script-specific filters; use `condition` (for example
   * `Name like '%Spooler%'`) to narrow the result.
   */
  async list(params?: ScriptListParams): Promise<Script[]> {
    return this.httpClient.request<Script[]>('/Scripts', {
      params: buildBaseListParams(params),
    });
  }

  /**
   * List all scripts with automatic pagination
   */
  listAll(params?: Omit<ScriptListParams, 'pageSize' | 'page'>): PaginatedIterable<Script> {
    return createPaginatedIterable<Script>(
      this.httpClient,
      '/Scripts',
      buildBaseListParams(params)
    );
  }

  /**
   * Get a single script by id (`GET /Scripts/{id}`).
   *
   * ConnectWise's published v1 spec omits this route, but live instances serve
   * it — and at least one hosted instance (2026-09-09) terminates requests to
   * the v2 equivalent. So this stays on v1; use `getDetail()` for the v2
   * contract when steps are needed.
   */
  async get(id: number): Promise<Script> {
    return this.httpClient.request<Script>(`/Scripts/${id}`);
  }

  /**
   * Get script detail from API v2 (`GET /api/v2/Scripts/{scriptId}`), the only
   * route that exposes steps. Prefer `get()` unless those fields are needed —
   * not every hosted instance serves v2.
   */
  async getDetail(id: number, options: { includeSteps?: boolean } = {}): Promise<ScriptDetail> {
    return this.httpClient.request<ScriptDetail>(`/Scripts/${id}`, {
      apiVersion: 'v2',
      params: { includeSteps: options.includeSteps },
    });
  }

  /**
   * Start a script on a computer by creating a scheduled-script row
   * (`POST /Computers/{id}/ScheduledScripts`).
   *
   * The returned row's `Id` is the schedule id, NOT a run/job id — Automate
   * has no job handle, so results are correlated through script history (see
   * `runAndWait`).
   */
  async scheduleForComputer(
    computerId: number,
    request: Omit<ScheduleScriptRequest, 'ComputerId'>
  ): Promise<ScheduledScript> {
    return this.httpClient.request<ScheduledScript>(
      `/Computers/${computerId}/ScheduledScripts`,
      {
        method: 'POST',
        body: { ...request, ComputerId: computerId },
      }
    );
  }

  /**
   * List scheduled scripts for a computer
   */
  async schedulesForComputer(computerId: number): Promise<ScheduledScript[]> {
    return this.httpClient.request<ScheduledScript[]>(
      `/Computers/${computerId}/ScheduledScripts`
    );
  }

  /**
   * Launch a script against many targets in one call
   * (`POST /Batch/ScriptExecute`).
   *
   * Unlike the per-computer schedule route, this reports per-target acceptance
   * so a target that was rejected outright (permissions, unknown id) is
   * distinguishable from one whose script simply hasn't finished yet.
   */
  async executeBatch(
    request: ScriptExecuteBatchRequest
  ): Promise<ScriptExecuteBatchResponse> {
    return this.httpClient.request<ScriptExecuteBatchResponse>(
      '/Batch/ScriptExecute',
      {
        method: 'POST',
        body: { EntityType: 'Computer', ...request },
      }
    );
  }

  /**
   * List scripts currently running on a computer
   * (`GET /Computers/{id}/RunningScripts`).
   */
  async runningOnComputer(computerId: number): Promise<RunningScript[]> {
    return this.httpClient.request<RunningScript[]>(
      `/Computers/${computerId}/RunningScripts`
    );
  }

  /**
   * Get script-run history for a computer (`GET /Computers/{id}/ScriptHistory`).
   *
   * This is where a run's verdict (`State`) and failure reason
   * (`DiagnosticMessage`) live — there is no other result surface. Rows are
   * present while a run is still in flight (`Status: 'Running'`).
   */
  async historyForComputer(
    computerId: number,
    params?: BaseListParams
  ): Promise<ScriptHistoryEntry[]> {
    return this.httpClient.request<ScriptHistoryEntry[]>(
      `/Computers/${computerId}/ScriptHistory`,
      { params: buildBaseListParams(params) }
    );
  }

  /**
   * Run a script on one or more computers and poll until each finishes.
   *
   * Automate has no synchronous run and hands back no handle: per the spec,
   * `POST /Batch/ScriptExecute` returns only `{ EntityId, ResultDetails }`
   * per target, and neither `ComputerScriptHistory` nor
   * `ComputerRunningScript` carries a schedule, batch, or instance id that
   * could be matched back to it. So the outcome has to be recovered from
   * script history by row identity against a pre-launch baseline: only a
   * history row absent from that baseline, matching this script, and marked
   * `Completed` counts as this run's result. Timestamps are deliberately not
   * used — that would be at the mercy of clock skew between this process and
   * the Automate server.
   *
   * The spec defines neither a default sort nor a default page size for
   * ScriptHistory, so every fetch (baseline and polls) asks for the newest
   * rows explicitly and reads the same bounded window; the row we are
   * waiting for is by definition the newest.
   *
   * A target whose timeout elapses comes back with `completed: false`; the
   * script is still running server-side and can be picked up later from
   * `historyForComputer`.
   */
  async runAndWait(
    computerIds: number[],
    request: Omit<ScriptExecuteBatchRequest, 'EntityIds'>,
    options: ScriptRunWaitOptions = {}
  ): Promise<ScriptRunResult[]> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const pollIntervalMs = options.pollIntervalMs ?? 3_000;
    const recentHistory = (computerId: number) =>
      this.historyForComputer(computerId, HISTORY_WINDOW);

    // Baseline every target's history before launching, so a run that was
    // already in flight can never be mistaken for the one we start here.
    const baselines = new Map<number, Set<number | undefined>>();
    await Promise.all(
      computerIds.map(async (computerId) => {
        const history = await recentHistory(computerId);
        baselines.set(computerId, new Set(history.map((entry) => entry.Id)));
      })
    );

    const batch = await this.executeBatch({ ...request, EntityIds: computerIds });

    // ResultStatus is a bare int32 in the spec with no documented enum, so
    // "non-zero means refused" is an assumption. Only apply it when the server
    // has said, via the spec-defined ContainsUnsuccessfulResults flag, that
    // something in this batch actually failed. Older instances answer without
    // a per-entity breakdown at all; every target is then treated as accepted.
    const refusals = new Map(
      batch.ContainsUnsuccessfulResults
        ? (batch.ScriptResults ?? [])
            .filter((result) => (result.ResultDetails?.ResultStatus ?? 0) !== 0)
            .map((result) => [result.EntityId, result] as const)
        : []
    );

    const startedAt = Date.now();

    return Promise.all(
      computerIds.map(async (computerId) => {
        const refusal = refusals.get(computerId);
        if (refusal) {
          return {
            computerId,
            launched: false,
            launchMessage: refusal.ResultDetails?.Message,
            completed: false,
            waitedMs: 0,
          };
        }

        const seen = baselines.get(computerId) ?? new Set();

        while (Date.now() - startedAt < timeoutMs) {
          await delay(pollIntervalMs);

          const history = await recentHistory(computerId);
          const match = history.find(
            (entry) =>
              !seen.has(entry.Id) &&
              entry.ScriptId === request.ScriptId &&
              entry.Status === 'Completed'
          );

          if (match) {
            return {
              computerId,
              launched: true,
              completed: true,
              history: match,
              state: match.State,
              diagnosticMessage: match.DiagnosticMessage,
              waitedMs: Date.now() - startedAt,
            };
          }
        }

        return {
          computerId,
          launched: true,
          completed: false,
          waitedMs: Date.now() - startedAt,
        };
      })
    );
  }

  /**
   * List script folders (`GET /ScriptFolders`)
   */
  async folders(): Promise<ScriptFolder[]> {
    return this.httpClient.request<ScriptFolder[]>('/ScriptFolders');
  }

  /**
   * Get a single folder (`GET /ScriptFolders/{entityId}`). Folder ids are
   * strings on the wire; a number is accepted for convenience.
   */
  async getFolder(id: string | number): Promise<ScriptFolder> {
    return this.httpClient.request<ScriptFolder>(`/ScriptFolders/${id}`);
  }
}
