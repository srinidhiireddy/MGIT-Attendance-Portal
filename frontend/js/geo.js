/* ═══════════════════════════════════════════
   geo.js — Geolocation utilities (client-side)
   Final validation is always done server-side.
   ═══════════════════════════════════════════ */

/**
 * Get current position as a Promise.
 * Returns { latitude, longitude, accuracy } or throws on error.
 */
function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy:  pos.coords.accuracy
      }),
      err => {
        const msgs = {
          1: 'Location permission denied. Please allow location access.',
          2: 'Location unavailable. Check your GPS/network.',
          3: 'Location request timed out. Try again.'
        };
        reject(new Error(msgs[err.code] || 'Location error'));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        ...options
      }
    );
  });
}

/**
 * Client-side Haversine distance (informational only — server validates).
 */
function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * Continuously watch position and call callback({ latitude, longitude, accuracy }).
 * Returns watchId; call navigator.geolocation.clearWatch(watchId) to stop.
 */
function watchPosition(callback, errorCallback) {
  if (!('geolocation' in navigator)) {
    errorCallback(new Error('Geolocation not supported'));
    return null;
  }
  return navigator.geolocation.watchPosition(
    pos => callback({
      latitude:  pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy:  pos.coords.accuracy
    }),
    err => errorCallback(new Error(err.message)),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}

/**
 * Build a human-readable distance string.
 */
function formatDistance(metres) {
  if (metres == null) return '—';
  return metres < 1000
    ? `${Math.round(metres)} m`
    : `${(metres / 1000).toFixed(2)} km`;
}
