const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const target1 = `      const query = \`query ($id: Int) { Media (id: $id) { title { romaji english native } format episodes } }\`;`;
const rep1 = `      const query = \`query ($id: Int) { Media (id: $id) { title { romaji english native } format episodes nextAiringEpisode { airingAt timeUntilAiring episode } } }\`;`;

const target2 = `      if (!title) return null;`;
const rep2 = `      if (!title) return null;

      const nextAiring = anilistData?.data?.Media?.nextAiringEpisode;
      const requestedEpNum = parseInt(epNum, 10);
      if (nextAiring && requestedEpNum >= nextAiring.episode) {
          console.log(\`[WATCH] Episode \${requestedEpNum} of \${title} hasn't aired yet. Airs at: \${nextAiring.airingAt}\`);
          return { error: 'PREMIERE_AWAITING', airingAt: nextAiring.airingAt, episode: requestedEpNum, notAired: true };
      }`;

if (code.includes(target1) && code.includes(target2)) {
    code = code.replace(target1, rep1).replace(target2, rep2);
    fs.writeFileSync('backend/server.js', code);
    console.log('Successfully patched server.js!');
} else {
    console.log('Failed to find targets!');
}
