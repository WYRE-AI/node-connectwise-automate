/**
 * Computer (Agent) types for ConnectWise Automate
 */

import type { BaseEntity, BaseListParams, ExtraDataField, LocationInfo } from './common.js';

/**
 * Computer entity (an agent/endpoint)
 */
export interface Computer extends BaseEntity {
  /** Computer name */
  ComputerName: string;
  /** Client ID */
  ClientId: number;
  /** Client name */
  Client?: {
    Id: number;
    Name: string;
  };
  /** Location ID */
  LocationId: number;
  /** Location info */
  Location?: LocationInfo;
  /** Domain name */
  Domain?: string;
  /** Username of last logged in user */
  LastUserName?: string;
  /** Operating system */
  OS?: string;
  /** OS version */
  OSVersion?: string;
  /** Service pack */
  ServicePack?: string;
  /** Computer type */
  Type?: string;
  /** BIOS manufacturer */
  BiosManufacturer?: string;
  /** BIOS name */
  BiosName?: string;
  /** BIOS version */
  BiosVersion?: string;
  /** Serial number */
  SerialNumber?: string;
  /** Computer model */
  Model?: string;
  /** Manufacturer */
  Manufacturer?: string;
  /** Total memory in MB */
  TotalMemory?: number;
  /** Total disk space in GB */
  TotalDiskSpace?: number;
  /** Free disk space in GB */
  FreeDiskSpace?: number;
  /** IP address */
  LocalIPAddress?: string;
  /** MAC address */
  MacAddress?: string;
  /** External IP address */
  ExternalIPAddress?: string;
  /** Is online */
  IsOnline?: boolean;
  /** Last contact time */
  LastContact?: string;
  /** Last heartbeat time */
  LastHeartbeat?: string;
  /** Date added */
  DateAdded?: string;
  /** Agent version */
  AgentVersion?: string;
  /** Network probe status */
  IsNetworkProbe?: boolean;
  /** Is virtualized */
  IsVirtual?: boolean;
  /** Uptime in seconds */
  UptimeSeconds?: number;
  /** Comment/notes */
  Comment?: string;
  /** Asset tag */
  AssetTag?: string;
  /** Extra data fields */
  ExtraDataFields?: ExtraDataField[];
}

/**
 * Computer list parameters
 */
export interface ComputerListParams extends BaseListParams {
  /** Filter by client ID */
  clientId?: number;
  /** Filter by location ID */
  locationId?: number;
  /** Include offline agents */
  includeOffline?: boolean;
  /** Filter by online status */
  isOnline?: boolean;
}

/**
 * Computer list response
 */
export interface ComputerListResponse {
  TotalRecords?: number;
  Data: Computer[];
}

/**
 * Computer creation data
 */
export interface ComputerCreateData {
  ComputerName: string;
  ClientId: number;
  LocationId: number;
  Comment?: string;
  AssetTag?: string;
}

/**
 * Computer update data
 */
export interface ComputerUpdateData {
  ComputerName?: string;
  LocationId?: number;
  Comment?: string;
  AssetTag?: string;
}

/**
 * An entry in Automate's command catalog (`GET /Commands`).
 *
 * Automate commands are a fixed, server-defined catalog addressed by id — they
 * are not arbitrary shell strings. Enumerate this list to discover which
 * commands an instance supports and what parameters each expects.
 */
export interface AutomateCommand {
  /** Command id. Typed as a string by Automate's own schema. */
  Id?: string;
  Name?: string;
  Description?: string;
  Level?: number;
}

/**
 * Request body for `POST /Computers/{id}/Commandexecute`.
 *
 * The command travels as a nested object carrying its catalog id, and
 * `Parameters` is a positional array of strings — not a key/value map. Sending
 * a flat command string leaves every field unbound server-side, which surfaces
 * to the operator as a command that terminates immediately.
 */
export interface ComputerCommandRequest {
  /** Target computer id */
  ComputerId?: number;
  /** The catalog command to run, addressed by id */
  Command: Pick<AutomateCommand, 'Id'>;
  /** Positional parameters for the command */
  Parameters?: string[];
}

/**
 * Response from `POST/GET /Computers/{id}/Commandexecute`.
 *
 * `Status` is free-form text from the server — Automate emits values outside
 * any documented set (`Terminated` among them), so it is deliberately not
 * narrowed to a union here.
 */
export interface ComputerCommandExecution {
  Id?: number;
  ComputerId?: number;
  Command?: AutomateCommand;
  Status?: string;
  Parameters?: string[];
  Output?: string;
  Fastalk?: boolean;
  DateLastInventoried?: string;
}

/**
 * Polling behaviour for `ComputersResource.executeCommandAndWait()`.
 */
export interface CommandWaitOptions {
  /** Give up waiting after this many ms (default: 120_000) */
  timeoutMs?: number;
  /** Delay between polls in ms (default: 3_000) */
  pollIntervalMs?: number;
}

/**
 * Terminal outcome of `ComputersResource.executeCommandAndWait()`.
 */
export interface CommandRunResult {
  /** Whether a finished history row was observed before the timeout */
  completed: boolean;
  /** The response from the execute call itself */
  execution: ComputerCommandExecution;
  /** The matched history row, when the command finished */
  history?: CommandHistoryEntry;
  /** Status text, from history when available */
  status?: string;
  /** Command output, when the command finished */
  output?: string;
  /** How long polling ran, in milliseconds */
  waitedMs: number;
}

/**
 * A past command run (`GET /Computers/{id}/Commandhistory`).
 *
 * This is the only surface carrying a command's outcome and output.
 * Note that `Parameters` is a single string here, while the execute endpoint
 * uses a string array — the two representations genuinely differ.
 */
export interface CommandHistoryEntry {
  Id?: number;
  ComputerId?: number;
  DateExecuted?: string;
  CommandId?: number;
  Command?: string;
  Status?: string;
  Output?: string;
  Parameters?: string;
  User?: string;
  DateFinished?: string;
}
