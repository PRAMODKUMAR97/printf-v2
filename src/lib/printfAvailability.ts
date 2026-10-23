export const STATION_HEARTBEAT_WINDOW_MS = 15_000;

type StationHeartbeat = {
  status: string;
  last_seen: string | null;
  name?: string | null;
  accepts_orders_24_7?: boolean | null;
};

const CANARA_ENGINEERING_COLLEGE = 'canara engineering college';

export function isManualFulfilmentStation(station: Pick<StationHeartbeat, 'name' | 'accepts_orders_24_7'>) {
  return station.accepts_orders_24_7 === true || station.name?.trim().toLowerCase() === CANARA_ENGINEERING_COLLEGE;
}

/** A station is usable only while its printer agent is actively sending heartbeats. */
export function isStationAvailable(station: StationHeartbeat, now = Date.now()) {
  if (station.status !== 'online' || !station.last_seen) return false;
  const lastSeen = new Date(station.last_seen).getTime();
  return Number.isFinite(lastSeen) && now - lastSeen < STATION_HEARTBEAT_WINDOW_MS;
}

/** Whether a customer can place an order at this station. */
export function isStationOrderable(station: StationHeartbeat, now = Date.now()) {
  return isManualFulfilmentStation(station) || isStationAvailable(station, now);
}
