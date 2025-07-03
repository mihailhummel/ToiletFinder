const fs = require('fs');
const https = require('https');

const overpassUrl = 'https://overpass-api.de/api/interpreter';
const query = `
[out:json][timeout:60];
area["name"="Bulgaria"]->.searchArea;
(
  node["amenity"="fuel"](area.searchArea);
);
out body;
`;

console.log('Fetching gas stations in Bulgaria from Overpass API...');

const req = https.request(
  overpassUrl,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        fs.writeFileSync('bulgaria_gas_stations.json', JSON.stringify(json, null, 2));
        console.log('Saved gas stations to bulgaria_gas_stations.json');
      } catch (err) {
        console.error('Error parsing or saving data:', err);
      }
    });
  }
);

req.on('error', (err) => {
  console.error('Request error:', err);
});

req.write('data=' + encodeURIComponent(query));
req.end(); 