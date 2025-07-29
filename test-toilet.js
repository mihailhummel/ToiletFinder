// Test script to add a toilet with custom title
const testToilet = {
  type: "public",
  title: "Test Custom Title - " + new Date().toISOString(),
  coordinates: {
    lat: 40.7128,
    lng: -74.0060
  },
  accessibility: "unknown",
  accessType: "unknown",
  userId: "test-user",
  source: "user",
  addedByUserName: "Test User"
};

console.log('Testing toilet creation with custom title:', testToilet.title);

fetch('http://localhost:5001/api/toilets', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testToilet)
})
.then(response => response.json())
.then(data => {
  console.log('✅ Toilet created successfully:', data);
  console.log('Title in response:', data.title);
})
.catch(error => {
  console.error('❌ Error creating toilet:', error);
}); 