#!/usr/bin/env node

import { existsSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const sensitiveFiles = [
  'firebase-service-account-key.json',
  'firebase-admin-config.js',
  'firebase-admin-config.d.ts'
];

console.log('🧪 Testing production mode (without sensitive files)...\n');

// Check if sensitive files exist
const existingFiles = sensitiveFiles.filter(file => 
  existsSync(join(projectRoot, file))
);

if (existingFiles.length === 0) {
  console.log('✅ No sensitive files found. App is ready for production deployment.');
  console.log('💡 Make sure to set all required environment variables in your deployment platform.');
  process.exit(0);
}

console.log('⚠️  Found sensitive files that should not be deployed:');
existingFiles.forEach(file => console.log(`   - ${file}`));

console.log('\n🔒 To test production mode:');
console.log('1. Move these files to a safe location (outside the project)');
console.log('2. Set up environment variables in a .env file');
console.log('3. Run: npm run start');
console.log('\n📋 Required environment variables:');
console.log('   - FIREBASE_PROJECT_ID');
console.log('   - FIREBASE_PRIVATE_KEY_ID');
console.log('   - FIREBASE_PRIVATE_KEY');
console.log('   - FIREBASE_CLIENT_EMAIL');
console.log('   - FIREBASE_CLIENT_ID');
console.log('   - FIREBASE_CLIENT_X509_CERT_URL');
console.log('   - SUPABASE_URL');
console.log('   - SUPABASE_ANON_KEY');
console.log('   - SUPABASE_SERVICE_ROLE_KEY');
console.log('   - DATABASE_URL');

console.log('\n📖 See DEPLOYMENT.md for detailed instructions.');
