/**
 * Scripts resource operations
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import type { BaseListParams } from '../types/common.js';
import { normalizeListResponse } from '../types/common.js';
import { buildBaseListParams } from '../params.js';
import type {
  Script,
  ScriptListParams,
  ScriptListResponse,
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
 * Scripts resource operations
 */
export class ScriptsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List scripts with optional filtering
   */
  async list(params?: ScriptListParams): Promise<ScriptListResponse> {
    const response = await this.httpClient.request<ScriptListResponse | Script[]>('/Scripts', {
      params: this.buildListParams(params),
    });
    return normalizeListResponse(response);
  }

  /**
   * List all scripts with automatic pagination
   */
  listAll(params?: Omit<ScriptListParams, 'pageSize' | 'page'>): PaginatedIterable<Script> {
    return createPaginatedIterable<Script>(
      this.httpClient,
      '/Scripts',
      this.buildListParams(params)
    );
  }

  /**
   * Get a single script by ID
   */
  async get(id: number): Promise<Script> {
    return this.httpClient.request<Script>(`/Scripts/${id}`);
  }

  /**
   * Start a script on a computer by creating a scheduled-script row.
   *
   * Automate exposes no synchronous "run now" route; scheduling with no
   * schedule constraints is how a run is triggered. The returned row's `Id` is
   * the schedule id, NOT a run/job id — Automate has no job handle, so results
   * are correlated through script history (see `runAndWait`).
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
   * Launch a script against many targets in one call.
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
   */
  async runningOnComputer(computerId: number): Promise<RunningScript[]> {
    return this.httpClient.request<RunningScript[]>(
      `/Computers/${computerId}/RunningScripts`
    );
  }

  /**
   * Get completed script-run history for a computer.
   *
   * This is where a run's verdict (`State`) and failure reason
   * (`DiagnosticMessage`) live — there is no other result surface.
   */
  async historyForComputer(
    computerId: number,
    params?: BaseListParams
  ): Promise<ScriptHistoryEntry[]> {
    return this.httpClient.request<ScriptHistoryEntry[]>(
      `/Computers/${computerId}/ScriptHistory`,
      { params: this.buildListParams(params) }
    );
  }

  /**
   * Run a script on one or more computers and poll until each finishes.
   *
   * Automate has no synchronous run and hands back no job id, so the outcome
   * has to be recovered from script history. Correlation is by row identity
   * against a pre-launch baseline: only a history row absent from that
   * baseline, matching this script, and marked `Completed` counts as this
   * run's result. Timestamps are deliberately not used — that would be at the
   * mercy of clock skew between this process and the Automate server.
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

    // Baseline every target's history before launching, so a run that was
    // already in flight can never be mistaken for the one we start here.
    const baselines = new Map<number, Set<number | undefined>>();
    await Promise.all(
      computerIds.map(async (computerId) => {
        const history = await this.historyForComputer(computerId);
        baselines.set(computerId, new Set(history.map((entry) => entry.Id)));
      })
    );

    const batch = await this.executeBatch({ ...request, EntityIds: computerIds });
    const launchByEntity = new Map(
      (batch.ScriptResults ?? []).map((result) => [result.EntityId, result])
    );

    const startedAt = Date.now();

    return Promise.all(
      computerIds.map(async (computerId) => {
        const launch = launchByEntity.get(computerId);
        // ResultStatus is only meaningful when the server reported on this
        // target; absence of a row is treated as accepted, since older
        // instances answer the batch call without a per-entity breakdown.
        const launched =
          launch === undefined || (launch.ResultDetails?.ResultStatus ?? 0) === 0;

        if (!launched) {
          return {
            computerId,
            launched: false,
            launchMessage: launch?.ResultDetails?.Message,
            completed: false,
            waitedMs: 0,
          };
        }

        const seen = baselines.get(computerId) ?? new Set();

        while (Date.now() - startedAt < timeoutMs) {
          await delay(pollIntervalMs);

          const history = await this.historyForComputer(computerId);
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
   * List script folders
   */
  async folders(): Promise<ScriptFolder[]> {
    return this.httpClient.request<ScriptFolder[]>('/ScriptFolders');
  }

  /**
   * Get a single folder by ID
   */
  async getFolder(id: number): Promise<ScriptFolder> {
    return this.httpClient.request<ScriptFolder>(`/ScriptFolders/${id}`);
  }

  /**
   * Build query parameters from list params
   */
  private buildListParams(
    params?: ScriptListParams | BaseListParams
  ): Record<string, string | number | boolean | undefined> {
    if (!params) return {};

    const result: Record<string, string | number | boolean | undefined> = {
      ...buildBaseListParams(params),
    };

    if ('folderId' in params && params.folderId !== undefined) {
      result['folderId'] = params.folderId;
    }
    if ('scriptType' in params && params.scriptType !== undefined) {
      result['scriptType'] = params.scriptType;
    }
    if ('name' in params && params.name !== undefined) {
      result['name'] = params.name;
    }

    return result;
  }
}
