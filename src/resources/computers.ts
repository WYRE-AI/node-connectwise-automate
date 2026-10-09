/**
 * Computers resource operations
 */

import type { HttpClient } from '../http.js';
import { isTransientNetworkError } from '../network-errors.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import type {
  Computer,
  ComputerListParams,
  ComputerListResponse,
  ComputerCommandRequest,
  ComputerCommandExecution,
  CommandHistoryEntry,
  AutomateCommand,
  CommandWaitOptions,
  CommandRunResult,
} from '../types/computers.js';
import type { BaseListParams } from '../types/common.js';
import { buildBaseListParams, type QueryParams } from '../params.js';

/** Resolve after `ms` milliseconds. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Statuses after which Automate no longer updates a CommandExecute row.
 * `Success` and `Failed` are the documented outcomes; `Terminated` is what the
 * server reports when the agent could not run the command at all.
 */
const TERMINAL_COMMAND_STATUSES = new Set(['success', 'failed', 'terminated']);

function isTerminalCommandStatus(status: string | undefined): boolean {
  return status !== undefined && TERMINAL_COMMAND_STATUSES.has(status.toLowerCase());
}

/**
 * Computers resource operations
 */
export class ComputersResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List computers with optional filtering
   */
  async list(params?: ComputerListParams): Promise<ComputerListResponse> {
    return this.httpClient.request<ComputerListResponse>('/Computers', {
      params: this.buildListParams(params),
    });
  }

  /**
   * List all computers with automatic pagination
   */
  listAll(params?: Omit<ComputerListParams, 'pageSize' | 'page'>): PaginatedIterable<Computer> {
    return createPaginatedIterable<Computer>(
      this.httpClient,
      '/Computers',
      this.buildListParams(params)
    );
  }

  /**
   * Get a single computer by ID
   */
  async get(id: number): Promise<Computer> {
    return this.httpClient.request<Computer>(`/Computers/${id}`);
  }

  /**
   * Issue a catalog command to a computer.
   *
   * `command.Command.Id` must be an id from the command catalog (`commands()`);
   * Automate does not accept free-text commands here. The call returns as soon
   * as the command is queued — see `executeCommandAndWait` for the outcome.
   */
  async executeCommand(
    id: number,
    command: Omit<ComputerCommandRequest, 'ComputerId'>
  ): Promise<ComputerCommandExecution> {
    return this.httpClient.request<ComputerCommandExecution>(
      `/Computers/${id}/CommandExecute`,
      {
        method: 'POST',
        body: { ...command, ComputerId: id },
      }
    );
  }

  /**
   * Read command execution rows for a computer.
   *
   * Pass `ids` to fetch specific executions — this is how a queued command's
   * `Status` and `Output` are read back once the agent has acted.
   */
  async commandExecutions(
    id: number,
    params?: BaseListParams
  ): Promise<ComputerCommandExecution[]> {
    return this.httpClient.request<ComputerCommandExecution[]>(
      `/Computers/${id}/CommandExecute`,
      { params: buildBaseListParams(params) }
    );
  }

  /**
   * Get past command runs for a computer, including status and output.
   */
  async commandHistory(
    id: number,
    params?: BaseListParams
  ): Promise<CommandHistoryEntry[]> {
    return this.httpClient.request<CommandHistoryEntry[]>(
      `/Computers/${id}/CommandHistory`,
      { params: buildBaseListParams(params) }
    );
  }

  /**
   * Issue a command and wait for its outcome.
   *
   * The execute call returns before the agent has acted, but the row it
   * returns is the result surface: `GET /Computers/{id}/CommandExecute` takes
   * an `ids` filter, and that row's `Status` and `Output` fill in as the agent
   * reports back. Polling is keyed on the returned `Id`, so no other run of
   * the same command can be mistaken for this one.
   *
   * Resolves with `completed: false` if the timeout elapses; the command keeps
   * running and its row can be re-read later via `commandExecutions`. The
   * returned `execution.Id` is the id the launch gave back, including when
   * every poll failed.
   *
   * A dropped socket on a status GET is not fatal: those reads are idempotent
   * and are counted in `pollErrors` until the deadline. The launch POST is
   * not retried here — a socket error on it throws, because the command may
   * or may not already be queued.
   */
  async executeCommandAndWait(
    id: number,
    command: Omit<ComputerCommandRequest, 'ComputerId'>,
    options: CommandWaitOptions = {}
  ): Promise<CommandRunResult> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const pollIntervalMs = options.pollIntervalMs ?? 3_000;

    let execution = await this.executeCommand(id, command);
    const executionId = execution.Id;
    const startedAt = Date.now();
    let pollErrors = 0;

    while (
      executionId !== undefined &&
      !isTerminalCommandStatus(execution.Status) &&
      Date.now() - startedAt < timeoutMs
    ) {
      await delay(pollIntervalMs);

      try {
        const rows = await this.commandExecutions(id, { ids: String(executionId) });
        execution = rows.find((row) => row.Id === executionId) ?? execution;
      } catch (error) {
        if (!isTransientNetworkError(error)) {
          throw error;
        }
        // Keep the row from the launch (it carries the execution id) and
        // try again until the deadline. The transport layer has already
        // retried this GET; this counts rounds that still failed.
        pollErrors += 1;
      }
    }

    return {
      completed: isTerminalCommandStatus(execution.Status),
      execution,
      status: execution.Status,
      output: execution.Output,
      waitedMs: Date.now() - startedAt,
      pollErrors,
    };
  }

  /**
   * List the instance's command catalog
   */
  async commands(params?: BaseListParams): Promise<AutomateCommand[]> {
    return this.httpClient.request<AutomateCommand[]>('/Commands', {
      params: buildBaseListParams(params),
    });
  }

  /**
   * Get a single catalog command by id
   */
  async getCommand(commandId: string | number): Promise<AutomateCommand> {
    return this.httpClient.request<AutomateCommand>(`/Commands/${commandId}`);
  }

  /**
   * Build query parameters from list params.
   *
   * `GET /Computers` has no client/location/online query parameters, so the
   * convenience filters become clauses of the `condition` expression.
   */
  private buildListParams(params?: ComputerListParams): QueryParams {
    if (!params) return {};

    const { clientId, locationId, isOnline, ...base } = params;
    const query = buildBaseListParams(base);

    const clauses: string[] = [];
    if (base.condition) clauses.push(base.condition);
    if (clientId !== undefined) clauses.push(`Client.Id = ${clientId}`);
    if (locationId !== undefined) clauses.push(`Location.Id = ${locationId}`);
    if (isOnline !== undefined) clauses.push(`Status = '${isOnline ? 'Online' : 'Offline'}'`);

    if (clauses.length > 1) {
      query['condition'] = clauses.map((clause) => `(${clause})`).join(' and ');
    } else if (clauses.length === 1) {
      query['condition'] = clauses[0];
    }

    return query;
  }
}
