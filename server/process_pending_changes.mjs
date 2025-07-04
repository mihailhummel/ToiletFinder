import admin from 'firebase-admin';
import serviceAccount from './findwc-2be85-firebase-adminsdk-fbsvc-a1b97ea513.json' assert { type: 'json' };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

async function processPendingChanges() {
  const snapshot = await db.collection('pending_changes').orderBy('createdAt').get();
  let processed = 0;
  for (const doc of snapshot.docs) {
    const { type, data } = doc.data();
    try {
      if (type === 'add') {
        const toiletData = {
          ...data,
          createdAt: admin.firestore.Timestamp.now(),
          averageRating: 0,
          reviewCount: 0,
          reportCount: 0,
          isRemoved: false,
          removedAt: null,
        };
        await db.collection('toilets').add(toiletData);
      } else if (type === 'report') {
        if (data.text || data.rating) {
          // It's a review
          await db.collection('reviews').add({ ...data, createdAt: admin.firestore.Timestamp.now() });
        } else {
          // It's a toilet report
          await db.collection('toiletReports').add({ ...data, createdAt: admin.firestore.Timestamp.now() });
        }
      } else if (type === 'delete') {
        const { toiletId } = data;
        if (toiletId) {
          const toiletRef = db.collection('toilets').doc(toiletId);
          await toiletRef.delete();
        }
      }
      await doc.ref.delete();
      processed++;
    } catch (err) {
      console.error('Error processing change', doc.id, err);
    }
  }
  console.log(`Processed and removed ${processed} pending changes.`);
  process.exit(0);
}

processPendingChanges(); 