import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import { ChevronLeft, Languages, Volume2, Mic, Camera, Send, Lightbulb, Square, X } from 'lucide-react';
import { chatService } from '../services/api';


interface Message {
    id: number;
    text: string;
    sender: 'ai' | 'user';
    reasoning?: string;
    alerts?: string[];
    confidence?: number;
    data_sources?: string[];
    isAudio?: boolean;
}

const ChatAssistant = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Load chat history or fetch initial greeting on mount
    useEffect(() => {
        const initializeChat = async () => {
            try {
                const farmerId = localStorage.getItem('farmerId');
                if (!farmerId) {
                    // No farmer ID, show default welcome
                    setMessages([{
                        id: 1,
                        text: t('chat.welcome', "Hello! Please complete your profile to get started."),
                        sender: 'ai'
                    }]);
                    return;
                }

                // Try to load chat history
                const data = await chatService.getHistory(parseInt(farmerId));
                if (data.messages && data.messages.length > 0) {
                    const historyMessages: Message[] = data.messages.map((msg: any, index: number) => ({
                        id: index + 1,
                        text: msg.content,
                        sender: msg.role === 'assistant' ? 'ai' : 'user'
                    }));
                    setMessages(historyMessages);
                } else {
                    // No history - fetch initial greeting from backend
                    // This will return appropriate message based on whether user has crops or not
                    const response = await chatService.sendMessage("hello", parseInt(farmerId));
                    setMessages([{
                        id: 1,
                        text: response.response,
                        sender: 'ai',
                        confidence: response.confidence,
                        reasoning: response.reasoning,
                        data_sources: response.data_sources
                    }]);
                }
            } catch (error) {
                console.error('Failed to initialize chat:', error);
                // Fallback greeting
                setMessages([{
                    id: 1,
                    text: t('chat.welcome', "Hello! I'm your farming assistant. How can I help you today?"),
                    sender: 'ai'
                }]);
            }
        };
        initializeChat();
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // TTS Logic
    const speakMessage = (text: string) => {
        // Stop any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Map i18n language to BCP 47 tags for speech

        const langMap: Record<string, string> = {
            'en': 'en-IN',
            'hi': 'hi-IN',
            'pa': 'pa-IN',
            'mr': 'mr-IN',
            'ta': 'ta-IN',
            'te': 'te-IN',
            'kn': 'kn-IN',
            'ml': 'ml-IN',
            'gu': 'gu-IN',
            'bn': 'bn-IN'
        };

        utterance.lang = langMap[i18n.language] || 'en-IN';
        window.speechSynthesis.speak(utterance);
    };

    // STT Logic
    const startListening = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        // Map app language to BCP 47 tags for speech recognition
        const langMap: Record<string, string> = {
            'en': 'en-IN',
            'hi': 'hi-IN',
            'te': 'te-IN',
            'mr': 'mr-IN',
            'kn': 'kn-IN',
            'ta': 'ta-IN',
            'pa': 'pa-IN',
            'ml': 'ml-IN',
            'gu': 'gu-IN',
            'bn': 'bn-IN'
        };
        recognition.lang = langMap[i18n.language] || 'en-IN';

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInputValue(transcript);
            setIsListening(false);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSend = async () => {
        if ((!inputValue.trim() && !selectedImage) || isLoading) return;

        const userMsg: Message = {
            id: Date.now(),
            text: inputValue,
            sender: 'user'
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue("");
        const imageToSend = selectedImage;
        setSelectedImage(null); // Clear image immediately
        setIsLoading(true);

        try {
            const farmerIdStr = localStorage.getItem('farmerId');

            if (!farmerIdStr) {
                throw new Error("No farmer ID found. Please complete profile.");
            }
            const data = await chatService.sendMessage(userMsg.text, parseInt(farmerIdStr), imageToSend || undefined, i18n.language);

            const aiMsg: Message = {
                id: Date.now() + 1,
                text: data.response,
                sender: 'ai',
                reasoning: data.reasoning,
                alerts: data.alerts,
                confidence: data.confidence,
                data_sources: data.data_sources
            };
            setMessages(prev => [...prev, aiMsg]);

            // Auto-speak AI response
            speakMessage(data.response);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg: Message = {
                id: Date.now() + 1,
                text: "I'm having trouble connecting right now. Please try again later.",
                sender: 'ai'
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <MobileContainer className="bg-gray-50 flex flex-col h-full">
            {/* Header */}
            <header className="bg-white px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0 sticky top-0 z-50">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-gray-100 rounded-full"
                >
                    <ChevronLeft className="w-6 h-6 text-gray-900" />
                </button>
                <h1 className="text-xl font-bold text-gray-900">AgriAI Assistant</h1>
                <button className="p-2 hover:bg-gray-100 rounded-full">
                    <Languages className="w-6 h-6 text-gray-900" />
                </button>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {messages.map((msg, index) => (
                    <div key={msg.id} className="flex flex-col gap-1">
                        {/* Sender Label */}
                        <span className={`text-xs font-semibold ${msg.sender === 'ai' ? 'text-green-600' : 'text-green-600 self-end'}`}>
                            {msg.sender === 'ai' ? 'AgriAI Agent' : 'Farmer Ravi'}
                        </span>

                        <div className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border bg-white">
                                {msg.sender === 'ai' ? (
                                    <img src="https://cdn-icons-png.flaticon.com/512/4712/4712035.png" alt="AI Agent" className="w-full h-full object-cover p-1" />
                                ) : (
                                    <img src="https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?q=80&w=2080&auto=format&fit=crop" alt="Farmer Ravi" className="w-full h-full object-cover" />
                                )}
                            </div>

                            {/* Message Bubble */}
                            <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${msg.sender === 'user'
                                ? 'bg-[#22C522] text-black font-semibold rounded-tr-none'
                                : 'bg-white text-gray-900 border border-gray-100 rounded-tl-none'
                                }`}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                                {msg.sender === 'ai' && msg.confidence !== undefined && (
                                    <div className="mt-2 flex items-center justify-between border-t border-gray-50 pt-2">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                {t('chat.confidence', 'AI Confidence')}: {Math.round(msg.confidence * 100)}%
                                            </span>
                                        </div>
                                        {msg.data_sources && msg.data_sources.length > 0 && (
                                            <span className="text-[10px] font-medium text-gray-400">
                                                via {msg.data_sources[0]}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* AI Extra Context (Alerts & Reasoning) */}
                        {msg.sender === 'ai' && (
                            <div className="ml-12 mt-2 space-y-2 w-[85%]">
                                {msg.alerts && msg.alerts.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-3">
                                        <div className="w-8 h-8 bg-amber-100 rounded-full flex-shrink-0 flex items-center justify-center text-amber-600">
                                            <Lightbulb className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-0.5">{t('chat.alert', 'Farming Alert')}</p>
                                            {msg.alerts.map((alert, idx) => (
                                                <p key={idx} className="text-xs text-amber-700 font-medium">{alert}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {msg.reasoning && (
                                    <details className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden group">
                                        <summary className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 flex items-center justify-between list-none">
                                            <span>{t('chat.why_this_advice', 'Why this advice?')}</span>
                                            <ChevronLeft className="w-3 h-3 -rotate-90 group-open:rotate-90 transition-transform" />
                                        </summary>
                                        <div className="px-3 pb-3 text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-2">
                                            {msg.reasoning}
                                        </div>
                                    </details>
                                )}
                            </div>
                        )}

                        {/* Audio Player for AI messages */}
                        {msg.sender === 'ai' && (
                            <div className="ml-12 mt-1 bg-white border border-gray-100 rounded-xl p-2 flex items-center justify-between w-[80%] shadow-sm">
                                <div className="flex items-center gap-2 text-green-600">
                                    <Volume2 className="w-5 h-5" />
                                    <span className="text-sm font-medium">{t('chat.listen', 'Listen to message')}</span>
                                </div>
                                <button
                                    onClick={() => speakMessage(msg.text)}
                                    className="bg-[#22C522] text-black text-xs font-bold px-4 py-1.5 rounded-full hover:bg-green-500 active:scale-95 transition-transform"
                                >
                                    {t('chat.play', 'PLAY')}
                                </button>
                            </div>
                        )}

                        {/* Audio Player (Mock) for User messages (Example logic, usually triggered by voice input) */}
                        {msg.sender === 'user' && index === 2 && ( // Just showing mock for the last AI response context if needed, but per design user bubbles are green. Adapting if user sends voice.
                            <></>
                        )}
                        {/* Hardcoded example for the "Listen" state from design if needed, but dynamic is better. 
                             Design shows "Sune (Listen)" bar for AI messages. Added above.
                         */}

                    </div>
                ))}

                {/* Helper Tip */}
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-3 mt-4">
                    <Lightbulb className="w-6 h-6 text-black fill-black" />
                    <span className="font-bold text-gray-900">How to take a good photo:</span>
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-3 flex-shrink-0 mb-4 md:mb-0">
                {/* Image Preview */}
                {selectedImage && (
                    <div className="relative w-fit bg-gray-100 rounded-lg p-2 border border-gray-200">
                        <img src={selectedImage} alt="Preview" className="h-20 w-auto rounded-md object-cover" />
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-3 w-full">
                    {/* Camera Button */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-black shadow-lg bg-[#22C522] shadow-green-500/20 active:scale-95 transition-transform`}
                    >
                        <Camera className="w-6 h-6 fill-black" />
                    </button>

                    {/* Text Input */}
                    <div className={`flex-1 ${isListening ? 'bg-green-100' : 'bg-gray-100'} rounded-full h-12 flex items-center px-4 relative transition-colors`}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={isListening ? "Listening..." : "Type or use voice..."}
                            className="bg-transparent w-full h-full outline-none text-gray-700 placeholder-gray-500 font-medium"
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button
                            onClick={isListening ? stopListening : startListening}
                            className={`${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {isListening ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                        </button>
                        {isListening && (
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                                ACTIVE
                            </div>
                        )}
                    </div>

                    {/* Send Button */}
                    <button
                        onClick={handleSend}
                        disabled={isLoading || (!inputValue.trim() && !selectedImage)}
                        className="w-12 h-12 rounded-full bg-[#1a1c1a] flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                    >
                        <Send className="w-5 h-5 ml-0.5" />
                    </button>
                </div>
            </div>
            <div ref={messagesEndRef} />
        </MobileContainer>
    );
};

export default ChatAssistant;
