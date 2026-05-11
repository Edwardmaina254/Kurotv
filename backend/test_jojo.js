const query = `
query ($search: String) {
  Page(page: 1, perPage: 10) {
    media(type: ANIME, search: $search, sort: [POPULARITY_DESC]) {
      id title { english romaji }
    }
  }
}
`;
fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'KuroTV/1.0 (Local Development)'
  },
  body: JSON.stringify({query, variables: {search: "jojo"}})
}).then(r => r.json()).then(j => console.log(JSON.stringify(j, null, 2))).catch(console.error);
