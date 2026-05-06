import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function KuroAdmin() {
    const [animeId, setAnimeId] = useState('');
    const [epNum, setEpNum] = useState('');
    const [url, setUrl] = useState('');

    const handleUpload = async () => {
        // Basic validation to prevent empty clicks
        if (!animeId || !epNum || !url) return alert("Fill all fields, fam!");

        const { error } = await supabase
            .from('episodes')
            .insert([{
                anime_id: animeId,
                episode_number: parseInt(epNum),
                stream_url: url
            }]);

        if (error) alert("Error: " + error.message);
        else alert("Episode added to KuroVault! 🚀");
    };

    return (
        <div className="min-h-screen pt-32 px-12 bg-[#040404] text-white flex flex-col items-center">
            <h1 className="text-4xl font-black mb-8 uppercase italic tracking-tighter">KuroVault Admin</h1>

            <div className="w-full max-w-md space-y-6 bg-white/5 p-10 rounded-3xl border border-white/10 backdrop-blur-xl">
                <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">AniList ID</label>
                    <input
                        placeholder="e.g. 147105"
                        className="w-full bg-black border border-white/10 p-4 rounded-xl focus:border-blue-500 outline-none transition-all"
                        onChange={(e) => setAnimeId(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Episode Number</label>
                    <input
                        placeholder="1"
                        type="number"
                        className="w-full bg-black border border-white/10 p-4 rounded-xl focus:border-blue-500 outline-none transition-all"
                        onChange={(e) => setEpNum(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Stream URL (.m3u8 or .mp4)</label>
                    <input
                        placeholder="https://..."
                        className="w-full bg-black border border-white/10 p-4 rounded-xl focus:border-blue-500 outline-none transition-all"
                        onChange={(e) => setUrl(e.target.value)}
                    />
                </div>

                <button
                    onClick={handleUpload}
                    className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                >
                    Add to Vault
                </button>
            </div>
        </div>
    );
}