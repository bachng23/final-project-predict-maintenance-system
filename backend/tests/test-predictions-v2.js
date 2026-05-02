const http = require('http');

async function testPredictions() {
  console.log('Testing GET /api/bearings/:id/predictions...');
  
  // 1. Get a bearing ID
  const getBearingId = () => new Promise((resolve, reject) => {
    http.get('http://localhost:5000/api/bearings', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data).data[0].id));
    }).on('error', reject);
  });

  try {
    const id = await getBearingId();
    console.log(`Using Bearing ID: ${id}`);

    // 2. Test predictions endpoint
    http.get(`http://localhost:5000/api/bearings/${id}/predictions?limit=5`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Count: ${json.count}`);
        if (json.data.length > 0) {
          console.log('Sample Point:', {
            sample_ts: json.data[0].sample_ts,
            health_score: json.data[0].health_score,
            rul_hours: json.data[0].rul_hours
          });
        }
      });
    });
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testPredictions();
