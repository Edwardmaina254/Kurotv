import axios from 'axios';

const BASE = 'https://anizone.to';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function decodeJsonArgument(raw) {
    if (!raw) return null;
    const marker = '\x01U\x01';
    let value = String(raw).replace(/\\\\u([0-9a-fA-F]{4})/g, `${marker}$1`);
    value = value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    value = value.replace(/\x01U\x01([0-9a-fA-F]{4})/g, '\\u$1');
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function jsonArgument(html, name) {
    const pattern = new RegExp(`${name}\\s*:\\s*JSON\\.parse\\('((?:[^'\\\\]|\\\\.)*)'\\)`, 'i');
    const match = String(html).match(pattern);
    return decodeJsonArgument(match ? match[1] : null);
}

function playerData(html) {
    const match = String(html).match(/vidstackPlayer\s*\(\s*JSON\.parse\('((?:[^'\\]|\\.)*)'\)\s*\)/i);
    return decodeJsonArgument(match ? match[1] : null);
}

function normalizeUrl(value) {
    return String(value || '').replace(/\\+\//g, '/');
}

export async function searchAniZone(query) {
    if (!query || !query.trim()) return [];
    const cleanQuery = query.replace(/[^\w\s:]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanQuery) return [];
    try {
        const res = await axios.get(`${BASE}/anime?search=${encodeURIComponent(cleanQuery)}`, {
            headers: {
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer': `${BASE}/`
            },
            timeout: 9000
        });
        const items = jsonArgument(res.data, 'items');
        if (!Array.isArray(items)) return [];
        return items.map(item => ({
            slug: item.slug,
            title: item.main_title || Object.values(item.title_list || {})[0] || '',
            titles: [item.main_title, ...Object.values(item.title_list || {})].filter(Boolean),
            type: (item.type || '').toUpperCase(),
            year: Number(item.start_year) || null,
            episodeCount: Number(item.episode_count) || 0
        })).filter(item => item.title && item.slug);
    } catch (e) {
        console.warn(`[ANIZONE] Search error for "${cleanQuery}":`, e.message);
        return [];
    }
}

export function scoreAniZoneCandidate(candidate, anilistMeta) {
    let score = 0;
    const { titleEng, titleRomaji, format, seasonYear, episodes } = anilistMeta;

    const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cTitleNorm = normalize(candidate.title);
    const engNorm = normalize(titleEng);
    const romajiNorm = normalize(titleRomaji);

    // 1. Direct title match
    if (cTitleNorm && (cTitleNorm === engNorm || cTitleNorm === romajiNorm)) {
        score += 85;
    } else {
        // Token Jaccard overlap
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'no', 'na', 'ni', 'wo', 'ga', 'wa', 'season', 'part', 'cour', 'tv', 'movie', 'ova', 'ona']);
        const getTokens = (s) => new Set((s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1 && !stopWords.has(t)));
        const metaTokens = new Set([...getTokens(titleEng), ...getTokens(titleRomaji)]);
        const candTokens = new Set([...getTokens(candidate.title), ...candidate.titles.flatMap(t => [...getTokens(t)])]);
        
        let matchCount = 0;
        candTokens.forEach(t => { if (metaTokens.has(t)) matchCount++; });
        if (metaTokens.size > 0 && candTokens.size > 0) {
            const jaccard = matchCount / Math.max(metaTokens.size, candTokens.size);
            score += Math.round(jaccard * 75);
        }
    }

    // 2. Year Matching (CRITICAL: prevents matching Season 1 when looking for Season 3)
    if (seasonYear && candidate.year) {
        if (seasonYear === candidate.year) {
            score += 50; // Strong positive boost
        } else {
            const diff = Math.abs(seasonYear - candidate.year);
            if (diff > 2) {
                score -= 60; // Major penalty for different era/season
            } else if (diff === 1) {
                score -= 10;
            }
        }
    }

    // 3. Known arc / season subtitle matching
    const knownArcs = [
        { en: 'golden wind', ro: 'ougon no kaze', season: 5 },
        { en: 'diamond is unbreakable', ro: 'diamond wa kudakenai', season: 4 },
        { en: 'stardust crusaders', ro: 'stardust crusaders', season: 3 },
        { en: 'battle tendency', ro: 'sentou chuuryuu', season: 2 },
        { en: 'phantom blood', ro: 'phantom blood', season: 1 },
        { en: 'the conflict', ro: 'soukoku tan', cour: 3 },
        { en: 'the separation', ro: 'ketsubetsu tan', cour: 2 },
        { en: 'the calamity', ro: 'kashin tan', cour: 4 },
        { en: 'season 3', ro: '3rd season', s: 3 },
        { en: 'season 2', ro: '2nd season', s: 2 }
    ];

    const metaStr = `${titleEng || ''} ${titleRomaji || ''}`.toLowerCase();
    const candStr = `${candidate.title} ${candidate.titles.join(' ')}`.toLowerCase();

    for (const arc of knownArcs) {
        const metaMatches = metaStr.includes(arc.en) || (arc.ro && metaStr.includes(arc.ro));
        const candMatches = candStr.includes(arc.en) || (arc.ro && candStr.includes(arc.ro));
        if (metaMatches && candMatches) {
            score += 45;
        } else if (metaMatches && !candMatches) {
            score -= 50; // Requested specific arc, but candidate doesn't match
        }
    }

    // 4. Format Matching
    if (format && candidate.type) {
        const isMovieMeta = format.toUpperCase() === 'MOVIE';
        const isMovieCand = candidate.type.includes('MOVIE');
        if (isMovieMeta === isMovieCand) {
            score += 20;
        } else {
            score -= 60; // Incompatible format
        }
    }

    // 5. Episode Count Similarity
    if (episodes && episodes > 0 && candidate.episodeCount > 0) {
        const diff = Math.abs(episodes - candidate.episodeCount);
        if (diff === 0) score += 25;
        else if (diff <= 2) score += 15;
        else if (diff > 25 && episodes < 50) score -= 30;
    }

    return score;
}

export async function extractFromAniZone(anilistId, epNum, requestedLang = 'sub', fallbackMalId = null) {
    let titleEng = null;
    let titleRomaji = null;
    let format = 'TV';
    let seasonYear = null;
    let episodes = null;

    // 1. Fetch metadata from AniList GraphQL
    try {
        const query = `query ($id: Int) { Media (id: $id) { id title { romaji english } format seasonYear startDate { year } episodes nextAiringEpisode { episode airingAt } } }`;
        const res = await axios.post('https://graphql.anilist.co', {
            query,
            variables: { id: parseInt(anilistId, 10) }
        }, { timeout: 6000 });
        const media = res.data?.data?.Media;
        if (media) {
            titleEng = media.title?.english;
            titleRomaji = media.title?.romaji;
            format = media.format || 'TV';
            seasonYear = media.seasonYear || media.startDate?.year || null;
            episodes = media.episodes || null;

            const requestedEpNum = parseInt(epNum, 10);
            if (media.nextAiringEpisode && requestedEpNum >= media.nextAiringEpisode.episode) {
                console.log(`[ANIZONE] Episode ${requestedEpNum} of ${titleEng || titleRomaji} hasn't aired yet.`);
                return { error: 'PREMIERE_AWAITING', airingAt: media.nextAiringEpisode.airingAt, episode: requestedEpNum, notAired: true };
            }
        }
    } catch (e) {
        console.warn(`[ANIZONE] AniList metadata fetch failed for ID ${anilistId}:`, e.message);
    }

    // 2. AniZip Fallback if metadata is missing
    if (!titleEng && !titleRomaji) {
        try {
            const azRes = await axios.get(`https://api.ani.zip/mappings?anilist_id=${anilistId}`, { timeout: 5000 });
            titleEng = azRes.data?.titles?.en || null;
            titleRomaji = azRes.data?.titles?.ro || null;
            episodes = azRes.data?.episodeCount || episodes;
        } catch {}
    }

    const primaryTitle = titleEng || titleRomaji;
    if (!primaryTitle) {
        console.warn(`[ANIZONE] Could not determine title for AniList ID ${anilistId}`);
        return null;
    }

    if (!seasonYear && primaryTitle.match(/\((\d{4})\)/)) {
        seasonYear = parseInt(primaryTitle.match(/\((\d{4})\)/)[1], 10);
    }

    const anilistMeta = { titleEng, titleRomaji, format, seasonYear, episodes };

    // 3. Search AniZone with multiple strategic queries
    const candidateMap = new Map();
    const addCandidates = (list) => {
        for (const c of list) {
            if (!candidateMap.has(c.slug)) candidateMap.set(c.slug, c);
        }
    };

    if (titleEng) addCandidates(await searchAniZone(titleEng));
    if (candidateMap.size === 0 && titleRomaji && titleRomaji !== titleEng) {
        addCandidates(await searchAniZone(titleRomaji));
    }
    if (primaryTitle.includes(':')) {
        addCandidates(await searchAniZone(primaryTitle.replace(/:/g, ' ')));
        const prefix = primaryTitle.split(':')[0].trim();
        if (prefix.toLowerCase() === 're' || prefix.toLowerCase() === 're:zero') {
            addCandidates(await searchAniZone('Re:Zero'));
        } else if (prefix.length >= 3) {
            addCandidates(await searchAniZone(prefix));
        }
    }
    if (candidateMap.size === 0 && primaryTitle.includes('-')) {
        addCandidates(await searchAniZone(primaryTitle.replace(/-/g, ' ')));
    }
    if (candidateMap.size === 0) {
        const words = primaryTitle.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);
        if (words.length >= 2) {
            addCandidates(await searchAniZone(words.slice(0, 2).join(' ')));
        }
    }

    const candidates = Array.from(candidateMap.values());
    if (candidates.length === 0) {
        console.log(`[ANIZONE] No search candidates found on AniZone for "${primaryTitle}"`);
        return null;
    }

    // 4. Score and sort candidates
    for (const c of candidates) {
        c.score = scoreAniZoneCandidate(c, anilistMeta);
    }

    const validCandidates = candidates.filter(c => c.score >= 50);
    validCandidates.sort((a, b) => b.score - a.score);

    if (validCandidates.length === 0) {
        console.log(`[ANIZONE] No candidates met minimum score threshold (>= 50) for "${primaryTitle}"`);
        return null;
    }

    console.log(`[ANIZONE] Top candidate for "${primaryTitle}": "${validCandidates[0].title}" (score: ${validCandidates[0].score}, slug: ${validCandidates[0].slug})`);

    // 5. Try top candidates in order
    for (const best of validCandidates.slice(0, 2)) {
        try {
            const watchUrl = `${BASE}/anime/${best.slug}/${epNum}`;
            console.log(`[ANIZONE] Fetching watch page: ${watchUrl}...`);
            const epRes = await axios.get(watchUrl, {
                headers: {
                    'User-Agent': UA,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Referer': `${BASE}/anime/${best.slug}`
                },
                timeout: 10000
            });

            const player = playerData(epRes.data);
            if (!player || !player.src) {
                console.log(`[ANIZONE] No player source found on slug "${best.slug}" for episode ${epNum}`);
                continue;
            }

            const rawHlsUrl = normalizeUrl(player.src);
            const subtitles = (Array.isArray(player.subtitles) ? player.subtitles : [])
                .filter(s => s && s.file)
                .map(s => ({
                    url: normalizeUrl(s.file),
                    lang: s.title || s.language || 'English',
                    default: Boolean(s.default)
                }));

            console.log(`[ANIZONE] 🎉 Success! Stream extracted from slug "${best.slug}" for Ep ${epNum}`);
            return {
                headers: { 'Referer': `${BASE}/` },
                sources: [{
                    url: rawHlsUrl,
                    isM3U8: true,
                    isIframe: false,
                    quality: 'default'
                }],
                subtitles,
                storyboard: player.storyboard ? normalizeUrl(player.storyboard) : null,
                chapters: player.chapter ? normalizeUrl(player.chapter) : null
            };
        } catch (watchErr) {
            console.warn(`[ANIZONE] Watch fetch error for slug "${best.slug}":`, watchErr.message);
        }
    }

    return null;
}
