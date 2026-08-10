const fetch = require('node-fetch');
async function test() {
    const query = `
      query { 
        Page(page: 1, perPage: 20) { 
          media(sort: TRENDING_DESC, type: ANIME, status: RELEASING, isAdult: false) { 
            id title { english romaji } coverImage { extraLarge } bannerImage averageScore description type status 
          } 
        } 
      }`;
    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const json = await res.json();
        console.log(JSON.stringify(json).slice(0, 500));
    } catch(e) { console.error(e.message); }
}
test();
