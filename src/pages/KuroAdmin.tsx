import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function KuroAdmin() {
    const [animeId, setAnimeId] = useState('');
    const [epNum, setEpNum] = useState('');
    const [url, setUrl] = useState('');

    const handleUpload = async () => {
        if (!animeId || !epNum || !url) return alert("Fill all fields");
        const { error } = await supabase.from('episodes').insert([{ anime_id: animeId, episode_number: parseInt(epNum), stream_url: url }]);
        if (error) alert("Error: " + error.message);
        else alert("Episode added!");
    };

    return (
        <div className="min-h-screen pt-24 px-6 flex flex-col items-center">
            <h1 className="text-2xl font-bold mb-8 tracking-tight font-display" data-reveal>KuroVault Admin</h1>
            <div className="w-full max-w-md space-y-5 card p-8" data-reveal>
                <div className="space-y-1.5">
                    <label className="kicker">AniList ID</label>
                    <input placeholder="e.g. 147105" className="w-full bg-bg border border-border p-3 rounded-xl focus:border-muted outline-none transition-all text-sm text-fg placeholder-muted" onChange={(e) => setAnimeId(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <label className="kicker">Episode Number</label>
                    <input placeholder="1" type="number" className="w-full bg-bg border border-border p-3 rounded-xl focus:border-muted outline-none transition-all text-sm text-fg placeholder-muted" onChange={(e) => setEpNum(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <label className="kicker">Stream URL (.m3u8 or .mp4)</label>
                    <input placeholder="https://..." className="w-full bg-bg border border-border p-3 rounded-xl focus:border-muted outline-none transition-all text-sm text-fg placeholder-muted" onChange={(e) => setUrl(e.target.value)} />
                </div>
                <button onClick={handleUpload} className="w-full bg-accent hover:bg-accent-dim text-white py-3 rounded-xl font-semibold text-xs tracking-wider uppercase transition-all cursor-pointer shadow-sm hover:shadow-md">Add to Vault</button>
            </div>
        </div>
    );
}
