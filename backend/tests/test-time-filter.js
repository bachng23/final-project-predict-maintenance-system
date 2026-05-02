const http = require('http');

async function testTimeFiltering() {
  console.log('🚀 Testing Time-Based Filtering for Predictions...');
  
  const getBearingId = () => new Promise((resolve, reject) => {
    http.get('http://localhost:5000/api/bearings', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data).data[0].id));
    }).on('error', reject);
  });

  try {
    const id = await getBearingId();
    
    // Create a time range: from 1 hour ago to now
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
    
    const startDate = oneHourAgo.toISOString();
    const endDate = now.toISOString();

    console.log(`Filtering from ${startDate} to ${endDate}`);

    const url = `http://localhost:5000/api/bearings/${id}/predictions?start_date=${startDate}&end_date=${endDate}`;
    
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        console.log(`✅ Status: ${res.statusCode}`);
        console.log(`📊 Found ${json.count} points in this range.`);
        if (json.data.length > 0) {
          console.log('Sample Point TS:', json.data[0].sample_ts);
        }
      });
    });
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTimeFiltering();
