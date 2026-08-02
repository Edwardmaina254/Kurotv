const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

axios.get('https://anitaku.bz/search.html?keyword=giant+killing', { httpsAgent: agent }).then(r => {
  const $ = cheerio.load(r.data);
  const items = $('.items li');
  items.each((i, el) => console.log($(el).find('.name a').attr('href')));
}).catch(console.error);
