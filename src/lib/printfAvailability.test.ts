import { describe, expect, it } from 'vitest';
import { isStationAvailable, STATION_HEARTBEAT_WINDOW_MS } from './printfAvailability';

describe('isStationAvailable', () => {
  const now = new Date('2026-10-23T18:00:00.000Z').getTime();

  it('requires a recent heartbeat as well as an online status', () => {
    expect(isStationAvailable({ status: 'online', last_seen: new Date(now - 1_000).toISOString() }, now)).toBe(true);
    expect(isStationAvailable({ status: 'online', last_seen: new Date(now - STATION_HEARTBEAT_WINDOW_MS - 1).toISOString() }, now)).toBe(false);
  });

  it('does not trust a stale or missing heartbeat', () => {
    expect(isStationAvailable({ status: 'online', last_seen: null }, now)).toBe(false);
    expect(isStationAvailable({ status: 'offline', last_seen: new Date(now - 1_000).toISOString() }, now)).toBe(false);
  });
});
