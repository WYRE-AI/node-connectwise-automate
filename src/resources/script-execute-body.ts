import { ConnectWiseAutomateValidationError } from '../errors.js';
import type { ScriptExecuteBatchBody, ScriptExecuteBatchRequest } from '../types/scripts.js';

export const DEFAULT_SCRIPT_PRIORITY = 5;
export const SCRIPT_SCHEDULE_FREQUENCY_ONCE = 1;

/**
 * Build the explicit ScheduleScriptBatchRequest body. Field names come from
 * the official Batch swagger. The Priority scale, frequency id 1 meaning
 * "once / run now", and default flags mirror the Control Center "run now"
 * request and are PENDING verification against a captured Control Center
 * payload (WYREAI-573); they are not verified by the swagger.
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
    Schedule: request.Schedule ?? { ScriptScheduleFrequency: { ScriptScheduleFrequencyId: SCRIPT_SCHEDULE_FREQUENCY_ONCE } },
    ...(request.ExpireDate !== undefined && { ExpireDate: request.ExpireDate }),
    ...(request.DistributionWindow !== undefined && { DistributionWindow: request.DistributionWindow }),
    ...(request.IncludeSubGroups !== undefined && { IncludeSubGroups: request.IncludeSubGroups }),
  };
}
