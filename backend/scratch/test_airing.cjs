const fetch = require('node-fetch');

async function test() {
  const anilistId = 164222; // Bleach TYBW Part 3 (which hasn't fully aired, or is currently airing)
  const query = `query ($id: Int) { Media (id: $id) { title { romaji english } episodes nextAiringEpisode { airingAt timeUntilAiring episode } } }`;
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id: anilistId } })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
