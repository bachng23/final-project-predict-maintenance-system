const http = require('http');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost';

async function testPredictions() {
  console.log('Testing GET /api/bearings/:id/predictions...');

  const getBearingId = () =>
    new Promise((resolve, reject) => {
      http
        .get(new URL('/api/bearings', API_BASE_URL), (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => resolve(JSON.parse(data).data[0].id));
        })
        .on('error', reject);
    });

  try {
    const id = await getBearingId();
    console.log(`Using Bearing ID: ${id}`);

    const url = new URL(`/api/bearings/${id}/predictions`, API_BASE_URL);
    url.searchParams.set('limit', '5');

    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const json = JSON.parse(data);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Count: ${json.count}`);
        if (json.data.length > 0) {
          console.log('Sample Point:', {
            sample_ts: json.data[0].sample_ts,
            health_score: json.data[0].health_score,
            rul_hours: json.data[0].rul_hours,
          });
        }
      });
    });
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testPredictions();
