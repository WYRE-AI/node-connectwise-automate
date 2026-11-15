import { describe, it, expect } from 'vitest';
import {
  buildScriptExecuteBatchBody,
  DEFAULT_SCRIPT_PRIORITY,
  SCRIPT_SCHEDULE_FREQUENCY_ONCE,
  SCRIPT_TARGET_ENTITY_TYPE_ORDINAL,
  formatIsoWithOffset,
  toScriptTargetEntityTypeOrdinal,
  ConnectWiseAutomateValidationError,
} from '../../src/index.js';
import type { ScriptExecuteBatchRequest, ScriptTargetEntityType } from '../../src/index.js';

const now = new Date('2026-01-02T03:04:05.000Z');

describe('buildScriptExecuteBatchBody', () => {
  it('serializes the Control Center ScriptSchedule wire shape', () => {
    expect(JSON.parse(JSON.stringify(buildScriptExecuteBatchBody({ EntityIds: [748], ScriptId: 5160 }, now)))).toEqual({
      EntityType: 1,
      EntityIds: ['748'],
      ScriptId: '5160',
      Parameters: [],
      Priority: DEFAULT_SCRIPT_PRIORITY,
      OfflineActionFlags: { SkipsOfflineAgents: true, WakesOfflineAgents: true },
      UseAgentTime: false,
      StartDate: formatIsoWithOffset(now),
      Schedule: { ScriptScheduleFrequency: { ScriptScheduleFrequencyId: SCRIPT_SCHEDULE_FREQUENCY_ONCE } },
    });
    expect(DEFAULT_SCRIPT_PRIORITY).toBe(12);
    expect(SCRIPT_SCHEDULE_FREQUENCY_ONCE).toBe(1);
    expect(formatIsoWithOffset(now)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/
    );
  });

  it('maps string EntityTypes to swagger ordinals and keeps Parameters', () => {
    const request: ScriptExecuteBatchRequest = {
      EntityType: 'Group',
      EntityIds: [2, 3],
      ScriptId: 99,
      Parameters: [{ Key: 'key', Value: 'value' }],
      Priority: 1,
      OfflineActionFlags: {
        SkipsOfflineAgents: false,
        WakesOfflineAgents: true,
        OnlyRunsOnOfflineAgents: true,
      },
      UseAgentTime: true,
      StartDate: 'start',
      ExpireDate: 'end',
      IncludeSubGroups: false,
      Schedule: {
        ScriptScheduleFrequency: { ScriptScheduleFrequencyId: 2, Name: 'custom' },
        DailySettings: { Interval: 2 },
      },
      DistributionWindow: { Amount: 3 },
    };
    const before = structuredClone(request);
    expect(buildScriptExecuteBatchBody(request, now)).toEqual({
      EntityType: 7,
      EntityIds: ['2', '3'],
      ScriptId: '99',
      Parameters: [{ Key: 'key', Value: 'value' }],
      Priority: 1,
      OfflineActionFlags: {
        SkipsOfflineAgents: false,
        WakesOfflineAgents: true,
        OnlyRunsOnOfflineAgents: true,
      },
      UseAgentTime: true,
      StartDate: 'start',
      ExpireDate: 'end',
      IncludeSubGroups: false,
      Schedule: {
        ScriptScheduleFrequency: { ScriptScheduleFrequencyId: 2, Name: 'custom' },
        DailySettings: { Interval: 2 },
      },
      DistributionWindow: { Amount: 3 },
    });
    expect(request).toEqual(before);
  });

  it('omits OnlyRunsOnOfflineAgents unless the caller sets it', () => {
    const body = buildScriptExecuteBatchBody(
      { EntityIds: [1], ScriptId: 42, OfflineActionFlags: { SkipsOfflineAgents: false } },
      now
    );
    expect(body.OfflineActionFlags).toEqual({
      SkipsOfflineAgents: false,
      WakesOfflineAgents: true,
    });
    expect('OnlyRunsOnOfflineAgents' in body.OfflineActionFlags).toBe(false);
  });

  it('keeps ScriptGuid as a string when ScriptId is absent', () => {
    expect(buildScriptExecuteBatchBody({ EntityIds: [1], ScriptGuid: 'guid' }, now)).toMatchObject({
      EntityType: 1,
      EntityIds: ['1'],
      ScriptGuid: 'guid',
    });
    expect(buildScriptExecuteBatchBody({ EntityIds: [1], ScriptGuid: 'guid' }, now)).not.toHaveProperty('ScriptId');
  });

  it.each([[], [0], [-1], [1.5], [NaN], [Infinity], ['1'], undefined, new Array(1)])('rejects invalid targets %j', EntityIds => {
    expect(() => buildScriptExecuteBatchBody({ EntityIds, ScriptId: 42 } as ScriptExecuteBatchRequest)).toThrow(ConnectWiseAutomateValidationError);
  });

  it.each([{}, { ScriptId: 42, ScriptGuid: 'guid' }])('requires exactly one script identifier %j', script => {
    expect(() => buildScriptExecuteBatchBody({ EntityIds: [1], ...script })).toThrow(ConnectWiseAutomateValidationError);
  });
});

describe('toScriptTargetEntityTypeOrdinal', () => {
  it('maps Computer to 1 and Group to 7', () => {
    expect(toScriptTargetEntityTypeOrdinal('Computer')).toBe(1);
    expect(toScriptTargetEntityTypeOrdinal('Group')).toBe(7);
    expect(SCRIPT_TARGET_ENTITY_TYPE_ORDINAL.Computer).toBe(1);
  });

  it('covers every ScriptTargetEntityType exactly once', () => {
    const types = Object.keys(SCRIPT_TARGET_ENTITY_TYPE_ORDINAL) as ScriptTargetEntityType[];
    const ordinals = types.map((type) => toScriptTargetEntityTypeOrdinal(type));
    expect(new Set(ordinals).size).toBe(types.length);
    expect(Math.min(...ordinals)).toBe(0);
    expect(Math.max(...ordinals)).toBe(types.length - 1);
  });
});
