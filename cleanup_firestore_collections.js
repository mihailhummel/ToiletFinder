import admin from 'firebase-admin';
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

async function deleteCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  let count = 0;
  for (const doc of snapshot.docs) {
    await doc.ref.delete();
    count++;
    if (count % 100 === 0) console.log(`Deleted ${count} from ${collectionName}...`);
  }
  console.log(`Deleted ${count} documents from ${collectionName}`);
}

async function main() {
  await deleteCollection('toilets');
  await deleteCollection('reviews');
  await deleteCollection('toiletReports');
  console.log('Cleanup complete!');
  process.exit(0);
}

main(); 