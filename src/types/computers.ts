/**
 * Computer (agent) and command types for ConnectWise Automate.
 *
 * Field names follow ConnectWise's Automate swagger: `LabTech.Models.Computer`,
 * `LabTech.Models.Command`, `LabTech.Models.CommandExecute` and
 * `Automate.Api.Domain.Contracts.Compatibility.CommandHistory`.
 */

import type { BaseEntity, BaseListParams, ListResponse } from './common.js';

/**
 * A related entity as Automate embeds it on a computer: id plus display name.
 */
export interface EntityRef {
  Id: number;
  Name?: string;
}

/** A user session on a computer (`LabTech.Models.LoggedInUser`). */
export interface LoggedInUser {
  LoggedInUserName?: string;
  ConsoleId?: number;
}

/**
 * Computer entity (an agent/endpoint), per `LabTech.Models.Computer`.
 *
 * There is no flat `ClientId`/`LocationId`: the owning client and location
 * are nested objects. Online state is the `Status` string, not a boolean.
 */
export interface Computer extends BaseEntity {
  ComputerName: string;
  FriendlyName?: string;
  Client?: EntityRef;
  Location?: EntityRef;
  Contact?: {
    Id: number;
    FirstName?: string;
    LastName?: string;
    Email?: string;
  };
  /** `Online` or `Offline` */
  Status?: string;
  /** `Workstation`, `Server`, ... */
  Type?: string;
  MasterMode?: string;
  OperatingSystemName?: string;
  OperatingSystemVersion?: string;
  DomainName?: string;
  DomainNameServers?: string[];
  Comment?: string;
  CommentPriority?: EntityRef;
  RemoteAgentVersion?: string;
  RemoteAgentLastContact?: string;
  RemoteAgentLastInventory?: string;
  LastInventoryReceived?: string;
  LastHeartbeat?: string;
  LastStartup?: string;
  DateAdded?: string;
  AssetDate?: string;
  AssetTag?: string;
  WarrantyEndDate?: string;
  WindowsUpdateDate?: string;
  AntivirusDefinitionDate?: string;
  VirusScanner?: EntityRef;
  UTCOffset?: number;
  TotalMemory?: number;
  FreeMemory?: number;
  CpuUsage?: number;
  SystemUptime?: number;
  UserIdleTime?: number;
  LocalIPAddress?: string;
  GatewayIPAddress?: string;
  MACAddress?: string;
  OpenPortsTCP?: number[];
  OpenPortsUDP?: number[];
  Bandwidth?: number;
  BandwidthDisplay?: string;
  LoggedInUsers?: LoggedInUser[];
  LastUserName?: string;
  UserAccounts?: string[];
  Groups?: EntityRef[];
  PrimaryContactName?: string;
  SerialNumber?: string;
  BiosManufacturer?: string;
  BiosFlash?: string;
  TempFiles?: string;
  PowerProfiles?: string[];
  CurrentPowerProfile?: string;
  HardwarePorts?: string[];
  IRQ?: number[];
  Address?: number[];
  DMA?: number[];
  CpuScore?: number;
  D3DScore?: number;
  DiskScore?: number;
  GraphicsScore?: number;
  MemoryScore?: number;
  IsFasTalk?: boolean;
  IsMaster?: boolean;
  IsNetworkProbe?: boolean;
  IsHeartbeatEnabled?: boolean;
  IsHeartbeatRunning?: boolean;
  IsMaintenanceModeEnabled?: boolean;
  IsTunnelSupported?: boolean;
  IsVirtualMachine?: boolean;
  IsVirtualHost?: boolean;
  IsLockedDown?: boolean;
  IsSystemAccount?: boolean;
  IsRebootNeeded?: boolean;
  HasIntelVPRO?: boolean;
  HasIntelAMT?: boolean;
  HasHPiLO?: boolean;
}

/**
 * Computer list parameters.
 *
 * `GET /Computers` filters only through `condition`. The convenience fields
 * below are folded into it (`Client.Id = …`, `Location.Id = …`,
 * `Status = 'Online'` / `'Offline'`) and AND-ed with any `condition` given.
 */
export interface ComputerListParams extends BaseListParams {
  /** Only computers belonging to this client */
  clientId?: number;
  /** Only computers at this location */
  locationId?: number;
  /** `true` for online agents only, `false` for offline only; omit for all */
  isOnline?: boolean;
}

/** `GET /Computers` response */
export type ComputerListResponse = ListResponse<Computer>;

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
 * Request body for `POST /Computers/{id}/CommandExecute`
 * (`LabTech.Models.CommandExecute`).
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
  /** Deliver over the FasTalk channel */
  Fastalk?: boolean;
}

/**
 * A command execution row (`POST`/`GET /Computers/{id}/CommandExecute`).
 *
 * The row returned by the execute call is also where the outcome lands:
 * `Status` and `Output` fill in as the agent reports back, and the row can be
 * re-read by `Id` through the `ids` filter on the GET route.
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
 * Outcome of `ComputersResource.executeCommandAndWait()`.
 */
export interface CommandRunResult {
  /** Whether a terminal status was observed before the timeout */
  completed: boolean;
  /** The execution row as last observed */
  execution: ComputerCommandExecution;
  /** Status text of that row */
  status?: string;
  /** Command output, once the agent has reported it */
  output?: string;
  /** How long polling ran, in milliseconds */
  waitedMs: number;
  /**
   * Status polls that still failed with a transient socket error after the
   * transport retries. The execution id is kept either way.
   */
  pollErrors: number;
}

/**
 * A past command run (`GET /Computers/{id}/CommandHistory`).
 *
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
