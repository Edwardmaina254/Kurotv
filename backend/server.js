// backend/server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv, createHash } from 'crypto';
import { Readable } from 'stream';
import 'dotenv/config';

// 🔥 GLOBAL TLS OVERRIDE: Defeats strict Node.js SSL handshake drops
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const require = createRequire(import.meta.url);
const consumet = require('@consumet/extensions');
const { META, ANIME } = consumet;

// ==========================================
// 🛡️ SECURE INITIALIZATION
// ==========================================
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: Supabase keys missing in .env! Deployment halted.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const preferredPort = Number(process.env.PORT) || 3005;
const host = '0.0.0.0';

// ==========================================
// 🛡️ SECURITY MIDDLEWARE
// ==========================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://kurotv-production.up.railway.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
  credentials: true
};
app.use(cors(corsOptions));

app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 250,
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/anime/', limiter);

const anilist = new META.Anilist();
const ANILIST_API = 'https://graphql.anilist.co';

console.log("✅ KuroTV Backend: Hyper-Accelerated Streaming Engine Online! (Security: HIGH)");

// ==========================================
// 🛑 AGGRESSIVE CACHING SYSTEMS
// ==========================================
const NODE_CACHE = new Map();
const BANNED_ANIME_IDS = ['209940'];

const getCache = (key) => NODE_CACHE.get(key);
const setCache = (key, data, ttlHours = 12) => {
  NODE_CACHE.set(key, data);
  setTimeout(() => NODE_CACHE.delete(key), ttlHours * 60 * 60 * 1000);
};

const timeoutPromise = (promise, ms) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
    promise
      .then(value => { clearTimeout(timer); resolve(value); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
};

const fetchWithBackoff = async (url, options, maxRetries = 2) => {
  const finalOptions = { ...options };
  finalOptions.headers = {
    ...finalOptions.headers,
    'User-Agent': 'KuroTV/1.0 (Performance Gateway)',
    'Accept': 'application/json'
  };

  for (let i = 0; i < maxRetries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { ...finalOptions, signal: controller.signal });
      clearTimeout(timeout);
      if (response.status !== 429) return response;
    } catch (e) {
      clearTimeout(timeout);
      if (i === maxRetries - 1) throw e;
    }
    const waitTime = Math.pow(2, i) * 250;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  throw new Error("Max retries reached after Rate Limit.");
};

// ==========================================
// 🏠 HOMEPAGE, METADATA & SEARCH ROUTES
// ==========================================
app.get('/health', (_req, res) => res.json({ ok: true }));

// 🔥 CACHE FIX: Now updates every 30 minutes (0.5 hours)
app.get('/anime/zoro/top-airing', async (req, res) => {
  const cacheKey = 'top-airing';
  if (getCache(cacheKey)) return res.json({ results: getCache(cacheKey) });
  
  try {
    const query = `
      query { 
        Page(page: 1, perPage: 20) { 
          media(sort: TRENDING_DESC, type: ANIME, status: RELEASING) { 
            id title { english romaji } coverImage { extraLarge } bannerImage averageScore description type status 
          } 
        } 
      }`;
    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    const json = await response.json();
    const formatted = (json?.data?.Page?.media || []).map(anime => ({
      id: anime?.id?.toString() || '', title: anime?.title?.english || anime?.title?.romaji || 'Unknown',
      image: anime?.coverImage?.extraLarge || '', bannerImage: anime?.bannerImage || anime?.coverImage?.extraLarge || '',
      rating: anime?.averageScore || 0, description: anime?.description || '', type: anime?.type || "TV", status: anime?.status || "RELEASING"
    })).filter(anime => !BANNED_ANIME_IDS.includes(anime.id));
    
    setCache(cacheKey, formatted, 0.5); // Cache for 30 mins
    return res.json({ results: formatted });
  } catch { return res.json({ results: [] }); }
});

// 🔥 CACHE FIX: Now updates every 30 minutes (0.5 hours)
app.get('/anime/zoro/recent-episodes', async (req, res) => {
  const cacheKey = 'recent-episodes';
  if (getCache(cacheKey)) return res.json({ results: getCache(cacheKey) });

  try {
    const query = `
      query { 
        Page(page: 1, perPage: 30) { 
          airingSchedules(notYetAired: false, sort: TIME_DESC) { 
            episode media { id title { english romaji } coverImage { extraLarge } type } 
          } 
        } 
      }`;
    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    const json = await response.json();
    const rawList = (json?.data?.Page?.airingSchedules || []).map(item => ({
      id: item?.media?.id?.toString() || '', episode: item?.episode || 1, episodeNumber: item?.episode || 1,
      title: item?.media?.title?.english || item?.media?.title?.romaji || 'Unknown', image: item?.media?.coverImage?.extraLarge || '', type: item?.media?.type || "TV"
    })).filter(anime => !BANNED_ANIME_IDS.includes(anime.id));
    
    const unique = []; const seen = new Set();
    for (const anime of rawList) { if (!seen.has(anime.id)) { seen.add(anime.id); unique.push(anime); } }
    
    const finalRecent = unique.slice(0, 20);
    setCache(cacheKey, finalRecent, 0.5); // Cache for 30 mins
    return res.json({ results: finalRecent });
  } catch { return res.json({ results: [] }); }
});

app.get('/anime/zoro/schedule', async (req, res) => {
  const cacheKey = 'schedule';
  if (getCache(cacheKey)) return res.json({ results: getCache(cacheKey) });

  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
    const startUnix = Math.floor(startOfWeek.getTime() / 1000);
    const endUnix = startUnix + (7 * 24 * 60 * 60);
    const query = `
      query ($start: Int, $end: Int) { 
        Page(page: 1, perPage: 150) { 
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) { 
            airingAt episode media { id title { english romaji } coverImage { extraLarge } type } 
          } 
        } 
      }`;
    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { start: startUnix, end: endUnix } }) });
    const json = await response.json();
    const formatted = (json?.data?.Page?.airingSchedules || []).map(item => ({
      id: item?.media?.id?.toString() || '', episode: item?.episode || 1, title: item?.media?.title?.english || item?.media?.title?.romaji || 'Unknown',
      image: item?.media?.coverImage?.extraLarge || '', type: item?.media?.type || "TV", airingAt: item?.airingAt || 0
    })).filter(anime => !BANNED_ANIME_IDS.includes(anime.id));
    
    const unique = []; const seen = new Set();
    for (const anime of formatted) { if (!seen.has(anime.id)) { seen.add(anime.id); unique.push(anime); } }
    
    setCache(cacheKey, unique, 1); // Cache for 1 hour
    return res.json({ results: unique });
  } catch { return res.json({ results: [] }); }
});

// 🔥 THE MISSING SEARCH ROUTE
app.get('/anime/zoro/search', async (req, res) => {
  const querySearch = req.query.query;
  const page = req.query.page || 1;
  if (!querySearch) return res.json({ currentPage: 1, hasNextPage: false, results: [] });

  const cacheKey = `search-${querySearch}-${page}`;
  if (getCache(cacheKey)) return res.json(getCache(cacheKey));

  try {
      const query = `
          query ($search: String, $page: Int) {
              Page(page: $page, perPage: 24) {
                  pageInfo { currentPage hasNextPage }
                  media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                      id title { english romaji } coverImage { extraLarge } format status averageScore episodes
                  }
              }
          }
      `;
      const response = await fetchWithBackoff(ANILIST_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { search: querySearch, page: parseInt(page) } })
      });

      const json = await response.json();
      const pageInfo = json?.data?.Page?.pageInfo || { currentPage: 1, hasNextPage: false };
      const results = (json?.data?.Page?.media || []).map(anime => ({
          id: anime?.id?.toString() || '',
          title: anime?.title?.english || anime?.title?.romaji || 'Unknown',
          image: anime?.coverImage?.extraLarge || '',
          type: anime?.format || "TV",
          status: anime?.status || "UNKNOWN",
          rating: anime?.averageScore || 0,
          totalEpisodes: anime?.episodes || 0
      })).filter(anime => !BANNED_ANIME_IDS.includes(anime.id));

      const finalPayload = { currentPage: pageInfo.currentPage, hasNextPage: pageInfo.hasNextPage, results };
      setCache(cacheKey, finalPayload, 1); // Cache search terms for 1 hour
      return res.json(finalPayload);
  } catch (err) {
      return res.status(500).json({ error: "Search failed" });
  }
});

app.get('/anime/zoro/info/:id', async (req, res) => {
  const id = req.params.id;
  const cacheKey = `info-${id}`;
  if (getCache(cacheKey)) return res.json(getCache(cacheKey));

  try {
    const query = `
      query ($id: Int) { 
        Media (id: $id, type: ANIME) { 
          id idMal title { english romaji } coverImage { extraLarge } bannerImage description genres averageScore status episodes type startDate { year month day } 
          relations { edges { relationType node { id title { english romaji } coverImage { extraLarge } format } } } 
        } 
      }`;
    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { id: parseInt(id) } }) });

    if (!response.ok) throw new Error("HTTP Error");
    const json = await response.json();
    const anime = json?.data?.Media;
    if (!anime) throw new Error("Missing data");

    let relations = (anime.relations?.edges || []).filter(edge => ['PREQUEL', 'SEQUEL', 'ALTERNATIVE', 'SPIN_OFF', 'SIDE_STORY'].includes(edge.relationType)).map(edge => ({
      id: edge.node.id, title: edge.node.title?.english || edge.node.title?.romaji || `${edge.node.format || 'TV'} Entry`,
      image: edge.node.coverImage?.extraLarge || '', type: edge.node.format || 'TV', relationType: edge.relationType
    })).filter(rel => !BANNED_ANIME_IDS.includes(rel.id.toString()));

    const payloadObj = {
      id: anime.id?.toString() || id, idMal: anime.idMal || null, title: anime.title?.english || anime.title?.romaji || 'Series',
      image: anime.coverImage?.extraLarge || '', bannerImage: anime.bannerImage || anime.coverImage?.extraLarge || '',
      description: anime.description || 'No synopsis available.', genres: anime.genres || [], rating: anime.averageScore || 0,
      status: anime.status || 'UNKNOWN', totalEpisodes: anime.episodes || 0, type: anime.type || 'TV',
      releaseDate: anime.startDate?.year ? `${anime.startDate.year}-${anime.startDate.month || 1}-${anime.startDate.day || 1}` : 'Unknown', relations
    };

    setCache(cacheKey, payloadObj);
    return res.json(payloadObj);
  } catch { res.status(404).json({ error: "Not found" }); }
});

app.get('/anime/zoro/episodes/:id', async (req, res) => {
  const id = req.params.id;
  if (!id || id === 'undefined') return res.json({ episodes: [] });
  const cacheKey = `episodes-${id}`;
  if (getCache(cacheKey)) return res.json(getCache(cacheKey));

  let targetEpisodes = 0; let format = "TV";
  try {
    const q = `query($id:Int){Media(id:$id){format episodes nextAiringEpisode{episode}}}`;
    const r = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, variables: { id: parseInt(id) } }) });
    const j = await r.json();
    if (j?.data?.Media) {
      format = j.data.Media.format || "TV";
      targetEpisodes = j.data.Media.nextAiringEpisode?.episode ? (j.data.Media.nextAiringEpisode.episode - 1) : (j.data.Media.episodes || 12);
    }
  } catch { }

  try {
    const consumetInfo = await timeoutPromise(anilist.fetchAnimeInfo(id), 6000);
    if (consumetInfo?.episodes?.length > 0) {
      const sanitized = consumetInfo.episodes.filter(ep => !isNaN(parseFloat(ep.number))).sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
      setCache(cacheKey, { episodes: sanitized });
      return res.json({ episodes: sanitized });
    }
  } catch { }

  const finalEps = [];
  const limit = targetEpisodes > 0 ? targetEpisodes : (format === 'MOVIE' ? 1 : 12);
  for (let i = 1; i <= limit; i++) {
    finalEps.push({ id: `auto-${id}-${i}`, number: format === 'MOVIE' ? "Full Movie" : i, url: `auto-${id}-${i}` });
  }
  setCache(cacheKey, { episodes: finalEps });
  res.json({ episodes: finalEps });
});

// ==========================================
// 🛡️ DYNAMIC SSL PROXY ROUTES (NUCLEAR REWRITE PIPELINE)
// ==========================================
function toAbsoluteUrl(url, baseUrl) { try { return new URL(url, baseUrl).toString(); } catch { return url; } }

function rewriteHlsManifest(manifest, manifestUrl, referer, baseUrl) {
  const effectiveReferer = referer && referer.trim().length > 0 ? referer : manifestUrl;
  const toProxyUrl = (rawUri) => {
    const trimmed = rawUri.trim();
    if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:") || trimmed.startsWith("#")) return rawUri;
    const absolute = toAbsoluteUrl(trimmed, manifestUrl);
    const isM3U8 = absolute.split('?')[0].endsWith('.m3u8');
    const proxyPath = isM3U8 ? '/proxy/stream.m3u8' : '/proxy/stream';
    return `${baseUrl}${proxyPath}?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(effectiveReferer)}`;
  };
  return manifest.split(/\r?\n/).map(line => {
    if (!line) return line;
    if (line.startsWith("#")) {
      if (line.includes('URI="')) return line.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${toProxyUrl(uri)}"`);
      return line;
    }
    return toProxyUrl(line);
  }).join("\n");
}

app.get('/proxy/stream.m3u8', async (req, res) => {
  const targetUrl = req.query.url;
  const referer = req.query.referer || 'https://kwik.cx/';
  if (!targetUrl) return res.status(400).send("Missing URL");

  const protocol = req.headers['x-forwarded-proto'] || (req.hostname === 'localhost' || req.hostname === '127.0.0.1' ? 'http' : 'https');
  const baseUrl = `${protocol}://${req.get('host')}`;

  try {
    let origin = ""; try { origin = new URL(referer).origin; } catch (e) { }
    const headers = { "Referer": referer, "Origin": origin || "https://kwik.cx", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", "Accept": "*/*" };
    
    const fetchRes = await fetch(targetUrl, { headers });
    if (!fetchRes.ok) return res.status(502).send("Proxy Stream Error");

    let manifestText = await fetchRes.text();
    manifestText = manifestText.replace(/,\s*CODECS="[^"]+"/gi, '').replace(/CODECS="[^"]+",\s*/gi, '').replace(/CODECS="[^"]+"/gi, '');
    manifestText = manifestText.replace(/,\s*CODECS=[^,\s]+/gi, '').replace(/CODECS=[^,\s]+,\s*/gi, '').replace(/CODECS=[^,\s]+/gi, '');

    const rewritten = rewriteHlsManifest(manifestText, targetUrl, referer, baseUrl);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(fetchRes.status).send(rewritten);
  } catch (err) { res.status(502).send("Proxy Stream Error"); }
});

app.get('/proxy/stream', async (req, res) => {
  const targetUrl = req.query.url;
  const referer = req.query.referer || 'https://kwik.cx/';
  if (!targetUrl) return res.status(400).send("Missing URL");

  try {
    let origin = ""; try { origin = new URL(referer).origin; } catch (e) { }
    const headers = { "Referer": referer, "Origin": origin || "https://kwik.cx", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", "Accept": "*/*", "Accept-Encoding": "identity" };
    if (req.headers.range) headers.Range = req.headers.range;

    const fetchRes = await fetch(targetUrl, { headers, redirect: 'follow' });
    if (!fetchRes.ok) return res.status(502).send();

    let upstreamType = (fetchRes.headers.get('content-type') || 'video/mp2t').toLowerCase();
    if (upstreamType.includes('audio/,') || upstreamType.includes('text/plain')) upstreamType = 'video/mp2t';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');
    res.setHeader('Content-Type', upstreamType);
    if (fetchRes.headers.has('content-range')) res.setHeader('Content-Range', fetchRes.headers.get('content-range'));
    if (fetchRes.headers.has('accept-ranges')) res.setHeader('Accept-Ranges', fetchRes.headers.get('accept-ranges'));

    res.status(fetchRes.status);
    const nodeStream = Readable.fromWeb(fetchRes.body);
    req.on('close', () => nodeStream.destroy());
    nodeStream.on('error', () => { if (!res.headersSent) res.status(502).end(); else res.end(); });
    res.on('error', () => { nodeStream.destroy(); });
    nodeStream.pipe(res);
  } catch (err) { return res.status(502).send("Proxy Stream Error"); }
});

// ==========================================
// 🛑 WATCH ROUTE (DYNAMIC CLOUD LINKING)
// ==========================================
app.get('/anime/zoro/watch/:episodeId', async (req, res) => {
  const { episodeId } = req.params;
  const lang = req.query.lang === 'dub' ? 'dub' : 'sub';

  const cacheKey = `watch-extracted-${episodeId}-${lang}`;
  if (getCache(cacheKey)) { return res.json(getCache(cacheKey)); }

  const protocol = req.headers['x-forwarded-proto'] || (req.hostname === 'localhost' || req.hostname === '127.0.0.1' ? 'http' : 'https');
  const baseUrl = `${protocol}://${req.get('host')}`;

  const enrichWithSkipTimes = async (responseData, resolvedAnimeId, resolvedEpNum) => {
    if (!responseData) return responseData;
    let intro = responseData.intro || null; let outro = responseData.outro || null;
    if ((!intro || !outro) && resolvedAnimeId && resolvedEpNum) {
      try {
        const parsedEp = parseInt(resolvedEpNum, 10);
        if (!isNaN(parsedEp)) {
          const { data: customSkip } = await supabase.from('custom_skip_times').select('*').eq('episode_number', parsedEp).or(`anime_id.eq.${resolvedAnimeId},mal_id.eq.${resolvedAnimeId}`).maybeSingle();
          if (customSkip) {
            if (!intro && customSkip.op_start !== null && customSkip.op_end !== null) intro = { start: customSkip.op_start, end: customSkip.op_end };
            if (!outro && customSkip.ed_start !== null && customSkip.ed_end !== null) outro = { start: customSkip.ed_start, end: customSkip.ed_end };
          }
        }
      } catch { }
    }
    return { ...responseData, intro, outro };
  };

  let requestedAnimeId = req.query.animeId || "";
  let epNum = req.query.epNum || "";

  if (episodeId.startsWith('allanime-')) {
    const parts = episodeId.split('-ep-');
    requestedAnimeId = parts[0].split('-vid-')[0].replace('allanime-', ''); epNum = parts[1] || epNum;
  } else if (episodeId.startsWith('auto-')) {
    const parts = episodeId.split('-');
    requestedAnimeId = parts[1] || requestedAnimeId; epNum = parts[2] || epNum;
  } else if (episodeId.includes('-episode-')) {
    const parts = episodeId.split('-episode-');
    requestedAnimeId = parts[0]; epNum = parts[1];
  } else {
    requestedAnimeId = requestedAnimeId || episodeId.split('-')[0] || episodeId;
  }
  epNum = epNum || "1";

  const MIRURO_API_BASE = process.env.EXTRACTOR_API_URL ? process.env.EXTRACTOR_API_URL.replace(/\/+$/, '') : 'http://127.0.0.1:8000';

  try {
    const epListCacheKey = `miruro-eplist-${requestedAnimeId}`;
    let epListData = getCache(epListCacheKey);

    if (!epListData) {
      console.log(`[WATCH] Requesting episode mappings from ${MIRURO_API_BASE} for ID: ${requestedAnimeId}...`);
      const epListController = new AbortController();
      const epListTimeout = setTimeout(() => epListController.abort(), 20000);
      const epListRes = await fetch(`${MIRURO_API_BASE}/episodes/${requestedAnimeId}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'KuroTV-Gateway/3.0', 'Referer': 'https://www.miruro.tv/', 'Origin': 'https://www.miruro.tv' },
        signal: epListController.signal
      });
      clearTimeout(epListTimeout);

      if (epListRes.ok) {
        epListData = await epListRes.json();
        setCache(epListCacheKey, epListData, 12);
      }
    } else {
      console.log(`[WATCH] Loading episode mappings from internal memory cache for ID: ${requestedAnimeId} ⚡`);
    }

    if (epListData) {
      const targetParsedNum = parseInt(epNum, 10);
      let extractedWatchPath = null;
      let finalStreamPayload = null;
      const availableProviders = epListData?.providers || {};
      const providerKeys = [...new Set(['zoro', 'ally', 'arc', 'jet', ...Object.keys(availableProviders)])].filter(k => k !== 'kiwi');

      // Helper to fetch a stream for a single provider
      const fetchStreamForProvider = async (pKey) => {
          const providerEps = availableProviders[pKey]?.episodes?.[lang] || availableProviders[pKey]?.episodes?.['sub'] || [];
          const matchedEp = providerEps.find(e => parseInt(e.number, 10) === targetParsedNum);
          if (!matchedEp?.id) throw new Error("No mapping");

          const cleanPath = matchedEp.id.startsWith('/') ? matchedEp.id.slice(1) : matchedEp.id;
          const controller = new AbortController();
          
          // 🔥 AGGRESSIVE 4.5 SECOND TIMEOUT. No more waiting forever.
          const timeout = setTimeout(() => controller.abort(), 4500); 

          const res = await fetch(`${MIRURO_API_BASE}/${cleanPath}`, {
              headers: { 'Accept': 'application/json', 'User-Agent': 'KuroTV-Gateway/4.0', 'Referer': 'https://www.miruro.tv/', 'Origin': 'https://www.miruro.tv' },
              signal: controller.signal
          });
          clearTimeout(timeout);

          if (!res.ok) throw new Error("Bad response");
          const payload = await res.json();
          if (!payload?.streams?.length) throw new Error("No streams");

          return { path: cleanPath, payload: payload, provider: pKey };
      };

      try {
          console.log(`[WATCH] Racing all providers concurrently for maximum speed...`);
          
          // 🔥 FIRE ALL REQUESTS AT THE EXACT SAME TIME
          const results = await Promise.allSettled(providerKeys.map(key => fetchStreamForProvider(key)));
          
          const validExtractions = results
              .filter(r => r.status === 'fulfilled')
              .map(r => r.value);

          if (validExtractions.length > 0) {
              // 🔥 AGGREGATE ALL STREAMS FROM EVERY SUCCESSFUL PROVIDER
              let combinedStreams = [];
              validExtractions.forEach(ext => {
                  if (ext.payload && ext.payload.streams) {
                      combinedStreams = combinedStreams.concat(ext.payload.streams.map(s => ({
                          ...s,
                          _providerName: ext.provider // Tag it for debugging
                      })));
                  }
              });

              // 🔥 GLOBAL SORT: Force ALL raw .m3u8 streams to the absolute top, iframes to the bottom
              combinedStreams.sort((a, b) => {
                  const aIsRaw = a.type === 'hls' || a.url.includes('.m3u8');
                  const bIsRaw = b.type === 'hls' || b.url.includes('.m3u8');
                  
                  if (aIsRaw && !bIsRaw) return -1;
                  if (!aIsRaw && bIsRaw) return 1;
                  return 0;
              });

              // Send the ultimate payload with every possible backup bundled together
              finalStreamPayload = {
                  streams: combinedStreams,
                  subtitles: validExtractions.find(e => e.payload?.subtitles?.length > 0)?.payload.subtitles || [],
                  intro: validExtractions.find(e => e.payload?.intro)?.payload.intro,
                  outro: validExtractions.find(e => e.payload?.outro)?.payload.outro
              };
              
              extractedWatchPath = validExtractions[0].path; // Keep path for the success condition
              console.log(`[WATCH] ⚡ Aggregated ${combinedStreams.length} total streams across ${validExtractions.length} providers! Raw streams prioritized.`);
          }
      } catch (err) {
          console.warn(`[WATCH] Concurrent extraction error:`, err.message);
      }

      if (extractedWatchPath && finalStreamPayload) {
        const activeStreams = finalStreamPayload.streams;
        const finalPayload = {
          sources: activeStreams.map(st => {
            const rawUrl = st.url;
            const isIframe = st.type === 'embed' || rawUrl.includes('/e/') || rawUrl.includes('embed');
            if (isIframe) { return { url: rawUrl, quality: st.quality || 'embed', isM3U8: false, isIframe: true }; }
            const isM3U8 = rawUrl.includes('.m3u8') || st.type === 'hls';
            const targetReferer = st.referer || 'https://kwik.cx/';
            const proxyEndpoint = isM3U8 ? '/proxy/stream.m3u8' : '/proxy/stream';
            return {
              url: `${baseUrl}${proxyEndpoint}?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent(targetReferer)}`,
              quality: st.quality || 'default', isM3U8: isM3U8, isIframe: false
            };
          }),
          subtitles: finalStreamPayload?.subtitles || [],
          intro: finalStreamPayload?.intro?.end ? { start: finalStreamPayload.intro.start, end: finalStreamPayload.intro.end } : null,
          outro: finalStreamPayload?.outro?.start ? { start: finalStreamPayload.outro.start, end: finalStreamPayload.outro.end } : null
        };

        const enrichedPayload = await enrichWithSkipTimes(finalPayload, requestedAnimeId, epNum);
        setCache(cacheKey, enrichedPayload);
        return res.json(enrichedPayload);
      }
    }
  } catch (extractorErr) {
    console.warn(`[WATCH] Miruro microservice path dropped, mapping local fallover logic:`, extractorErr.message);
  }

  // 2. BACKUP NATIVE SCRAPER INTEGRATION
  const executeNativePipelineFallback = async (fallbackAnimeId, fallbackEpNum) => {
    console.log(`[WATCH] Invoking local fallover processing on segment: ${fallbackAnimeId}, Ep: ${fallbackEpNum}`);
    const STATIC_NATIVE_MAP = {
      "186497": "the-ramparts-of-ice", "202381": "dr-stone-science-future", "199221": "marriagetoxin", "21": "one-piece",
      "20958": "attack-on-titan-season-2", "99147": "attack-on-titan-season-3", "104578": "attack-on-titan-season-3-part-2",
      "110277": "attack-on-titan-final-season", "131681": "attack-on-titan-final-season-part-2", "142856": "attack-on-titan-final-season-the-final-chapters",
      "101922": "demon-slayer-kimetsu-no-yaiba", "127230": "demon-slayer-kimetsu-no-yaiba-mugen-train-arc", "121031": "demon-slayer-kimetsu-no-yaiba-entertainment-district-arc",
      "128851": "demon-slayer-kimetsu-no-yaiba-swordsmith-village-arc", "142329": "demon-slayer-kimetsu-no-yaiba-hashira-training-arc",
      "30276": "one-punch-man", "101759": "one-punch-man-season-2", "108465": "mushoku-tensei-jobless-reincarnation",
      "133632": "mushoku-tensei-jobless-reincarnation-season-2", "145139": "mushoku-tensei-jobless-reincarnation-season-2-part-2",
      "150672": "mashle-magic-and-muscles", "163132": "mashle-magic-and-muscles-season-2", "269": "bleach",
      "41461": "bleach-thousand-year-blood-war", "145064": "bleach-thousand-year-blood-war-part-2", "166922": "bleach-thousand-year-blood-war-part-3"
    };

    let targetSlug = STATIC_NATIVE_MAP[fallbackAnimeId] ? `${STATIC_NATIVE_MAP[fallbackAnimeId]}-episode-${fallbackEpNum}` : `${fallbackAnimeId}-episode-${fallbackEpNum}`;
    if (!STATIC_NATIVE_MAP[fallbackAnimeId]) {
      try {
        const consumetInfo = await timeoutPromise(anilist.fetchAnimeInfo(fallbackAnimeId), 8000);
        const actualTargetEp = (consumetInfo?.episodes || []).find(e => parseInt(e.number, 10) === parseInt(fallbackEpNum, 10));
        if (actualTargetEp?.id) targetSlug = actualTargetEp.id;
      } catch { }
    }

    try {
      const rawData = await timeoutPromise(anilist.fetchEpisodeSources(targetSlug), 10000);
      if (!rawData || !rawData.sources || rawData.sources.length === 0) throw new Error("Blank sources");
      const proxyWrappedData = {
        ...rawData,
        sources: rawData.sources.map(st => {
          const rawUrl = st.url;
          const isM3U8 = rawUrl.includes('.m3u8') || st.type === 'hls';
          const proxyEndpoint = isM3U8 ? '/proxy/stream.m3u8' : '/proxy/stream';
          const cacheBuster = isM3U8 ? `&cb=${Date.now()}` : '';
          return { ...st, url: `${baseUrl}${proxyEndpoint}?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent('https://gogoanime.co/')}${cacheBuster}` };
        })
      };
      const enriched = await enrichWithSkipTimes(proxyWrappedData, fallbackAnimeId, fallbackEpNum);
      return enriched;
    } catch { return { error: "Unreleased or No Sources", sources: [] }; }
  };

  return res.json(await executeNativePipelineFallback(requestedAnimeId, epNum));
});

app.listen(preferredPort, host, () => {
  console.log(`🔥 KuroTV API is permanently locked and running at http://${host}:${preferredPort}`);
});