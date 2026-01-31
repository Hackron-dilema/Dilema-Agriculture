import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import { Button } from '../components/common/Button';
import { Check, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const languages = [
    { code: 'en', name: 'English', sub: 'Default', flag: '🇺🇸' },
    { code: 'hi', name: 'हिंदी', sub: 'Hindi', flag: '🇮🇳' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ', sub: 'Punjabi', flag: '🌾' },
    { code: 'mr', name: 'मराठी', sub: 'Marathi', flag: '🚩' },
    { code: 'gu', name: 'ગુજરાતી', sub: 'Gujarati', flag: '🦁' },
    { code: 'bn', name: 'বাংলা', sub: 'Bengali', flag: '🐅' },
    { code: 'ta', name: 'தமிழ்', sub: 'Tamil', flag: '🛕' },
    { code: 'te', name: 'తెలుగు', sub: 'Telugu', flag: '🌶️' },
    { code: 'kn', name: 'ಕನ್ನಡ', sub: 'Kannada', flag: '🐘' },
    { code: 'ml', name: 'മലയാളം', sub: 'Malayalam', flag: '🌴' },
];

const LanguageSelection = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [selectedLang, setSelectedLang] = useState(i18n.language || 'en');

    const handleLanguageSelect = (code: string) => {
        setSelectedLang(code);
        i18n.changeLanguage(code);
    };

    return (
        <MobileContainer className="bg-gray-50">
            <div className="relative h-64 w-full overflow-hidden">
                {/* Fixed Image with fallback gradient if fails */}
                <div className="w-full h-full bg-gradient-to-b from-green-500 to-green-700">
                    <img
                        src="https://images.unsplash.com/photo-1625246333195-bf4048ca3327?q=80&w=2694&auto=format&fit=crop"
                        alt="Corn field"
                        className="w-full h-full object-cover mix-blend-overlay opacity-50"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                </div>

                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/90" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-center">
                    <div className="w-16 h-16 bg-[#22C522] rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg shadow-green-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                            <circle cx="7" cy="17" r="2" />
                            <circle cx="17" cy="17" r="2" />
                        </svg>
                    </div>
                </div>
            </div>

            <div className="flex-1 px-6 pb-8 flex flex-col relative z-10 -mt-10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('languageSelection.title')}</h1>
                    <p className="text-gray-500">{t('languageSelection.subtitle')}</p>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto max-h-[40vh] pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                    {languages.map((lang, index) => (
                        <motion.button
                            key={lang.code}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleLanguageSelect(lang.code)}
                            className={`w-full p-4 rounded-full flex items-center justify-between transition-all duration-200 ${selectedLang === lang.code
                                    ? 'bg-[#22C522] shadow-lg shadow-green-500/20 scale-[1.02]'
                                    : 'bg-white hover:bg-gray-100 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-2xl">{lang.flag}</span>
                                <div className="text-left">
                                    <span className={`block font-bold ${selectedLang === lang.code ? 'text-black' : 'text-gray-900'}`}>
                                        {lang.name}
                                    </span>
                                    <span className={`text-sm ${selectedLang === lang.code ? 'text-black/70' : 'text-gray-500'}`}>
                                        {lang.sub}
                                    </span>
                                </div>
                            </div>

                            {selectedLang === lang.code && (
                                <div className="bg-black text-white p-1 rounded-full">
                                    <Check className="w-4 h-4" />
                                </div>
                            )}
                        </motion.button>
                    ))}
                </div>

                <div className="mt-8 pt-4 border-t border-gray-100">
                    <Button
                        fullWidth
                        size="lg"
                        className="text-lg font-bold shadow-xl shadow-green-500/20"
                        onClick={() => navigate('/farm-info')}
                    >
                        {t('common.continue')} <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                </div>
            </div>
        </MobileContainer>
    );
};

export default LanguageSelection;
