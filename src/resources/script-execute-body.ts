import { ConnectWiseAutomateValidationError } from '../errors.js';
import type {
  ScriptExecuteBatchBody,
  ScriptExecuteBatchRequest,
  ScriptOfflineActionFlags,
  ScriptTargetEntityType,
} from '../types/scripts.js';

/**
 * Web Control Center default Priority on `POST /Batch/ScriptSchedule`
 * (Rick / WMTS capture, WYREAI-573). Still overridable per request.
 */
export const DEFAULT_SCRIPT_PRIORITY = 12;

/**
 * Official swagger leaves ScriptScheduleFrequencyId as an undocumented int32.
 * Control Center sends id 1 for run-once / run-now.
 */
export const SCRIPT_SCHEDULE_FREQUENCY_ONCE = 1;

/**
 * Automate entity-type ordinals for the Batch script routes. Same order as the
 * swagger string enum on `ScheduleScriptBatchRequest` (System=0, Computer=1,
 * …). The web console posts the numeric form (`EntityType: 1` for a computer).
 */
export const SCRIPT_TARGET_ENTITY_TYPE_ORDINAL: {
  [K in ScriptTargetEntityType]: number;
} = {
  System: 0,
  Computer: 1,
  Site: 2,
  Company: 3,
  Probe: 4,
  NetworkDevice: 5,
  Ticket: 6,
  Group: 7,
  MobileDevice: 8,
  Vendor: 9,
  VendorProduct: 10,
  Possibility: 11,
  Opportunity: 12,
  Contact: 13,
  User: 14,
  Script: 15,
  Plugin: 16,
  Service: 17,
  ServiceBundle: 18,
  Search: 19,
  SearchFolder: 20,
  Dataview: 21,
  DataviewFolder: 22,
  UserFolder: 23,
  UserClass: 24,
  ScriptFolder: 25,
  RemoteMonitorTemplate: 26,
  ExtraField: 27,
};

/** Map a public string EntityType to the numeric ordinal the console posts. */
export function toScriptTargetEntityTypeOrdinal(
  type: ScriptTargetEntityType
): number {
  return SCRIPT_TARGET_ENTITY_TYPE_ORDINAL[type];
}

/**
 * Format `date` as ISO-8601 with a numeric UTC offset (no `Z`, no millis),
 * matching Control Center (`2026-11-15T12:46:46-05:00`).
 */
export function formatIsoWithOffset(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

function buildOfflineActionFlags(
  flags: ScriptOfflineActionFlags | undefined
): ScriptExecuteBatchBody['OfflineActionFlags'] {
  const offline: ScriptExecuteBatchBody['OfflineActionFlags'] = {
    // Control Center defaults: skip offline on, wake offline on.
    SkipsOfflineAgents: flags?.SkipsOfflineAgents ?? true,
    WakesOfflineAgents: flags?.WakesOfflineAgents ?? true,
  };
  if (flags?.OnlyRunsOnOfflineAgents !== undefined) {
    offline.OnlyRunsOnOfflineAgents = flags.OnlyRunsOnOfflineAgents;
  }
  return offline;
}

/**
 * Build the wire body for `POST /cwa/api/v1/Batch/ScriptSchedule`.
 *
 * Public request fields stay the historical SDK shape (string EntityType,
 * numeric EntityIds / ScriptId). The console posts numeric EntityType, string
 * EntityIds / ScriptId, Priority 12, run-once Schedule, StartDate with a local
 * offset, and OfflineActionFlags with Skips/Wakes true — a sparse or
 * ScriptExecute-shaped body is what Automate answers with HTTP 500.
 */
export function buildScriptExecuteBatchBody(
  request: ScriptExecuteBatchRequest,
  now: Date = new Date()
): ScriptExecuteBatchBody {
  if (!Array.isArray(request.EntityIds) || request.EntityIds.length === 0 ||
      Array.from(request.EntityIds).some(id => !Number.isInteger(id) || id <= 0)) {
    throw new ConnectWiseAutomateValidationError('EntityIds must be a non-empty array of positive integers');
  }
  if ((request.ScriptId !== undefined) === (request.ScriptGuid !== undefined)) {
    throw new ConnectWiseAutomateValidationError('Exactly one of ScriptId or ScriptGuid is required');
  }
  return {
    EntityType: toScriptTargetEntityTypeOrdinal(request.EntityType ?? 'Computer'),
    EntityIds: request.EntityIds.map((id) => String(id)),
    ...(request.ScriptId !== undefined
      ? { ScriptId: String(request.ScriptId) }
      : { ScriptGuid: request.ScriptGuid }),
    Parameters: request.Parameters ?? [],
    Priority: request.Priority ?? DEFAULT_SCRIPT_PRIORITY,
    OfflineActionFlags: buildOfflineActionFlags(request.OfflineActionFlags),
    UseAgentTime: request.UseAgentTime ?? false,
    StartDate: request.StartDate ?? formatIsoWithOffset(now),
    Schedule: request.Schedule ?? {
      ScriptScheduleFrequency: { ScriptScheduleFrequencyId: SCRIPT_SCHEDULE_FREQUENCY_ONCE },
    },
    ...(request.ExpireDate !== undefined && { ExpireDate: request.ExpireDate }),
    ...(request.DistributionWindow !== undefined && { DistributionWindow: request.DistributionWindow }),
    ...(request.IncludeSubGroups !== undefined && { IncludeSubGroups: request.IncludeSubGroups }),
  };
}
