import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
// Supports both environment variables (production) and local file (development)
let serviceAccount;

// Try environment variables first (for production deployment)
if (process.env.FIREBASE_PRIVATE_KEY) {
  serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID || 'findwc-2be85',
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
  };
  console.log('🔑 Firebase Admin initialized with environment variables');
} else {
  // Fallback to local file for development
  try {
    const serviceAccountPath = join(__dirname, 'firebase-service-account-key.json');
    if (existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      console.log('🔑 Firebase Admin initialized with local service account file');
    } else {
      console.warn('⚠️  firebase-service-account-key.json not found. Using environment variables only.');
      console.warn('   For development, add firebase-service-account-key.json file');
      console.warn('   For production, set FIREBASE_* environment variables');
      // Don't exit, let the app continue without Firebase admin
      serviceAccount = null;
    }
  } catch (error) {
    console.error('⚠️  Error reading Firebase configuration:', error.message);
    console.error('   For production, set environment variables:');
    console.error('   FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, etc.');
    console.error('   For development, add firebase-service-account-key.json file');
    serviceAccount = null;
  }
}

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || 'findwc-2be85'
  });
}

// Only export auth if Firebase is properly initialized
const auth = admin.apps.length > 0 ? admin.auth() : null;

export { admin, auth };

// TypeScript type declarations for CJS module
export default admin; 