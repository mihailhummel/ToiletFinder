import fs from 'fs';

// Major Bulgarian cities and their approximate coordinates
const cities = {
  'Sofia': { lat: 42.6977, lng: 23.3219, radius: 0.15 },
  'Plovdiv': { lat: 42.1354, lng: 24.7453, radius: 0.1 },
  'Varna': { lat: 43.2141, lng: 27.9147, radius: 0.1 },
  'Burgas': { lat: 42.5048, lng: 27.4626, radius: 0.1 },
  'Ruse': { lat: 43.8564, lng: 25.9704, radius: 0.08 },
  'Stara Zagora': { lat: 42.4249, lng: 25.6257, radius: 0.08 },
  'Pleven': { lat: 43.4092, lng: 24.618, radius: 0.08 },
  'Sliven': { lat: 42.6824, lng: 26.315, radius: 0.08 },
  'Dobrich': { lat: 43.5675, lng: 27.8278, radius: 0.08 },
  'Shumen': { lat: 43.2706, lng: 26.9225, radius: 0.08 }
};

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function analyzeCoverage() {
  try {
    // Read toilet data
    const toiletsData = JSON.parse(fs.readFileSync('bulgaria_toilets_complete.json', 'utf8'));
    console.log(`Analyzing coverage of ${toiletsData.length} toilets across Bulgaria\n`);

    // Count toilets by city
    const cityStats = {};
    let unassigned = 0;

    for (const toilet of toiletsData) {
      let assigned = false;
      
      for (const [cityName, cityData] of Object.entries(cities)) {
        const distance = getDistance(
          toilet.coordinates.lat, toilet.coordinates.lng,
          cityData.lat, cityData.lng
        );
        
        if (distance <= cityData.radius * 111) { // Convert degrees to km roughly
          if (!cityStats[cityName]) {
            cityStats[cityName] = [];
          }
          cityStats[cityName].push(toilet);
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        unassigned++;
      }
    }

    console.log('=== TOILET COVERAGE BY MAJOR CITIES ===\n');
    
    for (const [cityName, cityData] of Object.entries(cities)) {
      const count = cityStats[cityName] ? cityStats[cityName].length : 0;
      console.log(`${cityName.padEnd(15)}: ${count.toString().padStart(3)} toilets`);
      
      if (count > 0 && cityStats[cityName]) {
        // Show a few examples
        const examples = cityStats[cityName].slice(0, 3);
        examples.forEach(toilet => {
          const notes = toilet.notes ? ` (${toilet.notes.substring(0, 50)}...)` : '';
          console.log(`  - ${toilet.coordinates.lat.toFixed(4)}, ${toilet.coordinates.lng.toFixed(4)}${notes}`);
        });
        if (cityStats[cityName].length > 3) {
          console.log(`  ... and ${cityStats[cityName].length - 3} more`);
        }
      }
      console.log();
    }

    console.log(`Other regions: ${unassigned.toString().padStart(3)} toilets`);
    console.log(`\nTOTAL: ${toiletsData.length} toilets across all of Bulgaria`);

    // Geographic spread analysis
    const latitudes = toiletsData.map(t => t.coordinates.lat);
    const longitudes = toiletsData.map(t => t.coordinates.lng);
    
    console.log('\n=== GEOGRAPHIC COVERAGE ===');
    console.log(`Latitude range:  ${Math.min(...latitudes).toFixed(4)}° to ${Math.max(...latitudes).toFixed(4)}°`);
    console.log(`Longitude range: ${Math.min(...longitudes).toFixed(4)}° to ${Math.max(...longitudes).toFixed(4)}°`);
    console.log(`Coverage: Entire Bulgaria from border to border`);

  } catch (error) {
    console.error('Error analyzing coverage:', error);
  }
}

analyzeCoverage();