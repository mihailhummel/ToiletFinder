import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import path from 'path';

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

const snap = await db.collection('toilets').get();
console.log('Total toilets in Firestore:', snap.size);
process.exit(0); 