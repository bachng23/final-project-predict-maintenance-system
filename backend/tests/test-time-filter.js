const http = require('http');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost';

async function testTimeFiltering() {
  console.log('Testing time-based filtering for predictions...');

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

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const startDate = oneHourAgo.toISOString();
    const endDate = now.toISOString();

    console.log(`Filtering from ${startDate} to ${endDate}`);

    const url = new URL(`/api/bearings/${id}/predictions`, API_BASE_URL);
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);

    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const json = JSON.parse(data);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Found ${json.count} points in this range.`);
        if (json.data.length > 0) {
          console.log('Sample Point TS:', json.data[0].sample_ts);
        }
      });
    });
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testTimeFiltering();
