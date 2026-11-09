import { describe, it, expect } from 'vitest';
import { buildScriptExecuteBatchBody, DEFAULT_SCRIPT_PRIORITY, SCRIPT_SCHEDULE_FREQUENCY_ONCE, ConnectWiseAutomateValidationError } from '../../src/index.js';
import type { ScriptExecuteBatchRequest } from '../../src/index.js';

const now = new Date('2026-01-02T03:04:05.000Z');
describe('buildScriptExecuteBatchBody', () => {
  it('serializes explicit defaults using the injected clock', () => {
    expect(JSON.parse(JSON.stringify(buildScriptExecuteBatchBody({ EntityIds: [1], ScriptId: 42 }, now)))).toEqual({
      EntityType: 'Computer', EntityIds: [1], ScriptId: 42, Parameters: [],
      Priority: DEFAULT_SCRIPT_PRIORITY,
      OfflineActionFlags: { SkipsOfflineAgents: false, WakesOfflineAgents: false, OnlyRunsOnOfflineAgents: false },
      UseAgentTime: false, StartDate: now.toISOString(),
      Schedule: { ScriptScheduleFrequency: { ScriptScheduleFrequencyId: SCRIPT_SCHEDULE_FREQUENCY_ONCE } },
    });
  });
  it('respects every override without mutating the request', () => {
    const request: ScriptExecuteBatchRequest = {
      EntityType: 'Group', EntityIds: [2], ScriptGuid: 'guid',
      Parameters: [{ Key: 'key', Value: 'value' }], Priority: 0,
      OfflineActionFlags: { SkipsOfflineAgents: false, WakesOfflineAgents: true, OnlyRunsOnOfflineAgents: true },
      UseAgentTime: true, StartDate: 'start', ExpireDate: 'end', IncludeSubGroups: false,
      Schedule: { ScriptScheduleFrequency: { ScriptScheduleFrequencyId: 2, Name: 'custom' }, DailySettings: { Interval: 2 } },
      DistributionWindow: { Amount: 3 },
    };
    const before = structuredClone(request);
    expect(buildScriptExecuteBatchBody(request, now)).toEqual(request);
    expect(request).toEqual(before);
  });
  it.each([[], [0], [-1], [1.5], [NaN], [Infinity], ['1'], undefined, new Array(1)])('rejects invalid targets %j', EntityIds => {
    expect(() => buildScriptExecuteBatchBody({ EntityIds, ScriptId: 42 } as ScriptExecuteBatchRequest)).toThrow(ConnectWiseAutomateValidationError);
  });
  it.each([{}, { ScriptId: 42, ScriptGuid: 'guid' }])('requires exactly one script identifier %j', script => {
    expect(() => buildScriptExecuteBatchBody({ EntityIds: [1], ...script })).toThrow(ConnectWiseAutomateValidationError);
  });
});
