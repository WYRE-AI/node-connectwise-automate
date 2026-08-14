/**
 * Computers resource operations
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import type {
  Computer,
  ComputerListParams,
  ComputerListResponse,
  ComputerCreateData,
  ComputerUpdateData,
  ComputerCommandRequest,
  ComputerCommandExecution,
  CommandHistoryEntry,
  AutomateCommand,
  CommandWaitOptions,
  CommandRunResult,
} from '../types/computers.js';
import type { BaseListParams } from '../types/common.js';
import { buildBaseListParams } from '../params.js';

/** Resolve after `ms` milliseconds. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
   * Create a new computer
   */
  async create(data: ComputerCreateData): Promise<Computer> {
    return this.httpClient.request<Computer>('/Computers', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Update an existing computer
   */
  async update(id: number, data: ComputerUpdateData): Promise<Computer> {
    return this.httpClient.request<Computer>(`/Computers/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  /**
   * Delete a computer
   */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>(`/Computers/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Issue a catalog command to a computer.
   *
   * `command.Command.Id` must be an id from the command catalog (`commands()`);
   * Automate does not accept free-text commands here.
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
   * List commands currently queued or executing on a computer
   */
  async commandExecutions(id: number): Promise<ComputerCommandExecution[]> {
    return this.httpClient.request<ComputerCommandExecution[]>(
      `/Computers/${id}/CommandExecute`
    );
  }

  /**
   * Get past command runs for a computer, including status and output.
   *
   * This is the only place a command's outcome is observable — the execute
   * call itself returns before the agent has done anything.
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
   * Issue a command and poll command history until it finishes.
   *
   * Like scripts, commands are asynchronous with no job handle — the execute
   * call returns before the agent has acted. Correlation is by row identity
   * against a pre-launch baseline, so a previous run of the same command can
   * never be mistaken for this one.
   *
   * Returns with `completed: false` if the timeout elapses; the command keeps
   * running and can be picked up later via `commandHistory`.
   */
  async executeCommandAndWait(
    id: number,
    command: Omit<ComputerCommandRequest, 'ComputerId'>,
    options: CommandWaitOptions = {}
  ): Promise<CommandRunResult> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const pollIntervalMs = options.pollIntervalMs ?? 3_000;

    const seenIds = new Set(
      (await this.commandHistory(id)).map((entry) => entry.Id)
    );

    const execution = await this.executeCommand(id, command);

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      await delay(pollIntervalMs);

      const history = await this.commandHistory(id);
      const match = history.find(
        (entry) => !seenIds.has(entry.Id) && entry.DateFinished !== undefined
      );

      if (match) {
        return {
          completed: true,
          execution,
          history: match,
          status: match.Status,
          output: match.Output,
          waitedMs: Date.now() - startedAt,
        };
      }
    }

    return {
      completed: false,
      execution,
      status: execution.Status,
      waitedMs: Date.now() - startedAt,
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
   * Send a message to a computer (popup)
   */
  async sendMessage(id: number, message: string, title?: string): Promise<void> {
    await this.httpClient.request<void>(`/Computers/${id}/SendMessage`, {
      method: 'POST',
      body: { Message: message, Title: title },
    });
  }

  /**
   * Restart a computer
   */
  async restart(id: number, force?: boolean, delayMinutes?: number): Promise<void> {
    await this.httpClient.request<void>(`/Computers/${id}/Restart`, {
      method: 'POST',
      body: { Force: force, DelayMinutes: delayMinutes },
    });
  }

  /**
   * Shutdown a computer
   */
  async shutdown(id: number, force?: boolean, delayMinutes?: number): Promise<void> {
    await this.httpClient.request<void>(`/Computers/${id}/Shutdown`, {
      method: 'POST',
      body: { Force: force, DelayMinutes: delayMinutes },
    });
  }

  /**
   * Wake up a computer (Wake-on-LAN)
   */
  async wakeUp(id: number): Promise<void> {
    await this.httpClient.request<void>(`/Computers/${id}/WakeUp`, {
      method: 'POST',
    });
  }

  /**
   * Build query parameters from list params
   */
  private buildListParams(params?: ComputerListParams): Record<string, string | number | boolean | undefined> {
    if (!params) return {};

    const result: Record<string, string | number | boolean | undefined> = {};

    if (params.pageSize !== undefined) result['pageSize'] = params.pageSize;
    if (params.page !== undefined) result['page'] = params.page;
    if (params.condition !== undefined) result['condition'] = params.condition;
    if (params.includeFields !== undefined) result['includeFields'] = params.includeFields;
    if (params.orderBy !== undefined) result['orderBy'] = params.orderBy;
    if (params.expand !== undefined) result['expand'] = params.expand;
    if (params.clientId !== undefined) result['clientId'] = params.clientId;
    if (params.locationId !== undefined) result['locationId'] = params.locationId;
    if (params.includeOffline !== undefined) result['includeOffline'] = params.includeOffline;
    if (params.isOnline !== undefined) result['isOnline'] = params.isOnline;

    return result;
  }
}
