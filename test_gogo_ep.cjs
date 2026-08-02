const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

axios.get('https://anitaku.bz/giant-killing-episode-1', { httpsAgent: agent }).then(r => {
  const match = r.data.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  console.log(match ? match[1] : 'No iframe found');
}).catch(console.error);
