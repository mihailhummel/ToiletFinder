import fs from 'fs';

// Overpass API query to get all toilets in Bulgaria
const overpassQuery = `
[out:json][timeout:120];
(
  area["ISO3166-1"="BG"][admin_level=2];
)->.bulgaria;
(
  node["amenity"="toilets"](area.bulgaria);
  way["amenity"="toilets"](area.bulgaria);
  relation["amenity"="toilets"](area.bulgaria);
  
  node["tourism"="information"]["information"="toilets"](area.bulgaria);
  
  node["amenity"="fuel"]["toilets"="yes"](area.bulgaria);
  way["amenity"="fuel"]["toilets"="yes"](area.bulgaria);
  
  node["amenity"="restaurant"]["toilets"="yes"](area.bulgaria);
  way["amenity"="restaurant"]["toilets"="yes"](area.bulgaria);
  
  node["amenity"="cafe"]["toilets"="yes"](area.bulgaria);
  way["amenity"="cafe"]["toilets"="yes"](area.bulgaria);
  
  node["shop"="supermarket"]["toilets"="yes"](area.bulgaria);
  way["shop"="supermarket"]["toilets"="yes"](area.bulgaria);
  
  node["amenity"="fast_food"]["toilets"="yes"](area.bulgaria);
  way["amenity"="fast_food"]["toilets"="yes"](area.bulgaria);
);
out center meta;
`;

async function fetchToilets() {
  console.log('Fetching toilet data from OpenStreetMap for Bulgaria...');
  
  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(overpassQuery)}`
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Found ${data.elements.length} toilet locations`);

    // Process and format the data
    const toilets = data.elements
      .filter(element => element.lat && element.lon)
      .map(element => {
        const tags = element.tags || {};
        
        // Determine toilet type
        let type = 'public';
        let name = 'Public Toilet';
        let availability = 'Public access';
        let accessibility = 'Unknown accessibility';
        
        // Determine type based on amenity and other tags
        if (tags.amenity === 'fuel' || tags.shop === 'fuel') {
          type = 'gas-station';
          name = tags.name || tags.brand || 'Gas Station Toilet';
          availability = 'Customer access';
        } else if (tags.amenity === 'restaurant') {
          type = 'restaurant';
          name = tags.name || 'Restaurant Restroom';
          availability = 'Customer access';
        } else if (tags.amenity === 'cafe') {
          type = 'cafe';
          name = tags.name || 'Cafe Restroom';
          availability = 'Customer access';
        } else if (tags.shop === 'supermarket' || tags.amenity === 'supermarket') {
          type = 'mall';
          name = tags.name || 'Supermarket Restroom';
          availability = 'Public during hours';
        } else if (tags.amenity === 'fast_food') {
          type = 'restaurant';
          name = tags.name || 'Fast Food Restroom';
          availability = 'Customer access';
        } else {
          // Default public toilet
          name = tags.name || 'Public Toilet';
          if (tags.operator) {
            name = `Toilet - ${tags.operator}`;
          }
        }

        // Check for accessibility info
        if (tags.wheelchair === 'yes') {
          accessibility = 'Wheelchair accessible';
        } else if (tags.wheelchair === 'no') {
          accessibility = 'Not wheelchair accessible';
        }

        // Check for fee information
        if (tags.fee === 'yes') {
          availability = 'Paid access';
        } else if (tags.fee === 'no') {
          availability = 'Free access';
        }

        // Build description
        let description = '';
        if (tags.description) description += tags.description + '. ';
        if (tags.opening_hours) description += `Hours: ${tags.opening_hours}. `;
        if (tags.operator) description += `Operated by: ${tags.operator}. `;
        if (tags.level) description += `Level: ${tags.level}. `;
        if (tags.baby_changing === 'yes') description += 'Baby changing available. ';
        if (tags.drinking_water === 'yes') description += 'Drinking water available. ';

        return {
          id: `osm-${element.type}-${element.id}`,
          type: type,
          name: name,
          coordinates: {
            lat: element.lat || element.center?.lat,
            lng: element.lon || element.center?.lon
          },
          availability: availability,
          accessibility: accessibility,
          notes: description.trim() || `${name} in Bulgaria`,
          source: 'OpenStreetMap',
          osmId: element.id,
          osmType: element.type,
          tags: tags
        };
      })
      .filter(toilet => toilet.coordinates.lat && toilet.coordinates.lng);

    console.log(`Processed ${toilets.length} valid toilet locations`);

    // Save to file
    fs.writeFileSync('bulgaria_toilets_full.json', JSON.stringify(toilets, null, 2));
    console.log('Toilet data saved to bulgaria_toilets_full.json');

    // Show sample of data
    console.log('Sample toilet data:');
    console.log(toilets.slice(0, 3).map(t => ({
      name: t.name,
      type: t.type,
      availability: t.availability,
      coordinates: t.coordinates,
      notes: t.notes.substring(0, 100) + '...'
    })));

    return toilets;

  } catch (error) {
    console.error('Error fetching toilet data:', error);
    return [];
  }
}

// Run the fetch
fetchToilets();