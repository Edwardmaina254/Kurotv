const fetch = require('node-fetch');
async function test() {
    const query = `
      query { 
        Page(page: 1, perPage: 20) { 
          media(sort: TRENDING_DESC, type: ANIME, status: RELEASING, isAdult: false) { 
            id title { english romaji }
          } 
        } 
      }`;
    const response = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    console.log(response.status);
    const json = await response.json();
    console.log(JSON.stringify(json).substring(0, 200));
}
test();
