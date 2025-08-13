import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
// You'll need to download the service account key from Firebase Console
// and save it as 'firebase-service-account-key.json' in the project root
let serviceAccount;

try {
  const serviceAccountPath = join(__dirname, 'firebase-service-account-key.json');
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
  console.error('⚠️  Service account key not found. Please download it from Firebase Console:');
  console.error('   1. Go to Firebase Console > Project Settings > Service Accounts');
  console.error('   2. Click "Generate new private key"');
  console.error('   3. Save the file as "firebase-service-account-key.json" in the project root');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'findwc-2be85'
  });
}

const auth = admin.auth();

export { admin, auth };

// TypeScript type declarations for CJS module
export default admin; 