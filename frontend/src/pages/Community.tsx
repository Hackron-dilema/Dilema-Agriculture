import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import { BottomNav } from '../components/layout/BottomNav';
import {
    Menu,
    Search,
    ThumbsUp,
    MessageCircle,
    Share2,
    Plus,
    Filter,
    MoreHorizontal
} from 'lucide-react';

interface Post {
    id: number;
    author: string;
    avatar: string; // URL or Initials
    time: string;
    content: string;
    image?: string;
    likes: number;
    comments: number;
    tags: string[];
    role?: 'Expert' | 'Farmer';
}

interface Poll {
    id: number;
    question: string;
    options: { id: string; text: string; votes: number }[];
    totalVotes: number;
    timeLeft: string;
}

const Community = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'discussions' | 'polls'>('discussions');

    // Mock Data (In real app, fetch from API)
    const posts: Post[] = [
        {
            id: 1,
            author: "Ram Singh",
            avatar: "RS",
            time: "2h ago",
            content: "My wheat crop is showing yellowing leaves. I used Urea 3 days ago. Is this normal? #wheat #fertilizer",
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Vehn%C3%A4pelto_6.jpg/1200px-Vehn%C3%A4pelto_6.jpg",
            likes: 12,
            comments: 4,
            tags: ["Wheat", "Disease"],
            role: "Farmer"
        },
        {
            id: 2,
            author: "Dr. Anjali Gupta",
            avatar: "AG",
            time: "5h ago",
            content: "Advisory: Heavy rains expected in Sonipat district. Ensure proper drainage for vegetable crops immediately.",
            likes: 45,
            comments: 2,
            tags: ["Weather", "Advisory"],
            role: "Expert"
        }
    ];

    const polls: Poll[] = [
        {
            id: 1,
            question: "Which fertilizer gave you better yield for Paddy this year?",
            options: [
                { id: 'a', text: 'DAP + Urea', votes: 65 },
                { id: 'b', text: 'Zinc + Urea', votes: 20 },
                { id: 'c', text: 'Organic Compost', votes: 15 }
            ],
            totalVotes: 124,
            timeLeft: "2 days left"
        }
    ];

    return (
        <MobileContainer className="bg-gray-50 flex flex-col h-full relative">
            {/* Header */}
            <header className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <button className="p-2 bg-gray-100 rounded-lg text-gray-800" onClick={() => navigate('/dashboard')}>
                        <Menu className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">{t('community.title')}</h1>
                    <button className="p-2 bg-gray-100 rounded-full text-gray-600">
                        <Search className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('discussions')}
                        className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors ${activeTab === 'discussions'
                                ? 'bg-[#22C522] text-black'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                    >
                        {t('community.discussions')}
                    </button>
                    <button
                        onClick={() => setActiveTab('polls')}
                        className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors ${activeTab === 'polls'
                                ? 'bg-[#22C522] text-black'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                    >
                        {t('community.polls')}
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">

                {/* Filters (Horizontal Scroll) */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1 shadow-sm">
                        <Filter className="w-3 h-3" /> {t('community.filter')}
                    </button>
                    {['All', 'Wheat', 'Rice', 'Market', 'Seeds', 'Machinery'].map((tag) => (
                        <button key={tag} className="px-4 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium whitespace-nowrap shadow-sm">
                            {tag}
                        </button>
                    ))}
                </div>

                {/* FEED CONTENT */}
                {activeTab === 'discussions' ? (
                    <div className="space-y-4">
                        {posts.map(post => (
                            <div key={post.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                {/* Post Header */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm ${post.role === 'Expert' ? 'bg-blue-600' : 'bg-orange-500'}`}>
                                            {post.avatar}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-gray-900 text-sm">{post.author}</h3>
                                                {post.role === 'Expert' && <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Expert</span>}
                                            </div>
                                            <p className="text-xs text-gray-400">{post.time}</p>
                                        </div>
                                    </div>
                                    <button className="text-gray-400"><MoreHorizontal className="w-5 h-5" /></button>
                                </div>

                                {/* Content */}
                                <p className="text-gray-800 text-sm mb-3 leading-relaxed">
                                    {post.content}
                                </p>

                                {post.image && (
                                    <div className="rounded-xl overflow-hidden mb-3 h-48">
                                        <img src={post.image} alt="Post content" className="w-full h-full object-cover" />
                                    </div>
                                )}

                                {/* Tags */}
                                <div className="flex gap-2 mb-4">
                                    {post.tags.map(tag => (
                                        <span key={tag} className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md">#{tag}</span>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                                    <button className="flex items-center gap-1.5 text-gray-500 hover:text-green-600 transition-colors">
                                        <ThumbsUp className="w-5 h-5" />
                                        <span className="text-xs font-bold">{post.likes}</span>
                                    </button>
                                    <button className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors">
                                        <MessageCircle className="w-5 h-5" />
                                        <span className="text-xs font-bold">{post.comments}</span>
                                    </button>
                                    <button className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors">
                                        <Share2 className="w-5 h-5" />
                                        <span className="text-xs font-medium">{t('community.share')}</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* POLLS CONTENT */
                    <div className="space-y-4">
                        {polls.map(poll => (
                            <div key={poll.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                                <h3 className="font-bold text-gray-900 mb-4">{poll.question}</h3>

                                <div className="space-y-3 mb-4">
                                    {poll.options.map(option => {
                                        const percent = Math.round((option.votes / poll.totalVotes) * 100);
                                        return (
                                            <button key={option.id} className="w-full relative h-10 rounded-lg bg-gray-50 overflow-hidden border border-gray-200 group hover:border-green-300 transition-colors">
                                                <div
                                                    className="absolute top-0 left-0 h-full bg-green-100 transition-all duration-500"
                                                    style={{ width: `${percent}%` }}
                                                ></div>
                                                <div className="absolute inset-0 flex items-center justify-between px-3">
                                                    <span className="text-xs font-bold text-gray-800 z-10">{option.text}</span>
                                                    <span className="text-xs font-medium text-gray-500 z-10">{percent}%</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <span>{poll.totalVotes} {t('community.votes')}</span>
                                    <span>{poll.timeLeft}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}


                {/* Floating Action Button */}
                <div className="fixed bottom-24 right-6 z-20">
                    <button className="w-14 h-14 bg-[#22C522] rounded-full flex items-center justify-center shadow-xl shadow-green-500/40 text-black hover:scale-105 transition-transform">
                        <Plus className="w-8 h-8" />
                    </button>
                </div>
            </div>

            <BottomNav />
        </MobileContainer>
    );
};

export default Community;
