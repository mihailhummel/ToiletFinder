const fs = require('fs');

// Read the toilet data from OpenStreetMap
const data = JSON.parse(fs.readFileSync('/tmp/bulgaria_toilets.json', 'utf8'));

console.log(`Processing ${data.elements.length} toilets from Bulgaria...`);

// Function to determine toilet type based on OpenStreetMap tags
function getToiletType(tags) {
  // Check for specific venue types based on location context
  if (tags.building === 'gas_station' || tags.operator?.toLowerCase().includes('газ') || 
      tags.operator?.toLowerCase().includes('petrol') || tags.operator?.toLowerCase().includes('lukoil') || 
      tags.operator?.toLowerCase().includes('shell') || tags.operator?.toLowerCase().includes('omv')) {
    return 'gas-station';
  }
  
  if (tags.building === 'commercial' || tags.amenity === 'restaurant' || 
      tags.cuisine || tags.operator?.toLowerCase().includes('restaurant')) {
    return 'restaurant';
  }
  
  if (tags.building === 'retail' || tags.shop || tags.operator?.toLowerCase().includes('mall')) {
    return 'mall';
  }
  
  if (tags.amenity === 'cafe' || tags.operator?.toLowerCase().includes('cafe')) {
    return 'cafe';
  }
  
  // Default to public toilet
  return 'public';
}

// Function to create description from OSM tags
function createDescription(tags) {
  let description = [];
  
  if (tags.name) {
    description.push(tags.name);
  }
  
  if (tags.operator) {
    description.push(`Operated by: ${tags.operator}`);
  }
  
  if (tags.access && tags.access !== 'public') {
    description.push(`Access: ${tags.access}`);
  }
  
  if (tags.fee === 'yes') {
    description.push('Fee required');
  } else if (tags.fee === 'no') {
    description.push('Free');
  }
  
  if (tags.wheelchair === 'yes') {
    description.push('Wheelchair accessible');
  } else if (tags.wheelchair === 'no') {
    description.push('Not wheelchair accessible');
  }
  
  if (tags.opening_hours) {
    description.push(`Hours: ${tags.opening_hours}`);
  }
  
  if (tags.toilets_disposal) {
    description.push(`Type: ${tags.toilets_disposal}`);
  }
  
  return description.length > 0 ? description.join(' • ') : 'Public toilet facility';
}

// Process toilets and generate INSERT statements
const toilets = data.elements
  .filter(element => element.lat && element.lon) // Only elements with coordinates
  .map(toilet => {
    const tags = toilet.tags || {};
    return {
      type: getToiletType(tags),
      coordinates: {
        lat: toilet.lat,
        lng: toilet.lon
      },
      notes: createDescription(tags),
      userId: 'osm-import'
    };
  });

console.log(`Processed ${toilets.length} valid toilet locations`);

// Sort by distance from Sofia center for prioritized insertion
const sofiaCenter = { lat: 42.6977, lng: 23.3219 };
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

toilets.sort((a, b) => {
  const distA = getDistance(sofiaCenter.lat, sofiaCenter.lng, a.coordinates.lat, a.coordinates.lng);
  const distB = getDistance(sofiaCenter.lat, sofiaCenter.lng, b.coordinates.lat, b.coordinates.lng);
  return distA - distB;
});

// Output first 50 toilets closest to Sofia for immediate testing
const sofiaToilets = toilets.slice(0, 50);
console.log(`\nFirst 50 toilets closest to Sofia:`);

sofiaToilets.forEach((toilet, index) => {
  const distance = getDistance(sofiaCenter.lat, sofiaCenter.lng, toilet.coordinates.lat, toilet.coordinates.lng);
  console.log(`${index + 1}. ${toilet.type} at ${toilet.coordinates.lat.toFixed(5)}, ${toilet.coordinates.lng.toFixed(5)} (${distance.toFixed(1)}km from Sofia) - ${toilet.notes.substring(0, 50)}...`);
});

// Generate curl commands for the first 10 toilets
console.log(`\n\n=== CURL COMMANDS FOR FIRST 10 TOILETS ===\n`);

sofiaToilets.slice(0, 10).forEach((toilet, index) => {
  const curlCommand = `curl -X POST http://localhost:5000/api/toilets \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(toilet)}'`;
  
  console.log(`# Toilet ${index + 1}: ${toilet.notes.substring(0, 40)}...`);
  console.log(curlCommand);
  console.log('');
});