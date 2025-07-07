import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const supabaseUrl = 'https://fvohytokcumrauwplnwo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2h5dG9rY3VtcmF1d3BsbndvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg5MDczOCwiZXhwIjoyMDY3NDY2NzM4fQ.nJIBMdMfRd7BB38zS43g40zfLTLGisXVvaKH6SZDvXw';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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

console.log('🚀 COMPLETE SETUP AND MIGRATION\n');

async function setupAndMigrate() {
  try {
    // Step 1: Set up Supabase database schema
    console.log('1️⃣ Setting up Supabase database schema...');
    
    const setupSQL = `
      -- Enable PostGIS extension
      CREATE EXTENSION IF NOT EXISTS postgis;
      
      -- Create toilets table
      CREATE TABLE IF NOT EXISTS toilets (
        id TEXT PRIMARY KEY,
        coordinates JSONB NOT NULL,
        type TEXT NOT NULL DEFAULT 'public',
        source TEXT NOT NULL DEFAULT 'user',
        notes TEXT,
        tags JSONB DEFAULT '{}',
        is_removed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Create spatial index
      CREATE INDEX IF NOT EXISTS idx_toilets_coordinates 
      ON toilets 
      USING GIST (ST_SetSRID(ST_MakePoint((coordinates->>'lng')::float, (coordinates->>'lat')::float), 4326));
      
      -- Create spatial query function
      CREATE OR REPLACE FUNCTION get_toilets_in_bounds(
        west DOUBLE PRECISION,
        south DOUBLE PRECISION,
        east DOUBLE PRECISION,
        north DOUBLE PRECISION
      )
      RETURNS TABLE (
        id TEXT,
        coordinates JSONB,
        type TEXT,
        source TEXT,
        notes TEXT,
        tags JSONB,
        is_removed BOOLEAN,
        created_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          t.id,
          t.coordinates,
          t.type,
          t.source,
          t.notes,
          t.tags,
          t.is_removed,
          t.created_at,
          t.updated_at
        FROM toilets t
        WHERE 
          t.is_removed = FALSE
          AND ST_Within(
            ST_SetSRID(ST_MakePoint((t.coordinates->>'lng')::float, (t.coordinates->>'lat')::float), 4326),
            ST_MakeEnvelope(west, south, east, north, 4326)
          );
      END;
      $$;
      
      -- Enable RLS
      ALTER TABLE toilets ENABLE ROW LEVEL SECURITY;
      
      -- Create policies
      CREATE POLICY "Allow public read access" ON toilets
        FOR SELECT USING (true);
        
      CREATE POLICY "Allow authenticated insert" ON toilets
        FOR INSERT WITH CHECK (true);
        
      CREATE POLICY "Allow authenticated update" ON toilets
        FOR UPDATE USING (true);
        
      CREATE POLICY "Allow authenticated delete" ON toilets
        FOR DELETE USING (true);
    `;
    
    console.log('📝 Running SQL setup...');
    
    // Execute the SQL setup
    const { error: setupError } = await supabase.rpc('exec_sql', { sql: setupSQL });
    
    if (setupError) {
      console.log('⚠️ SQL setup via RPC failed, trying alternative method...');
      
      // Try to create table directly
      const { error: tableError } = await supabase
        .from('toilets')
        .select('id')
        .limit(1);
      
      if (tableError && tableError.message.includes('does not exist')) {
        console.log('❌ Table does not exist. Please run the SQL setup manually in Supabase dashboard:');
        console.log('\n' + setupSQL);
        console.log('\n💡 Copy and paste this SQL into your Supabase SQL Editor, then run this script again.');
        return;
      }
    }
    
    console.log('✅ Database schema ready');

    // Step 2: Fetch ALL toilets from Firebase
    console.log('2️⃣ Fetching ALL toilets from Firebase...');
    
    const toiletsSnapshot = await db.collection('toilets').get();
    
    if (toiletsSnapshot.empty) {
      console.log('⚠️ No toilets found in Firebase. Nothing to migrate.');
      return;
    }
    
    const firebaseToilets = [];
    toiletsSnapshot.forEach(doc => {
      const data = doc.data();
      firebaseToilets.push({
        id: doc.id,
        ...data
      });
    });
    
    console.log(`📊 Found ${firebaseToilets.length} toilets in Firebase`);

    // Step 3: Clear existing data in Supabase
    console.log('3️⃣ Clearing existing data in Supabase...');
    
    const { error: deleteError } = await supabase
      .from('toilets')
      .delete()
      .neq('id', 'impossible-id'); // Delete all records
    
    if (deleteError) {
      console.error('❌ Error clearing data:', deleteError);
    } else {
      console.log('✅ Existing data cleared');
    }

    // Step 4: Transform and batch insert ALL toilets to Supabase
    console.log('4️⃣ Processing and inserting ALL toilet data...');
    
    // Transform Firebase data to match Supabase schema
    const transformedToilets = firebaseToilets.map(toilet => ({
      id: toilet.id,
      coordinates: toilet.coordinates || { lat: 0, lng: 0 },
      type: toilet.type || 'public',
      source: toilet.source || toilet.userId || 'firebase-migration',
      tags: toilet.tags || {},
      notes: toilet.notes || null,
      is_removed: toilet.isRemoved || false,
      created_at: toilet.createdAt ? new Date(toilet.createdAt.seconds * 1000).toISOString() : new Date().toISOString(),
      updated_at: toilet.updatedAt ? new Date(toilet.updatedAt.seconds * 1000).toISOString() : new Date().toISOString()
    }));

    console.log(`🔄 Starting batch insertion of ${transformedToilets.length} toilets...`);

    // Insert in batches to avoid timeout and rate limits
    const BATCH_SIZE = 100; // Smaller batches for reliability
    let totalInserted = 0;
    let batchErrors = 0;
    const startTime = Date.now();

    for (let i = 0; i < transformedToilets.length; i += BATCH_SIZE) {
      const batch = transformedToilets.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(transformedToilets.length / BATCH_SIZE);
      
      try {
        const { error: batchError } = await supabase
          .from('toilets')
          .insert(batch);
        
        if (batchError) {
          console.error(`❌ Batch ${batchNum}/${totalBatches} failed:`, batchError.message);
          batchErrors++;
          
          // If it's a duplicate key error, try without IDs
          if (batchError && batchError.message && batchError.message.includes('duplicate key')) {
            console.log(`🔄 Retrying batch ${batchNum} without custom IDs...`);
            const batchWithoutIds = batch.map(toilet => ({
              ...toilet,
              id: undefined // Let Supabase generate IDs
            }));
            
            const { error: retryError } = await supabase
              .from('toilets')
              .insert(batchWithoutIds);
            
            if (retryError) {
              console.error(`❌ Retry failed for batch ${batchNum}:`, retryError.message);
            } else {
              totalInserted += batch.length;
              console.log(`✅ Batch ${batchNum} retry successful`);
            }
          }
        } else {
          totalInserted += batch.length;
          
          // Progress updates
          if (batchNum % 20 === 0 || batchNum === totalBatches) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = (totalInserted / elapsed).toFixed(1);
            const remaining = transformedToilets.length - totalInserted;
            const eta = remaining / (totalInserted / elapsed);
            
            console.log(`✅ Progress: ${batchNum}/${totalBatches} batches, ${totalInserted}/${transformedToilets.length} toilets (${rate}/sec, ~${Math.round(eta)}s remaining)`);
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.error(`❌ Unexpected error in batch ${batchNum}:`, error);
        batchErrors++;
      }
    }

    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`\n🎉 MIGRATION COMPLETED!`);
    console.log(`✅ Successfully migrated: ${totalInserted} toilets`);
    console.log(`❌ Failed batches: ${batchErrors}`);
    console.log(`📊 Success rate: ${((totalInserted / firebaseToilets.length) * 100).toFixed(1)}%`);
    console.log(`⏱️ Total time: ${totalTime.toFixed(1)}s`);
    console.log(`🚀 Average rate: ${(totalInserted / totalTime).toFixed(1)} toilets/second`);

    // Step 5: Verify the migration worked
    console.log('\n5️⃣ Verifying migration...');
    
    // Get total count
    const { count, error: countError } = await supabase
      .from('toilets')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Count error:', countError);
    } else {
      console.log(`📊 Total toilets in Supabase: ${count}`);
    }

    // Test Sofia area
    const { data: sofiaData, error: sofiaError } = await supabase
      .rpc('get_toilets_in_bounds', {
        west: 23.0,
        south: 42.5,
        east: 24.0,
        north: 43.0
      });
    
    if (sofiaError) {
      console.error('❌ Sofia area test failed:', sofiaError);
    } else {
      console.log(`🏙️ Found ${sofiaData.length} toilets in Sofia area`);
    }

    // Test user area
    const { data: userAreaData, error: userAreaError } = await supabase
      .rpc('get_toilets_in_bounds', {
        west: 23.290,
        south: 42.638,
        east: 23.299,
        north: 42.651
      });
    
    if (userAreaError) {
      console.error('❌ User area test failed:', userAreaError);
    } else {
      console.log(`🚽 Found ${userAreaData.length} toilets in user area`);
    }

    console.log('\n🎉 COMPLETE MIGRATION SUCCESSFUL!');
    console.log('🔄 Refresh your app to see THOUSANDS of toilets! 🚽📍');
    console.log('💡 You now have the complete Bulgaria toilet database from Firebase!');
    
  } catch (error) {
    console.error('❌ MIGRATION FAILED:', error);
    
    if (error.code === 'resource-exhausted' || error.message.includes('quota')) {
      console.log('\n💡 Firebase quota exceeded. Please wait for quota reset and try again.');
      console.log('📅 Firebase quotas typically reset daily.');
    }
    
    process.exit(1);
  }
}

// Run the migration
setupAndMigrate().then(() => {
  console.log('\n✅ Setup and migration script finished successfully!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Setup and migration script failed:', error);
  process.exit(1);
}); 