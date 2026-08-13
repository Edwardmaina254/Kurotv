import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv, createHash } from 'crypto';
import { Readable } from 'stream';
import 'dotenv/config';
import torrentStream from 'torrent-stream';
import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rssParser = new Parser();
const activeTorrents = new Map(); // Global cache for running torrent engines

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
    if (!response.ok || json.errors) throw new Error("Anilist API Error");

    const formatted = (json?.data?.Page?.media || []).map(anime => ({
      id: anime?.id?.toString() || '', title: anime?.title?.english || anime?.title?.romaji || 'Unknown',
      image: anime?.coverImage?.extraLarge || '', bannerImage: anime?.bannerImage || anime?.coverImage?.extraLarge || '',
      rating: anime?.averageScore || 0, description: anime?.description || '', type: anime?.type || "TV", status: anime?.status || "RELEASING"
    })).filter(anime => !BANNED_ANIME_IDS.includes(anime.id));
    
    if (formatted.length > 0) {
      fs.writeFileSync(path.join(__dirname, 'fallback_top_airing.json'), JSON.stringify(formatted, null, 2));
    }
    setCache(cacheKey, formatted, 2);
    return res.json({ results: formatted });
  } catch (err) { 
    console.error("[CRON/FALLBACK] Failed top-airing:", err.message);
    const fallbackPath = path.join(__dirname, 'fallback_top_airing.json');
    if (fs.existsSync(fallbackPath)) {
        return res.json({ results: JSON.parse(fs.readFileSync(fallbackPath, 'utf8')) });
    }
    const fallbackHardcoded = path.join(__dirname, 'fallback_data.json');
    if (fs.existsSync(fallbackHardcoded)) {
        return res.json({ results: JSON.parse(fs.readFileSync(fallbackHardcoded, 'utf8')) });
    }
    return res.json({ results: [] }); 
  }
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
    if (!response.ok || json.errors) throw new Error("Anilist API Error");

    const rawList = (json?.data?.Page?.airingSchedules || []).map(item => ({
      id: item?.media?.id?.toString() || '', episode: item?.episode || 1, episodeNumber: item?.episode || 1,
      title: item?.media?.title?.english || item?.media?.title?.romaji || 'Unknown', image: item?.media?.coverImage?.extraLarge || '', type: item?.media?.type || "TV",
      isAdult: item?.media?.isAdult === true
    })).filter(anime => !BANNED_ANIME_IDS.includes(anime.id) && !anime.isAdult); // 🔥 JS FILTER
    
    const unique = []; const seen = new Set();
    for (const anime of rawList) { if (!seen.has(anime.id)) { seen.add(anime.id); unique.push(anime); } }
    
    const finalRecent = unique.slice(0, 20);
    
    if (finalRecent.length > 0) {
      fs.writeFileSync(path.join(__dirname, 'fallback_recent_episodes.json'), JSON.stringify(finalRecent, null, 2));
    }
    setCache(cacheKey, finalRecent, 0.5);
    return res.json({ results: finalRecent });
  } catch (err) { 
    console.error("[CRON/FALLBACK] Failed recent-episodes:", err.message);
    const fallbackPath = path.join(__dirname, 'fallback_recent_episodes.json');
    if (fs.existsSync(fallbackPath)) {
        return res.json({ results: JSON.parse(fs.readFileSync(fallbackPath, 'utf8')) });
    }
    const fallbackHardcoded = path.join(__dirname, 'fallback_data.json');
    if (fs.existsSync(fallbackHardcoded)) {
        return res.json({ results: JSON.parse(fs.readFileSync(fallbackHardcoded, 'utf8')) });
    }
    return res.json({ results: [] }); 
  }
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
  } catch (err) { 
    console.error("[CRON/FALLBACK] Failed schedule:", err.message);
    return res.json({ results: [] }); 
  }
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
    if (json.errors) throw new Error("Anilist API Error");
    const anime = json?.data?.Media;
    if (!anime) throw new Error("Missing data");

    let relations = (anime.relations?.edges || []).filter(edge => ['PREQUEL', 'SEQUEL', 'ALTERNATIVE', 'SPIN_OFF', 'SIDE_STORY'].includes(edge.relationType)).map(edge => ({
      id: edge.node.id, title: edge.node.title?.english || edge.node.title?.romaji || `${edge.node.format || 'TV'} Entry`,
      image: edge.node.coverImage?.extraLarge || '', type: edge.node.format || 'TV', relationType: edge.relationType,
      isAdult: edge.node.isAdult === true
    })).filter(rel => !BANNED_ANIME_IDS.includes(rel.id.toString()) && !rel.isAdult && !['MANGA', 'NOVEL', 'ONE_SHOT'].includes(rel.type)); // 🔥 JS FILTER

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
  } catch (err) { 
    console.error(`[INFO ERROR] ID: ${id}`, err.message || err);
    try {
        console.warn(`[INFO FALLBACK] Attempting to fetch dummy metadata from api.ani.zip for ${id}`);
        const fallbackReq = await fetch(`https://api.ani.zip/mappings?anilist_id=${id}`);
        const fallbackData = await fallbackReq.json();
        
        if (fallbackData?.titles) {
            const fallbackPayload = {
                id: id.toString(),
                idMal: fallbackData.mal_id || null,
                title: fallbackData.titles.en || fallbackData.titles.ro || fallbackData.titles.ja || 'Unknown Series',
                image: fallbackData.image || '',
                bannerImage: fallbackData.image || '',
                description: 'Anilist API is currently down. Showing fallback data.',
                genres: [],
                rating: 0,
                status: 'UNKNOWN',
                totalEpisodes: fallbackData.episodes || 0,
                type: 'TV',
                releaseDate: 'Unknown',
                nextAiringEpisode: null,
                relations: []
            };
            setCache(cacheKey, fallbackPayload, 0.5);
            return res.json(fallbackPayload);
        }
    } catch (innerErr) {
        console.error(`[INFO FALLBACK ERROR] Failed to fetch fallback data: ${innerErr.message}`);
    }
    res.status(404).json({ error: "Not found", details: err.message }); 
  }
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
      targetEpisodes = j.data.Media.nextAiringEpisode?.episode ? (j.data.Media.nextAiringEpisode.episode - 1) : (j.data.Media.episodes || 0);
    }
  } catch { }

  if (targetEpisodes === 0) {
      const infoCache = getCache(`info-${id}`);
      if (infoCache) {
          targetEpisodes = infoCache.totalEpisodes || 0;
          format = infoCache.type || "TV";
      }
  }

  const finalEps = [];
  const limit = targetEpisodes > 0 ? targetEpisodes : (format === 'MOVIE' ? 1 : 12);
  for (let i = 1; i <= limit; i++) {
    finalEps.push({ id: `auto-${id}-${i}`, number: format === 'MOVIE' ? "Full Movie" : i, url: `auto-${id}-${i}` });
  }
  
  if (targetEpisodes > 0 || format === 'MOVIE') {
      setCache(cacheKey, { episodes: finalEps }, 1); 
  }
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
    
    const proxyPath = isM3U8 ? '/proxy/stream.m3u8' : '/proxy/segment';
    return `${baseUrl}${proxyPath}?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(effectiveReferer)}`;
  };
  const rewrittenLines = [];
  const lines = manifest.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    
    if (line.startsWith("#EXTINF")) {
      const nextLine = lines[i + 1];
      if (nextLine && !nextLine.startsWith("#") && (nextLine.includes('ibytedtos.com') || nextLine.includes('byteimg.com') || nextLine.includes('/ad-'))) {
        i++; // Skip the URI line
        continue;
      }
    }
    
    if (line.startsWith("#")) {
      if (line.includes('URI="')) {
        rewrittenLines.push(line.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${toProxyUrl(uri)}"`));
      } else {
        rewrittenLines.push(line);
      }
    } else {
      rewrittenLines.push(toProxyUrl(line));
    }
  }
  return rewrittenLines.join("\n");
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
    // Do NOT strip codecs. Hls.js needs them to filter unsupported HEVC streams on Windows.

    const rewritten = rewriteHlsManifest(manifestText, targetUrl, referer, baseUrl);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(fetchRes.status).send(rewritten);
  } catch (err) { res.status(502).send("Proxy Stream Error"); }
});

app.get('/proxy/segment', async (req, res) => {
  const targetUrl = req.query.url;
  const referer = req.query.referer || 'https://kwik.cx/';
  if (!targetUrl) return res.status(400).send("Missing URL");

  try {
    let origin = ""; try { origin = new URL(referer).origin; } catch (e) { }
    const headers = { "Referer": referer, "Origin": origin || "https://kwik.cx", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", "Accept": "*/*" };
    
    const fetchRes = await fetch(targetUrl, { headers });
    if (!fetchRes.ok) return res.status(502).send("Proxy Segment Error");

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (fetchRes.headers.get('content-type')) res.setHeader('Content-Type', fetchRes.headers.get('content-type'));
    if (fetchRes.headers.get('content-length')) res.setHeader('Content-Length', fetchRes.headers.get('content-length'));
    
    const arrayBuffer = await fetchRes.arrayBuffer();
    return res.status(fetchRes.status).send(Buffer.from(arrayBuffer));
  } catch (err) { 
    console.error("Segment proxy error:", err);
    res.status(502).send("Proxy Segment Error"); 
  }
});

app.get('/proxy/stream', async (req, res) => {
  const targetUrl = req.query.url;
  const referer = req.query.referer || 'https://kwik.cx/';
  if (!targetUrl) return res.status(400).send("Missing URL");

  try {
    let origin = ""; try { origin = new URL(referer).origin; } catch (e) { }
    const headers = { "Referer": referer, "Origin": origin || "https://kwik.cx", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", "Accept": "*/*", "Accept-Encoding": "identity" };
    if (req.headers.range) headers.Range = req.headers.range;

    const response = await axios({
        method: 'get',
        url: targetUrl,
        headers,
        responseType: 'stream',
        validateStatus: () => true,
        maxRedirects: 5
    });

    if (response.status >= 400) return res.status(502).send();

    let upstreamType = (response.headers['content-type'] || 'video/mp2t').toLowerCase();
    if (upstreamType.includes('audio/,') || upstreamType.includes('text/plain')) upstreamType = 'video/mp2t';
    if (targetUrl.includes('.vtt')) upstreamType = 'text/vtt';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
    res.setHeader('Content-Type', upstreamType);
    
    if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
    if (response.headers['content-range']) res.setHeader('Content-Range', response.headers['content-range']);
    if (response.headers['accept-ranges']) res.setHeader('Accept-Ranges', response.headers['accept-ranges']);

    res.status(response.status);
    
    response.data.on('error', () => { if (!res.headersSent) res.status(502).end(); else res.end(); });
    req.on('close', () => response.data.destroy());
    res.on('error', () => response.data.destroy());
    
    response.data.pipe(res);
  } catch (err) { return res.status(502).send("Proxy Stream Error"); }
});

// ==========================================
// 🌊 TORRENT ENGINE (REMOVED: MKV CODEC LIMITATIONS)
// ==========================================
// 🛑 WATCH ROUTE (DYNAMIC CLOUD LINKING)
// ==========================================
app.get('/anime/zoro/watch/:episodeId', async (req, res) => {
  const episodeId = req.params.episodeId;
  const lang = req.query.lang === 'dub' ? 'dub' : 'sub';

  const cacheKey = `watch-${episodeId}-${lang}`;
  if (getCache(cacheKey)) {
    console.log(`⚡ Serving Stream from RAM Cache: ${episodeId}`);
    return res.json(getCache(cacheKey));
  }

  const sendIframeFallback = async (animeId, epNum) => {
      console.log(`[WATCH] Attempting global iframe fallback using AniZip mapping for AniList ID: ${animeId}`);
      try {
          const aniZipRes = await fetchWithBackoff(`https://api.ani.zip/mappings?anilist_id=${animeId}`, {}, 2);
          const aniZipData = await aniZipRes.json();
          let tmdbId = aniZipData?.mappings?.themoviedb_id;
          let imdbId = aniZipData?.mappings?.imdb_id;
          const episodesMap = aniZipData?.episodes;
          
          let sNum = 1;
          let eNum = epNum;

          if (episodesMap && (episodesMap[epNum] || Object.values(episodesMap).find(e => e.episodeNumber == epNum))) {
              const epData = episodesMap[epNum] || Object.values(episodesMap).find(e => e.episodeNumber == epNum);
              sNum = epData.seasonNumber || 1;
              eNum = epData.episodeNumber || epNum;
          }

          if (tmdbId || imdbId) {
              console.log(`[WATCH] Loading Iframe Fallback for TMDB: ${tmdbId || 'N/A'}, IMDB: ${imdbId || 'N/A'}, Season: ${sNum}, Episode: ${eNum}`);
              const payload = {
                  sources: [
                      { url: `https://vidsrc.me/embed/tv?${tmdbId ? 'tmdb=' + tmdbId : 'imdb=' + imdbId}&season=${sNum}&episode=${eNum}`, isM3U8: false, isIframe: true },
                      { url: `https://vidsrc.to/embed/tv?${tmdbId ? 'tmdb=' + tmdbId : 'imdb=' + imdbId}&season=${sNum}&episode=${eNum}`, isM3U8: false, isIframe: true },
                      { url: `https://vidsrc.pm/embed/tv?${tmdbId ? 'tmdb=' + tmdbId : 'imdb=' + imdbId}&season=${sNum}&episode=${eNum}`, isM3U8: false, isIframe: true }
                  ],
                  subtitles: []
              };
              return res.json(payload);
          }
      } catch (fallbackErr) {
          console.error("[WATCH] Iframe Fallback failed:", fallbackErr.message);
      }
      return res.status(404).json({ message: "Stream Unavailable - Episode currently unavailable from all upstream sources." });
  };

  // Native Gogoanime ID Handler (or auto handler)
  let animeId = ""; let epNum = "";
  if (episodeId.startsWith('auto-') || episodeId.startsWith('allanime-')) {
    if (episodeId.startsWith('allanime-')) {
      const parts = episodeId.split('-ep-');
      const prefixParts = parts[0].split('-vid-');
      animeId = prefixParts[0].replace('allanime-', '');
      epNum = parts[1];
    } else {
      const parts = episodeId.split('-');
      animeId = parts[1];
      epNum = parts[2];
    }

    try {
      const info = await anilist.fetchAnimeInfo(animeId);
      if (info && info.episodes && info.episodes.length > 0) {
        const targetEp = info.episodes.find(ep => ep.number === parseInt(epNum));
        if (targetEp && targetEp.id) {
          const data = await anilist.fetchEpisodeSources(targetEp.id);
          if (data && data.sources && data.sources.length > 0) {
             setCache(cacheKey, data);
             return res.json(data);
          }
        }
      }
      throw new Error("Could not find mapped episode or stream failed.");
    } catch (e) {
      console.warn(`[WATCH] Consumet fetch failed:`, e.message);
      try {
          const query = `query($id:Int){Media(id:$id){title{romaji english}}}`;
          const r = await fetch(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { id: parseInt(animeId) } }) });
          const j = await r.json();
          const title = j?.data?.Media?.title?.romaji || j?.data?.Media?.title?.english || 'anime';
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const targetSlug = `${slug}-episode-${epNum}`;
          const data = await anilist.fetchEpisodeSources(targetSlug);
          if (data && data.sources && data.sources.length > 0) {
             setCache(cacheKey, data);
             return res.json(data);
          }
          throw new Error("Slug guesser failed");
      } catch (err) {
          console.warn(`[WATCH] Consumet slug guesser failed:`, err.message);
          return await sendIframeFallback(animeId, epNum);
      }
    }
  }

  // Native Gogoanime ID Handler
  if (episodeId.startsWith('http')) return res.json({ sources: [{ url: episodeId, isM3U8: episodeId.includes('.m3u8'), quality: 'default' }] });

  try {
    const data = await anilist.fetchEpisodeSources(episodeId);
    if (data && data.sources && data.sources.length > 0) {
       setCache(cacheKey, data);
       return res.json(data);
    }
    throw new Error("No sources found");
  } catch (error) { 
    console.warn(`[WATCH] Consumet direct fetch failed:`, error.message);
    const fallbackAnimeId = req.query.animeId || "";
    if (fallbackAnimeId) {
        return await sendIframeFallback(fallbackAnimeId, req.query.epNum || "1");
    }
    res.status(500).json({ error: "Stream Failed" }); 
  }
});

app.listen(preferredPort, host, () => {
  console.log(`🔥 KuroTV API is permanently locked and running at http://${host}:${preferredPort}`);
  
  // ⚡ Pre-warm caches asynchronously to prevent slow loading times for the first user after a reboot
  setTimeout(() => {
    console.log("[CACHE] Pre-warming homepage caches...");
    axios.get(`http://127.0.0.1:${preferredPort}/anime/zoro/top-airing`).catch(() => null);
    axios.get(`http://127.0.0.1:${preferredPort}/anime/zoro/recent-episodes`).catch(() => null);
  }, 3000);
});
// trigger deploy 2
