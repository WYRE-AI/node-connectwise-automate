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
  ScriptListParams,
  ScriptListResponse,
  ScriptFolder,
  ScheduleScriptRequest,
  ScheduledScript,
  RunningScript,
  ScriptHistoryEntry,
  ScriptRunResult,
  ScriptRunWaitOptions,
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
    return this.httpClient.request<ScriptListResponse>('/Scripts', {
      params: this.buildListParams(params),
    });
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
      `/Computers/${computerId}/Scheduledscripts`,
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
      `/Computers/${computerId}/Scheduledscripts`
    );
  }

  /**
   * List scripts currently running on a computer
   */
  async runningOnComputer(computerId: number): Promise<RunningScript[]> {
    return this.httpClient.request<RunningScript[]>(
      `/Computers/${computerId}/Runningscripts`
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
      `/Computers/${computerId}/Scripthistory`,
      { params: this.buildListParams(params) }
    );
  }

  /**
   * Run a script on a computer and poll until it reaches a terminal state.
   *
   * Correlation is by row identity, not timestamps: the history rows present
   * before launch are captured as a baseline, and only a row absent from that
   * baseline (and matching this script + computer) is accepted as this run's
   * result. That avoids both clock-skew between client and server and the
   * false match you would get if the same script were already running.
   *
   * Returns with `completed: false` if the timeout elapses first — the script
   * keeps running server-side; poll `historyForComputer` to pick it up later.
   */
  async runAndWait(
    computerId: number,
    request: Omit<ScheduleScriptRequest, 'ComputerId'>,
    options: ScriptRunWaitOptions = {}
  ): Promise<ScriptRunResult> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const pollIntervalMs = options.pollIntervalMs ?? 3_000;

    // Baseline the existing history so a pre-existing run can never be
    // mistaken for the one we are about to start.
    const seenHistoryIds = new Set(
      (await this.historyForComputer(computerId)).map((entry) => entry.Id)
    );

    const schedule = await this.scheduleForComputer(computerId, request);

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      await delay(pollIntervalMs);

      const history = await this.historyForComputer(computerId);
      const match = history.find(
        (entry) =>
          !seenHistoryIds.has(entry.Id) &&
          entry.ScriptId === request.ScriptId &&
          entry.Status === 'Completed'
      );

      if (match) {
        return {
          completed: true,
          schedule,
          history: match,
          state: match.State,
          diagnosticMessage: match.DiagnosticMessage,
          waitedMs: Date.now() - startedAt,
        };
      }
    }

    return {
      completed: false,
      schedule,
      waitedMs: Date.now() - startedAt,
    };
  }

  /**
   * List script folders
   */
  async folders(): Promise<ScriptFolder[]> {
    return this.httpClient.request<ScriptFolder[]>('/Scriptfolders');
  }

  /**
   * Get a single folder by ID
   */
  async getFolder(id: number): Promise<ScriptFolder> {
    return this.httpClient.request<ScriptFolder>(`/Scriptfolders/${id}`);
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
