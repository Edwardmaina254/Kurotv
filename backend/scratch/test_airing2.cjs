const fetch = require('node-fetch');
async function test() {
  const query = `query { Media (search: "Bleach", type: ANIME, sort: START_DATE_DESC) { id title { romaji } nextAiringEpisode { airingAt timeUntilAiring episode } } }`;
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
