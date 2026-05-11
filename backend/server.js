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

const require = createRequire(import.meta.url);
const consumet = require('@consumet/extensions');
const { META } = consumet;

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
    console.warn(`[CORS] Blocked request from unknown origin: ${origin}`);
    callback(new Error(`CORS policy: Origin ${origin} is not allowed.`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
  credentials: true
};
app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
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
const CACHE = { trending: null, recent: null, schedule: null };

const NODE_CACHE = new Map();
const MAPPING_CACHE = new Map();

const BANNED_ANIME_IDS = [
  '209940' // Komekami! Girls
];

const getCache = (key) => NODE_CACHE.get(key);
const setCache = (key, data, ttlHours = 12) => {
  NODE_CACHE.set(key, data);
  setTimeout(() => NODE_CACHE.delete(key), ttlHours * 60 * 60 * 1000);
};

// ==========================================
// ⚡ HYPER-CONCURRENT BACKOFF ENGINE (LATENCY CRUSHER)
// ==========================================
const fetchWithBackoff = async (url, options, maxRetries = 2) => {
  const finalOptions = { ...options };
  finalOptions.headers = {
    ...finalOptions.headers,
    'User-Agent': 'KuroTV/1.0 (Performance Gateway)',
    'Accept': 'application/json'
  };

  for (let i = 0; i < maxRetries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(url, { ...finalOptions, signal: controller.signal });
      clearTimeout(timeout);
      if (response.status !== 429) return response;
    } catch (e) {
      clearTimeout(timeout);
      if (i === maxRetries - 1) throw e;
    }
    const waitTime = Math.pow(2, i) * 200;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  throw new Error("Max retries reached after Rate Limit.");
};

const timeoutPromise = (promise, ms) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

// ==========================================
// ⚙️ MASSIVELY PARALLEL SOURCE RACER
// ==========================================
async function processAllanImeSources(sources, baseUrl, cacheKey = null) {
  const obfuscated = sources.filter(s => s.sourceUrl && s.sourceUrl.startsWith('--'));
  const sorted = [
    ...obfuscated.filter(s => s.type === 'player'),
    ...obfuscated.filter(s => s.type !== 'player')
  ].slice(0, 4);

  if (sorted.length === 0) return null;

  const sourcePromises = sorted.map(async (source) => {
    const encoded = source.sourceUrl.slice(2);
    let decoded = "";
    for (let i = 0; i < encoded.length; i += 2) {
      decoded += OBFUSCATED_DECODE_TABLE[encoded.slice(i, i + 2).toLowerCase()] || "";
    }
    decoded = decoded.replace("/clock", "/clock.json");
    let providerUrl = decoded.startsWith("http") ? decoded : `https://${ALLANIME_BASE}${decoded}`;
    providerUrl = providerUrl.replace(/([^:]\/)\/+/g, "$1");

    if (providerUrl.includes('clock.json') || providerUrl.endsWith('.json')) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 800);

      const clockRes = await fetch(providerUrl, {
        headers: { Referer: ALLANIME_REFERER, "User-Agent": "Mozilla/5.0" },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!clockRes.ok) throw new Error(`Clock HTTP ${clockRes.status}`);
      const clockData = await clockRes.json();
      const firstLink = clockData?.links?.[0];

      if (!firstLink?.link) throw new Error(`Clock JSON has no link field`);

      providerUrl = firstLink.link;
      if (!providerUrl.startsWith('http')) providerUrl = `https://${ALLANIME_BASE}${providerUrl}`;
    }

    const isTrueM3U8 = await checkIsM3U8(providerUrl);
    const proxyPath = isTrueM3U8 ? '/proxy/stream.m3u8' : '/proxy/stream';
    const finalUrl = `${baseUrl}${proxyPath}?url=${encodeURIComponent(providerUrl)}&referer=${encodeURIComponent(ALLANIME_REFERER)}`;
    return { headers: { Referer: ALLANIME_REFERER }, sources: [{ url: finalUrl, isM3U8: isTrueM3U8, quality: 'default' }] };
  });

  try {
    const fastestResponse = await Promise.any(sourcePromises);
    return fastestResponse;
  } catch (aggregateError) {
    return null;
  }
}

// ==========================================
// 🗡️ ALLANIME DECRYPTION ENGINE
// ==========================================
const ALLANIME_REFERER = "https://youtu-chan.com";
const ALLANIME_BASE = "allanime.day";
const ALLANIME_API = `https://api.${ALLANIME_BASE}`;
const TOBE_PARSED_FIELD = "tobeparsed";
const ALLANIME_AES_ALGO = "aes-256-ctr";
const ALLANIME_BLOB_VERSION = 0x01;
const ALLANIME_VERSION_LENGTH = 1;
const ALLANIME_IV_LENGTH = 12;
const ALLANIME_AUTH_TAG_LENGTH = 16;
const ALLANIME_COUNTER_SUFFIX = Buffer.from([0x00, 0x00, 0x00, 0x02]);
const ALLANIME_SECRET = "Xot36i3lK3:v1";
const ALLANIME_KEY = createHash("sha256").update(ALLANIME_SECRET).digest();

const OBFUSCATED_DECODE_TABLE = {
  "79": "A", "7a": "B", "7b": "C", "7c": "D", "7d": "E", "7e": "F", "7f": "G",
  "70": "H", "71": "I", "72": "J", "73": "K", "74": "L", "75": "M", "76": "N", "77": "O",
  "68": "P", "69": "Q", "6a": "R", "6b": "S", "6c": "T", "6d": "U", "6e": "V", "6f": "W",
  "60": "X", "61": "Y", "62": "Z", "59": "a", "5a": "b", "5b": "c", "5c": "d", "5d": "e",
  "5e": "f", "5f": "g", "50": "h", "51": "i", "52": "j", "53": "k", "54": "l", "55": "m",
  "56": "n", "57": "o", "48": "p", "49": "q", "4a": "r", "4b": "s", "4c": "t", "4d": "u",
  "4e": "v", "4f": "w", "40": "x", "41": "y", "42": "z", "08": "0", "09": "1", "0a": "2",
  "0b": "3", "0c": "4", "0d": "5", "0e": "6", "0f": "7", "00": "8", "01": "9", "15": "-",
  "16": ".", "67": "_", "46": "~", "02": ":", "17": "/", "07": "?", "1b": "#", "63": "[",
  "65": "]", "78": "@", "19": "!", "1c": "$", "1e": "&", "10": "(", "11": ")", "12": "*",
  "13": "+", "14": ",", "03": ";", "05": "=", "1d": "%"
};

function parseDecryptedPayload(payload) {
  try { return JSON.parse(payload); } catch { return payload; }
}

function decryptTobeparsed(blobBase64) {
  const blob = Buffer.from(blobBase64, "base64");
  const version = blob[0];
  if (version !== ALLANIME_BLOB_VERSION) throw new Error(`Unsupported Allanime blob version: ${version}`);

  const ivStart = ALLANIME_VERSION_LENGTH;
  const ivEnd = ivStart + ALLANIME_IV_LENGTH;
  const ciphertextStart = ivEnd;
  const ciphertextEnd = blob.length - ALLANIME_AUTH_TAG_LENGTH;

  const iv = blob.subarray(ivStart, ivEnd);
  const ciphertext = blob.subarray(ciphertextStart, ciphertextEnd);
  const ctrIv = Buffer.concat([iv, ALLANIME_COUNTER_SUFFIX]);

  const decipher = createDecipheriv(ALLANIME_AES_ALGO, ALLANIME_KEY, ctrIv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return parseDecryptedPayload(decrypted.toString("utf8"));
}

function normalizeTobeparsed(value) {
  if (Array.isArray(value)) return value.map(normalizeTobeparsed);
  if (!value || typeof value !== "object") return value;

  const normalized = {};
  for (const [key, entry] of Object.entries(value)) {
    normalized[key] = normalizeTobeparsed(entry);
  }

  const encrypted = typeof normalized[TOBE_PARSED_FIELD] === "string" ? normalized[TOBE_PARSED_FIELD] : null;
  if (encrypted) {
    try {
      const decrypted = normalizeTobeparsed(decryptTobeparsed(encrypted));
      delete normalized[TOBE_PARSED_FIELD];
      if (decrypted && typeof decrypted === "object" && !Array.isArray(decrypted)) {
        return { ...normalized, ...decrypted };
      }
      normalized.data = decrypted;
    } catch (error) { }
  }
  return normalized;
}

async function allAnimeGql(variables, query) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(`${ALLANIME_API}/api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": ALLANIME_REFERER,
        "User-Agent": "Mozilla/5.0"
      },
      body: JSON.stringify({ variables, query }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`AllAnime request failed: ${res.status}`);
    return normalizeTobeparsed(await res.json());
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function checkIsM3U8(url) {
  if (url.includes('.m3u8')) return true;
  try {
    const headers = { "Referer": ALLANIME_REFERER, "User-Agent": "Mozilla/5.0" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300);
    let res = await fetch(url, { method: 'HEAD', headers, signal: controller.signal });
    clearTimeout(timeout);

    let contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('mpegurl') || contentType.includes('x-mpegurl')) return true;
    if (contentType.includes('mp4') || contentType.includes('video/mp4')) return false;

    const sniffController = new AbortController();
    const sniffTimeout = setTimeout(() => sniffController.abort(), 300);
    res = await fetch(url, { headers: { ...headers, Range: 'bytes=0-150' }, signal: sniffController.signal });
    const arrayBuffer = await res.arrayBuffer();
    clearTimeout(sniffTimeout);
    const text = new TextDecoder().decode(arrayBuffer.slice(0, 150));
    if (text.includes('#EXTM3U')) return true;
  } catch (e) { }
  return false;
}

function toAbsoluteUrl(url, baseUrl) {
  try { return new URL(url, baseUrl).toString(); } catch { return url; }
}

function rewriteHlsManifest(manifest, manifestUrl, referer, baseUrl) {
  const effectiveReferer = referer && referer.trim().length > 0 ? referer : manifestUrl;
  const toProxyUrl = (rawUri) => {
    const trimmed = rawUri.trim();
    if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return rawUri;
    const absolute = toAbsoluteUrl(trimmed, manifestUrl);
    const proxyPath = absolute.includes('.m3u8') ? '/proxy/stream.m3u8' : '/proxy/stream';
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

app.get('/health', (_req, res) => res.json({ ok: true }));

// ==========================================
// 🏠 HOMEPAGE ROUTES (OPTIMIZED RAM RETENTION)
// ==========================================
app.get('/anime/zoro/top-airing', async (req, res) => {
  if (CACHE.trending) return res.json({ results: CACHE.trending });
  try {
    const query = `query { Page(page: 1, perPage: 20) { media(sort: TRENDING_DESC, type: ANIME, status: RELEASING) { id title { english romaji } coverImage { extraLarge } bannerImage averageScore description type status } } }`;
    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    const json = await response.json();
    const formatted = (json?.data?.Page?.media || [])
      .map(anime => ({
        id: anime?.id?.toString() || '', title: anime?.title?.english || anime?.title?.romaji || 'Unknown', image: anime?.coverImage?.extraLarge || '', bannerImage: anime?.bannerImage || anime?.coverImage?.extraLarge || '', rating: anime?.averageScore || 0, description: anime?.description || '', type: anime?.type || "TV", status: anime?.status || "RELEASING"
      }))
      .filter(anime => !BANNED_ANIME_IDS.includes(anime.id));

    CACHE.trending = formatted;
    return res.json({ results: formatted });
  } catch (error) { return res.json({ results: CACHE.trending || [] }); }
});

app.get('/anime/zoro/recent-episodes', async (req, res) => {
  if (CACHE.recent) return res.json({ results: CACHE.recent });
  try {
    const query = `query { Page(page: 1, perPage: 30) { airingSchedules(notYetAired: false, sort: TIME_DESC) { episode media { id title { english romaji } coverImage { extraLarge } type } } } }`;
    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    const json = await response.json();
    const rawList = (json?.data?.Page?.airingSchedules || [])
      .map(item => ({
        id: item?.media?.id?.toString() || '', episode: item?.episode || 1, episodeNumber: item?.episode || 1, title: item?.media?.title?.english || item?.media?.title?.romaji || 'Unknown', image: item?.media?.coverImage?.extraLarge || '', type: item?.media?.type || "TV"
      }))
      .filter(anime => !BANNED_ANIME_IDS.includes(anime.id));

    const unique = []; const seen = new Set();
    for (const anime of rawList) { if (!seen.has(anime.id)) { seen.add(anime.id); unique.push(anime); } }
    CACHE.recent = unique.slice(0, 20);
    return res.json({ results: CACHE.recent });
  } catch (error) { return res.json({ results: CACHE.recent || [] }); }
});

app.get('/anime/zoro/schedule', async (req, res) => {
  if (CACHE.schedule) return res.json({ results: CACHE.schedule });
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startUnix = Math.floor(startOfWeek.getTime() / 1000);
    const endUnix = startUnix + (7 * 24 * 60 * 60);

    const query = `
      query ($start: Int, $end: Int) { 
        Page(page: 1, perPage: 150) { 
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) { 
            airingAt 
            episode 
            media { id title { english romaji } coverImage { extraLarge } type } 
          } 
        } 
      }
    `;

    const response = await fetchWithBackoff(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { start: startUnix, end: endUnix } })
    });

    const json = await response.json();
    const formatted = (json?.data?.Page?.airingSchedules || [])
      .map(item => ({
        id: item?.media?.id?.toString() || '',
        episode: item?.episode || 1,
        title: item?.media?.title?.english || item?.media?.title?.romaji || 'Unknown',
        image: item?.media?.coverImage?.extraLarge || '',
        type: item?.media?.type || "TV",
        airingAt: item?.airingAt || 0
      }))
      .filter(anime => !BANNED_ANIME_IDS.includes(anime.id));

    const unique = []; const seen = new Set();
    for (const anime of formatted) {
      if (!seen.has(anime.id)) {
        seen.add(anime.id);
        unique.push(anime);
      }
    }

    CACHE.schedule = unique;
    return res.json({ results: CACHE.schedule });
  } catch (error) {
    return res.json({ results: CACHE.schedule || [] });
  }
});

// ==========================================
// 🔍 GOD-MODE SEARCH ROUTE (SCHEMA-VALIDATION SAFE)
// ==========================================
app.get('/anime/zoro/search', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 40;
    const search = req.query.q ? req.query.q.trim() : undefined;
    const format = req.query.format || undefined;
    const status = req.query.status || undefined;
    const genres = req.query.genres ? req.query.genres.split(',') : undefined;

    const sortMap = {
      'trending': 'TRENDING_DESC',
      'popular': 'POPULARITY_DESC',
      'newest': 'START_DATE_DESC',
      'score': 'SCORE_DESC'
    };

    // 🔥 PURE GRAPHQL SCHEMA VARIABLES
    // Uses fully valid enums in the variable block to completely prevent HTTP 500 compilation crashes,
    // while natively hardcoding SEARCH_MATCH relevance enforcement directly into the string query block.
    let queryArgs = `$page: Int, $perPage: Int, $sort: [MediaSort]`;
    let mediaArgs = `type: ANIME, sort: $sort`;
    const fetchLimit = search ? 50 : perPage;
    const variables = {
      page,
      perPage: fetchLimit,
      sort: search ? ["SEARCH_MATCH", "POPULARITY_DESC"] : [sortMap[req.query.sort] || 'TRENDING_DESC']
    };

    if (search) {
      let graphqlSearchString = search;
      const words = search.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 0) {
        graphqlSearchString = words.reduce((a, b) => a.length > b.length ? a : b);
      } else {
        graphqlSearchString = search.split(/\s+/)[0];
      }

      queryArgs += `, $search: String`;
      mediaArgs += `, search: $search`;
      variables.search = graphqlSearchString;
    }

    if (format) {
      queryArgs += `, $format: MediaFormat`;
      mediaArgs += `, format: $format`;
      variables.format = format;
    }
    if (status) {
      queryArgs += `, $status: MediaStatus`;
      mediaArgs += `, status: $status`;
      variables.status = status;
    }
    if (genres) {
      queryArgs += `, $genre_in: [String]`;
      mediaArgs += `, genre_in: $genre_in`;
      variables.genre_in = genres;
    }

    const query = `
      query (${queryArgs}) { 
        Page(page: $page, perPage: $perPage) { 
          pageInfo { hasNextPage currentPage } 
          media(${mediaArgs}) { 
            id title { english romaji } coverImage { extraLarge } format status averageScore episodes
          } 
        } 
      }
    `;

    const response = await fetchWithBackoff(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });

    const json = await response.json();

    if (json.errors) {
      console.error("AniList GraphQL Errors:", json.errors);
      throw new Error("Validation Schema Crash");
    }

    let rawResults = json?.data?.Page?.media || [];

    // 🔥 UNIFIED PROXIMITY POST-FILTER
    if (search) {
      const norm = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const queryNorm = norm(search);
      const queryWords = queryNorm.split(' ').filter(w => w.length > 1);

      rawResults = rawResults.filter(anime => {
        const tEng = norm(anime?.title?.english);
        const tRom = norm(anime?.title?.romaji);
        const fullT = `${tEng} ${tRom}`;

        if (tEng.includes(queryNorm) || tRom.includes(queryNorm)) {
          return true;
        }

        if (queryWords.length > 0) {
          if (queryWords.length <= 2) {
            return queryWords.every(w => fullT.includes(w));
          } else {
            let matchCount = 0;
            queryWords.forEach(w => { if (fullT.includes(w)) matchCount++; });
            return (matchCount / queryWords.length) >= 0.4;
          }
        }
        return false;
      });
    }

    const formatted = rawResults
      .slice(0, perPage)
      .map(anime => ({
        id: anime?.id?.toString() || '',
        title: anime?.title?.english || anime?.title?.romaji || 'Unknown',
        image: anime?.coverImage?.extraLarge || '',
        type: anime?.format || "TV",
        status: anime?.status || "UNKNOWN",
        rating: anime?.averageScore || 0,
        totalEpisodes: anime?.episodes || 0
      }))
      .filter(anime => !BANNED_ANIME_IDS.includes(anime.id));

    return res.json({
      results: formatted,
      hasNextPage: json?.data?.Page?.pageInfo?.hasNextPage || false
    });
  } catch (error) {
    console.error("[SEARCH ERROR]", error.message);
    return res.status(500).json({ results: [], hasNextPage: false, error: "Search Failed" });
  }
});

// ==========================================
// ℹ️ INFO ROUTE (LIGHTNING SPEED METADATA AGGREGATOR)
// ==========================================
app.get('/anime/zoro/info/:id', async (req, res) => {
  const id = req.params.id;
  const cacheKey = `info-${id}`;

  // 1. Check Cache First
  const cachedData = getCache(cacheKey);
  if (cachedData) return res.json(cachedData);

  try {
    let anime = null;
    let relations = [];

    // --- PRIMARY SEARCH: Jikan (MAL) ---
    // Note: Assuming 'id' passed here is the MAL ID. 
    // If it's an AniList ID, you'd need a mapping step first.
    let jikanData = null;
    try {
      const jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${id}/full`);
      if (jikanRes.ok) {
        const jRes = await jikanRes.json();
        jikanData = jRes.data;
      }
    } catch (err) {
      console.error("Jikan Primary Fetch Failed:", err.message);
    }

    // --- SECONDARY ENRICHMENT: AniList ---
    // We try AniList to get the banner, cleaner descriptions, and relations.
    try {
      const query = `query ($id: Int, $search: String) { 
        Media (id: $id, search: $search, type: ANIME) { 
          id title { english romaji } coverImage { extraLarge } bannerImage description genres averageScore status episodes type 
          startDate { year month day } 
          relations { edges { relationType node { id title { english romaji } coverImage { extraLarge } format } } } 
        } 
      }`;

      // Use Jikan title as a fallback search if ID lookup fails due to ID mismatch
      const variables = jikanData
        ? { search: jikanData.title }
        : { id: parseInt(id) };

      const alResponse = await fetchWithBackoff(ANILIST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
      });

      if (alResponse.ok) {
        const json = await alResponse.json();
        anime = json?.data?.Media;
      }
    } catch (alErr) {
      console.warn("AniList Secondary Fetch failed (likely rate limited). Falling back to Jikan.");
    }

    // --- DATA NORMALIZATION ---
    // Use AniList data if available, otherwise use Jikan data.
    const finalTitle = anime?.title?.english || anime?.title?.romaji || jikanData?.title || 'Unknown Title';
    const finalImage = anime?.coverImage?.extraLarge || jikanData?.images?.jpg?.large_image_url || '';

    // Process Relations (Only if AniList succeeded)
    if (anime?.relations?.edges) {
      relations = anime.relations.edges
        .filter(edge => ['PREQUEL', 'SEQUEL', 'ALTERNATIVE', 'SPIN_OFF', 'SIDE_STORY'].includes(edge.relationType))
        .map(edge => ({
          id: edge.node.id,
          title: edge.node.title?.english || edge.node.title?.romaji || `${edge.node.format || 'TV'} ${edge.relationType}`,
          image: edge.node.coverImage?.extraLarge || '',
          type: edge.node.format || 'TV',
          relationType: edge.relationType
        }))
        .filter(rel => !BANNED_ANIME_IDS.includes(rel.id.toString()));
    }

    // --- PAYLOAD CONSTRUCTION ---
    const payloadObj = {
      id: id,
      title: finalTitle,
      image: finalImage,
      bannerImage: anime?.bannerImage || finalImage, // Fallback to cover if no banner
      description: anime?.description || jikanData?.synopsis || 'No synopsis available.',
      genres: anime?.genres || jikanData?.genres?.map(g => g.name) || [],
      rating: anime?.averageScore || (jikanData?.score ? jikanData.score * 10 : 0),
      status: anime?.status || jikanData?.status?.toUpperCase() || 'UNKNOWN',
      totalEpisodes: anime?.episodes || jikanData?.episodes || 0,
      type: anime?.type || jikanData?.type || 'TV',
      releaseDate: anime?.startDate?.year
        ? `${anime.startDate.year}-${anime.startDate.month || 1}-${anime.startDate.day || 1}`
        : (jikanData?.aired?.from?.split('T')[0] || 'Unknown'),
      relations: relations
    };

    // If we have neither AniList nor Jikan, throw error
    if (!jikanData && !anime) throw new Error("Anime not found on both providers");

    setCache(cacheKey, payloadObj);
    return res.json(payloadObj);

  } catch (error) {
    console.error("Search Error:", error.message);
    res.status(404).json({ error: "Anime not found or provider timeout" });
  }
});

// ==========================================
// 🛑 EPISODES LIST WITH "EXACT SEQUENCE INTERCEPTOR"
// ==========================================
app.get('/anime/zoro/episodes/:id', async (req, res) => {
  const id = req.params.id;
  if (!id || id === 'undefined') return res.json({ episodes: [] });

  const cacheKey = `episodes-${id}`;
  if (getCache(cacheKey)) return res.json(getCache(cacheKey));

  let animeTitles = [];
  let format = "TV";
  let finalEpisodes = [];
  let targetEpisodes = 0;

  try {
    const q = `query($id:Int){Media(id:$id){title{english romaji} status format episodes nextAiringEpisode{episode}}}`;
    const r = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, variables: { id: parseInt(id) } }) });
    const j = await r.json();
    if (j?.data?.Media) {
      if (j.data.Media.title) animeTitles = [j.data.Media.title.english, j.data.Media.title.romaji].filter(Boolean);
      if (j.data.Media.format) format = j.data.Media.format;

      if (j.data.Media.nextAiringEpisode) {
        targetEpisodes = Math.max(0, j.data.Media.nextAiringEpisode.episode - 1);
      } else if (j.data.Media.episodes) {
        targetEpisodes = j.data.Media.episodes;
      } else if (j.data.Media.status === 'RELEASING' || j.data.Media.status === 'FINISHED') {
        targetEpisodes = 12;
      }
    }
  } catch (e) { }

  const interceptAndSanitizeEps = (rawArray, limitCeiling) => {
    if (!rawArray || rawArray.length === 0) return [];

    const sorted = [...rawArray].sort((a, b) => {
      const numA = typeof a.number === 'number' ? a.number : parseFloat(a.number) || 0;
      const numB = typeof b.number === 'number' ? b.number : parseFloat(b.number) || 0;
      return numA - numB;
    });

    const sanitized = [];
    const seenNums = new Set();

    for (const ep of sorted) {
      const num = typeof ep.number === 'number' ? ep.number : parseFloat(ep.number);
      if (isNaN(num)) continue;

      const expectedNext = sanitized.length + 1;
      if (num > expectedNext + 2 && limitCeiling > 0 && num > limitCeiling) {
        continue;
      }

      if (!seenNums.has(num)) {
        seenNums.add(num);
        sanitized.push(ep);
      }
    }

    if (limitCeiling > 0 && sanitized.length > limitCeiling) {
      return sanitized.slice(0, limitCeiling);
    }

    return sanitized;
  };

  try {
    const consumetInfo = await timeoutPromise(anilist.fetchAnimeInfo(id), 600);
    if (consumetInfo && consumetInfo.episodes && consumetInfo.episodes.length > 0) {
      let finalEps = interceptAndSanitizeEps(consumetInfo.episodes, targetEpisodes);

      const maxFoundEp = Math.max(...finalEps.map(ep => typeof ep.number === 'number' ? ep.number : parseInt(ep.number) || 0), 0);
      if (targetEpisodes > maxFoundEp) {
        for (let i = Math.floor(maxFoundEp) + 1; i <= targetEpisodes; i++) {
          finalEps.push({ id: `auto-${id}-${i}`, number: i, url: `auto-${id}-${i}` });
        }
      }

      setCache(cacheKey, { episodes: finalEps });
      return res.json({ episodes: finalEps });
    }
  } catch (e) { }

  if (animeTitles.length > 0) {
    try {
      let allAnimeId = MAPPING_CACHE.get(`allanime-id-${id}`);

      if (!allAnimeId) {
        const SEARCH_GQL = `query($search: SearchInput) { shows(search: $search, limit: 30) { edges { _id name englishName availableEpisodesDetail } } }`;
        const getWords = (str) => {
          if (!str) return [];
          return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter(w => w.length > 0 && !['sub', 'dub', 'tv', 'movie', 'ova', 'special', 'ona', 'part', 'season', 'the', 'and', 'of', 'nd', 'rd', 'th'].includes(w));
        };

        const searchPromises = animeTitles.map(title => {
          let searchQuery = ['MOVIE', 'OVA', 'SPECIAL', 'ONA'].includes(format) ? title.replace(/Movie/gi, '').replace(/OVA/gi, '').trim() : title;
          const broadQuery = getWords(searchQuery).slice(0, 3).join(' ');
          return allAnimeGql({ search: { query: broadQuery, allowAdult: false, allowUnknown: false } }, SEARCH_GQL).catch(() => null);
        });

        const searchResults = await Promise.all(searchPromises);
        let bestScore = -1;

        for (let i = 0; i < animeTitles.length; i++) {
          const title = animeTitles[i];
          const searchJson = searchResults[i];
          const edges = searchJson?.data?.shows?.edges;

          if (edges && edges.length > 0) {
            const targetWords = getWords(title);
            const exactTarget = targetWords.join('');

            for (const edge of edges) {
              const nameWords = getWords(edge.name);
              const engWords = getWords(edge.englishName);

              let matchCountName = 0; targetWords.forEach(tw => { if (nameWords.includes(tw)) matchCountName++; });
              let scoreName = targetWords.length > 0 ? (matchCountName / targetWords.length) * 100 : 0;
              scoreName -= Math.abs(nameWords.length - targetWords.length) * 5;

              let matchCountEng = 0; targetWords.forEach(tw => { if (engWords.includes(tw)) matchCountEng++; });
              let scoreEng = targetWords.length > 0 ? (matchCountEng / targetWords.length) * 100 : 0;
              scoreEng -= Math.abs(engWords.length - targetWords.length) * 5;

              let finalScore = Math.max(scoreName, scoreEng);
              if (nameWords.join('') === exactTarget || engWords.join('') === exactTarget) finalScore = 150;

              const subEps = edge.availableEpisodesDetail?.sub || [];
              const dubEps = edge.availableEpisodesDetail?.dub || [];
              const edgeMaxEps = Math.max(
                ...subEps.map(n => parseFloat(n)).filter(n => !isNaN(n)),
                ...dubEps.map(n => parseFloat(n)).filter(n => !isNaN(n)),
                0
              );

              if (targetEpisodes > 0 && Math.abs(edgeMaxEps - targetEpisodes) <= 2) {
                finalScore += 200;
              }

              if (finalScore > 0 && finalScore > bestScore) {
                bestScore = finalScore;
                allAnimeId = edge._id;
              }
              if (finalScore >= 350) break;
            }
          }
        }
      }

      if (allAnimeId) {
        MAPPING_CACHE.set(`allanime-id-${id}`, allAnimeId);

        const EPISODES_GQL = `query ($showId: String!) { show( _id: $showId ) { _id availableEpisodesDetail } }`;
        const epJson = await allAnimeGql({ showId: allAnimeId }, EPISODES_GQL);

        const parseEps = (raw) => {
          if (Array.isArray(raw)) return raw.map(e => typeof e === 'object' ? (e.episode || e.ep || e.number || e.toString()) : String(e));
          if (raw && typeof raw === 'object') return Object.keys(raw);
          return [];
        };

        const subEps = parseEps(epJson?.data?.show?.availableEpisodesDetail?.sub);
        const dubEps = parseEps(epJson?.data?.show?.availableEpisodesDetail?.dub);
        const rawEps = parseEps(epJson?.data?.show?.availableEpisodesDetail?.raw);

        const combinedEps = Array.from(new Set([...subEps, ...dubEps, ...rawEps]));

        if (combinedEps.length > 0) {
          const mappedArray = combinedEps.map(epNumString => {
            const num = parseFloat(epNumString);
            const combinedId = `allanime-${id}-vid-${allAnimeId}-ep-${epNumString}`;
            return {
              id: combinedId,
              number: (format === 'MOVIE' && combinedEps.length === 1) ? "Full Movie" : num,
              url: combinedId
            };
          });

          finalEpisodes = interceptAndSanitizeEps(mappedArray, targetEpisodes);

          const maxFoundEp = Math.max(...finalEpisodes.map(ep => typeof ep.number === 'number' ? ep.number : parseInt(ep.number) || 0), 0);
          if (targetEpisodes > maxFoundEp) {
            for (let i = Math.floor(maxFoundEp) + 1; i <= targetEpisodes; i++) {
              finalEpisodes.push({ id: `auto-${id}-${i}`, number: i, url: `auto-${id}-${i}` });
            }
          }

          setCache(cacheKey, { episodes: finalEpisodes });
          return res.json({ episodes: finalEpisodes });
        }
      }
    } catch (e) { }
  }

  if (format === 'MOVIE') {
    finalEpisodes.push({ id: `auto-${id}-1`, number: "Full Movie", url: `auto-${id}-1` });
    setCache(cacheKey, { episodes: finalEpisodes });
    return res.json({ episodes: finalEpisodes });
  }

  if (targetEpisodes > 0) {
    for (let i = 1; i <= targetEpisodes; i++) {
      finalEpisodes.push({ id: `auto-${id}-${i}`, number: i, url: `auto-${id}-${i}` });
    }
    setCache(cacheKey, { episodes: finalEpisodes });
    return res.json({ episodes: finalEpisodes });
  }

  setCache(cacheKey, { episodes: finalEpisodes });
  res.json({ episodes: finalEpisodes });
});

// ==========================================
// 🛡️ DYNAMIC SSL PROXY ROUTES
// ==========================================
app.get('/proxy/stream.m3u8', async (req, res) => {
  const targetUrl = req.query.url;
  const referer = req.query.referer || ALLANIME_REFERER;

  if (!targetUrl) return res.status(400).send("Missing URL");

  const protocol = req.headers['x-forwarded-proto'] || (req.hostname === 'localhost' || req.hostname === '127.0.0.1' ? 'http' : 'https');
  const baseUrl = `${protocol}://${req.get('host')}`;

  try {
    const headers = { "Referer": referer, "User-Agent": "Mozilla/5.0", "Accept": "*/*" };
    const fetchRes = await fetch(targetUrl, { headers });
    const contentType = (fetchRes.headers.get('content-type') || '').toLowerCase();

    if (contentType.includes('video/mp4') || contentType.includes('octet-stream')) {
      return res.redirect(`${baseUrl}/proxy/stream?url=${encodeURIComponent(targetUrl)}&referer=${encodeURIComponent(referer)}`);
    }

    res.status(fetchRes.status);
    const manifestText = await fetchRes.text();
    const rewritten = rewriteHlsManifest(manifestText, targetUrl, referer, baseUrl);

    fetchRes.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (['transfer-encoding', 'connection', 'content-encoding', 'content-length'].includes(lower)) return;
      res.setHeader(key, val);
    });

    res.setHeader('content-type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('access-control-allow-origin', '*');
    return res.send(rewritten);
  } catch (err) { res.status(502).send("Proxy Stream Error"); }
});

app.get('/proxy/stream', async (req, res) => {
  let targetUrl = req.query.url;
  const referer = req.query.referer || ALLANIME_REFERER;

  if (!targetUrl) return res.status(400).send("Missing URL");

  const protocol = req.headers['x-forwarded-proto'] || (req.hostname === 'localhost' || req.hostname === '127.0.0.1' ? 'http' : 'https');
  const baseUrl = `${protocol}://${req.get('host')}`;

  try {
    const headers = { "Referer": referer, "User-Agent": "Mozilla/5.0", "Accept": "*/*" };
    if (req.headers.range) headers.Range = req.headers.range;

    let fetchRes;
    for (let i = 0; i < 5; i++) {
      fetchRes = await fetch(targetUrl, { headers, redirect: 'manual' });
      if (fetchRes.status >= 300 && fetchRes.status < 400) {
        let location = fetchRes.headers.get('location');
        if (location.startsWith('/')) location = new URL(location, targetUrl).toString();
        targetUrl = location;
      } else break;
    }

    const upstreamType = (fetchRes.headers.get('content-type') || '').toLowerCase();
    if (upstreamType.includes('mpegurl') || upstreamType.includes('application/x-mpegurl')) {
      return res.redirect(`${baseUrl}/proxy/stream.m3u8?url=${encodeURIComponent(targetUrl)}&referer=${encodeURIComponent(referer)}`);
    }

    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, HEAD, OPTIONS');
    res.setHeader('access-control-allow-headers', 'Content-Type, Range');
    res.setHeader('access-control-expose-headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Accept-Ranges', 'bytes');
    if (fetchRes.headers.has('content-length')) res.setHeader('Content-Length', fetchRes.headers.get('content-length'));
    if (fetchRes.headers.has('content-range')) res.setHeader('Content-Range', fetchRes.headers.get('content-range'));
    res.setHeader('content-type', upstreamType || 'video/mp4');
    res.status(fetchRes.status);

    if (!fetchRes.body) return res.end();
    const nodeStream = Readable.fromWeb(fetchRes.body);
    req.on('close', () => nodeStream.destroy());
    nodeStream.pipe(res).on('error', () => { });
  } catch (err) { res.status(502).send("Proxy Stream Error"); }
});

// ==========================================
// 🛑 WATCH ROUTE (HYBRID OPTION A + DB FALLBACK)
// ==========================================
app.get('/anime/zoro/watch/:episodeId', async (req, res) => {
  const episodeId = req.params.episodeId;
  const lang = req.query.lang === 'dub' ? 'dub' : 'sub';

  const cacheKey = `watch-${episodeId}-${lang}`;
  if (getCache(cacheKey)) {
    return res.json(getCache(cacheKey));
  }

  const protocol = req.headers['x-forwarded-proto'] || (req.hostname === 'localhost' || req.hostname === '127.0.0.1' ? 'http' : 'https');
  const baseUrl = `${protocol}://${req.get('host')}`;

  const enrichWithSkipTimes = async (responseData, resolvedAnimeId, resolvedEpNum) => {
    if (!responseData) return responseData;

    let intro = responseData.intro || null;
    let outro = responseData.outro || null;

    if ((!intro || !outro) && resolvedAnimeId && resolvedEpNum) {
      try {
        const parsedEp = parseInt(resolvedEpNum);
        if (!isNaN(parsedEp)) {
          const { data: customSkip } = await supabase
            .from('custom_skip_times')
            .select('*')
            .eq('episode_number', parsedEp)
            .or(`anime_id.eq.${resolvedAnimeId},mal_id.eq.${resolvedAnimeId}`)
            .maybeSingle();

          if (customSkip) {
            if (!intro && customSkip.op_start !== null && customSkip.op_end !== null) {
              intro = { start: customSkip.op_start, end: customSkip.op_end };
            }
            if (!outro && customSkip.ed_start !== null && customSkip.ed_end !== null) {
              outro = { start: customSkip.ed_start, end: customSkip.ed_end };
            }
          }
        }
      } catch (err) { }
    }

    return {
      ...responseData,
      intro,
      outro
    };
  };

  if (episodeId.startsWith('auto-') || episodeId.startsWith('allanime-')) {
    let animeId = ""; let epNum = ""; let allAnimeId = null;

    if (episodeId.startsWith('allanime-')) {
      const parts = episodeId.split('-ep-');
      const prefixParts = parts[0].split('-vid-');
      animeId = prefixParts[0].replace('allanime-', '');
      allAnimeId = prefixParts[1];
      epNum = parts[1];

      if (allAnimeId) {
        try {
          const EPISODE_EMBED_GQL = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) { episode( showId: $showId translationType: $translationType episodeString: $episodeString ) { episodeString sourceUrls } }`;

          let epJson = await allAnimeGql({ showId: allAnimeId, translationType: lang, episodeString: epNum }, EPISODE_EMBED_GQL);
          let sources = epJson?.data?.episode?.sourceUrls || [];

          if (sources.length === 0) {
            const paddedEp = String(epNum).padStart(2, '0');
            epJson = await allAnimeGql({ showId: allAnimeId, translationType: lang, episodeString: paddedEp }, EPISODE_EMBED_GQL);
            sources = epJson?.data?.episode?.sourceUrls || [];
          }

          if (sources.length === 0 && lang === 'dub') {
            epJson = await allAnimeGql({ showId: allAnimeId, translationType: 'sub', episodeString: epNum }, EPISODE_EMBED_GQL);
            sources = epJson?.data?.episode?.sourceUrls || [];

            if (sources.length === 0) {
              const paddedEp = String(epNum).padStart(2, '0');
              epJson = await allAnimeGql({ showId: allAnimeId, translationType: 'sub', episodeString: paddedEp }, EPISODE_EMBED_GQL);
              sources = epJson?.data?.episode?.sourceUrls || [];
            }
          }

          if (sources.length === 0) {
            epJson = await allAnimeGql({ showId: allAnimeId, translationType: 'raw', episodeString: epNum }, EPISODE_EMBED_GQL);
            sources = epJson?.data?.episode?.sourceUrls || [];
            if (sources.length === 0) {
              const paddedEp = String(epNum).padStart(2, '0');
              epJson = await allAnimeGql({ showId: allAnimeId, translationType: 'raw', episodeString: paddedEp }, EPISODE_EMBED_GQL);
              sources = epJson?.data?.episode?.sourceUrls || [];
            }
          }

          const rawResponse = await processAllanImeSources(sources, baseUrl, cacheKey);
          if (rawResponse) {
            const enrichedResponse = await enrichWithSkipTimes(rawResponse, animeId, epNum);
            setCache(cacheKey, enrichedResponse);
            return res.json(enrichedResponse);
          }
          throw new Error("All sources failed after processing.");
        } catch (e) { }
      }
    } else {
      const parts = episodeId.split('-');
      animeId = parts[1];
      epNum = parts[2];

      allAnimeId = MAPPING_CACHE.get(`allanime-id-${animeId}`);
    }

    try {
      if (!allAnimeId) {
        const titleQuery = `query($id:Int){Media(id:$id){title{romaji english} episodes nextAiringEpisode{episode}}}`;
        const titleRes = await fetchWithBackoff(ANILIST_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: titleQuery, variables: { id: parseInt(animeId) } })
        });
        const titleJson = await titleRes.json();
        const titles = [
          titleJson?.data?.Media?.title?.english,
          titleJson?.data?.Media?.title?.romaji
        ].filter(Boolean);

        if (titles.length === 0) throw new Error("Could not resolve title from AniList");

        const targetEpisodes = titleJson?.data?.Media?.episodes ||
          (titleJson?.data?.Media?.nextAiringEpisode ? titleJson.data.Media.nextAiringEpisode.episode - 1 : 0);

        const SEARCH_GQL = `query($search: SearchInput) { shows(search: $search, limit: 30) { edges { _id name englishName availableEpisodesDetail } } }`;
        const getWords = (str) => {
          if (!str) return [];
          return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ')
            .filter(w => w.length > 0 && !['sub', 'dub', 'tv', 'movie', 'ova', 'special', 'ona', 'part', 'season', 'the', 'and', 'of'].includes(w));
        };

        let bestScore = -1;

        const searchPromises = titles.map(title => {
          const broadQuery = getWords(title).slice(0, 3).join(' ');
          return allAnimeGql({ search: { query: broadQuery, allowAdult: false, allowUnknown: false } }, SEARCH_GQL).catch(() => null);
        });

        const searchResults = await Promise.all(searchPromises);

        for (let i = 0; i < titles.length; i++) {
          const title = titles[i];
          const searchJson = searchResults[i];
          const edges = searchJson?.data?.shows?.edges || [];

          for (const edge of edges) {
            const targetWords = getWords(title);
            const nameWords = getWords(edge.name);
            const engWords = getWords(edge.englishName);

            let matchName = 0; targetWords.forEach(tw => { if (nameWords.includes(tw)) matchName++; });
            let matchEng = 0; targetWords.forEach(tw => { if (engWords.includes(tw)) matchEng++; });
            let score = Math.max(
              targetWords.length > 0 ? (matchName / targetWords.length) * 100 : 0,
              targetWords.length > 0 ? (matchEng / targetWords.length) * 100 : 0
            );

            if (nameWords.join('') === targetWords.join('') || engWords.join('') === targetWords.join('')) score = 150;

            const subEps = edge.availableEpisodesDetail?.sub || [];
            const maxEps = Math.max(...subEps.map(n => parseFloat(n)).filter(n => !isNaN(n)), 0);
            if (targetEpisodes > 0 && Math.abs(maxEps - targetEpisodes) <= 2) score += 200;

            if (score > bestScore) { bestScore = score; allAnimeId = edge._id; }
            if (score >= 350) break;
          }
          if (bestScore >= 350) break;
        }

        if (!allAnimeId) throw new Error("AllAnime title search returned no matches");
        MAPPING_CACHE.set(`allanime-id-${animeId}`, allAnimeId);
      }

      const EPISODE_EMBED_GQL = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) { episode( showId: $showId translationType: $translationType episodeString: $episodeString ) { episodeString sourceUrls } }`;
      let epJson = await allAnimeGql({ showId: allAnimeId, translationType: lang, episodeString: epNum }, EPISODE_EMBED_GQL);
      let sources = epJson?.data?.episode?.sourceUrls || [];

      if (sources.length === 0) {
        const paddedEp = String(epNum).padStart(2, '0');
        epJson = await allAnimeGql({ showId: allAnimeId, translationType: lang, episodeString: paddedEp }, EPISODE_EMBED_GQL);
        sources = epJson?.data?.episode?.sourceUrls || [];
      }

      if (sources.length === 0 && lang === 'dub') {
        epJson = await allAnimeGql({ showId: allAnimeId, translationType: 'sub', episodeString: epNum }, EPISODE_EMBED_GQL);
        sources = epJson?.data?.episode?.sourceUrls || [];

        if (sources.length === 0) {
          const paddedEp = String(epNum).padStart(2, '0');
          epJson = await allAnimeGql({ showId: allAnimeId, translationType: 'sub', episodeString: paddedEp }, EPISODE_EMBED_GQL);
          sources = epJson?.data?.episode?.sourceUrls || [];
        }
      }

      if (sources.length === 0) {
        epJson = await allAnimeGql({ showId: allAnimeId, translationType: 'raw', episodeString: epNum }, EPISODE_EMBED_GQL);
        sources = epJson?.data?.episode?.sourceUrls || [];
        if (sources.length === 0) {
          const paddedEp = String(epNum).padStart(2, '0');
          epJson = await allAnimeGql({ showId: allAnimeId, translationType: 'raw', episodeString: paddedEp }, EPISODE_EMBED_GQL);
          sources = epJson?.data?.episode?.sourceUrls || [];
        }
      }

      const rawResponse = await processAllanImeSources(sources, baseUrl, cacheKey);
      if (rawResponse) {
        const enrichedResponse = await enrichWithSkipTimes(rawResponse, animeId, epNum);
        setCache(cacheKey, enrichedResponse);
        return res.json(enrichedResponse);
      }
      throw new Error("All AllAnime fallback sources failed");

    } catch (err) {
      return res.json({ error: "Unreleased or No Sources", sources: [] });
    }
  }

  if (episodeId.startsWith('http')) return res.json({ sources: [{ url: episodeId, isM3U8: episodeId.includes('.m3u8'), quality: 'default' }] });

  try {
    const rawData = await timeoutPromise(anilist.fetchEpisodeSources(episodeId), 4500);

    const fallbackAnimeId = req.query.animeId || null;
    const fallbackEpNum = req.query.epNum || null;

    const enrichedData = await enrichWithSkipTimes(rawData, fallbackAnimeId, fallbackEpNum);

    setCache(cacheKey, enrichedData);
    res.json(enrichedData);
  } catch (error) {
    res.status(500).json({ error: "Stream Failed" });
  }
});

app.listen(preferredPort, host, () => {
  console.log(`🔥 KuroTV API is permanently locked and running at http://${host}:${preferredPort}`);
});