import fs from 'fs';

// Load OSM and Geoapify POIs
const osmPOIs = JSON.parse(fs.readFileSync('bulgaria_pois_complete.json', 'utf8'));
const geoapifyPOIs = JSON.parse(fs.readFileSync('bulgaria_geoapify_pois.json', 'utf8'));

// Helper: Haversine distance (meters)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Deduplicate: merge by proximity (30m) and type
const merged = [];
const usedGeoapify = new Set();
for (const osm of osmPOIs) {
  let found = false;
  for (let i = 0; i < geoapifyPOIs.length; i++) {
    if (usedGeoapify.has(i)) continue;
    const g = geoapifyPOIs[i];
    if (!osm.coordinates || !g.coordinates) continue;
    const dist = haversine(osm.coordinates.lat, osm.coordinates.lng, g.coordinates.lat, g.coordinates.lng);
    if (dist < 30 && osm.type === g.type) {
      // Merge attributes, prefer OSM label, combine notes
      merged.push({
        ...osm,
        id: osm.id + '|' + g.id,
        notes: [osm.notes, g.notes].filter(Boolean).join('\n---\n'),
        isToilet: osm.isToilet || g.isToilet,
        isFree: osm.isFree !== undefined ? osm.isFree : g.isFree,
        isAccessible: osm.isAccessible !== undefined ? osm.isAccessible : g.isAccessible,
        source: 'osm+geoapify',
        geoapifyId: g.id,
        geoapifyRaw: g.raw
      });
      usedGeoapify.add(i);
      found = true;
      break;
    }
  }
  if (!found) merged.push(osm);
}
// Add remaining Geoapify POIs
for (let i = 0; i < geoapifyPOIs.length; i++) {
  if (!usedGeoapify.has(i)) merged.push(geoapifyPOIs[i]);
}

console.log(`Merged total: ${merged.length} POIs`);
fs.writeFileSync('bulgaria_pois_merged.json', JSON.stringify(merged, null, 2));
console.log('Saved merged POIs to bulgaria_pois_merged.json'); 