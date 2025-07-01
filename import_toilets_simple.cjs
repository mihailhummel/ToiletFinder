const fs = require('fs');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

// Use environment variables for database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function importToilets() {
  console.log('Starting toilet data import...');
  
  try {
    // Read the fetched toilet data
    const toiletData = JSON.parse(fs.readFileSync('real_toilets_data.json', 'utf8'));
    console.log(`Found ${toiletData.length} toilets to import`);

    // Clear existing toilets
    console.log('Clearing existing toilet data...');
    await pool.query('DELETE FROM toilets');

    // Import new toilets
    let imported = 0;
    
    for (const toilet of toiletData) {
      try {
        await pool.query(`
          INSERT INTO toilets (id, type, lat, lng, notes, user_id, created_at, average_rating, review_count)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          randomUUID(),
          toilet.type,
          toilet.coordinates.lat,
          toilet.coordinates.lng,
          toilet.notes,
          'system-import',
          new Date(toilet.createdAt),
          0,
          0
        ]);
        imported++;
        
        if (imported % 50 === 0) {
          console.log(`Imported ${imported}/${toiletData.length} toilets...`);
        }
      } catch (err) {
        console.log(`Error importing toilet ${toilet.id}:`, err.message);
      }
    }

    console.log(`Successfully imported ${imported} real toilet locations!`);
    
    // Show summary by type
    const result = await pool.query(`
      SELECT type, COUNT(*) as count 
      FROM toilets 
      GROUP BY type 
      ORDER BY count DESC
    `);
    
    console.log('\nToilet types in database:');
    result.rows.forEach(row => {
      console.log(`- ${row.type}: ${row.count} locations`);
    });

  } catch (error) {
    console.error('Error importing toilets:', error);
  } finally {
    await pool.end();
  }
}

importToilets();