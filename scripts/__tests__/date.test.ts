import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSundayToSaturdayWindow } from '../lib/date.ts';

describe('getSundayToSaturdayWindow', () => {
  it('calculates preceding Sunday to Saturday when run on Monday', () => {
    const monday = new Date('2026-09-21T02:00:00Z');
    const window = getSundayToSaturdayWindow(monday);

    assert.equal(window.from, '2026-09-13T00:00:00Z');
    assert.equal(window.to, '2026-09-19T23:59:59Z');
  });

  it('calculates preceding Sunday to Saturday when run on Sunday', () => {
    const sunday = new Date('2026-09-20T10:00:00Z');
    const window = getSundayToSaturdayWindow(sunday);

    assert.equal(window.from, '2026-09-13T00:00:00Z');
    assert.equal(window.to, '2026-09-19T23:59:59Z');
  });

  it('calculates preceding Sunday to Saturday when run on Saturday', () => {
    const saturday = new Date('2026-09-19T18:00:00Z');
    const window = getSundayToSaturdayWindow(saturday);

    assert.equal(window.from, '2026-09-06T00:00:00Z');
    assert.equal(window.to, '2026-09-12T23:59:59Z');
  });

  it('correctly crosses month boundaries (e.g. March into February)', () => {
    // 2026-03-02 is a Monday
    const mondayInMarch = new Date('2026-03-02T02:00:00Z');
    const window = getSundayToSaturdayWindow(mondayInMarch);

    assert.equal(window.from, '2026-02-22T00:00:00Z');
    assert.equal(window.to, '2026-02-28T23:59:59Z');
  });

  it('correctly crosses year boundaries (e.g. early January into previous December)', () => {
    // 2026-01-05 is a Monday
    const firstMondayOfYear = new Date('2026-01-05T02:00:00Z');
    const window = getSundayToSaturdayWindow(firstMondayOfYear);

    assert.equal(window.from, '2025-12-28T00:00:00Z');
    assert.equal(window.to, '2026-01-03T23:59:59Z');
  });

  it('produces a window spanning exactly 7 calendar days', () => {
    const window = getSundayToSaturdayWindow(new Date('2026-09-16T12:00:00Z'));
    const startDate = new Date(window.from);
    const endDate = new Date(window.to);

    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    assert.equal(diffDays, 7);
  });
});
