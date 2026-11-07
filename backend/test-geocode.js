const axios = require('axios');

async function testGeocode() {
  try {
    const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: 'MG Road Pune',
        key: 'AIzaSyCZTUAO6QJa2WpMceJpQWtfGGzfvQRVxaQ' // your key
      }
    });
    console.log('Status:', res.data.status);
    console.log('Address:', res.data.results[0].formatted_address);
    console.log('Lat/Lng:', res.data.results[0].geometry.location);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testGeocode();