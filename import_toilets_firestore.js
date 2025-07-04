import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import for service account
const serviceAccount = await import('./server/findwc-2be85-firebase-adminsdk-fbsvc-a1b97ea513.json', {
  assert: { type: 'json' }
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount.default),
  });
}
const db = admin.firestore();

// Read toilets data
const toiletsPath = path.join(__dirname, 'bulgaria_pois_ready_for_import.json');
const toiletsData = JSON.parse(fs.readFileSync(toiletsPath, 'utf8'));

async function importToilets() {
  let count = 0;
  for (const toilet of toiletsData) {
    // Prepare Firestore document
    const doc = {
      type: toilet.type || 'public',
      coordinates: toilet.coordinates,
      notes: toilet.notes || '',
      userId: toilet.userId || 'osm-import',
      source: toilet.source || 'osm',
      addedByUserName: toilet.addedByUserName || '',
      osmId: toilet.osmId ? String(toilet.osmId) : '',
      tags: toilet.tags || {},
      reportCount: 0,
      isRemoved: false,
      removedAt: null,
      createdAt: new Date(),
      averageRating: 0,
      reviewCount: 0,
    };
    try {
      const ref = await db.collection('toilets').add(doc);
      await ref.update({ id: ref.id });
      count++;
      if (count % 100 === 0) {
        console.log(`Imported ${count} toilets...`);
      }
    } catch (err) {
      console.error(`Error importing toilet ${toilet.id}:`, err);
    }
  }
  console.log(`Import complete! Imported ${count} toilets.`);
  process.exit(0);
}

importToilets(); 