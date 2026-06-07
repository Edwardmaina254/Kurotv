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
        if (!email || !subject || !message) { setError('Please fill in all required fields.'); return; }
        setLoading(true); setError(null);
        try {
            const { error: dbError } = await supabase.from('feedback').insert([{ email, subject, message, created_at: new Date().toISOString() }]);
            if (dbError) throw dbError;
            setSubmitted(true);
        } catch (err: any) {
            console.error('Feedback submission failed:', err);
            setError('Failed to submit. Please try again later.');
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen pt-20 md:pt-24 pb-12 md:pb-16 px-4 sm:px-8 flex flex-col items-center justify-center">
            <div className="w-full max-w-md">
                <div className="mb-4 md:mb-6">
                    <button onClick={() => navigate(-1)} className="flex items-center text-[10px] font-semibold tracking-wider text-muted hover:text-fg transition-colors uppercase cursor-pointer">
                        <ArrowLeft className="w-3 h-3 mr-1" /> Back
                    </button>
                </div>
                <div className="card p-5 md:p-8" data-reveal>
                    <h2 className="text-base md:text-lg font-bold text-fg mb-1 font-display">Contact Us</h2>
                    <p className="text-xs md:text-sm text-muted mb-5 md:mb-6">Submit your inquiry and we'll get back to you.</p>

                    {submitted ? (
                        <div className="flex flex-col items-center text-center">
                            <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-positive mb-3" />
                            <h3 className="text-xs md:text-sm font-semibold text-fg mb-1">Message Sent!</h3>
                            <p className="text-xs text-muted mb-4 md:mb-5">Thank you for your feedback.</p>
                            <button onClick={() => navigate('/home')} className="w-full bg-accent hover:bg-accent-dim text-white font-semibold text-[10px] md:text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-sm">Return to Home</button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:gap-4">
                            {error && <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 text-danger text-xs text-center">{error}</div>}
                            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email"
                                className="w-full bg-bg border border-border focus:border-muted rounded-xl px-4 py-2.5 md:py-3 text-xs text-fg placeholder-muted outline-none transition-all" />
                            <input type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
                                className="w-full bg-bg border border-border focus:border-muted rounded-xl px-4 py-2.5 md:py-3 text-xs text-fg placeholder-muted outline-none transition-all" />
                            <textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Leave us a message"
                                className="w-full bg-bg border border-border focus:border-muted rounded-xl p-4 text-xs text-fg placeholder-muted outline-none transition-all resize-none" />
                            <button type="submit" disabled={loading}
                                className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 text-white font-semibold text-[10px] md:text-xs py-2.5 md:py-3 rounded-xl transition-all flex items-center justify-center cursor-pointer mt-1 tracking-wider uppercase shadow-sm hover:shadow-md">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
