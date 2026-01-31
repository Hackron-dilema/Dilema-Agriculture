import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import { BottomNav } from '../components/layout/BottomNav';
import { ChevronRight, LogOut, RefreshCw, Sun, Droplets, Calendar, Sprout, Globe, VolumeX, Volume2, MapPin, Menu } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { profileService } from '../services/api';
import { useEffect } from 'react';

const Profile = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { address, loading, getLocation, latitude, longitude } = useGeolocation();

    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [landType, setLandType] = useState<'dry' | 'wet'>('dry');
    const [farmer, setFarmer] = useState<any>(null);
    const [crops, setCrops] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const farmerId = parseInt(localStorage.getItem('farmerId') || '1');
                const [profileData, cropsData] = await Promise.all([
                    profileService.getMe(),
                    profileService.getFarmerCrops(farmerId)
                ]);
                setFarmer(profileData);
                setCrops(cropsData);
                if (profileData.irrigation_type) {
                    setLandType(profileData.irrigation_type.toLowerCase() === 'wet' ? 'wet' : 'dry');
                }
            } catch (error) {
                console.error('Failed to load profile', error);
            }
        };
        fetchProfile();
    }, []);

    // Sync location to backend when address updates
    useEffect(() => {
        const syncLocation = async () => {
            if (!address || !latitude || !longitude || !farmer) return;

            setIsSaving(true);
            try {
                const phone = localStorage.getItem('phone') || farmer.phone;
                const locationName = `${address.city}, ${address.state}`;

                const response = await profileService.updateProfile({
                    phone,
                    latitude,
                    longitude,
                    location_name: locationName
                });

                if (response.access_token) {
                    localStorage.setItem('token', response.access_token);
                }

                // Update local farmer state
                setFarmer({ ...farmer, location_name: locationName, latitude, longitude });
            } catch (error) {
                console.error('Failed to sync location:', error);
            } finally {
                setIsSaving(false);
            }
        };
        syncLocation();
    }, [address, latitude, longitude]);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    // Hardcoded languages for big buttons (common + current)
    const commonLanguages = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
        { code: 'pa', name: 'ਪੰਜਾਬੀ', flag: '🌾' }, // Example regional
    ];

    const handleLanguageChange = (code: string) => {
        i18n.changeLanguage(code);
        // Simple mock for voice confirmation
        if (voiceEnabled) {
            // In a real app, this would play a sound
            console.log(`Voice confirmation: Language changed to ${code}`);
        }
    };

    const handleUpdateLocation = () => {
        getLocation();
    };

    return (
        <MobileContainer className="bg-gray-50 flex flex-col h-full relative">
            {/* Header */}
            <header className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <button className="p-2 bg-gray-100 rounded-lg text-gray-800" onClick={() => navigate('/dashboard')}>
                    <Menu className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold text-gray-900">{t('profile.title')}</h1>
                <div className="w-10"></div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
                {/* Farmer Info Card */}
                {farmer && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xl">
                            {farmer.name?.[0] || 'F'}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{farmer.name || t('common.farmer')}</h2>
                            <p className="text-sm text-gray-500">{farmer.phone}</p>
                        </div>
                    </div>
                )}

                {/* Language Section */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="w-5 h-5 text-green-600" />
                        <h2 className="text-lg font-bold text-gray-900">{t('profile.language')}</h2>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {commonLanguages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageChange(lang.code)}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${i18n.language === lang.code
                                    ? 'border-green-500 bg-green-50 text-green-800'
                                    : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-green-200'
                                    }`}
                            >
                                <span className="text-2xl mb-1">{lang.flag}</span>
                                <span className="text-xs font-bold">{lang.name}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => navigate('/')} // Redirect to main language selection
                        className="w-full py-2 bg-gray-50 text-green-700 font-bold rounded-xl text-sm border border-green-100 hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
                    >
                        {t('profile.changeLanguage')} <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Location Section */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">{t('profile.location')}</h2>
                    </div>

                    <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-100">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">{t('profile.state')}</span>
                            <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">{t('profile.district')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-gray-900">
                                {address?.state || "Haryana"}
                            </span>
                            <span className="text-lg font-bold text-gray-900">
                                {address?.city || "Sonipat"}
                            </span>
                        </div>
                        {loading && <p className="text-xs text-blue-500 mt-2 font-medium animate-pulse">Updating location...</p>}
                        {isSaving && <p className="text-xs text-green-500 mt-2 font-medium animate-pulse">Saving to server...</p>}
                    </div>

                    <button
                        onClick={handleUpdateLocation}
                        className="w-full py-3 bg-[#22C522] text-black font-bold rounded-xl shadow-lg shadow-green-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        {t('profile.updateLocation')}
                    </button>
                </div>

                {/* Crop Details */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Sprout className="w-5 h-5 text-green-600" />
                        <h2 className="text-lg font-bold text-gray-900">{t('profile.cropDetails')}</h2>
                    </div>

                    {crops.length > 0 ? (
                        crops.map((crop) => (
                            <div key={crop.id} className="flex items-center gap-4 mb-4 last:mb-0">
                                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden">
                                    <Sprout className="w-10 h-10 text-green-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-gray-900 capitalize">{crop.crop_type}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span>{t('profile.sowingDate')}: <strong>{new Date(crop.sowing_date).toLocaleDateString()}</strong></span>
                                    </div>
                                    <div className="mt-2 text-xs font-bold text-green-600">
                                        {crop.current_stage.replace('_', ' ')}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 text-sm">No active crops found.</p>
                    )}

                    <div className="mt-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500 font-medium">{t('profile.stage')}</span>
                            <span className="text-green-600 font-bold">Growth Phase (45%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full w-[45%]"></div>
                        </div>
                    </div>
                </div>

                {/* Land Type */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">{t('profile.landType')}</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setLandType('dry')}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${landType === 'dry'
                                ? 'border-orange-400 bg-orange-50 text-orange-900'
                                : 'border-gray-100 bg-gray-50 text-gray-500 grayscale hover:grayscale-0'
                                }`}
                        >
                            <Sun className="w-8 h-8 text-orange-500" />
                            <span className="font-bold text-sm">{t('profile.dryLand')}</span>
                        </button>

                        <button
                            onClick={() => setLandType('wet')}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${landType === 'wet'
                                ? 'border-blue-400 bg-blue-50 text-blue-900'
                                : 'border-gray-100 bg-gray-50 text-gray-500 grayscale hover:grayscale-0'
                                }`}
                        >
                            <Droplets className="w-8 h-8 text-blue-500" />
                            <span className="font-bold text-sm">{t('profile.wetLand')}</span>
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${voiceEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                            {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">{t('profile.voiceAlerts')}</h2>
                            <p className="text-xs text-gray-500">{voiceEnabled ? 'On' : 'Off'}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setVoiceEnabled(!voiceEnabled)}
                        className={`w-12 h-7 rounded-full transition-colors relative ${voiceEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-transform ${voiceEnabled ? 'left-6' : 'left-1'}`}></div>
                    </button>
                </div>

                {/* Help Actions */}
                <div className="pb-4">
                    <button
                        onClick={handleLogout}
                        className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-xl flex items-center justify-center gap-2 mb-4 hover:bg-red-100 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        {t('profile.startAgain', 'Logout / Start Again')}
                    </button>
                </div>

            </div>

            <BottomNav />
        </MobileContainer>
    );
};

export default Profile;
