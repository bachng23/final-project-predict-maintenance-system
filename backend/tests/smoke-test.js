require('dotenv').config();
const http = require('http');

async function checkAPI() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost';
  const requestUrl = new URL('/api/bearings', baseUrl);
  console.log(`Checking GET ${requestUrl.toString()} ...`);

  const options = {
    hostname: requestUrl.hostname,
    port: requestUrl.port || 80,
    path: `${requestUrl.pathname}${requestUrl.search}`,
    method: 'GET',
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        const json = JSON.parse(data);
        console.log('API reachable (200 OK)');
        console.log(`Bearing count: ${json.count}`);

        if (json.data.length > 0) {
          const bearing = json.data[0];
          console.log('First bearing payload:');
          console.log(`   - ID: ${bearing.bearing_id}`);
          console.log(`   - Status: ${bearing.status}`);
          console.log(`   - RUL (Hours): ${bearing.rul_hours}`);

          const required = ['bearing_id', 'status', 'health_score', 'rul_hours'];
          const missing = required.filter((field) => !(field in bearing));

          if (missing.length === 0) {
            console.log('Required fields are present.');
          } else {
            console.error('Missing fields:', missing);
          }
        }
      } else {
        console.error(`API error: Status Code ${res.statusCode}`);
        console.error('Data:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Cannot connect to the API through Nginx.');
    console.error('Error details:', error.message);
  });

  req.end();
}

checkAPI();
