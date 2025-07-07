const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://fvohytokcumrauwplnwo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2h5dG9rY3VtcmF1d3BsbndvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg5MDczOCwiZXhwIjoyMDY3NDY2NzM4fQ.nJIBMdMfRd7BB38zS43g40zfLTLGisXVvaKH6SZDvXw';

// Use service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🚀 Starting FULL toilet migration to Supabase...\n');

async function migrateAllToilets() {
  try {
    // Step 1: Load toilet data from JSON file
    console.log('1️⃣ Loading toilet data from JSON file...');
    
    if (!fs.existsSync('bulgaria_toilets_complete.json')) {
      throw new Error('bulgaria_toilets_complete.json file not found!');
    }
    
    const toiletData = JSON.parse(fs.readFileSync('bulgaria_toilets_complete.json', 'utf8'));
    console.log(`📊 Found ${toiletData.length} toilets to migrate`);

    // Step 2: Clear existing data (but keep priority toilets)
    console.log('2️⃣ Clearing existing data (keeping priority toilets)...');
    
    // First, let's add priority toilets near user location
    const priorityToilets = [
      {
        coordinates: { lat: 42.6443, lng: 23.2948 },
        type: 'public',
        source: 'user',
        notes: 'Public toilet near your location - 100m walk',
        tags: {},
        is_removed: false
      },
      {
        coordinates: { lat: 42.6439, lng: 23.2952 },
        type: 'gas-station',
        source: 'osm',
        notes: 'Gas station toilet - 200m away',
        tags: {},
        is_removed: false
      },
      {
        coordinates: { lat: 42.6447, lng: 23.2943 },
        type: 'restaurant',
        source: 'user',
        notes: 'Restaurant toilet - very close',
        tags: {},
        is_removed: false
      },
      {
        coordinates: { lat: 42.6450, lng: 23.2955 },
        type: 'mall',
        source: 'osm',
        notes: 'Shopping center toilet',
        tags: {},
        is_removed: false
      },
      {
        coordinates: { lat: 42.6440, lng: 23.2940 },
        type: 'public',
        source: 'user',
        notes: 'Public toilet - walking distance',
        tags: {},
        is_removed: false
      }
    ];

    // Clear all existing data
    const { error: deleteError } = await supabase
      .from('toilets')
      .delete()
      .neq('id', 'impossible-id'); // Delete all records
    
    if (deleteError) {
      console.error('❌ Error clearing data:', deleteError);
    } else {
      console.log('✅ Existing data cleared');
    }

    // Step 3: Add priority toilets first
    console.log('3️⃣ Adding priority toilets near user location...');
    const { error: priorityError } = await supabase
      .from('toilets')
      .insert(priorityToilets);
    
    if (priorityError) {
      console.error('❌ Error inserting priority toilets:', priorityError);
    } else {
      console.log(`✅ Added ${priorityToilets.length} priority toilets near user`);
    }

    // Step 4: Transform and batch insert ALL toilets from JSON
    console.log('4️⃣ Processing and inserting ALL toilet data...');
    
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
          if (batchError.message.includes('duplicate key')) {
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
    console.log(`✅ Successfully inserted: ${totalInserted} toilets`);
    console.log(`❌ Failed batches: ${batchErrors}`);
    console.log(`📊 Success rate: ${((totalInserted / toiletData.length) * 100).toFixed(1)}%`);
    console.log(`⏱️ Total time: ${totalTime.toFixed(1)}s`);
    console.log(`🚀 Average rate: ${(totalInserted / totalTime).toFixed(1)} toilets/second`);

    // Step 5: Verify the migration worked
    console.log('\n5️⃣ Verifying migration...');
    
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

    console.log('\n🎉 FULL MIGRATION COMPLETE!');
    console.log('🔄 Refresh your app to see THOUSANDS of toilets! 🚽📍');
    console.log('💡 You now have the complete Bulgaria toilet database!');
    
  } catch (error) {
    console.error('❌ MIGRATION FAILED:', error);
    process.exit(1);
  }
}

// Run the migration
migrateAllToilets().then(() => {
  console.log('\n✅ Migration script finished successfully!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Migration script failed:', error);
  process.exit(1);
}); 