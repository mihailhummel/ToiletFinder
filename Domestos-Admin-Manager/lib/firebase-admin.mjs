/**
 * Firebase Admin SDK init — used only to VERIFY visitors' ID tokens server-side.
 * Same service account as the main toaletna.com app. Mirrors the project's
 * firebase-admin-config.js: env vars in production, optional local JSON for dev.
 */
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'findwc-2be85';

let serviceAccount = null;

if (process.env.FIREBASE_PRIVATE_KEY) {
  serviceAccount = {
    type: 'service_account',
    project_id: PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    // Railway stores the key with literal "\n" — restore real newlines.
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  };
} else {
  // Local dev fallback: a service-account JSON at the folder root.
  const localPath = join(__dirname, '..', 'firebase-service-account-key.json');
  if (existsSync(localPath)) {
    serviceAccount = JSON.parse(readFileSync(localPath, 'utf8'));
  }
}

if (!serviceAccount) {
  throw new Error(
    'Firebase Admin not configured. Set FIREBASE_PRIVATE_KEY (+ FIREBASE_CLIENT_EMAIL etc.) ' +
      'or add firebase-service-account-key.json for local dev.',
  );
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
  });
}

export const auth = admin.auth();
export default admin;
