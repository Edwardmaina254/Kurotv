import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users as UsersIcon, Activity, Server, Cpu } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AdminUsers() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const category = searchParams.get('category') || 'Users';
    
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                // In a real scenario, you might filter by category here.
                // For now we just load the recent watch history or users as a placeholder.
                const { data, error } = await supabase
                    .from('watch_history')
                    .select('*')
                    .order('updated_at', { ascending: false })
                    .limit(50);
                
                if (data) setUsers(data);
            } catch (err) {
                console.error("Failed to load users", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [category]);

    const getIconForCategory = () => {
        if (category.includes('Sockets')) return <Activity className="w-5 h-5 text-accent" />;
        if (category.includes('Gateway')) return <Server className="w-5 h-5 text-accent" />;
        if (category.includes('Cache')) return <Cpu className="w-5 h-5 text-accent" />;
        return <UsersIcon className="w-5 h-5 text-accent" />;
    };

    return (
        <div className="min-h-screen pt-20 md:pt-24 pb-12 px-4 md:px-6 max-w-[1200px] mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4 md:pb-5 mb-6 md:mb-8" data-reveal>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/admin-dashboard')}
                        className="p-2 hover:bg-surface rounded-xl transition-colors text-muted hover:text-white"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            {getIconForCategory()}
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight font-display text-white">{category}</h1>
                        </div>
                        <p className="text-[11px] md:text-xs text-muted mt-0.5">Viewing details for {category.toLowerCase()}</p>
                    </div>
                </div>
            </div>

            <div className="card p-5 md:p-6" data-reveal>
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border text-xs text-muted">
                                    <th className="pb-3 font-semibold uppercase tracking-wider">ID</th>
                                    <th className="pb-3 font-semibold uppercase tracking-wider">Anime ID</th>
                                    <th className="pb-3 font-semibold uppercase tracking-wider">Episode</th>
                                    <th className="pb-3 font-semibold uppercase tracking-wider">Last Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length > 0 ? (
                                    users.map((user, i) => (
                                        <tr key={user.id || i} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                                            <td className="py-4 text-sm font-medium">{user.id || 'N/A'}</td>
                                            <td className="py-4 text-sm text-muted">{user.anime_id || 'N/A'}</td>
                                            <td className="py-4 text-sm">{user.episode_number || 'N/A'}</td>
                                            <td className="py-4 text-xs text-muted">
                                                {user.updated_at ? new Date(user.updated_at).toLocaleString() : 'N/A'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-muted text-sm">
                                            No data found for this category.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
