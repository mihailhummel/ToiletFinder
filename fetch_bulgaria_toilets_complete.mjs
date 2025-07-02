import fs from 'fs';

// Overpass API query to get all toilets in Bulgaria using bounding box
// Bulgaria coordinates: approximately 41.2-44.2°N, 22.4-28.6°E
const overpassQuery = `
[out:json][timeout:60];
(
  node[amenity=toilets](41.2,22.4,44.2,28.6);
  way[amenity=toilets](41.2,22.4,44.2,28.6);
  relation[amenity=toilets](41.2,22.4,44.2,28.6);
);
out geom;
`;

async function fetchBulgariaToilets() {
  try {
    console.log('Fetching toilet data from OpenStreetMap for Bulgaria...');
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(overpassQuery),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Found ${data.elements.length} toilet facilities in Bulgaria`);

    // Convert OpenStreetMap data to our format
    const toilets = data.elements.map(element => {
      const tags = element.tags || {};
      
      // Get coordinates
      let lat, lng;
      if (element.type === 'node') {
        lat = element.lat;
        lng = element.lon;
      } else if (element.center) {
        lat = element.center.lat;
        lng = element.center.lon;
      } else if (element.lat && element.lon) {
        lat = element.lat;
        lng = element.lon;
      }

      // Determine toilet type based on tags
      let type = 'public'; // default
      if (tags.access === 'customers') type = 'restaurant';
      else if (tags.operator && tags.operator.toLowerCase().includes('gas')) type = 'gas-station';
      else if (tags.operator && (tags.operator.toLowerCase().includes('mall') || tags.operator.toLowerCase().includes('center'))) type = 'mall';
      else if (tags.amenity === 'cafe' || tags.operator && tags.operator.toLowerCase().includes('cafe')) type = 'cafe';
      else if (tags.access === 'private') type = 'other';

      // Create description from available tags
      const descriptionParts = [];
      if (tags.name) descriptionParts.push(`Name: ${tags.name}`);
      if (tags.opening_hours) descriptionParts.push(`Hours: ${tags.opening_hours}`);
      if (tags.fee) descriptionParts.push(`Fee: ${tags.fee}`);
      if (tags.wheelchair) descriptionParts.push(`Wheelchair accessible: ${tags.wheelchair}`);
      if (tags.operator) descriptionParts.push(`Operator: ${tags.operator}`);
      if (tags.access) descriptionParts.push(`Access: ${tags.access}`);
      
      return {
        id: `osm-${element.type}-${element.id}`,
        type: type,
        coordinates: {
          lat: lat,
          lng: lng
        },
        notes: descriptionParts.length > 0 ? descriptionParts.join('\n') : undefined,
        userId: 'osm-import', // Special user ID for OSM imports
        osmId: element.id,
        osmType: element.type,
        tags: tags
      };
    }).filter(toilet => toilet.coordinates.lat && toilet.coordinates.lng); // Only keep toilets with valid coordinates

    // Save to file
    fs.writeFileSync('bulgaria_toilets_complete.json', JSON.stringify(toilets, null, 2));
    console.log(`Successfully saved ${toilets.length} toilet locations to bulgaria_toilets_complete.json`);

    // Also save raw OSM data for reference
    fs.writeFileSync('bulgaria_toilets_osm_raw.json', JSON.stringify(data, null, 2));
    console.log('Raw OSM data saved to bulgaria_toilets_osm_raw.json');

    return toilets;
  } catch (error) {
    console.error('Error fetching Bulgaria toilet data:', error);
    throw error;
  }
}

// Run the script
fetchBulgariaToilets().catch(console.error);