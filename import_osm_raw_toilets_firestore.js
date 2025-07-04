import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccount = await import('./server/findwc-2be85-firebase-adminsdk-fbsvc-a1b97ea513.json', {
  assert: { type: 'json' }
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount.default),
  });
}
const db = admin.firestore();

const rawPath = path.join(__dirname, 'bulgaria_toilets_osm_raw.json');
const rawData = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const elements = rawData.elements || [];

function getToiletType(tags = {}) {
  if (tags.building === 'gas_station' || (tags.operator && /газ|petrol|lukoil|shell|omv/i.test(tags.operator))) {
    return 'gas-station';
  }
  if (tags.building === 'commercial' || tags.amenity === 'restaurant' || tags.cuisine || (tags.operator && /restaurant/i.test(tags.operator))) {
    return 'restaurant';
  }
  if (tags.building === 'retail' || tags.shop || (tags.operator && /mall/i.test(tags.operator))) {
    return 'mall';
  }
  if (tags.amenity === 'cafe' || (tags.operator && /cafe/i.test(tags.operator))) {
    return 'cafe';
  }
  return 'public';
}

function createDescription(tags = {}) {
  let description = [];
  if (tags.name) description.push(tags.name);
  if (tags.operator) description.push(`Operated by: ${tags.operator}`);
  if (tags.access && tags.access !== 'public') description.push(`Access: ${tags.access}`);
  if (tags.fee === 'yes') description.push('Fee required');
  else if (tags.fee === 'no') description.push('Free');
  if (tags.wheelchair === 'yes') description.push('Wheelchair accessible');
  else if (tags.wheelchair === 'no') description.push('Not wheelchair accessible');
  if (tags.opening_hours) description.push(`Hours: ${tags.opening_hours}`);
  if (tags['toilets:disposal']) description.push(`Type: ${tags['toilets:disposal']}`);
  return description.length > 0 ? description.join(' • ') : 'Public toilet facility';
}

async function importToilets() {
  let count = 0;
  for (const el of elements) {
    if (el.type !== 'node' || !el.lat || !el.lon) continue;
    const osmId = String(el.id);
    // Check for existing toilet with this osmId
    const existing = await db.collection('toilets').where('osmId', '==', osmId).limit(1).get();
    if (!existing.empty) continue;
    const doc = {
      type: getToiletType(el.tags),
      coordinates: { lat: el.lat, lng: el.lon },
      notes: createDescription(el.tags),
      userId: 'osm-import',
      source: 'osm',
      addedByUserName: '',
      osmId,
      tags: el.tags || {},
      reportCount: 0,
      isRemoved: false,
      removedAt: null,
      createdAt: new Date(),
      averageRating: 0,
      reviewCount: 0,
    };
    try {
      await db.collection('toilets').add(doc);
      count++;
      if (count % 100 === 0) {
        console.log(`Imported ${count} toilets...`);
      }
    } catch (err) {
      console.error(`Error importing toilet ${osmId}:`, err);
    }
  }
  console.log(`Import complete! Imported ${count} new toilets.`);
  process.exit(0);
}

importToilets(); 