// src/pages/Contact.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Contact() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !subject || !message) {
            setError('Please fill in all required fields.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error: dbError } = await supabase.from('feedback').insert([
                {
                    email,
                    subject,
                    message,
                    created_at: new Date().toISOString()
                }
            ]);

            if (dbError) throw dbError;
            setSubmitted(true);
        } catch (err: any) {
            console.error('Feedback submission failed:', err);
            setError('Failed to submit message. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full min-h-screen bg-[#040404] text-gray-300 font-sans pb-24 pt-24 px-4 sm:px-8 flex flex-col justify-between z-10 relative">
            <div className="max-w-[1500px] mx-auto w-full flex-1 flex flex-col items-center justify-center">

                {/* Back Navigation */}
                <div className="w-full max-w-md mb-6 flex justify-start">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center text-[10px] font-black tracking-widest text-gray-500 hover:text-blue-500 transition-colors cursor-pointer uppercase"
                    >
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Back
                    </button>
                </div>

                {/* 🛑 THEMED CONTACT FORM BLOCK (Pure Black & Neon Blue) */}
                <div className="w-full max-w-md bg-[#0a0a0a] rounded-2xl p-8 border border-[#1a1a1a] shadow-2xl relative z-10">
                    <h2 className="text-xl font-black text-white mb-2 leading-tight">Contact Us</h2>
                    <p className="text-gray-400 text-xs leading-relaxed mb-6 font-medium">
                        Please submit your inquiry using the form below and we will get in touch with you shortly.
                    </p>

                    {submitted ? (
                        <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                            <h3 className="text-white font-bold text-sm mb-1">Message Sent Successfully!</h3>
                            <p className="text-gray-500 text-xs font-medium mb-6 max-w-xs">
                                Thank you for your feedback. Our support team will review your inquiry.
                            </p>
                            <button
                                onClick={() => navigate('/home')}
                                className="w-full bg-[#111] hover:bg-blue-600 text-gray-300 hover:text-white font-bold text-xs py-3 rounded-lg border border-[#222] hover:border-blue-500 transition-all cursor-pointer"
                            >
                                Return to Home
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs font-medium text-center">
                                    {error}
                                </div>
                            )}

                            <div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Your email"
                                    className="w-full bg-[#050505] border border-[#1e1e1e] focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg px-4 py-3 text-xs text-white placeholder-gray-600 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <input
                                    type="text"
                                    required
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Subject"
                                    className="w-full bg-[#050505] border border-[#1e1e1e] focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg px-4 py-3 text-xs text-white placeholder-gray-600 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <textarea
                                    required
                                    rows={5}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Leave us a message"
                                    className="w-full bg-[#050505] border border-[#1e1e1e] focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg p-4 text-xs text-white placeholder-gray-600 outline-none transition-all resize-none custom-scrollbar"
                                />
                            </div>

                            {/* ⚡ Elite Neon Blue Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-black text-xs py-3 rounded-lg transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center cursor-pointer mt-2 tracking-widest uppercase"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                            </button>
                        </form>
                    )}
                </div>

            </div>
        </div>
    );
}