#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Supabase configuration
const SUPABASE_URL = 'https://fvohytokcumrauwplnwo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2h5dG9rY3VtcmF1d3BsbndvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg5MDczOCwiZXhwIjoyMDY3NDY2NzM4fQ.nJIBMdMfRd7BB38zS43g40zfLTLGisXVvaKH6SZDvXw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function importSampleData() {
  console.log('📊 Importing sample toilet data to Supabase...\n');

  try {
    // Read the Bulgaria toilets data
    console.log('📖 Reading bulgaria_toilets_complete.json...');
    const rawData = readFileSync('./bulgaria_toilets_complete.json', 'utf8');
    const toiletsData = JSON.parse(rawData);
    
    console.log(`📋 Found ${toiletsData.length} toilets in dataset`);

    // Transform data to Supabase format (take first 1000 for testing)
    const toiletsToImport = toiletsData.slice(0, 1000).map((toilet, index) => {
      // Handle different coordinate formats
      let coordinates;
      if (toilet.lat && toilet.lng) {
        coordinates = { lat: parseFloat(toilet.lat), lng: parseFloat(toilet.lng) };
      } else if (toilet.coordinates) {
        coordinates = toilet.coordinates;
      } else {
        console.warn(`Skipping toilet ${index} - invalid coordinates`);
        return null;
      }

      return {
        coordinates: coordinates,
        type: toilet.type || toilet.amenity || 'public',
        source: toilet.source || 'osm',
        tags: toilet.tags || toilet,
        notes: toilet.notes || toilet.name || null,
        is_removed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }).filter(toilet => toilet !== null);

    console.log(`✅ Prepared ${toiletsToImport.length} toilets for import`);

    // Import in batches of 100
    const BATCH_SIZE = 100;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < toiletsToImport.length; i += BATCH_SIZE) {
      const batch = toiletsToImport.slice(i, i + BATCH_SIZE);
      
      console.log(`📦 Importing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toiletsToImport.length / BATCH_SIZE)} (${batch.length} items)`);

      try {
        const { data, error } = await supabase
          .from('toilets')
          .insert(batch)
          .select();

        if (error) {
          console.error(`❌ Batch error:`, error.message);
          errors += batch.length;
        } else {
          imported += data.length;
          console.log(`✅ Imported ${data.length} toilets`);
        }
      } catch (error) {
        console.error(`❌ Batch exception:`, error.message);
        errors += batch.length;
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`✅ Successfully imported: ${imported} toilets`);
    console.log(`❌ Errors: ${errors} toilets`);
    console.log(`📈 Success rate: ${((imported / toiletsToImport.length) * 100).toFixed(1)}%`);

    // Verify import
    const { count, error: countError } = await supabase
      .from('toilets')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting records:', countError.message);
    } else {
      console.log(`\n🗄️ Total toilets in database: ${count}`);
    }

    // Test a sample query
    console.log('\n🧪 Testing sample queries...');
    
    const { data: sampleToilets, error: sampleError } = await supabase
      .from('toilets')
      .select('*')
      .limit(3);

    if (sampleError) {
      console.error('❌ Sample query failed:', sampleError.message);
    } else {
      console.log(`✅ Sample query successful - retrieved ${sampleToilets.length} toilets`);
      sampleToilets.forEach((toilet, i) => {
        console.log(`   ${i + 1}. ${toilet.coordinates.lat.toFixed(4)}, ${toilet.coordinates.lng.toFixed(4)} (${toilet.type})`);
      });
    }

    console.log('\n🎉 Sample data import completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Start your development server: npm run dev');
    console.log('2. Check the map for toilet markers');
    console.log('3. Test viewport filtering by moving the map');

  } catch (error) {
    console.error('💥 Import failed:', error);
    process.exit(1);
  }
}

importSampleData(); 