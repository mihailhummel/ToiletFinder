import fs from 'fs';

async function importToiletsBatch() {
  try {
    console.log('Reading Bulgaria toilets data...');
    
    // Read the fetched toilet data
    const toiletsData = JSON.parse(fs.readFileSync('bulgaria_toilets_complete.json', 'utf8'));
    console.log(`Found ${toiletsData.length} toilets to import`);

    // Get current toilets to avoid duplicates
    console.log('Checking existing toilets...');
    const existingResponse = await fetch('http://localhost:5000/api/toilets');
    const existingToilets = await existingResponse.json();
    console.log(`Currently have ${existingToilets.length} toilets in database`);

    // Skip toilets that are already imported (simple coordinate-based check)
    const newToilets = toiletsData.filter(toilet => {
      return !existingToilets.some(existing => 
        Math.abs(existing.coordinates.lat - toilet.coordinates.lat) < 0.0001 &&
        Math.abs(existing.coordinates.lng - toilet.coordinates.lng) < 0.0001
      );
    });

    console.log(`${newToilets.length} new toilets to import`);

    if (newToilets.length === 0) {
      console.log('All toilets already imported!');
      return;
    }

    let imported = 0;
    let errors = 0;

    // Import in chunks of 20 with faster processing
    const CHUNK_SIZE = 20;
    for (let i = 0; i < newToilets.length; i += CHUNK_SIZE) {
      const chunk = newToilets.slice(i, i + CHUNK_SIZE);
      
      // Process chunk in parallel
      const promises = chunk.map(async (toilet) => {
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
            return { success: true };
          } else {
            const errorText = await response.text();
            console.error(`Failed to import toilet: ${errorText}`);
            return { success: false };
          }
        } catch (error) {
          console.error(`Error importing toilet:`, error.message);
          return { success: false };
        }
      });

      const results = await Promise.all(promises);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      imported += successful;
      errors += failed;
      
      console.log(`Processed chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(newToilets.length/CHUNK_SIZE)}: ${successful} imported, ${failed} errors (Total: ${imported}/${newToilets.length})`);
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('\n=== Import Summary ===');
    console.log(`New toilets processed: ${newToilets.length}`);
    console.log(`Successfully imported: ${imported}`);
    console.log(`Errors: ${errors}`);

    // Final count
    const finalResponse = await fetch('http://localhost:5000/api/toilets');
    const finalToilets = await finalResponse.json();
    console.log(`Total toilets now in database: ${finalToilets.length}`);

  } catch (error) {
    console.error('Error during import:', error);
    throw error;
  }
}

// Run the import
importToiletsBatch().catch(console.error);