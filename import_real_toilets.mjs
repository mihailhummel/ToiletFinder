import fs from 'fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { toilets } from './shared/schema.ts';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function importToilets() {
  console.log('Starting toilet data import...');
  
  try {
    // Read the fetched toilet data
    const toiletData = JSON.parse(fs.readFileSync('real_toilets_data.json', 'utf8'));
    console.log(`Found ${toiletData.length} toilets to import`);

    // Clear existing toilets
    console.log('Clearing existing toilet data...');
    await db.delete(toilets);

    // Import new toilets in batches
    const batchSize = 50;
    let imported = 0;
    
    for (let i = 0; i < toiletData.length; i += batchSize) {
      const batch = toiletData.slice(i, i + batchSize);
      
      const toiletsToInsert = batch.map(toilet => ({
        id: toilet.id,
        type: toilet.type,
        lat: toilet.coordinates.lat,
        lng: toilet.coordinates.lng,
        notes: toilet.notes,
        userId: 'system-import',
        createdAt: new Date(toilet.createdAt),
        averageRating: 0,
        reviewCount: 0
      }));

      await db.insert(toilets).values(toiletsToInsert);
      imported += toiletsToInsert.length;
      console.log(`Imported ${imported}/${toiletData.length} toilets...`);
    }

    console.log(`Successfully imported ${imported} real toilet locations!`);
    
    // Show summary by type
    const typeCounts = toiletData.reduce((acc, toilet) => {
      acc[toilet.type] = (acc[toilet.type] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\nToilet types imported:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`- ${type}: ${count} locations`);
    });

  } catch (error) {
    console.error('Error importing toilets:', error);
  } finally {
    await client.end();
  }
}

importToilets();