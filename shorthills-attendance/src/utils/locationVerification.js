// Ambience Mall, Sector 24, Gurugram
const OFFICE = {
  lat: 28.5027,
  lng: 77.0929,
  name: 'Ambience Mall, Gurugram',
  radiusMeters: 700,
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isWithinOffice(lat, lng) {
  const distance = Math.round(haversineDistance(lat, lng, OFFICE.lat, OFFICE.lng))
  return {
    withinRange: distance <= OFFICE.radiusMeters,
    distance,
    office: OFFICE,
  }
}

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      (err) => {
        const msgs = {
          1: 'Location access denied. Please allow location permission and try again.',
          2: 'Location unavailable. Please enable GPS or check your connection.',
          3: 'Location request timed out. Please try again.',
        }
        reject(new Error(msgs[err.code] || 'Failed to get location.'))
      },
      { timeout: 15000, maximumAge: 30000, enableHighAccuracy: true }
    )
  })
}
