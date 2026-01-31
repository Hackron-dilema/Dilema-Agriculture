import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import { Settings, CloudRain, Bug, Camera, Plus, Mic } from 'lucide-react';
import { cn } from '../utils/cn';

interface Message {
    id: number;
    text: React.ReactNode;
    sender: 'ai' | 'user';
    time?: string;
    avatar?: string;
}

const ChatAssistant = () => {
    const { t } = useTranslation();
    const [messages] = useState<Message[]>([
        {
            id: 1,
            text: "Good morning, John! The soil moisture levels look good today. How can I help with the corn crop?",
            sender: 'ai',
            time: '8:30 AM',
            avatar: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png'
        },
        {
            id: 2,
            text: "Is it a good time to apply fertilizer given the rain?",
            sender: 'user',
            time: '8:32 AM',
            avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=2574&auto=format&fit=crop'
        },
        {
            id: 3,
            text: <>I would recommend <span className="font-bold text-red-500">waiting</span>. With 40mm of rain expected, applying now would likely lead to runoff, wasting resources and risking local waterways. Wait until the heavy rain passes.</>,
            sender: 'ai',
            time: '8:32 AM',
            avatar: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png'
        },
        {
            id: 4,
            text: "Got it. Can you remind me to check the forecast again on Thursday?",
            sender: 'user',
            time: '',
            avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=2574&auto=format&fit=crop'
        }
    ]);

    return (
        <MobileContainer className="bg-white">
            {/* Heavy Rain Alert Banner */}
            <div className="pt-4 px-4 pb-2">
                {/* Custom Header within Chat */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center overflow-hidden border border-green-200">
                                <img
                                    src="https://cdn-icons-png.flaticon.com/512/427/427838.png"
                                    alt="Bot"
                                    className="w-8 h-8"
                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                />
                            </div>
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#22C522] rounded-full border-2 border-white"></div>
                        </div>
                        <div>
                            <h1 className="font-bold text-gray-900 text-lg">{t('chat.title')}</h1>
                            <p className="text-xs text-gray-500 font-medium">{t('common.online')} • v2.4</p>
                        </div>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                        <Settings className="w-6 h-6" />
                    </button>
                </div>

                {/* Alert Cards Row */}
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {/* Weather Alert */}
                    <div className="min-w-[85%] bg-white rounded-[2rem] border border-green-100 p-4 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 flex-shrink-0">
                            <CloudRain className="w-6 h-6 fill-current" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-[15px]">{t('chat.heavyRain')}</h3>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed">{t('chat.heavyRainDesc')}</p>
                        </div>
                    </div>
                    {/* Pest Alert (Partial) */}
                    <div className="min-w-[20%] bg-red-50 rounded-[2rem] border border-red-100 p-4 shadow-sm flex items-center justify-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500">
                            <Bug className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6 bg-gray-50/50">
                <div className="flex justify-center my-2">
                    <span className="bg-gray-100 text-gray-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">{t('chat.today')}, 8:30 AM</span>
                </div>

                {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex gap-3", msg.sender === 'user' ? 'flex-row-reverse' : 'items-start')}>
                        {msg.sender === 'ai' && (
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-white border border-gray-200 mt-1 flex-shrink-0 shadow-sm">
                                <img
                                    src={msg.avatar}
                                    alt="AI"
                                    className="w-full h-full object-cover p-1"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement!.style.backgroundColor = '#dcfce7';
                                    }}
                                />
                            </div>
                        )}
                        {msg.sender === 'user' && (
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 mt-1 flex-shrink-0 shadow-sm">
                                <img
                                    src={msg.avatar}
                                    alt="User"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement!.style.backgroundColor = '#f3f4f6';
                                    }}
                                />
                            </div>
                        )}

                        <div className={cn(
                            "max-w-[80%] rounded-[2rem] p-4 shadow-sm relative text-[15px] leading-relaxed",
                            msg.sender === 'user'
                                ? 'bg-[#22C522] text-black font-semibold rounded-tr-sm'
                                : 'bg-white text-gray-800 font-medium rounded-tl-sm border border-gray-100'
                        )}>
                            {msg.text}
                            {msg.sender === 'ai' && (
                                <div className="mt-1 text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                                    {t('chat.title')} • {msg.time}
                                </div>
                            )}
                            {msg.sender === 'user' && msg.time && (
                                <div className="mt-1 text-[10px] text-black/40 font-bold uppercase tracking-wide text-right">
                                    {t('chat.read')} • {msg.time}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
                <div className="flex items-center gap-3">
                    <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors">
                        <Camera className="w-5 h-5" />
                    </button>

                    <div className="flex-1 bg-gray-100 rounded-full h-12 flex items-center px-4 relative">
                        <input
                            type="text"
                            placeholder={t('chat.inputPlaceholder')}
                            className="bg-transparent w-full h-full outline-none text-gray-700 placeholder-gray-500 font-medium"
                        />
                        <button className="text-gray-400 hover:text-gray-600">
                            <Plus className="w-5 h-5 rounded-full border-2 border-current p-[1px]" />
                        </button>
                    </div>

                    <button className="w-12 h-12 rounded-full bg-[#22C522] flex items-center justify-center text-black shadow-lg shadow-green-500/30 hover:bg-[#1da81d] transition-colors">
                        <Mic className="w-6 h-6 fill-black" />
                    </button>
                </div>
            </div>
        </MobileContainer>
    );
};

export default ChatAssistant;
