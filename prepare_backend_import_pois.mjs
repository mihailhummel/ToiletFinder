import fs from 'fs';

const merged = JSON.parse(fs.readFileSync('bulgaria_pois_merged.json', 'utf8'));

const ready = merged.map(poi => ({
  type: poi.type || 'public',
  coordinates: poi.coordinates,
  notes: poi.notes || '',
  userId: poi.userId || (poi.source === 'geoapify' ? 'geoapify-import' : 'osm-import'),
  source: poi.source || '',
  addedByUserName: poi.addedByUserName || '',
  osmId: poi.osmId ? String(poi.osmId) : '',
  tags: poi.tags || {},
  reportCount: 0,
  isRemoved: false,
  removedAt: null,
  createdAt: new Date().toISOString(),
  averageRating: 0,
  reviewCount: 0,
}));

fs.writeFileSync('bulgaria_pois_ready_for_import.json', JSON.stringify(ready, null, 2));
console.log(`Prepared ${ready.length} POIs for backend import.`); 