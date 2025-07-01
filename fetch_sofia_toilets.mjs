import fs from 'fs';

// More focused query for Sofia and major Bulgarian cities
const overpassQuery = `
[out:json][timeout:60];
(
  // Sofia area
  node["amenity"="toilets"](42.5,23.1,42.8,23.5);
  way["amenity"="toilets"](42.5,23.1,42.8,23.5);
  
  // Plovdiv area  
  node["amenity"="toilets"](42.1,24.7,42.2,24.8);
  way["amenity"="toilets"](42.1,24.7,42.2,24.8);
  
  // Varna area
  node["amenity"="toilets"](43.1,27.8,43.3,28.0);
  way["amenity"="toilets"](43.1,27.8,43.3,28.0);
  
  // Gas stations with toilets in Sofia area
  node["amenity"="fuel"](42.5,23.1,42.8,23.5);
  way["amenity"="fuel"](42.5,23.1,42.8,23.5);
  
  // Shopping centers in Sofia
  node["shop"="mall"](42.5,23.1,42.8,23.5);
  way["shop"="mall"](42.5,23.1,42.8,23.5);
  node["amenity"="marketplace"](42.5,23.1,42.8,23.5);
  way["amenity"="marketplace"](42.5,23.1,42.8,23.5);
);
out center meta;
`;

async function fetchToilets() {
  console.log('Fetching toilet data for major Bulgarian cities...');
  
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
    console.log(`Found ${data.elements.length} locations`);

    // Process and format the data
    const toilets = data.elements
      .filter(element => element.lat && element.lon)
      .map((element, index) => {
        const tags = element.tags || {};
        
        // Determine toilet type and details
        let type = 'public';
        let name = 'Public Toilet';
        let availability = 'Public access';
        let accessibility = 'Accessibility unknown';
        let notes = '';
        
        if (tags.amenity === 'fuel') {
          type = 'gas-station';
          name = `Toilet at ${tags.brand || tags.name || 'Gas Station'}`;
          availability = 'Customer access preferred';
          notes = 'Gas station restroom. ';
        } else if (tags.shop === 'mall' || tags.amenity === 'marketplace') {
          type = 'mall';
          name = `Restroom at ${tags.name || 'Shopping Center'}`;
          availability = 'Public during hours';
          notes = 'Shopping center restroom. ';
        } else if (tags.amenity === 'toilets') {
          name = tags.name || 'Public Toilet';
          if (tags.operator) {
            name = `Toilet - ${tags.operator}`;
            notes += `Operated by ${tags.operator}. `;
          }
        }

        // Accessibility info
        if (tags.wheelchair === 'yes') {
          accessibility = 'Wheelchair accessible';
        } else if (tags.wheelchair === 'no') {
          accessibility = 'Not wheelchair accessible';
        }

        // Fee information
        if (tags.fee === 'yes') {
          availability = 'Paid access';
          notes += 'Fee required. ';
        } else if (tags.fee === 'no') {
          availability = 'Free access';
        }

        // Additional details
        if (tags.opening_hours) {
          notes += `Hours: ${tags.opening_hours}. `;
        }
        if (tags.baby_changing === 'yes') {
          notes += 'Baby changing available. ';
        }
        if (tags.drinking_water === 'yes') {
          notes += 'Drinking water available. ';
        }

        // Location context
        const lat = element.lat || element.center?.lat;
        const lng = element.lon || element.center?.lon;
        let locationContext = '';
        if (lat >= 42.5 && lat <= 42.8 && lng >= 23.1 && lng <= 23.5) {
          locationContext = 'Sofia';
        } else if (lat >= 42.1 && lat <= 42.2 && lng >= 24.7 && lng <= 24.8) {
          locationContext = 'Plovdiv';
        } else if (lat >= 43.1 && lat <= 43.3 && lng >= 27.8 && lng <= 28.0) {
          locationContext = 'Varna';
        }

        if (locationContext) {
          notes += `Located in ${locationContext}. `;
        }

        return {
          id: `toilet-${Date.now()}-${index}`,
          type: type,
          coordinates: { lat, lng },
          notes: notes.trim() || name,
          userId: 'system',
          createdAt: new Date().toISOString(),
          name: name,
          availability: availability,
          accessibility: accessibility,
          source: 'OpenStreetMap',
          osmId: element.id
        };
      })
      .filter(toilet => toilet.coordinates.lat && toilet.coordinates.lng);

    console.log(`Processed ${toilets.length} valid toilet locations`);

    if (toilets.length > 0) {
      fs.writeFileSync('real_toilets_data.json', JSON.stringify(toilets, null, 2));
      console.log('Toilet data saved to real_toilets_data.json');

      console.log('Sample toilet locations:');
      toilets.slice(0, 5).forEach(toilet => {
        console.log(`- ${toilet.name} (${toilet.type}) - ${toilet.availability}`);
      });
    }

    return toilets;

  } catch (error) {
    console.error('Error fetching toilet data:', error);
    return [];
  }
}

fetchToilets();