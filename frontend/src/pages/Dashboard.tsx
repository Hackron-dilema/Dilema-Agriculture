
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import { BottomNav } from '../components/layout/BottomNav';
import {
    Menu,
    Globe,
    Play,
    Tractor,
    CloudSun,
    IndianRupee,
    Sprout,
    Check
} from 'lucide-react';

const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ', flag: '🌾' },
    { code: 'mr', name: 'मराठी', flag: '🚩' },
    { code: 'gu', name: 'ગુજરાતી', flag: '🦁' },
    { code: 'bn', name: 'বাংলা', flag: '🐅' },
    { code: 'ta', name: 'தமிழ்', flag: '🛕' },
    { code: 'te', name: 'తెలుగు', flag: '🌶️' },
    { code: 'kn', name: 'ಕನ್ನಡ', flag: '🐘' },
    { code: 'ml', name: 'മലയാളം', flag: '🌴' },
];

import { useEffect } from 'react';
import { cropService, profileService } from '../services/api';

const Dashboard = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [cropStatus, setCropStatus] = useState<any>(null);
    const [weather, setWeather] = useState<any>(null);
    const [impact, setImpact] = useState<any>(null);
    const [farmerName, setFarmerName] = useState('Farmer');
    const [farmerLocation, setFarmerLocation] = useState('');

    useEffect(() => {
        // Load farmer name from storage or fetch
        const name = localStorage.getItem('farmerName') || 'Farmer';
        setFarmerName(name);

        const fetchData = async () => {
            try {
                const farmerId = localStorage.getItem('farmerId');
                if (!farmerId) return;

                const id = parseInt(farmerId);

                // Parallel fetch for speed
                const [statusData, weatherData, profileData] = await Promise.all([
                    cropService.getCropStatus(id),
                    cropService.getWeather(id),
                    profileService.getMe().catch(() => null)
                ]);

                if (statusData.crops && statusData.crops.length > 0) {
                    setCropStatus(statusData.crops[0]);
                }

                if (weatherData) {
                    setWeather(weatherData);
                    setImpact(weatherData.farming_impact);
                }

                if (profileData) {
                    if (profileData.name) setFarmerName(profileData.name);
                    if (profileData.location_name) setFarmerLocation(profileData.location_name);
                }
            } catch (error) {
                console.error('Failed to load dashboard data', error);
            }
        };
        fetchData();
    }, []);

    const handleLanguageChange = (code: string) => {
        i18n.changeLanguage(code);
        setShowLangMenu(false);
    };

    const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

    return (
        <MobileContainer className="bg-gray-50 flex flex-col h-full relative">
            {/* Header */}
            <header className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm text-gray-900">
                <button className="p-2 bg-green-100 rounded-lg text-gray-800">
                    <Menu className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold">{t('dashboard.title')}</h1>

                <div className="relative">
                    <button
                        onClick={() => setShowLangMenu(!showLangMenu)}
                        className="flex items-center gap-1 border border-gray-200 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 text-gray-900"
                    >
                        <Globe className="w-4 h-4 text-green-600" />
                        <span>{currentLang.name}</span>
                    </button>

                    {showLangMenu && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white text-gray-900 rounded-xl shadow-xl border border-gray-100 py-2 z-50 max-h-64 overflow-y-auto">
                            {languages.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => handleLanguageChange(lang.code)}
                                    className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-green-50 transition-colors ${i18n.language === lang.code ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-700'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span>{lang.flag}</span>
                                        <span>{lang.name}</span>
                                    </div>
                                    {i18n.language === lang.code && <Check className="w-4 h-4 text-green-600" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto pb-24 text-gray-900">
                {/* Profile Section */}
                <div className="px-4 py-4 flex items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full border-2 border-green-500 p-0.5">
                            <img
                                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1887&auto=format&fit=crop"
                                alt="Farmer Profile"
                                className="w-full h-full rounded-full object-cover"
                            />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{t('dashboard.greeting', { name: farmerName })}</h2>
                        <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                            {farmerLocation || 'Location not set'}
                        </div>
                    </div>
                </div>

                {/* AI Assistant CTA */}
                <div className="px-4 mb-6">
                    <div className="bg-gradient-to-b from-green-100 to-green-50 rounded-3xl p-6 text-center shadow-sm border border-green-100 relative overflow-hidden">

                        <div className="w-16 h-16 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-sm relative z-10">
                            <span className="text-green-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                            </span>
                        </div>

                        <h3 className="text-xl font-bold mb-1 relative z-10 text-gray-900">{t('dashboard.askAi')}</h3>
                        <p className="text-gray-600 text-sm mb-6 relative z-10">{t('dashboard.talkInLang')}</p>

                        <button
                            onClick={() => navigate('/chat-assistant')}
                            className="w-full bg-[#22C522] text-black font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-green-500/20 active:scale-[0.98] transition-transform relative z-10"
                        >
                            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                                <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                            </div>
                            <span className="text-lg">{t('dashboard.tapToTalk')}</span>
                        </button>

                        {/* Background decorative circles */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-green-200/20 rounded-full blur-2xl -ml-10 -mb-10"></div>
                    </div>
                </div>

                {/* Quick Services */}
                <div className="px-4 mb-2">
                    <h3 className="text-lg font-bold mb-4 text-gray-900">{t('dashboard.quickServices')}</h3>
                    <div className="grid grid-cols-2 gap-4">

                        {/* Service 1 */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-start hover:border-green-200 transition-colors cursor-pointer text-gray-900">
                            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-3 text-green-600">
                                <Tractor className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold">{cropStatus ? cropStatus.crop_name : t('dashboard.services.cropHealth')}</h4>
                            <p className="text-xs text-green-600 mt-1">
                                {cropStatus
                                    ? `${cropStatus.stage.replace('_', ' ')} • ${Math.round(cropStatus.overall_progress * 100)}%`
                                    : t('dashboard.services.checkPests')}
                            </p>
                        </div>

                        {/* Weather Card */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-start hover:border-blue-200 transition-colors cursor-pointer text-gray-900">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3 text-blue-600">
                                <CloudSun className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold">
                                {weather?.current?.temperature ? `${Math.round(weather.current.temperature)}°C` : t('dashboard.services.weather')}
                            </h4>
                            <p className="text-xs text-blue-600 mt-1">
                                {weather?.current?.condition
                                    ? weather.current.condition
                                    : t('dashboard.services.weatherAlerts')}
                                {impact?.spray_safe && ' • Spraying Safe'}
                            </p>
                        </div>

                        {/* Service 3 */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-start hover:border-orange-200 transition-colors cursor-pointer text-gray-900">
                            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-3 text-orange-600">
                                <IndianRupee className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold">{t('dashboard.services.mandiRates')}</h4>
                            <p className="text-xs text-orange-600 mt-1">{t('dashboard.services.marketPrices')}</p>
                        </div>

                        {/* Service 4 - REMOVED */}
                    </div>
                </div>

                {/* Expert Tip (Visual placeholder at bottom) */}
                <div className="px-4 mt-6">
                    <div className="bg-[#8B5E3C] rounded-t-2xl p-4 relative overflow-hidden text-white min-h-[100px]">
                        <h4 className="font-bold text-lg mb-1 relative z-10">{t('dashboard.tipTitle')}</h4>
                        <p className="text-sm opacity-90 relative z-10 pr-10">{t('dashboard.tipDesc')}</p>
                        <div className="absolute right-[-20px] bottom-[-40px] opacity-20 text-white">
                            <Sprout size={120} />
                        </div>
                    </div>
                </div>

            </div>

            {/* Bottom Navigation */}
            <BottomNav />
        </MobileContainer>
    );
};

export default Dashboard;
