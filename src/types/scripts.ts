/**
 * Script types for ConnectWise Automate.
 *
 * Every shape here is taken from ConnectWise's published OpenAPI spec for the
 * Automate API (Scripts.json, Batch.json, Computers.json). Where the spec's
 * schema name differs from ours it is noted so the two can be diffed.
 */

import type { BaseEntity, BaseListParams } from './common.js';

/**
 * A script folder as the v1 API serves it (`LabTech.Models.ScriptFolder`,
 * from `GET /ScriptFolders` and nested in `Script.Folder`).
 *
 * NOTE: `Id` and `ParentId` are strings on the wire, not numbers.
 */
export interface ScriptFolder {
  Id: string;
  ParentId?: string;
  Name: string;
  GUID?: string;
  SubFolders?: ScriptFolder[];
  ParentFolder?: ScriptFolder;
}

/** `LabTech.Models.ScriptMetadata` */
export interface ScriptMetadata {
  ExtraDataFields?: string;
  Parameters?: string;
  Globals?: string;
  ScriptVersion?: number;
  ScriptGuid?: string;
}

/** `LabTech.Models.ScriptStep` — one raw step of a v1 script body. */
export interface ScriptStep {
  ScriptSection?: number;
  FunctionId?: number;
  Param1?: string;
  Param2?: string;
  Param3?: string;
  Param4?: string;
  Param5?: string;
  Sort?: number;
  Continue?: number;
  OsLimit?: number;
  Indentation?: number;
}

/** `LabTech.Models.ScriptData` */
export interface ScriptData {
  ScriptMetadata?: ScriptMetadata;
  ScriptSteps?: ScriptStep[];
}

/**
 * A script as `GET /Scripts` lists it (`LabTech.Models.Script`).
 *
 * NOTE: `Id` is a string on the wire, not a number. The script's kind is
 * expressed as a set of `Is*Script` flags rather than a type enum, and
 * `Parameters` is the raw list of parameter definitions as strings.
 */
export interface Script {
  Id: string;
  Folder?: ScriptFolder;
  Name: string;
  Comments?: string;
  IsComputerScript?: boolean;
  IsLocationScript?: boolean;
  IsMaintenanceScript?: boolean;
  IsFunctionScript?: boolean;
  IsOffline?: boolean;
  IgnoreForMobileDevices?: boolean;
  IsPublicSharable?: boolean;
  IsUserResponse?: boolean;
  IsSystemScript?: boolean;
  IsMobileDeviceScript?: boolean;
  IsNetworkDeviceScript?: boolean;
  IsContactScript?: boolean;
  Version?: number;
  GUID?: string;
  Parameters?: string[];
  EditPermission?: number[];
  Permission?: number[];
  AutomationTime?: number;
  UpdateDate?: string;
  UpdatedBy?: string;
  FullFolderPath?: string;
  ScriptData?: ScriptData;
}

/**
 * Query options for `GET /Scripts`.
 *
 * The spec defines no script-specific filters — only the generic list
 * options. To filter by name or folder use `condition`, e.g.
 * `Name like '%Spooler%'`.
 */
export type ScriptListParams = BaseListParams;

/** `Automate.Api.Domain.Contracts.Scripts.ScriptFolder` (v2 shape). */
export interface ScriptDetailFolder {
  ScriptFolderId?: number;
  Name?: string;
  ChildFolders?: ScriptDetailFolder[];
}

/** `Automate.Api.Domain.Contracts.Scripts.ScriptStep` (v2 shape). */
export interface ScriptDetailStep {
  OperatingSystem?: number;
  IsEnabled?: boolean;
  ShouldContinueOnFailure?: boolean;
  IndentationLevel?: number;
  Function?: { ScriptFunctionId?: number };
}

/** A category/technician choice on a script's ticket or time settings. */
interface OverridableChoice {
  Name?: string;
  IsOverridden?: boolean;
  CustomValue?: string;
}

/** `Automate.Api.Domain.Contracts.Scripts.Settings.TicketEntrySettings` */
export interface ScriptTicketEntrySettings {
  TicketSubject?: string;
  TicketRequestor?: string;
  TicketCategory?: OverridableChoice & { TicketCategoryId?: number };
  CloseTicketTrigger?: { CloseTicketTriggerTypeId?: number; Name?: string };
}

/** `Automate.Api.Domain.Contracts.Scripts.Settings.TimeEntrySettings` */
export interface ScriptTimeEntrySettings {
  TicketId?: string;
  MinutesToLog?: string;
  TimeCategory?: OverridableChoice & { TimeCategoryId?: number };
  StopTimerTrigger?: { StopTimerTriggerTypeId?: number; Name?: string };
  Notes?: string;
  Technician?: OverridableChoice & { UserId?: number };
}

/**
 * Script detail as `GET /api/v2/Scripts/{scriptId}` returns it
 * (`Automate.Api.Domain.Contracts.Scripts.Script`).
 *
 * This is a different contract from the v1 list row (`Script`): the key is
 * a numeric `ScriptId`, the kind flags live under `ScriptOptions`, and the
 * step list is only populated when the request asks for `includeSteps`.
 */
export interface ScriptDetail {
  ScriptId: number;
  Name?: string;
  Description?: string;
  Folder?: ScriptDetailFolder;
  Parameters?: string[];
  GlobalVariables?: Record<string, string>;
  Steps?: ScriptDetailStep[];
  ScriptTargetType?: { ScriptTargetTypeId?: number; Name?: string };
  ScriptOptions?: {
    IsIsolatedScript?: boolean;
    IsMaintenanceScript?: boolean;
    IsFunctionScript?: boolean;
    IsOfflineScript?: boolean;
    IsSystemScript?: boolean;
  };
  AutomationMinutes?: number;
  IsProtected?: boolean;
  UsesEnhancedLogging?: boolean;
  TicketEntrySettings?: ScriptTicketEntrySettings;
  TimeEntrySettings?: ScriptTimeEntrySettings;
  UserClassAccessSettings?: Array<{
    UserClassId?: number;
    Name?: string;
    CanExecute?: boolean;
    CanEdit?: boolean;
  }>;
}

/**
 * A scheduled-script row (`LabTech.Models.ScheduledScript`), as returned by
 * `GET/POST /Computers/{id}/ScheduledScripts`.
 */
export interface ScheduledScript extends BaseEntity {
  ScriptId?: number;
  ClientId?: number;
  LocationId?: number;
  ComputerId?: number;
  GroupId?: number;
  IncludeSubgroups?: boolean;
  SearchId?: number;
  Disabled?: boolean;
  EffectiveStartDate?: string;
  EffectiveEndDate?: string;
  EffectiveOccurrences?: number;
  DistributionWindowType?: number;
  DistributionWindowAmount?: number;
  NextRun?: string;
  NextSchedule?: string;
  ScheduleType?: number;
  ExcludeTimeStart?: string;
  ExcludeTimeEnd?: string;
  Interval?: number;
  ScheduleWeekOfMonth?: number;
  ScheduleDayOfWeek?: number;
  RepeatType?: number;
  RepeatAmount?: number;
  RepeatStopAfter?: number;
  SkipOffline?: boolean;
  OfflineOnly?: boolean;
  WakeOffline?: boolean;
  WakeScript?: boolean;
  DisableTimeZone?: boolean;
  RunScriptOnProbe?: boolean;
  /** Script parameters, in Automate's delimited string format */
  Parameters?: string;
  Priority?: number;
  TimeZoneAdd?: number;
  User?: string;
  LastUpdate?: string;
}

/**
 * Request body for `POST /Computers/{id}/ScheduledScripts`. The spec takes
 * the full `LabTech.Models.ScheduledScript`; everything but the script and
 * target is optional. Leaving the schedule fields unset makes the script
 * eligible immediately, which is the closest thing to "run now" on this
 * route.
 *
 * NOTE: `Parameters` is a single delimited string here, unlike the batch
 * route which takes `{ Key, Value }` pairs.
 */
export type ScheduleScriptRequest = Partial<Omit<ScheduledScript, 'Id'>> & {
  ScriptId: number;
  ComputerId: number;
};

/** Lifecycle of a script run as Automate reports it. */
export type ScriptRunStatus = 'Running' | 'Completed';

/** Verdict of a finished script run. */
export type ScriptRunState = 'Failure' | 'Information' | 'Success';

/**
 * A currently-running script on a computer
 * (`LabTech.Models.ComputerRunningScript`, `GET /Computers/{id}/RunningScripts`).
 */
export interface RunningScript extends BaseEntity {
  ScriptId?: number;
  ComputerId?: number;
  Name?: string;
  Status?: ScriptRunStatus;
  StartDate?: string;
}

/**
 * A script-run history row for a computer
 * (`LabTech.Models.ComputerScriptHistory`, `GET /Computers/{id}/ScriptHistory`).
 *
 * `State` carries the pass/fail verdict and `DiagnosticMessage` is the only
 * free-text failure reason the Automate API exposes for a script run. `Id`
 * is the row's own identity; the spec ties it to nothing else (not to a
 * schedule, batch call, or running-script instance).
 */
export interface ScriptHistoryEntry extends BaseEntity {
  ScriptId?: number;
  ComputerId?: number;
  Name?: string;
  User?: string;
  Status?: ScriptRunStatus;
  State?: ScriptRunState;
  HistoryDate?: string;
  DiagnosticMessage?: string;
}

/**
 * Entity kinds a batch script run can target. This is Automate's generic
 * entity enum as the spec declares it on `ScheduleScriptBatchRequest`; only a
 * handful (Computer, Group, Site, Company, Search, NetworkDevice) make sense
 * as script targets.
 */
export type ScriptTargetEntityType =
  | 'System'
  | 'Computer'
  | 'Site'
  | 'Company'
  | 'Probe'
  | 'NetworkDevice'
  | 'Ticket'
  | 'Group'
  | 'MobileDevice'
  | 'Vendor'
  | 'VendorProduct'
  | 'Possibility'
  | 'Opportunity'
  | 'Contact'
  | 'User'
  | 'Script'
  | 'Plugin'
  | 'Service'
  | 'ServiceBundle'
  | 'Search'
  | 'SearchFolder'
  | 'Dataview'
  | 'DataviewFolder'
  | 'UserFolder'
  | 'UserClass'
  | 'ScriptFolder'
  | 'RemoteMonitorTemplate'
  | 'ExtraField';

/** A script parameter as the batch endpoint expects it (`KeyValuePair<string,string>`). */
export interface ScriptParameterValue {
  Key: string;
  Value: string;
}

/**
 * Controls what happens when a target agent is offline at fire time
 * (`Automate.Api.Domain.Contracts.Scripts.ScheduledScriptOfflineActionFlags`).
 */
export interface ScriptOfflineActionFlags {
  SkipsOfflineAgents?: boolean;
  WakesOfflineAgents?: boolean;
  OnlyRunsOnOfflineAgents?: boolean;
}

/**
 * Request body for `POST /Batch/ScriptExecute`
 * (`Automate.Api.Domain.Contracts.BatchScripts.ScheduleScriptBatchRequest`) —
 * the multi-target script launch. One call covers every target and reports
 * per-target acceptance.
 *
 * The spec also accepts `Schedule` and `DistributionWindow` (recurrence
 * settings shared with `POST /Batch/ScriptSchedule`); they are not modelled
 * here.
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
  /** Priority — a bare int32 in the spec; its scale is not documented */
  Priority?: number;
  UseAgentTime?: boolean;
  StartDate?: string;
  ExpireDate?: string;
  IncludeSubGroups?: boolean;
}

/**
 * Per-target outcome of the launch itself, not of the script run
 * (`ScheduleScriptBatchResult` + `ResponseResult`). `ResultStatus` and
 * `ReasonCode` are bare int32s in the spec with no enum; the only
 * spec-defined success signal is the response's `ContainsUnsuccessfulResults`.
 */
export interface ScriptBatchResult {
  EntityId?: number;
  ResultDetails?: {
    ResultStatus?: number;
    ReasonCode?: number;
    Message?: string;
  };
}

/** Response from `POST /Batch/ScriptExecute` (`ScheduleScriptBatchResponse`). */
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
  state?: ScriptRunState;
  /** Free-text reason from Automate, when present */
  diagnosticMessage?: string;
  /** How long polling ran, in milliseconds */
  waitedMs: number;
  /**
   * History polls that still failed with a transient socket error after the
   * transport retries. A timeout still reports this target.
   */
  pollErrors: number;
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
