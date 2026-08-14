/**
 * Script types for ConnectWise Automate
 */

import type { BaseEntity, BaseListParams } from './common.js';

/**
 * Script entity
 */
export interface Script extends BaseEntity {
  /** Script name */
  Name: string;
  /** Script description */
  Description?: string;
  /** Script folder/category */
  FolderId?: number;
  /** Folder name */
  FolderName?: string;
  /** Script GUID */
  Guid?: string;
  /** Script type */
  ScriptType?: 'Function' | 'Script' | 'Maintenance';
  /** License type */
  LicenseType?: string;
  /** Parameters definition */
  Parameters?: ScriptParameter[];
  /** Is enabled */
  IsEnabled?: boolean;
  /** Date created */
  DateCreated?: string;
  /** Last modified date */
  DateModified?: string;
  /** Last modified by */
  ModifiedBy?: string;
  /** Version */
  Version?: number;
}

/**
 * Script parameter definition
 */
export interface ScriptParameter {
  /** Parameter name */
  Name: string;
  /** Parameter type */
  Type: 'String' | 'Number' | 'Boolean' | 'ComputerList' | 'ClientList' | 'LocationList';
  /** Default value */
  DefaultValue?: string;
  /** Is required */
  IsRequired?: boolean;
  /** Description */
  Description?: string;
}

/**
 * Script list parameters
 */
export interface ScriptListParams extends BaseListParams {
  /** Filter by folder ID */
  folderId?: number;
  /** Filter by script type */
  scriptType?: 'Function' | 'Script' | 'Maintenance';
  /** Search by name */
  name?: string;
}

/**
 * Script list response
 */
export interface ScriptListResponse {
  TotalRecords?: number;
  Data: Script[];
}

/**
 * Request body for scheduling a script against a computer
 * (`POST /Computers/{id}/Scheduledscripts`).
 *
 * Automate has no synchronous "run script now" endpoint — a run is started by
 * creating a scheduled-script row. Leaving the schedule fields unset makes the
 * script eligible immediately, which is the closest thing to "run now".
 *
 * NOTE: `Parameters` is a single string on this endpoint (Automate's own
 * delimited format), NOT a key/value map and NOT an array. The scripting
 * endpoints use three different parameter encodings; see `ScriptScheduleEntry`.
 */
export interface ScheduleScriptRequest {
  /** Script ID to run */
  ScriptId: number;
  /** Target computer ID */
  ComputerId: number;
  /** Script parameters, in Automate's delimited string format */
  Parameters?: string;
  /** Priority (lower runs sooner) */
  Priority?: number;
  /** Skip the run entirely if the agent is offline at fire time */
  SkipOffline?: boolean;
  /** Send a Wake-on-LAN before running if the agent is offline */
  WakeOffline?: boolean;
  /** Only run when the agent is offline */
  OfflineOnly?: boolean;
  /** Earliest date the schedule is eligible to run */
  EffectiveStartDate?: string;
  /** Latest date the schedule is eligible to run */
  EffectiveEndDate?: string;
}

/**
 * A scheduled-script row, as returned by `/Computers/{id}/Scheduledscripts`.
 */
export interface ScheduledScript extends BaseEntity {
  ScriptId?: number;
  ClientId?: number;
  LocationId?: number;
  ComputerId?: number;
  GroupId?: number;
  Disabled?: boolean;
  EffectiveStartDate?: string;
  EffectiveEndDate?: string;
  NextRun?: string;
  NextSchedule?: string;
  ScheduleType?: number;
  Parameters?: string;
  Priority?: number;
  SkipOffline?: boolean;
  OfflineOnly?: boolean;
  WakeOffline?: boolean;
  User?: string;
  LastUpdate?: string;
}

/**
 * A currently-running script on a computer
 * (`GET /Computers/{id}/Runningscripts`).
 */
export interface RunningScript extends BaseEntity {
  ScriptId?: number;
  ComputerId?: number;
  Name?: string;
  Status?: 'Running' | 'Completed';
  StartDate?: string;
}

/**
 * A completed script run on a computer
 * (`GET /Computers/{id}/Scripthistory`).
 *
 * `State` carries the pass/fail verdict and `DiagnosticMessage` is the only
 * free-text failure reason the Automate API exposes for a script run.
 */
export interface ScriptHistoryEntry extends BaseEntity {
  ScriptId?: number;
  ComputerId?: number;
  Name?: string;
  User?: string;
  Status?: 'Running' | 'Completed';
  State?: 'Failure' | 'Information' | 'Success';
  HistoryDate?: string;
  DiagnosticMessage?: string;
}

/** Entity kinds a batch script run can target. */
export type ScriptTargetEntityType =
  | 'Computer'
  | 'Group'
  | 'Company'
  | 'Site'
  | 'Search'
  | 'NetworkDevice';

/** A script parameter as the batch endpoint expects it. */
export interface ScriptParameterValue {
  Key: string;
  Value: string;
}

/** Controls what happens when a target agent is offline at fire time. */
export interface ScriptOfflineActionFlags {
  SkipsOfflineAgents?: boolean;
  WakesOfflineAgents?: boolean;
  OnlyRunsOnOfflineAgents?: boolean;
}

/**
 * Request body for `POST /Batch/ScriptExecute` — the multi-target script
 * launch. One call covers every target and reports per-target acceptance.
 */
export interface ScriptExecuteBatchRequest {
  /** Kind of entity the ids refer to (default: `Computer`) */
  EntityType?: ScriptTargetEntityType;
  /** Target ids of the given entity type */
  EntityIds: number[];
  /** Script to run */
  ScriptId?: number;
  /** Alternative to ScriptId */
  ScriptGuid?: string;
  /** Script parameters as key/value pairs */
  Parameters?: ScriptParameterValue[];
  /** Offline-agent behaviour */
  OfflineActionFlags?: ScriptOfflineActionFlags;
  /** Priority (lower runs sooner) */
  Priority?: number;
  UseAgentTime?: boolean;
  StartDate?: string;
  ExpireDate?: string;
  IncludeSubGroups?: boolean;
}

/** Per-target outcome of the launch itself (not of the script run). */
export interface ScriptBatchResult {
  EntityId?: number;
  ResultDetails?: {
    ResultStatus?: number;
    ReasonCode?: number;
    Message?: string;
  };
}

/** Response from `POST /Batch/ScriptExecute`. */
export interface ScriptExecuteBatchResponse {
  ScriptResults?: ScriptBatchResult[];
  ContainsUnsuccessfulResults?: boolean;
}

/**
 * Terminal outcome of `ScriptsResource.runAndWait()` for one computer.
 */
export interface ScriptRunResult {
  /** The computer this result belongs to */
  computerId: number;
  /** Whether the launch itself was accepted for this target */
  launched: boolean;
  /** Launch rejection reason, when `launched` is false */
  launchMessage?: string;
  /** Whether a terminal history row was observed before the timeout */
  completed: boolean;
  /** The matched history row, when the run reached a terminal state */
  history?: ScriptHistoryEntry;
  /** Convenience verdict lifted from `history.State` */
  state?: 'Failure' | 'Information' | 'Success';
  /** Free-text reason from Automate, when present */
  diagnosticMessage?: string;
  /** How long polling ran, in milliseconds */
  waitedMs: number;
}

/**
 * Polling behaviour for `ScriptsResource.runAndWait()`.
 */
export interface ScriptRunWaitOptions {
  /** Give up waiting after this many ms (default: 120_000) */
  timeoutMs?: number;
  /** Delay between polls in ms (default: 3_000) */
  pollIntervalMs?: number;
}

/**
 * Script folder
 */
export interface ScriptFolder extends BaseEntity {
  /** Folder name */
  Name: string;
  /** Parent folder ID */
  ParentId?: number;
  /** Script count */
  ScriptCount?: number;
  /** Child folders */
  Children?: ScriptFolder[];
}
