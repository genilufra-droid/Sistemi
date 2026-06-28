/**
 * GPS location capture for Sistemi Genit, mirroring the HTML `getLocation()` /
 * route-tracking logic but using expo-location on React Native.
 *
 * - `captureLocation()` requests permission (once) and returns a GeoLocation
 *   object with status "ok" + coordinates, or a non-ok status ("denied",
 *   "timeout", "unavailable", "unsupported") so documents can still be saved.
 * - `haversineMeters()` measures distance between two points (route de-duping).
 */
import * as Location from "expo-location";
import type { GeoLocation, RoutePoint } from "./store";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Capture the current GPS position. Never throws — on any failure it resolves
 * to a GeoLocation whose `status` explains why (so saving a document is never
 * blocked by GPS issues).
 */
export async function captureLocation(): Promise<GeoLocation> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return { status: "denied", capturedAt: nowIso() };
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      status: "ok",
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
      capturedAt: new Date(pos.timestamp).toISOString(),
    };
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    const status: GeoLocation["status"] = /timeout/i.test(msg)
      ? "timeout"
      : "unavailable";
    return { status, error: msg, capturedAt: nowIso() };
  }
}

/** Distance in meters between two lat/lng points (Haversine). */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Convert a captured GeoLocation into a RoutePoint, or null if not ok. */
export function geoToRoutePoint(geo: GeoLocation): RoutePoint | null {
  if (geo.status !== "ok" || geo.lat == null || geo.lng == null) return null;
  return {
    lat: geo.lat,
    lng: geo.lng,
    accuracy: geo.accuracy,
    capturedAt: geo.capturedAt || nowIso(),
    source: "gps",
  };
}
