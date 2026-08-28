/**
 * Common type helper tests
 */

import { describe, it, expect } from 'vitest';
import { normalizeListResponse } from '../../src/types/common.js';

describe('normalizeListResponse', () => {
  it('wraps a bare array response (the live API shape) into { Data }', () => {
    const result = normalizeListResponse([{ Id: 1 }, { Id: 2 }]);

    expect(result).toEqual({ Data: [{ Id: 1 }, { Id: 2 }] });
  });

  it('wraps an empty bare array', () => {
    expect(normalizeListResponse([])).toEqual({ Data: [] });
  });

  it('passes through the documented { Data, TotalRecords } envelope unchanged', () => {
    const envelope = { Data: [{ Id: 1 }], TotalRecords: 5 };

    expect(normalizeListResponse(envelope)).toBe(envelope);
  });
});
