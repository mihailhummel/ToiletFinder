import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = await import('./server/findwc-2be85-firebase-adminsdk-fbsvc-a1b97ea513.json', {
  assert: { type: 'json' }
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount.default),
  });
}

const db = admin.firestore();

console.log('🔍 CHECKING FIREBASE QUOTA STATUS\n');

async function checkFirebaseQuota() {
  try {
    console.log('1️⃣ Testing Firebase connection...');
    
    // Try to fetch a small sample to test quota
    const toiletsSnapshot = await db.collection('toilets').limit(5).get();
    
    if (toiletsSnapshot.empty) {
      console.log('⚠️ No toilets found in Firebase.');
      return;
    }
    
    console.log(`✅ Firebase connection successful!`);
    console.log(`📊 Found ${toiletsSnapshot.size} toilets in sample`);
    
    // Try to get total count
    console.log('2️⃣ Testing total count query...');
    
    const totalSnapshot = await db.collection('toilets').get();
    console.log(`📊 Total toilets in Firebase: ${totalSnapshot.size}`);
    
    if (totalSnapshot.size > 0) {
      console.log('✅ Firebase quota is available!');
      console.log('🚀 You can now run the complete migration.');
      console.log('\n💡 Run this command to migrate ALL toilets:');
      console.log('   node migrate_firebase_to_supabase_complete.mjs');
    }
    
    // Show some sample data
    console.log('\n3️⃣ Sample toilet data:');
    let count = 0;
    totalSnapshot.forEach(doc => {
      if (count < 3) {
        const data = doc.data();
        console.log(`   - ${doc.id}: ${data.type || 'public'} at ${data.coordinates?.lat}, ${data.coordinates?.lng}`);
        count++;
      }
    });
    
  } catch (error) {
    console.error('❌ Firebase quota check failed:', error.message);
    
    if (error.code === 'resource-exhausted' || error.message.includes('quota')) {
      console.log('\n💡 Firebase quota exceeded. Please wait for quota reset.');
      console.log('📅 Firebase quotas typically reset daily.');
      console.log('⏰ Try again in a few hours or tomorrow.');
    } else {
      console.log('\n💡 Other Firebase error. Check your configuration.');
    }
  }
}

// Run the check
checkFirebaseQuota().then(() => {
  console.log('\n✅ Quota check completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Quota check failed:', error);
  process.exit(1);
}); 