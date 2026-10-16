import crypto from 'node:crypto';
import axios from 'axios';

const CF_WORKER = 'https://kurotv-proxy.felixnjuguna31.workers.dev';

function proxyUrl(targetUrl, referer = 'https://reanime.to/') {
    return `${CF_WORKER}/?url=${encodeURIComponent(targetUrl)}&referer=${encodeURIComponent(referer)}`;
}

function sha256hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function rt(b64) {
  return Buffer.from(b64, "base64");
}

async function fetchAuto(url, headers = {}, isJson = false) {
    const referer = headers.Referer || 'https://reanime.to/';
    const uHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        ...headers
    };
    
    // Attempt 1: Direct fetch
    try {
        const r = await fetch(url, { headers: uHeaders });
        if (r.ok) {
            return isJson ? await r.json() : await r.text();
        }
    } catch(e) {}

    // Attempt 2: Via CF Worker Proxy
    const target = proxyUrl(url, referer);
    const r = await fetch(target, { headers: uHeaders });
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
    return isJson ? await r.json() : await r.text();
}

function le(seed) {
  let e = seed;
  for (let i = 0; i < 3; i++) e = sha256hex(e + i);
  let l = e;
  for (let i = 0; i < 3; i++) l = sha256hex(l + i);
  return {
    keyField:      "kf_"  + e.substring(8,  16),
    ivField:       "ivf_" + e.substring(16, 24),
    containerName: "cd_"  + e.substring(24, 32),
    arrayName:     "ad_"  + e.substring(32, 40),
    objectName:    "od_"  + e.substring(40, 48),
    tokenField:    e.substring(48, 64) + "_" + e.substring(56, 64),
    keyFrag2Field: l.substring(0, 16)  + "_" + l.substring(16, 24),
  };
}

async function runWasm(wasmB64, frag1, kf2, T_bytes, seedInt) {
  const { instance } = await WebAssembly.instantiate(rt(wasmB64));
  const { _s, _r, _c, memory } = instance.exports;
  const h = new Uint8Array(memory.buffer);
  const len = frag1.length;
  const [y, v, T, out] = [1000, 1000 + len, 1000 + 2 * len, 1000 + 3 * len];
  h.set(frag1, y);
  h.set(kf2, v);
  h.set(T_bytes, T);
  _s(seedInt);
  _r(y, v, T, out, len);
  
  let pkB64 = null;
  if (_c) {
      try {
          const g = _c();
          const key32 = new Uint8Array(memory.buffer).slice(g, g + 32);
          pkB64 = Buffer.from(key32).toString('base64');
      } catch (e) {}
  }
  
  return {
      wasmOut: Buffer.from(h.subarray(out, out + len)),
      pk: pkB64
  };
}

function extractSsrObj(html) {
  const m = html.match(/\{type:"data",data:(\{)/);
  if (!m) throw new Error("SSR data block not found");
  let depth = 0;
  const start = html.indexOf("{", m.index + m[0].length - 1);
  for (let i = start; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      if (--depth === 0) return html.slice(start, i + 1);
    }
  }
  throw new Error("SSR brace matching failed");
}

export async function decryptFlix(embedUrl) {
    const html = await fetchAuto(embedUrl, { Referer: "https://reanime.to/" }, false);
    
    const data   = eval("(" + extractSsrObj(html) + ")");
    const seed   = data.obfuscation_seed;
    const fields = le(seed);
    const ocd    = data.obfuscated_crypto_data;
    const obj    = ocd[fields.containerName][fields.arrayName][0][fields.objectName];
    const frag1  = rt(obj[fields.keyField]);
    const iv     = rt(obj[fields.ivField]);
    const kf2    = rt(data[fields.keyFrag2Field]);
    const token  = data[fields.tokenField];

    if (!token) throw new Error("Token field missing from embed data");

    const tokData = await fetchAuto(`https://flixcloud.cc/api/m3u8/${token}`, { Referer: "https://reanime.to/" }, true);
    const vidKey  = sha256hex(token + "vid").substring(0, 10);
    const keyKey  = sha256hex(token + "key").substring(0, 10);
    const v_bytes = rt(tokData[vidKey]);
    const T_bytes = rt(tokData[keyKey]);

    const { wasmOut, pk } = await runWasm(data.w_payload, frag1, kf2, T_bytes, parseInt(seed.substring(0, 8), 16));
    const pbk     = crypto.pbkdf2Sync(wasmOut, seed, 1000, 32, "sha256");
    const rBytes  = Buffer.from(pbk);
    for (let i = 0; i < 32; i++) rBytes[i] ^= seed.charCodeAt(i % seed.length);
    const aesKey  = crypto.createHash("sha256").update(rBytes).digest();

    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
    const url      = Buffer.concat([decipher.update(v_bytes), decipher.final()]).toString("utf8").trim();

    return {
        url,
        pk,
        subtitles:      data.subtitles      ?? [],
        thumbnails_vtt: data.thumbnails_vtt ?? null,
        video_title:    data.video_title    ?? null,
        intro_chapter:  data.intro_chapter  ?? null,
        outro_chapter:  data.outro_chapter  ?? null,
    };
}

export async function extractFromReAnime(anilistId, epNum, lang = 'sub', malId = null, throwError = false) {
    try {
        let rawUrl = `https://reanime.to/api/flix/${anilistId}/${epNum}`;
        if (malId) rawUrl += `?mal=${malId}`;
        
        let res = null;
        try {
            res = await axios.get(rawUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Referer': 'https://reanime.to/'
                },
                timeout: 8000
            });
        } catch (directErr) {
            const target = proxyUrl(rawUrl, 'https://reanime.to/');
            res = await axios.get(target, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://reanime.to/'
                },
                timeout: 8000
            });
        }
        
        if (!res.data?.success || !res.data?.servers?.length) {
            console.warn(`[REANIME] No servers found for ID ${anilistId} Ep ${epNum}. Response was:`, JSON.stringify(res.data));
            if (throwError) throw new Error(`No servers found: ${JSON.stringify(res.data)}`);
            return null;
        }
        
        const targetType = lang === 'dub' ? 'dub' : 'sub';
        const server = res.data.servers.find(s => s.serverName === 'HD-2' && s.dataType === targetType)
                    || res.data.servers.find(s => s.dataType === targetType)
                    || res.data.servers[0];
                    
        if (!server?.dataLink) {
            if (throwError) throw new Error("No dataLink found on server");
            return null;
        }
        return await decryptFlix(server.dataLink);
    } catch (e) {
        console.warn(`[REANIME] Extraction failed for ID ${anilistId} Ep ${epNum}:`, e.message);
        if (throwError) throw e;
        return null;
    }
}
