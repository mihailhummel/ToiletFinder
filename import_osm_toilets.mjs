import fs from 'fs';

async function importOSMToilets() {
  try {
    console.log('Reading Bulgaria toilets data...');
    
    // Read the fetched toilet data
    const toiletsData = JSON.parse(fs.readFileSync('bulgaria_toilets_complete.json', 'utf8'));
    console.log(`Found ${toiletsData.length} toilets to import`);

    let imported = 0;
    let errors = 0;

    // Import toilets in batches using the API
    const BATCH_SIZE = 10;
    for (let i = 0; i < toiletsData.length; i += BATCH_SIZE) {
      const batch = toiletsData.slice(i, i + BATCH_SIZE);
      
      for (const toilet of batch) {
        try {
          const response = await fetch('http://localhost:5000/api/toilets', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: toilet.type,
              coordinates: toilet.coordinates,
              notes: toilet.notes,
              userId: toilet.userId
            })
          });

          if (response.ok) {
            imported++;
            if (imported % 50 === 0) {
              console.log(`Imported ${imported} toilets...`);
            }
          } else {
            const errorText = await response.text();
            console.error(`Failed to import toilet: ${errorText}`);
            errors++;
          }
        } catch (error) {
          console.error(`Error importing toilet:`, error.message);
          errors++;
        }
      }
      
      // Small delay between batches to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n=== Import Summary ===');
    console.log(`Total toilets processed: ${toiletsData.length}`);
    console.log(`Successfully imported: ${imported}`);
    console.log(`Errors: ${errors}`);

  } catch (error) {
    console.error('Error during import:', error);
    throw error;
  }
}

// Run the import
importOSMToilets().catch(console.error);