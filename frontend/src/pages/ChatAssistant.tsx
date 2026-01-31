import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileContainer } from '../components/layout/MobileContainer';
import { ChevronLeft, Languages, Volume2, Mic, Camera, Send, Lightbulb } from 'lucide-react';

interface Message {
    id: number;
    text: string;
    sender: 'ai' | 'user';
    isAudio?: boolean;
}

const ChatAssistant = () => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            text: "Namaste! I can help you identify pests or diseases. Please upload a photo of your crop or ask me a question.",
            sender: 'ai'
        },
        {
            id: 2,
            text: "My tomato leaves are turning yellow. What should I do?",
            sender: 'user'
        },
        {
            id: 3,
            text: "I see. Please take a clear photo of the leaf using the camera button below so I can analyze it for you.",
            sender: 'ai'
        }
    ]);
    const [inputValue, setInputValue] = useState("");

    const handleSend = () => {
        if (!inputValue.trim()) return;
        setMessages([...messages, {
            id: Date.now(),
            text: inputValue,
            sender: 'user'
        }]);
        setInputValue("");
    };

    return (
        <MobileContainer className="bg-gray-50 flex flex-col h-full">
            {/* Header */}
            <header className="bg-white px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
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
                            <div className={`p-4 rounded-2xl max-w-[80%] shadow-sm ${msg.sender === 'user'
                                    ? 'bg-[#22C522] text-black font-medium'
                                    : 'bg-white text-gray-900 border border-gray-100'
                                }`}>
                                <p className="leading-relaxed">{msg.text}</p>
                            </div>
                        </div>

                        {/* Audio Player (Mock) for AI messages */}
                        {msg.sender === 'ai' && (
                            <div className="ml-12 mt-1 bg-white border border-gray-100 rounded-xl p-2 flex items-center justify-between w-[80%] shadow-sm">
                                <div className="flex items-center gap-2 text-green-600">
                                    <Volume2 className="w-5 h-5" />
                                    <span className="text-sm font-medium">Listen to message</span>
                                </div>
                                <button className="bg-[#22C522] text-black text-xs font-bold px-4 py-1.5 rounded-full hover:bg-green-500">
                                    PLAY
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
            <div className="p-4 bg-white border-t border-gray-100 flex items-center gap-3 flex-shrink-0 mb-4 md:mb-0">
                {/* Camera Button */}
                <button className="w-12 h-12 rounded-full bg-[#22C522] flex items-center justify-center text-black shadow-lg shadow-green-500/20 active:scale-95 transition-transform">
                    <Camera className="w-6 h-6 fill-black" />
                </button>

                {/* Text Input */}
                <div className="flex-1 bg-gray-100 rounded-full h-12 flex items-center px-4 relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type or use voice..."
                        className="bg-transparent w-full h-full outline-none text-gray-700 placeholder-gray-500 font-medium"
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button className="text-gray-400 hover:text-gray-600">
                        <Mic className="w-5 h-5" />
                    </button>
                </div>

                {/* Send Button */}
                <button
                    onClick={handleSend}
                    className="w-12 h-12 rounded-full bg-[#1a1c1a] flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                >
                    <Send className="w-5 h-5 ml-0.5" />
                </button>
            </div>

        </MobileContainer>
    );
};

export default ChatAssistant;
