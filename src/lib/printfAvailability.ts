export const STATION_HEARTBEAT_WINDOW_MS = 15_000;

type StationHeartbeat = {
  status: string;
  last_seen: string | null;
};

/** A station is usable only while its printer agent is actively sending heartbeats. */
export function isStationAvailable(station: StationHeartbeat, now = Date.now()) {
  if (station.status !== 'online' || !station.last_seen) return false;
  const lastSeen = new Date(station.last_seen).getTime();
  return Number.isFinite(lastSeen) && now - lastSeen < STATION_HEARTBEAT_WINDOW_MS;
}
