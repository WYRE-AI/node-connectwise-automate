import { ConnectWiseAutomateValidationError } from '../errors.js';
import type { ScriptExecuteBatchBody, ScriptExecuteBatchRequest } from '../types/scripts.js';

/** MCP and historical SDK examples map high=1, normal=2, low=3. Default is normal. */
export const DEFAULT_SCRIPT_PRIORITY = 2;

/**
 * Official swagger leaves ScriptScheduleFrequencyId as an undocumented int32.
 * The LabTech `scheduledscripts` table stores frequency in `Interval`; Once is
 * the only swagger frequency with no sibling *Settings object, and 1 is the
 * first id. We send id 1 for a run-now / once schedule.
 */
export const SCRIPT_SCHEDULE_FREQUENCY_ONCE = 1;

/**
 * Build the explicit ScheduleScriptBatchRequest body for
 * `POST /cwa/api/v1/Batch/ScriptExecute`. Field names come from the official
 * Automate swagger (`connectwise-rest` AutomateTypes). A sparse body
 * (`EntityType` + `EntityIds` + `ScriptId`, empty `OfflineActionFlags`) is
 * what Automate answers with HTTP 500 "Encountered unhandled exception."
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
    EntityType: request.EntityType ?? 'Computer',
    EntityIds: request.EntityIds,
    ...(request.ScriptId !== undefined ? { ScriptId: request.ScriptId } : { ScriptGuid: request.ScriptGuid }),
    Parameters: request.Parameters ?? [],
    Priority: request.Priority ?? DEFAULT_SCRIPT_PRIORITY,
    OfflineActionFlags: {
      SkipsOfflineAgents: request.OfflineActionFlags?.SkipsOfflineAgents ?? false,
      WakesOfflineAgents: request.OfflineActionFlags?.WakesOfflineAgents ?? false,
      OnlyRunsOnOfflineAgents: request.OfflineActionFlags?.OnlyRunsOnOfflineAgents ?? false,
    },
    UseAgentTime: request.UseAgentTime ?? false,
    StartDate: request.StartDate ?? now.toISOString(),
    Schedule: request.Schedule ?? {
      ScriptScheduleFrequency: { ScriptScheduleFrequencyId: SCRIPT_SCHEDULE_FREQUENCY_ONCE },
    },
    ...(request.ExpireDate !== undefined && { ExpireDate: request.ExpireDate }),
    ...(request.DistributionWindow !== undefined && { DistributionWindow: request.DistributionWindow }),
    ...(request.IncludeSubGroups !== undefined && { IncludeSubGroups: request.IncludeSubGroups }),
  };
}
