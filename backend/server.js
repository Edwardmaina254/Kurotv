// backend/server.js
import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv, createHash } from 'crypto';
import { Readable } from 'stream';

const require = createRequire(import.meta.url);
const consumet = require('@consumet/extensions');
const { META, ANIME } = consumet;

/// Initialize Supabase Client
const supabaseUrl = 'https://qpcfmluwslfoiiszgoqi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2ZtbHV3c2xmb2lpc3pnb3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTk5NDcsImV4cCI6MjA5Mjg3NTk0N30.9xMp2A-WBdKOFs78VZCLAwnrcUiRQaHPkDV_kenL4xY';
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const preferredPort = Number(process.env.PORT) || 3005;
const host = '127.0.0.1';

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));

const anilist = new META.Anilist("gogoanime");
const ANILIST_API = 'https://graphql.anilist.co';

console.log("✅ KuroTV Backend: Bulletproof Intersection Engine Online! (Debug Mode: ON)");

// ==========================================
// 🛑 CACHING SYSTEMS
// ==========================================
const CACHE = { trending: null, recent: null, schedule: null };

const NODE_CACHE = new Map();
const MAPPING_CACHE = new Map();

const getCache = (key) => NODE_CACHE.get(key);
const setCache = (key, data, ttlHours = 2) => {
  NODE_CACHE.set(key, data);
  setTimeout(() => NODE_CACHE.delete(key), ttlHours * 60 * 60 * 1000);
};

// ==========================================
// ⚙️ THE EXPONENTIAL BACKOFF ENGINE
// ==========================================
const fetchWithBackoff = async (url, options, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    if (response.status !== 429) return response;
    const waitTime = Math.pow(2, i) * 1000;
    console.log(`⏳ [API] 429 Rate Limit Hit. Waiting ${waitTime}ms before retry...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  throw new Error("Max retries reached after Rate Limit.");
};

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
  const res = await fetch(`${ALLANIME_API}/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Referer": ALLANIME_REFERER,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36"
    },
    body: JSON.stringify({ variables, query }),
  });

  if (!res.ok) throw new Error(`AllAnime request failed: ${res.status}`);
  return normalizeTobeparsed(await res.json());
}

async function checkIsM3U8(url) {
  if (url.includes('.m3u8')) return true;
  try {
    const headers = { "Referer": ALLANIME_REFERER, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    let res = await fetch(url, { method: 'HEAD', headers, signal: controller.signal });
    clearTimeout(timeout);

    let contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('mpegurl') || contentType.includes('x-mpegurl')) return true;
    if (contentType.includes('mp4') || contentType.includes('video/mp4')) return false;

    const sniffController = new AbortController();
    const sniffTimeout = setTimeout(() => sniffController.abort(), 1000);
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

function rewriteHlsManifest(manifest, manifestUrl, referer, reqHost) {
  const effectiveReferer = referer && referer.trim().length > 0 ? referer : manifestUrl;
  const toProxyUrl = (rawUri) => {
    const trimmed = rawUri.trim();
    if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return rawUri;
    const absolute = toAbsoluteUrl(trimmed, manifestUrl);
    const proxyPath = absolute.includes('.m3u8') ? '/proxy/stream.m3u8' : '/proxy/stream';
    return `http://${reqHost}${proxyPath}?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(effectiveReferer)}`;
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
// 🏠 HOMEPAGE ROUTES
// ==========================================
app.get('/anime/zoro/top-airing', async (req, res) => {
  try {
    const query = `query { Page(page: 1, perPage: 20) { media(sort: TRENDING_DESC, type: ANIME, status: RELEASING) { id title { english romaji } coverImage { extraLarge } bannerImage averageScore description type status } } }`;
    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    const json = await response.json();
    const formatted = (json?.data?.Page?.media || []).map(anime => ({
      id: anime?.id?.toString() || '', title: anime?.title?.english || anime?.title?.romaji || 'Unknown', image: anime?.coverImage?.extraLarge || '', bannerImage: anime?.bannerImage || anime?.coverImage?.extraLarge || '', rating: anime?.averageScore || 0, description: anime?.description || '', type: anime?.type || "TV", status: anime?.status || "RELEASING"
    }));
    CACHE.trending = formatted;
    return res.json({ results: formatted });
  } catch (error) { return res.json({ results: CACHE.trending || [] }); }
});

app.get('/anime/zoro/recent-episodes', async (req, res) => {
  try {
    const query = `query { Page(page: 1, perPage: 30) { airingSchedules(notYetAired: false, sort: TIME_DESC) { episode media { id title { english romaji } coverImage { extraLarge } type } } } }`;
    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    const json = await response.json();
    const rawList = (json?.data?.Page?.airingSchedules || []).map(item => ({
      id: item?.media?.id?.toString() || '', episode: item?.episode || 1, episodeNumber: item?.episode || 1, title: item?.media?.title?.english || item?.media?.title?.romaji || 'Unknown', image: item?.media?.coverImage?.extraLarge || '', type: item?.media?.type || "TV"
    }));
    const unique = []; const seen = new Set();
    for (const anime of rawList) { if (!seen.has(anime.id)) { seen.add(anime.id); unique.push(anime); } }
    CACHE.recent = unique.slice(0, 20);
    return res.json({ results: CACHE.recent });
  } catch (error) { return res.json({ results: CACHE.recent || [] }); }
});

// ==========================================
// 📅 WEEKLY SCHEDULE ROUTE
// ==========================================
app.get('/anime/zoro/schedule', async (req, res) => {
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
    const formatted = (json?.data?.Page?.airingSchedules || []).map(item => ({
      id: item?.media?.id?.toString() || '',
      episode: item?.episode || 1,
      title: item?.media?.title?.english || item?.media?.title?.romaji || 'Unknown',
      image: item?.media?.coverImage?.extraLarge || '',
      type: item?.media?.type || "TV",
      airingAt: item?.airingAt || 0
    }));

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
// 🔍 GOD-MODE SEARCH ROUTE
// ==========================================
app.get('/anime/zoro/search', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 24;
    const search = req.query.q || undefined;
    const format = req.query.format || undefined;
    const status = req.query.status || undefined;
    const genres = req.query.genres ? req.query.genres.split(',') : undefined;

    const sortMap = {
      'trending': 'TRENDING_DESC',
      'popular': 'POPULARITY_DESC',
      'newest': 'START_DATE_DESC',
      'score': 'SCORE_DESC'
    };

    let sortQuery = [];

    if (search) {
      sortQuery = ['SEARCH_MATCH'];
    } else if (req.query.sort && sortMap[req.query.sort]) {
      sortQuery = [sortMap[req.query.sort]];
    } else {
      sortQuery = ['TRENDING_DESC'];
    }

    let queryArgs = `$page: Int, $perPage: Int, $sort: [MediaSort]`;
    let mediaArgs = `type: ANIME, sort: $sort`;
    const variables = { page, perPage, sort: sortQuery };

    if (search) { queryArgs += `, $search: String`; mediaArgs += `, search: $search`; variables.search = search; }
    if (format) { queryArgs += `, $format: MediaFormat`; mediaArgs += `, format: $format`; variables.format = format; }
    if (status) { queryArgs += `, $status: MediaStatus`; mediaArgs += `, status: $status`; variables.status = status; }
    if (genres) { queryArgs += `, $genre_in: [String]`; mediaArgs += `, genre_in: $genre_in`; variables.genre_in = genres; }

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

    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
    const json = await response.json();

    if (json.errors) {
      console.error("AniList GraphQL Errors:", json.errors);
      throw new Error("GraphQL Error");
    }

    const formatted = (json?.data?.Page?.media || []).map(anime => ({
      id: anime?.id?.toString() || '',
      title: anime?.title?.english || anime?.title?.romaji || 'Unknown',
      image: anime?.coverImage?.extraLarge || '',
      type: anime?.format || "TV",
      status: anime?.status || "UNKNOWN",
      rating: anime?.averageScore || 0,
      totalEpisodes: anime?.episodes || 0
    }));

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
// ℹ️ INFO ROUTE WITH RELATIONS UPGRADE
// ==========================================
app.get('/anime/zoro/info/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const query = `query ($id: Int) { 
      Media (id: $id, type: ANIME) { 
        id 
        title { english romaji } 
        coverImage { extraLarge } 
        bannerImage 
        description 
        genres 
        averageScore 
        status 
        episodes 
        type 
        startDate { year month day } 
        relations { 
          edges { 
            relationType 
            node { id title { english romaji } coverImage { extraLarge } format } 
          } 
        } 
      } 
    }`;
    const response = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { id: parseInt(id) } }) });

    if (!response.ok) throw new Error("AniList response was not ok");

    const json = await response.json();
    const anime = json?.data?.Media;

    if (!anime) throw new Error("Anime data missing from AniList");

    let relations = [];
    if (anime.relations && anime.relations.edges) {
      relations = anime.relations.edges
        .filter(edge => ['PREQUEL', 'SEQUEL', 'ALTERNATIVE', 'SPIN_OFF', 'SIDE_STORY'].includes(edge.relationType))
        .map(edge => ({
          id: edge.node.id,
          title: edge.node.title?.english || edge.node.title?.romaji || 'Unknown Title',
          image: edge.node.coverImage?.extraLarge || '',
          type: edge.node.format || 'TV',
          relationType: edge.relationType
        }));
    }

    return res.json({
      id: anime.id?.toString() || id,
      title: anime.title?.english || anime.title?.romaji || 'Unknown Title',
      image: anime.coverImage?.extraLarge || '',
      bannerImage: anime.bannerImage || anime.coverImage?.extraLarge || '',
      description: anime.description || 'No synopsis available.',
      genres: anime.genres || [],
      rating: anime.averageScore || 0,
      status: anime.status || 'UNKNOWN',
      totalEpisodes: anime.episodes || 0,
      type: anime.type || 'TV',
      releaseDate: anime.startDate?.year ? `${anime.startDate.year}-${anime.startDate.month || 1}-${anime.startDate.day || 1}` : 'Unknown',
      relations: relations
    });
  } catch (error) {
    console.error(`[INFO ERROR] ID ${id}:`, error.message);
    res.status(404).json({ error: "Anime not found or unreleased" });
  }
});

// ==========================================
// 🛑 EPISODES LIST WITH RAM CACHE & JOJO FIX
// ==========================================
app.get('/anime/zoro/episodes/:id', async (req, res) => {
  const id = req.params.id;
  if (!id || id === 'undefined') return res.json({ episodes: [] });

  const cacheKey = `episodes-${id}`;
  if (getCache(cacheKey)) return res.json(getCache(cacheKey));

  // 🛑 PERMANENT FIX: Try Consumet's native AniList-to-Gogoanime mapping FIRST
  try {
    const consumetInfo = await anilist.fetchAnimeInfo(id);
    if (consumetInfo && consumetInfo.episodes && consumetInfo.episodes.length > 0) {
      setCache(cacheKey, { episodes: consumetInfo.episodes });
      return res.json({ episodes: consumetInfo.episodes });
    }
  } catch (e) {
    console.warn(`[EPISODE SYNC] Native mapper failed for ${id}. Engaging Fallback Engine...`);
  }

  let animeTitles = [];
  let format = "TV";
  let finalEpisodes = [];
  let targetEpisodes = 0; // 🛑 THE JOJO FIX: We fetch exactly how many episodes it SHOULD have.

  try {
    const q = `query($id:Int){Media(id:$id){title{english romaji} format episodes nextAiringEpisode{episode}}}`;
    const r = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, variables: { id: parseInt(id) } }) });
    const j = await r.json();
    if (j?.data?.Media) {
      if (j.data.Media.title) animeTitles = [j.data.Media.title.english, j.data.Media.title.romaji].filter(Boolean);
      if (j.data.Media.format) format = j.data.Media.format;
      // Store the official episode count so we can cross-reference it
      targetEpisodes = j.data.Media.episodes || (j.data.Media.nextAiringEpisode ? j.data.Media.nextAiringEpisode.episode - 1 : 0);
    }
  } catch (e) { }

  if (animeTitles.length > 0) {
    try {
      const SEARCH_GQL = `query($search: SearchInput) { shows(search: $search, limit: 40) { edges { _id name englishName availableEpisodesDetail } } }`;
      const EPISODES_GQL = `query ($showId: String!) { show( _id: $showId ) { _id availableEpisodesDetail } }`;

      let allAnimeId = null;
      let bestScore = -1;

      const getWords = (str) => {
        if (!str) return [];
        return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter(w => w.length > 0 && !['sub', 'dub', 'tv', 'movie', 'ova', 'special', 'ona', 'part', 'season', 'the', 'and', 'of', 'nd', 'rd', 'th'].includes(w));
      };

      for (const title of animeTitles) {
        let searchQuery = ['MOVIE', 'OVA', 'SPECIAL', 'ONA'].includes(format) ? title.replace(/Movie/gi, '').replace(/OVA/gi, '').trim() : title;
        const broadQuery = getWords(searchQuery).slice(0, 3).join(' ');

        const searchJson = await allAnimeGql({ search: { query: broadQuery, allowAdult: false, allowUnknown: false } }, SEARCH_GQL);
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

            // 🛑 THE JOJO FIX: Max Episode Matcher
            // This checks how many episodes the search result has. If it matches AniList (e.g. 26), 
            // it gets a massive boost, guaranteeing it beats the OVA (7).
            const subEps = edge.availableEpisodesDetail?.sub || [];
            const dubEps = edge.availableEpisodesDetail?.dub || [];
            const edgeMaxEps = Math.max(
              ...subEps.map(n => parseFloat(n)).filter(n => !isNaN(n)),
              ...dubEps.map(n => parseFloat(n)).filter(n => !isNaN(n)),
              0
            );

            if (targetEpisodes > 0 && Math.abs(edgeMaxEps - targetEpisodes) <= 2) {
              finalScore += 200; // Instantly forces the correct season to win!
            }

            if (finalScore > 0 && finalScore > bestScore) {
              bestScore = finalScore;
              allAnimeId = edge._id;
            }
            if (finalScore >= 350) break; // Break early if perfect match
          }
        }
      }

      // Because this is your original code, the `allAnimeId` is embedded right here in the URL!
      if (allAnimeId) {
        const epJson = await allAnimeGql({ showId: allAnimeId }, EPISODES_GQL);
        const subEpisodes = epJson?.data?.show?.availableEpisodesDetail?.sub;

        if (subEpisodes && Array.isArray(subEpisodes)) {
          finalEpisodes = subEpisodes.map(epNumString => {
            const num = parseFloat(epNumString);
            const combinedId = `allanime-${id}-vid-${allAnimeId}-ep-${epNumString}`;
            return {
              id: combinedId,
              number: (format === 'MOVIE' && subEpisodes.length === 1) ? "Full Movie" : num,
              url: combinedId
            };
          }).sort((a, b) => (typeof a.number === 'number' && typeof b.number === 'number') ? a.number - b.number : 0);

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

  let airedCount = 12;
  try {
    const qCount = `query($id:Int){Media(id:$id){status episodes nextAiringEpisode{episode}}}`;
    const rCount = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: qCount, variables: { id: parseInt(id) } }) });
    const jCount = await rCount.json();
    if (jCount?.data?.Media) {
      if (jCount.data.Media.nextAiringEpisode) airedCount = jCount.data.Media.nextAiringEpisode.episode - 1;
      else if (jCount.data.Media.episodes) airedCount = jCount.data.Media.episodes;
    }
  } catch (e) { }

  if (airedCount > 0) {
    for (let i = 1; i <= airedCount; i++) {
      finalEpisodes.push({ id: `auto-${id}-${i}`, number: i, url: `auto-${id}-${i}` });
    }
    setCache(cacheKey, { episodes: finalEpisodes });
    return res.json({ episodes: finalEpisodes });
  }

  setCache(cacheKey, { episodes: finalEpisodes });
  res.json({ episodes: finalEpisodes });
});

app.get('/proxy/stream.m3u8', async (req, res) => {
  const targetUrl = req.query.url;
  const referer = req.query.referer || ALLANIME_REFERER;

  if (!targetUrl) return res.status(400).send("Missing URL");

  try {
    const headers = { "Referer": referer, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36", "Accept": "*/*" };
    const fetchRes = await fetch(targetUrl, { headers });
    const contentType = (fetchRes.headers.get('content-type') || '').toLowerCase();

    if (contentType.includes('video/mp4') || contentType.includes('octet-stream')) {
      return res.redirect(`/proxy/stream?url=${encodeURIComponent(targetUrl)}&referer=${encodeURIComponent(referer)}`);
    }

    res.status(fetchRes.status);
    const manifestText = await fetchRes.text();
    const rewritten = rewriteHlsManifest(manifestText, targetUrl, referer, req.get('host'));

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

  try {
    const headers = { "Referer": referer, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36", "Accept": "*/*" };
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
      return res.redirect(`/proxy/stream.m3u8?url=${encodeURIComponent(targetUrl)}&referer=${encodeURIComponent(referer)}`);
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
// 🛑 YOUR ORIGINAL WATCH ROUTE (LIGHTNING FAST)
// ==========================================
app.get('/anime/zoro/watch/:episodeId', async (req, res) => {
  const episodeId = req.params.episodeId;
  const lang = req.query.lang === 'dub' ? 'dub' : 'sub';

  const cacheKey = `watch-${episodeId}-${lang}`;
  if (getCache(cacheKey)) {
    console.log(`⚡ Serving Stream from RAM Cache: ${episodeId}`);
    return res.json(getCache(cacheKey));
  }

  // Because the ID generated above has allAnimeId embedded, this is instant.
  if (episodeId.startsWith('auto-') || episodeId.startsWith('allanime-')) {
    console.log(`🎬 Intercepted Virtual ID: ${episodeId} (Mode: ${lang})`);

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

          if (sources.length === 0 && lang === 'dub') {
            console.log(`[BACKEND] Dub not found for ${allAnimeId}. Falling back to Sub...`);
            epJson = await allAnimeGql({ showId: allAnimeId, translationType: 'sub', episodeString: epNum }, EPISODE_EMBED_GQL);
            sources = epJson?.data?.episode?.sourceUrls || [];
          }

          const validSources = sources.filter(s => s.sourceUrl && s.sourceUrl.startsWith('--')).slice(0, 2);

          const sourcePromises = validSources.map(async (source) => {
            const encoded = source.sourceUrl.slice(2);
            let decoded = "";
            for (let i = 0; i < encoded.length; i += 2) {
              decoded += OBFUSCATED_DECODE_TABLE[encoded.slice(i, i + 2).toLowerCase()] || "";
            }
            decoded = decoded.replace("/clock", "/clock.json");

            let providerUrl = decoded.startsWith("http") ? decoded : `https://${ALLANIME_BASE}${decoded}`;
            providerUrl = providerUrl.replace(/([^:]\/)\/+/g, "$1");

            if (providerUrl.includes('clock.json') || providerUrl.endsWith('.json')) {
              const clockRes = await fetch(providerUrl, { headers: { Referer: ALLANIME_REFERER } });
              const clockData = await clockRes.json();
              if (clockData && clockData.links && clockData.links.length > 0) {
                providerUrl = clockData.links[0].link;
                if (!providerUrl.startsWith('http')) providerUrl = `https://${ALLANIME_BASE}${providerUrl}`;
              } else {
                throw new Error("Empty Clock JSON");
              }
            }

            const isTrueM3U8 = await checkIsM3U8(providerUrl);
            const proxyPath = isTrueM3U8 ? '/proxy/stream.m3u8' : '/proxy/stream';
            const finalUrl = `http://${host}:${preferredPort}${proxyPath}?url=${encodeURIComponent(providerUrl)}&referer=${encodeURIComponent(ALLANIME_REFERER)}`;

            return {
              headers: { Referer: ALLANIME_REFERER },
              sources: [{ url: finalUrl, isM3U8: isTrueM3U8, quality: 'default' }]
            };
          });

          const results = await Promise.allSettled(sourcePromises);
          const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
          const bestResponse = successful.find(s => s.sources[0].isM3U8) || successful[0];

          if (bestResponse) {
            setCache(cacheKey, bestResponse);
            return res.json(bestResponse);
          }
          throw new Error("All concurrent obfuscated sources failed.");
        } catch (e) { console.warn(`⚠️ Native AllAnime Extraction Failed. Falling back to Failsafe...`); }
      }
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
          setCache(cacheKey, data);
          return res.json(data);
        }
      }
      throw new Error("Could not find mapped episode. Falling back to slug guesser...");
    } catch (e) {
      // ⚡ LAST RESORT FALLBACK (With added Mapping Cache support just in case!)
      try {
        const mappingKey = `allanime-map-${animeId}`;
        let fallbackAllAnimeId = MAPPING_CACHE.get(mappingKey);

        if (!fallbackAllAnimeId) {
          const query = `query($id:Int){Media(id:$id){title{romaji english}}}`;
          const r = await fetchWithBackoff(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { id: parseInt(animeId) } }) });
          const j = await r.json();
          const title = j?.data?.Media?.title?.romaji || j?.data?.Media?.title?.english || 'anime';
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const targetSlug = `${slug}-episode-${epNum}`;
          const data = await anilist.fetchEpisodeSources(targetSlug);
          setCache(cacheKey, data);
          return res.json(data);
        }
      } catch (err) {
        console.log(`[FALLBACK ENGINE] ❌ Stream completely unavailable for ID ${animeId}`);
        return res.json({ error: "Unreleased or No Sources", sources: [] });
      }
    }
  }

  // Native Gogoanime ID Handler
  if (episodeId.startsWith('http')) return res.json({ sources: [{ url: episodeId, isM3U8: episodeId.includes('.m3u8'), quality: 'default' }] });

  try {
    const data = await anilist.fetchEpisodeSources(episodeId);
    setCache(cacheKey, data);
    res.json(data);
  } catch (error) { res.status(500).json({ error: "Stream Failed" }); }
});

app.listen(preferredPort, host, () => {
  console.log(`🔥 KuroTV API is permanently locked and running at http://${host}:${preferredPort}`);
});