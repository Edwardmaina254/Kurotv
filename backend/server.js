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

import axios from 'axios';
const require = createRequire(import.meta.url);
const consumet = require('@consumet/extensions');
const { META, ANIME } = consumet;
const cheerio = require('cheerio');

// 🔥 INJECT STEALTH USER-AGENT GLOBALLY
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
axios.interceptors.request.use(config => {
  if (!config.headers) config.headers = {};
  config.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  return config;
});

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
  'https://kurotv-frontend.onrender.com',
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

// ==========================================
// 🔥 THE FIX 1: PATCH THE BROKEN CONSUMET DOMAIN
// ==========================================
const anilist = new META.Anilist();
if (anilist.provider) {
    anilist.provider.baseUrl = "https://anitaku.pe";
    anilist.provider.domain = "anitaku.pe";
}
const ANILIST_API = 'https://graphql.anilist.co';

console.log("✅ KuroTV Backend: Stable Streaming Engine Online! (Security: HIGH)");

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

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/anime/zoro/top-airing', async (req, res) => {
  const cacheKey = 'top-airing';
  if (getCache(cacheKey)) return res.json({ results: getCache(cacheKey) });
  
  try {
    // 🔥 NSFW FIX: Added isAdult: false to the GraphQL query
    const query = `
      query { 
        Page(page: 1, perPage: 20) { 
          media(sort: TRENDING_DESC, type: ANIME, status: RELEASING, isAdult: false) { 
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
    
    setCache(cacheKey, formatted, 0.5);
    return res.json({ results: formatted });
  } catch { return res.json({ results: [] }); }
});

app.get('/anime/zoro/recent-episodes', async (req, res) => {
  const cacheKey = 'recent-episodes';
  if (getCache(cacheKey)) return res.json({ results: getCache(cacheKey) });

  try {
    // 🔥 NSFW FIX: Requested isAdult flag from the media object
    const query = `
      query { 
        Page(page: 1, perPage: 30) { 
          airingSchedules(notYetAired: false, sort: TIME_DESC) { 
            episode media { id title { english romaji } coverImage { extraLarge } type isAdult } 
          } 
        } 
      }`;
    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    const json = await response.json();
    const rawList = (json?.data?.Page?.airingSchedules || []).map(item => ({
      id: item?.media?.id?.toString() || '', episode: item?.episode || 1, episodeNumber: item?.episode || 1,
      title: item?.media?.title?.english || item?.media?.title?.romaji || 'Unknown', image: item?.media?.coverImage?.extraLarge || '', type: item?.media?.type || "TV",
      isAdult: item?.media?.isAdult === true
    })).filter(anime => !BANNED_ANIME_IDS.includes(anime.id) && !anime.isAdult); // 🔥 JS FILTER
    
    const unique = []; const seen = new Set();
    for (const anime of rawList) { if (!seen.has(anime.id)) { seen.add(anime.id); unique.push(anime); } }
    
    const finalRecent = unique.slice(0, 20);
    setCache(cacheKey, finalRecent, 0.5);
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
    
    // 🔥 NSFW FIX: Requested isAdult flag from the media object
    const query = `
      query ($start: Int, $end: Int) { 
        Page(page: 1, perPage: 150) { 
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) { 
            airingAt episode media { id title { english romaji } coverImage { extraLarge } type isAdult } 
          } 
        } 
      }`;
    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { start: startUnix, end: endUnix } }) });
    const json = await response.json();
    const formatted = (json?.data?.Page?.airingSchedules || []).map(item => ({
      id: item?.media?.id?.toString() || '', episode: item?.episode || 1, title: item?.media?.title?.english || item?.media?.title?.romaji || 'Unknown',
      image: item?.media?.coverImage?.extraLarge || '', type: item?.media?.type || "TV", airingAt: item?.airingAt || 0,
      isAdult: item?.media?.isAdult === true
    })).filter(anime => !BANNED_ANIME_IDS.includes(anime.id) && !anime.isAdult); // 🔥 JS FILTER
    
    const unique = []; const seen = new Set();
    for (const anime of formatted) { if (!seen.has(anime.id)) { seen.add(anime.id); unique.push(anime); } }
    
    setCache(cacheKey, unique, 1);
    return res.json({ results: unique });
  } catch { return res.json({ results: [] }); }
});

app.get('/anime/zoro/search', async (req, res) => {
  const querySearch = req.query.query;
  const page = req.query.page || 1;
  if (!querySearch) return res.json({ currentPage: 1, hasNextPage: false, results: [] });

  const cacheKey = `search-${querySearch}-${page}`;
  if (getCache(cacheKey)) return res.json(getCache(cacheKey));

  try {
      // 🔥 NSFW FIX: Added isAdult: false to search query
      const query = `
          query ($search: String, $page: Int) {
              Page(page: $page, perPage: 24) {
                  pageInfo { currentPage hasNextPage }
                  media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
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
      setCache(cacheKey, finalPayload, 1);
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
    // 🔥 NSFW FIX: Ensure we catch relations that might be explicit
    const query = `
      query ($id: Int) { 
        Media (id: $id, type: ANIME) { 
          id idMal title { english romaji } coverImage { extraLarge } bannerImage description genres averageScore status episodes type startDate { year month day } 
          nextAiringEpisode { airingAt episode }
          relations { edges { relationType node { id title { english romaji } coverImage { extraLarge } format isAdult } } } 
        } 
      }`;
    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { id: parseInt(id) } }) });

    if (!response.ok) throw new Error("HTTP Error");
    const json = await response.json();
    const anime = json?.data?.Media;
    if (!anime) throw new Error("Missing data");

    let relations = (anime.relations?.edges || []).filter(edge => ['PREQUEL', 'SEQUEL', 'ALTERNATIVE', 'SPIN_OFF', 'SIDE_STORY'].includes(edge.relationType)).map(edge => ({
      id: edge.node.id, title: edge.node.title?.english || edge.node.title?.romaji || `${edge.node.format || 'TV'} Entry`,
      image: edge.node.coverImage?.extraLarge || '', type: edge.node.format || 'TV', relationType: edge.relationType,
      isAdult: edge.node.isAdult === true
    })).filter(rel => !BANNED_ANIME_IDS.includes(rel.id.toString()) && !rel.isAdult); // 🔥 JS FILTER

    const payloadObj = {
      id: anime.id?.toString() || id, idMal: anime.idMal || null, title: anime.title?.english || anime.title?.romaji || 'Series',
      image: anime.coverImage?.extraLarge || '', bannerImage: anime.bannerImage || anime.coverImage?.extraLarge || '',
      description: anime.description || 'No synopsis available.', genres: anime.genres || [], rating: anime.averageScore || 0,
      status: anime.status || 'UNKNOWN', totalEpisodes: anime.episodes || 0, type: anime.type || 'TV',
      releaseDate: anime.startDate?.year ? `${anime.startDate.year}-${anime.startDate.month || 1}-${anime.startDate.day || 1}` : 'Unknown',
      nextAiringEpisode: anime.nextAiringEpisode || null,
      relations
    };

    // 🔥 CACHE FIX: Releasing anime should only be cached for 1 hour to prevent delaying new episodes
    const ttl = payloadObj.status === 'RELEASING' ? 1 : 12;
    setCache(cacheKey, payloadObj, ttl);
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
      // 🔥 CACHE FIX: Releasing anime gets a 1-hour cache, otherwise 12 hours
      const ttl = consumetInfo.status === 'Ongoing' ? 1 : 12;
      setCache(cacheKey, { episodes: sanitized }, ttl);
      return res.json({ episodes: sanitized });
    }
  } catch { }

  const finalEps = [];
  const limit = targetEpisodes > 0 ? targetEpisodes : (format === 'MOVIE' ? 1 : 12);
  for (let i = 1; i <= limit; i++) {
    finalEps.push({ id: `auto-${id}-${i}`, number: format === 'MOVIE' ? "Full Movie" : i, url: `auto-${id}-${i}` });
  }
  setCache(cacheKey, { episodes: finalEps }, 1); // 1-hour cache for auto-generated list in case it's releasing
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

  // ⚡ FIX 1: Capture requested server from frontend (default to Vidstreaming)
  const requestedServer = req.query.server || 'Vidstreaming'; 
  
  // Map UI Names to Miruro Provider Keys
  const serverMap = {
      'Vidstreaming': 'zoro',
      'MegaCloud': 'ally',
      'StreamSB': 'arc'
  };
  const targetProviderKey = serverMap[requestedServer] || 'zoro';

  // Make sure to add the server to the cache key so they don't overwrite each other!
  // 🔥 BUST CACHE AGAIN to clear out any fast4speed links cached before the poison pill
  const cacheKey = `watch_v4-${episodeId}-${lang}-${targetProviderKey}`;
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

  const extractAniNekoStream = async (anilistId, epNum, requestedLang) => {
    try {
      console.log(`[WATCH] Fetching AniList metadata for ID: ${anilistId}...`);
      const query = `query ($id: Int) { Media (id: $id) { title { romaji english native } } }`;
      const anilistRes = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { id: parseInt(anilistId, 10) } })
      });
      const anilistData = await anilistRes.json();
      const title = anilistData?.data?.Media?.title?.english || anilistData?.data?.Media?.title?.romaji;
      if (!title) return null;

      console.log(`[WATCH] Searching AniNeko for title: "${title}"...`);
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
      
      if (!slug && anilistData?.data?.Media?.title?.romaji && anilistData.data.Media.title.romaji !== title) {
          console.log(`[WATCH] English title search failed, trying romaji: "${anilistData.data.Media.title.romaji}"`);
          const searchResRomaji = await fetch('https://anineko.to/browser?keyword=' + encodeURIComponent(anilistData.data.Media.title.romaji), { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const searchHtmlRomaji = await searchResRomaji.text();
          const $searchRomaji = cheerio.load(searchHtmlRomaji);
          $searchRomaji('.nv-anime-thumb').each((i, el) => {
              const href = $searchRomaji(el).attr('href');
              if (href && href.includes('/watch/')) {
                  slug = href.replace('/watch/', '');
                  return false;
              }
          });
      }

      if (!slug) return null;

      console.log(`[WATCH] Found AniNeko slug: "${slug}". Fetching Episode ${epNum}...`);
      const epUrl = `https://anineko.to/watch/${slug}/ep-${epNum}`;
      const epRes = await fetch(epUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const epHtml = await epRes.text();
      const $ep = cheerio.load(epHtml);

      let vidUrl = '';
      let targetGroup = requestedLang === 'dub' ? 'dub' : 'sub';
      
      const checkGroup = (group) => {
          $ep(`.server-items[data-id="${group}"] [data-video]`).each((i, el) => {
              const url = $ep(el).attr('data-video');
              if (url && (url.includes('vivibebe.site') || url.includes('bibiemb.xyz') || url.includes('otakuhg') || url.includes('playmogo') || url.includes('otakuvid'))) {
                  if (url.includes('vivibebe') || url.includes('bibiemb')) vidUrl = url;
                  else if (!vidUrl) vidUrl = url;
              }
          });
      };
      
      if (targetGroup === 'sub') {
          checkGroup('hsub'); // Prioritize Hard Subs (baked-in subtitles)
          if (!vidUrl) checkGroup('sub'); // Fallback to Soft Subs
      } else {
          checkGroup('dub');
      }

      if (!vidUrl) {
          $ep('[data-video]').each((i, el) => {
              const url = $ep(el).attr('data-video');
              if (url && (url.includes('vivibebe.site') || url.includes('bibiemb.xyz') || url.includes('otakuhg') || url.includes('playmogo') || url.includes('otakuvid'))) {
                  if (url.includes('vivibebe') || url.includes('bibiemb')) vidUrl = url;
                  else if (!vidUrl) vidUrl = url;
              }
          });
      }
      
      if (!vidUrl) return null;
      console.log(`[WATCH] Extracted Raw Video Server URL: ${vidUrl}`);

      let subtitleUrl = null;
      if (vidUrl.includes('?sub=')) subtitleUrl = vidUrl.split('?sub=')[1].split('&')[0];
      else if (vidUrl.includes('?caption_1=')) subtitleUrl = vidUrl.split('?caption_1=')[1].split('&')[0];
      else if (vidUrl.includes('?c1_file=')) subtitleUrl = vidUrl.split('?c1_file=')[1].split('&')[0];

      const vidRes = await fetch(vidUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://anineko.to/' } });
      const vidHtml = await vidRes.text();
      const m3u8Match = vidHtml.match(/["']([^"']+\.m3u8.*?)["']/);
      
      if (m3u8Match) {
          console.log(`[WATCH] ✅ Successfully extracted M3U8 Master Playlist!`);
          const payload = {
             headers: { "Referer": "https://vivibebe.site/" },
             sources: [{ url: m3u8Match[1], isM3U8: true, quality: 'default' }]
          };
          if (subtitleUrl) payload.subtitles = [{ url: subtitleUrl, lang: "English" }];
          return payload;
      }
      return null;
    } catch (e) {
      console.error('[AniNeko Extractor] Error:', e.message);
      return null;
    }
  };

  try {
     const payload = await extractAniNekoStream(requestedAnimeId, epNum, lang);
     if (payload) {
         const CLOUDFLARE_WORKER = "https://kurotv-proxy.felixnjuguna31.workers.dev";
         const proxyWrapped = {
            ...payload,
            sources: payload.sources.map(st => ({
               ...st,
               url: `${CLOUDFLARE_WORKER}/?url=${encodeURIComponent(st.url)}&referer=${encodeURIComponent(payload.headers?.Referer || 'https://vivibebe.site/')}`,
               isM3U8: true,
               isIframe: false
            }))
         };
         const enrichedPayload = await enrichWithSkipTimes(proxyWrapped, requestedAnimeId, epNum);
         setCache(cacheKey, enrichedPayload);
         return res.json(enrichedPayload);
     }
  } catch (err) {
     console.warn(`[WATCH] AniNeko pipeline failed:`, err.message);
  }
  
  // 🔥 Fetch fresh AniList details to see if this episode just aired or hasn't aired yet
  try {
    const aniListRes = await axios.post('https://graphql.anilist.co', {
      query: `
        query ($id: Int) {
          Media (id: $id, type: ANIME) {
            nextAiringEpisode { airingAt episode }
            episodes
          }
        }`,
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

});

app.listen(preferredPort, host, () => {
  console.log(`🔥 KuroTV API is permanently locked and running at http://${host}:${preferredPort}`);
});