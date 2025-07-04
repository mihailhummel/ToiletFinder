import fs from 'fs';

const API_KEY = '9236b89817ba4409a5ffd0331822e853';
const bbox = [22.4, 41.2, 28.6, 44.2]; // minLon, minLat, maxLon, maxLat for Bulgaria
const categories = [
  'amenity.toilet',
  'service.vehicle.fuel',
  'commercial.shopping_mall',
  'commercial.shopping_center',
  'transport.bus_station',
  'transport.train_station'
];
const LIMIT = 500;

async function fetchGeoapifyPOIs() {
  let allFeatures = [];
  for (const category of categories) {
    let offset = 0;
    let fetched = 0;
    while (true) {
      const url = `https://api.geoapify.com/v2/places?categories=${category}&filter=rect:${bbox.join(',')}&limit=${LIMIT}&offset=${offset}&apiKey=${API_KEY}`;
      console.log(`Fetching ${category} from Geoapify (offset ${offset})...`);
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch ${category} (offset ${offset}):`, await response.text());
        break;
      }
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        allFeatures = allFeatures.concat(data.features);
        fetched += data.features.length;
        console.log(`Fetched ${data.features.length} ${category} locations (offset ${offset}).`);
        if (data.features.length < LIMIT) break; // Last page
        offset += LIMIT;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Avoid rate limits
      } else {
        break;
      }
    }
    if (fetched === 0) {
      console.log(`No results for ${category}.`);
    }
  }

  // Map to unified POI format
  const pois = allFeatures.map(f => {
    const props = f.properties;
    return {
      id: `geoapify-${props.place_id}`,
      type: props.categories ? props.categories[0] : 'other',
      label: props.name || props.street || props.address_line2 || 'Unknown',
      coordinates: f.geometry && f.geometry.coordinates ? { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] } : undefined,
      notes: [
        props.name ? `Name: ${props.name}` : '',
        props.street ? `Street: ${props.street}` : '',
        props.city ? `City: ${props.city}` : '',
        props.postcode ? `Postcode: ${props.postcode}` : '',
        props.datasource ? `Source: ${props.datasource}` : '',
        props.website ? `Website: ${props.website}` : '',
        props.opening_hours ? `Hours: ${props.opening_hours}` : '',
        props.datasource ? `Source: ${props.datasource}` : ''
      ].filter(Boolean).join('\n'),
      isToilet: props.categories && props.categories.includes('amenity.toilet'),
      isFree: props.free !== undefined ? props.free : undefined,
      isAccessible: props.wheelchair !== undefined ? props.wheelchair : undefined,
      source: 'geoapify',
      raw: props
    };
  }).filter(poi => poi.coordinates && poi.coordinates.lat && poi.coordinates.lng);

  fs.writeFileSync('bulgaria_geoapify_pois.json', JSON.stringify(pois, null, 2));
  console.log(`Saved ${pois.length} POIs to bulgaria_geoapify_pois.json`);
}

fetchGeoapifyPOIs().catch(console.error); 