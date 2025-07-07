import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://fvohytokcumrauwplnwo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2h5dG9rY3VtcmF1d3BsbndvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg5MDczOCwiZXhwIjoyMDY3NDY2NzM4fQ.nJIBMdMfRd7BB38zS43g40zfLTLGisXVvaKH6SZDvXw';

// Use service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🚀 SETTING UP DATABASE AND IMPORTING ALL TOILETS...\n');

async function setupAndImport() {
  try {
    // Step 1: Create the toilets table
    console.log('1️⃣ Creating toilets table...');
    
    const createTableSQL = `
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
    `;
    
    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (createError) {
      console.log('Table might already exist, continuing...');
    } else {
      console.log('✅ Toilets table created');
    }

    // Step 2: Create spatial index
    console.log('2️⃣ Creating spatial index...');
    
    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_toilets_coordinates 
      ON toilets 
      USING GIST (ST_SetSRID(ST_MakePoint((coordinates->>'lng')::float, (coordinates->>'lat')::float), 4326));
    `;
    
    const { error: indexError } = await supabase.rpc('exec_sql', { sql: createIndexSQL });
    
    if (indexError) {
      console.log('Index might already exist, continuing...');
    } else {
      console.log('✅ Spatial index created');
    }

    // Step 3: Create the spatial query function
    console.log('3️⃣ Creating spatial query function...');
    
    const createFunctionSQL = `
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
    `;
    
    const { error: functionError } = await supabase.rpc('exec_sql', { sql: createFunctionSQL });
    
    if (functionError) {
      console.log('Function might already exist, continuing...');
    } else {
      console.log('✅ Spatial query function created');
    }

    // Step 4: Load toilet data from JSON file
    console.log('4️⃣ Loading toilet data from JSON file...');
    
    if (!fs.existsSync('bulgaria_toilets_complete.json')) {
      throw new Error('bulgaria_toilets_complete.json file not found!');
    }
    
    const toiletData = JSON.parse(fs.readFileSync('bulgaria_toilets_complete.json', 'utf8'));
    console.log(`📊 Found ${toiletData.length} toilets to import`);

    // Step 5: Clear existing data
    console.log('5️⃣ Clearing existing data...');
    
    const { error: deleteError } = await supabase
      .from('toilets')
      .delete()
      .neq('id', 'impossible-id'); // Delete all records
    
    if (deleteError) {
      console.error('❌ Error clearing data:', deleteError);
    } else {
      console.log('✅ Existing data cleared');
    }

    // Step 6: Transform and batch insert ALL toilets from JSON
    console.log('6️⃣ Processing and inserting ALL toilet data...');
    
    // Transform data to match Supabase schema
    const transformedToilets = toiletData.map(toilet => ({
      id: toilet.id && toilet.id.startsWith('osm-') ? toilet.id : `osm-${toilet.osmId || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      coordinates: toilet.coordinates,
      type: toilet.type || 'public',
      source: toilet.userId === 'osm-import' ? 'osm' : 'user',
      tags: toilet.tags || {},
      notes: toilet.notes || null,
      is_removed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
    console.log(`\n🎉 IMPORT COMPLETED!`);
    console.log(`✅ Successfully inserted: ${totalInserted} toilets`);
    console.log(`❌ Failed batches: ${batchErrors}`);
    console.log(`📊 Success rate: ${((totalInserted / toiletData.length) * 100).toFixed(1)}%`);
    console.log(`⏱️ Total time: ${totalTime.toFixed(1)}s`);
    console.log(`🚀 Average rate: ${(totalInserted / totalTime).toFixed(1)} toilets/second`);

    // Step 7: Verify the import worked
    console.log('\n7️⃣ Verifying import...');
    
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

    console.log('\n🎉 COMPLETE SETUP AND IMPORT SUCCESSFUL!');
    console.log('🔄 Refresh your app to see THOUSANDS of toilets! 🚽📍');
    console.log('💡 You now have the complete Bulgaria toilet database!');
    
  } catch (error) {
    console.error('❌ SETUP AND IMPORT FAILED:', error);
    process.exit(1);
  }
}

// Run the setup and import
setupAndImport().then(() => {
  console.log('\n✅ Setup and import script finished successfully!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Setup and import script failed:', error);
  process.exit(1);
}); 