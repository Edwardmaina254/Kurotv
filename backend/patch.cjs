const fs = require('fs');

const file = 'C:\\Users\\EDWARD MAINA\\kurotv\\backend\\server.js';
let content = fs.readFileSync(file, 'utf-8');

// Add cheerio
if (!content.includes("const cheerio = require('cheerio');")) {
    content = content.replace("const { META, ANIME } = consumet;", "const { META, ANIME } = consumet;\nconst cheerio = require('cheerio');");
}

// Extract everything from 'const MIRURO_API_BASE' to 'return res.json(await executeNativePipelineFallback('
const startIndex = content.indexOf('const MIRURO_API_BASE');
const endIndex = content.indexOf('return res.json(await executeNativePipelineFallback(requestedAnimeId, epNum));') + 'return res.json(await executeNativePipelineFallback(requestedAnimeId, epNum));'.length;

if (startIndex === -1 || endIndex === -1) {
    console.log('Could not find start or end index', startIndex, endIndex);
    process.exit(1);
}

const replacement = `
  const extractAniNekoStream = async (anilistId, epNum) => {
    try {
      console.log(\`[WATCH] Fetching AniList metadata for ID: \${anilistId}...\`);
      const query = \`query ($id: Int) { Media (id: $id) { title { romaji english native } } }\`;
      const anilistRes = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { id: parseInt(anilistId, 10) } })
      });
      const anilistData = await anilistRes.json();
      const title = anilistData?.data?.Media?.title?.english || anilistData?.data?.Media?.title?.romaji;
      if (!title) return null;

      console.log(\`[WATCH] Searching AniNeko for title: "\${title}"...\`);
      const searchRes = await fetch('https://anineko.to/browser?keyword=' + encodeURIComponent(title), { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);
      let slug = '';
      $search('.nv-anime-thumb').each((i, el) => {
          const href = $search(el).attr('href');
          if (href && href.includes('/watch/')) {
              slug = href.replace('/watch/', '');
              return false;
          }
      });
      if (!slug) return null;

      console.log(\`[WATCH] Found AniNeko slug: "\${slug}". Fetching Episode \${epNum}...\`);
      const epUrl = \`https://anineko.to/watch/\${slug}/ep-\${epNum}\`;
      const epRes = await fetch(epUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const epHtml = await epRes.text();
      const $ep = cheerio.load(epHtml);

      let vidUrl = '';
      $ep('[data-video]').each((i, el) => {
          const url = $ep(el).attr('data-video');
          if (url && (url.includes('vivibebe.site') || url.includes('bibiemb.xyz') || url.includes('otakuhg') || url.includes('playmogo') || url.includes('otakuvid'))) {
              if (url.includes('vivibebe') || url.includes('bibiemb')) {
                  vidUrl = url;
              } else if (!vidUrl) {
                  vidUrl = url;
              }
          }
      });
      
      if (!vidUrl) return null;
      console.log(\`[WATCH] Extracted Raw Video Server URL: \${vidUrl}\`);

      const vidRes = await fetch(vidUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://anineko.to/' } });
      const vidHtml = await vidRes.text();
      const m3u8Match = vidHtml.match(/["']([^"']+\\.m3u8.*?)["']/);
      
      if (m3u8Match) {
          console.log(\`[WATCH] ✅ Successfully extracted M3U8 Master Playlist!\`);
          return {
             headers: { "Referer": "https://vivibebe.site/" },
             sources: [{ url: m3u8Match[1], isM3U8: true, quality: 'default' }]
          };
      }
      return null;
    } catch (e) {
      console.error('[AniNeko Extractor] Error:', e.message);
      return null;
    }
  };

  try {
     const payload = await extractAniNekoStream(requestedAnimeId, epNum);
     if (payload) {
         const CLOUDFLARE_WORKER = "https://kurotv-proxy.felixnjuguna31.workers.dev";
         const proxyWrapped = {
            ...payload,
            sources: payload.sources.map(st => ({
               ...st,
               url: \`\${CLOUDFLARE_WORKER}/?url=\${encodeURIComponent(st.url)}&referer=\${encodeURIComponent(payload.headers?.Referer || 'https://vivibebe.site/')}\`,
               isM3U8: true,
               isIframe: false
            }))
         };
         const enrichedPayload = await enrichWithSkipTimes(proxyWrapped, requestedAnimeId, epNum);
         setCache(cacheKey, enrichedPayload);
         return res.json(enrichedPayload);
     }
  } catch (err) {
     console.warn(\`[WATCH] AniNeko pipeline failed:\`, err.message);
  }
  
  // 🔥 Fetch fresh AniList details to see if this episode just aired or hasn't aired yet
  try {
    const aniListRes = await axios.post('https://graphql.anilist.co', {
      query: \`
        query ($id: Int) {
          Media (id: $id, type: ANIME) {
            nextAiringEpisode { airingAt episode }
            episodes
          }
        }\`,
      variables: { id: parseInt(requestedAnimeId) }
    });

    const media = aniListRes.data?.data?.Media;
    if (media) {
      const nextEp = media.nextAiringEpisode;
      
      // Scenario A: The episode number requested is higher than what AniList says has aired
      if (nextEp && parseInt(epNum) >= nextEp.episode) {
        return res.json({
          error: "PREMIERE_AWAITING",
          airingAt: nextEp.airingAt,
          episode: epNum
        });
      }
      
      // Scenario B: It's the current episode that just flipped over in the last 3 hours, but no streams exist yet
      if (nextEp && (parseInt(epNum) === nextEp.episode - 1)) {
        return res.json({
          error: "UPLOADING_DELAY",
          episode: epNum
        });
      }
    }
  } catch (anilistErr) {
    console.error("[CRON/FALLBACK] Failed to check AniList safety gap:", anilistErr.message);
  }

  return res.status(404).json({ message: "Stream Unavailable - Episode currently unavailable from all upstream sources." });
`;

content = content.substring(0, startIndex) + replacement.trim() + '\n' + content.substring(endIndex);
fs.writeFileSync(file, content);
console.log('Successfully patched server.js!');
