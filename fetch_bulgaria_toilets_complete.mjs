import fs from 'fs';

// Overpass API query to get all relevant POIs in Bulgaria using bounding box
// Bulgaria coordinates: approximately 41.2-44.2°N, 22.4-28.6°E
const overpassQuery = `
[out:json][timeout:90];
(
  node[amenity=toilets](41.2,22.4,44.2,28.6);
  way[amenity=toilets](41.2,22.4,44.2,28.6);
  relation[amenity=toilets](41.2,22.4,44.2,28.6);
  node[amenity=fuel](41.2,22.4,44.2,28.6);
  way[amenity=fuel](41.2,22.4,44.2,28.6);
  relation[amenity=fuel](41.2,22.4,44.2,28.6);
  node[shop=mall](41.2,22.4,44.2,28.6);
  way[shop=mall](41.2,22.4,44.2,28.6);
  relation[shop=mall](41.2,22.4,44.2,28.6);
  node[amenity=shopping_mall](41.2,22.4,44.2,28.6);
  way[amenity=shopping_mall](41.2,22.4,44.2,28.6);
  relation[amenity=shopping_mall](41.2,22.4,44.2,28.6);
  node[amenity=shopping_center](41.2,22.4,44.2,28.6);
  way[amenity=shopping_center](41.2,22.4,44.2,28.6);
  relation[amenity=shopping_center](41.2,22.4,44.2,28.6);
  node[amenity=bus_station](41.2,22.4,44.2,28.6);
  way[amenity=bus_station](41.2,22.4,44.2,28.6);
  relation[amenity=bus_station](41.2,22.4,44.2,28.6);
  node[railway=station](41.2,22.4,44.2,28.6);
  way[railway=station](41.2,22.4,44.2,28.6);
  relation[railway=station](41.2,22.4,44.2,28.6);
);
out geom;
`;

async function fetchBulgariaPOIs() {
  try {
    console.log('Fetching POI data from OpenStreetMap for Bulgaria...');
    
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
    console.log(`Found ${data.elements.length} POIs in Bulgaria`);

    // Convert OpenStreetMap data to our format
    const pois = data.elements.map(element => {
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

      // Determine POI type and label
      let type = 'other';
      let label = 'Unknown';
      let isToilet = false;
      let isFree = undefined;
      let isAccessible = undefined;
      let source = 'osm';
      if (tags.amenity === 'toilets') {
        type = 'toilet';
        label = tags.name || 'Public Toilet';
        isToilet = true;
        isFree = tags.fee === 'no' || tags.fee === undefined;
      } else if (tags.amenity === 'fuel') {
        type = 'gas_station';
        label = tags.name || tags.brand || tags.operator || 'Gas Station';
        isFree = true; // Most gas stations allow free toilet use
      } else if (tags.shop === 'mall' || tags.amenity === 'shopping_mall' || tags.amenity === 'shopping_center') {
        type = 'mall';
        label = tags.name || tags.brand || tags.operator || 'Shopping Mall';
        isFree = true; // Most malls allow free toilet use
      } else if (tags.amenity === 'bus_station') {
        type = 'bus_station';
        label = tags.name || tags.operator || 'Bus Station';
        isFree = false; // Most bus stations charge a fee
      } else if (tags.railway === 'station') {
        type = 'train_station';
        label = tags.name || tags.operator || 'Train Station';
        isFree = false; // Most train stations charge a fee
      }
      if (tags.wheelchair) {
        isAccessible = tags.wheelchair === 'yes';
      }

      // Create description from available tags
      const descriptionParts = [];
      if (tags.name) descriptionParts.push(`Name: ${tags.name}`);
      if (tags.brand) descriptionParts.push(`Brand: ${tags.brand}`);
      if (tags.operator) descriptionParts.push(`Operator: ${tags.operator}`);
      if (tags.opening_hours) descriptionParts.push(`Hours: ${tags.opening_hours}`);
      if (tags.fee) descriptionParts.push(`Fee: ${tags.fee}`);
      if (tags.wheelchair) descriptionParts.push(`Wheelchair accessible: ${tags.wheelchair}`);
      if (tags.access) descriptionParts.push(`Access: ${tags.access}`);
      if (tags.website) descriptionParts.push(`Website: ${tags.website}`);
      if (tags.phone) descriptionParts.push(`Phone: ${tags.phone}`);
      if (tags.email) descriptionParts.push(`Email: ${tags.email}`);
      if (tags.address) descriptionParts.push(`Address: ${tags.address}`);
      if (tags['addr:full']) descriptionParts.push(`Address: ${tags['addr:full']}`);
      if (tags['addr:street']) descriptionParts.push(`Street: ${tags['addr:street']}`);
      if (tags['addr:city']) descriptionParts.push(`City: ${tags['addr:city']}`);
      if (tags['addr:housenumber']) descriptionParts.push(`House number: ${tags['addr:housenumber']}`);
      if (tags['addr:postcode']) descriptionParts.push(`Postcode: ${tags['addr:postcode']}`);
      
      return {
        id: `osm-${element.type}-${element.id}`,
        type,
        label,
        coordinates: lat && lng ? { lat, lng } : undefined,
        notes: descriptionParts.length > 0 ? descriptionParts.join('\n') : undefined,
        userId: 'osm-import',
        osmId: element.id,
        osmType: element.type,
        tags,
        isToilet,
        isFree,
        isAccessible,
        source
      };
    }).filter(poi => poi.coordinates && poi.coordinates.lat && poi.coordinates.lng); // Only keep POIs with valid coordinates

    // Save to file
    fs.writeFileSync('bulgaria_pois_complete.json', JSON.stringify(pois, null, 2));
    console.log(`Successfully saved ${pois.length} POIs to bulgaria_pois_complete.json`);

    // Also save raw OSM data for reference
    fs.writeFileSync('bulgaria_pois_osm_raw.json', JSON.stringify(data, null, 2));
    console.log('Raw OSM data saved to bulgaria_pois_osm_raw.json');

    return pois;
  } catch (error) {
    console.error('Error fetching Bulgaria POI data:', error);
    throw error;
  }
}

// Run the script
fetchBulgariaPOIs().catch(console.error);