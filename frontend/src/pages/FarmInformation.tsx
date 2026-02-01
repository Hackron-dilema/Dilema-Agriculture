import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import Map from '../components/common/Map';
import { useGeolocation } from '../hooks/useGeolocation';
import { MapPin, Sparkles, Droplets, Loader2, Check, RefreshCw, CloudRain, Waves } from 'lucide-react';
import { profileService } from '../services/api';

// Water source options
const waterSources = [
    { id: 'rainfed', label: 'Rainfed', labelHi: 'वर्षा आधारित', icon: CloudRain, color: 'orange' },
    { id: 'canal', label: 'Canal', labelHi: 'नहर', icon: Waves, color: 'blue' },
    { id: 'tubewell', label: 'Tubewell', labelHi: 'नलकूप', icon: Droplets, color: 'cyan' },
    { id: 'pond', label: 'Pond/Tank', labelHi: 'तालाब', icon: Waves, color: 'teal' },
];

const FarmInformation = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { latitude, longitude, address, loading, getLocation } = useGeolocation();

    const [farmerName, setFarmerName] = useState('');
    const [landSize, setLandSize] = useState('5');
    const [waterSource, setWaterSource] = useState('rainfed');
    const [manualState, setManualState] = useState('');
    const [manualDistrict, setManualDistrict] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // Auto-trigger location on mount
    useEffect(() => {
        getLocation();
    }, []);

    // Default coordinate (Haryana area) if sensing fails
    const defaultLat = 28.9931;
    const defaultLng = 77.0198;
    const displayLat = latitude || defaultLat;
    const displayLng = longitude || defaultLng;

    const handleOnboard = async () => {
        setIsSubmitting(true);
        setSubmitError('');
        try {
            const phone = localStorage.getItem('phone') || '';
            // Use basic onboard - no crop data required
            const response = await profileService.basicOnboard({
                phone,
                name: farmerName || 'Farmer',
                language: i18n.language,
                latitude: displayLat,
                longitude: displayLng,
                location_name: address
                    ? `${address.city}, ${address.state}`
                    : (manualDistrict && manualState ? `${manualDistrict}, ${manualState}` : 'Haryana, India'),
                land_size_acres: parseFloat(landSize),
                irrigation_type: waterSource
            });

            if (response.success) {
                localStorage.setItem('token', response.access_token);
                localStorage.setItem('farmerId', response.farmer_id.toString());
                localStorage.setItem('farmerName', farmerName || 'Farmer');
                navigate('/dashboard');
            } else {
                setSubmitError(response.message || 'Onboarding failed. Please try again.');
            }
        } catch (err: any) {
            console.error('Onboarding failed', err);
            const errorMsg = err.response?.data?.detail || err.message || 'Unable to connect to server. Please try again later.';
            setSubmitError(`Error: ${errorMsg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <MobileContainer>
            <Header title={t('farmInfo.title', 'Tell us about yourself')} />

            <div className="px-4 pb-6 space-y-6 overflow-y-auto">
                {/* Welcome Banner */}
                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-5 text-white relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full"></div>
                    <div className="absolute -right-2 -bottom-8 w-32 h-32 bg-white/10 rounded-full"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-wider opacity-90">{t('farmInfo.aiInsight', 'AI Insight')}</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed opacity-95">
                            {t('farmInfo.welcomeMessage', 'Just a few details and our AI will be ready to help you with personalized farming advice!')}
                        </p>
                    </div>
                </div>

                {/* Name Input */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">{t('common.name', 'Your Name')} *</label>
                    <input
                        type="text"
                        value={farmerName}
                        onChange={(e) => setFarmerName(e.target.value)}
                        placeholder={t('farmInfo.namePlaceholder', 'e.g. Ravi Kumar')}
                        className="w-full px-4 py-4 rounded-2xl border-2 border-gray-100 focus:border-green-500 outline-none text-lg font-bold bg-white"
                    />
                </div>

                {/* Location Section */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">{t('farmInfo.location', 'Your Location')}</label>
                    <div className="rounded-2xl overflow-hidden bg-gray-200 relative h-40 mb-3 border border-gray-100 shadow-inner">
                        {/* Dynamic Map */}
                        <div className="absolute inset-0 z-0">
                            <Map latitude={displayLat} longitude={displayLng} />
                        </div>

                        {/* Map Pin Overlay */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
                            <div className="relative">
                                <div className="w-10 h-10 bg-green-500/30 rounded-full animate-ping absolute inset-0"></div>
                                <div className="w-10 h-10 bg-[#22C522] rounded-full border-4 border-white shadow-lg flex items-center justify-center relative z-10">
                                    <MapPin className="w-5 h-5 text-white" />
                                </div>
                            </div>
                        </div>

                        {/* Status Tag */}
                        <div className="absolute left-1/2 transform -translate-x-1/2 top-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-gray-700 whitespace-nowrap shadow-sm z-10 flex items-center gap-2">
                            {loading ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> {t('farmInfo.detectingLocation', 'Detecting...')}</>
                            ) : (
                                <><Check className="w-3 h-3 text-green-500" /> {t('farmInfo.locationDetected', 'Location Detected')}</>
                            )}
                        </div>
                    </div>

                    {/* Location Display */}
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100">
                        <div className="flex-1">
                            <p className="font-bold text-gray-900">
                                {loading ? t('farmInfo.detectingLocation', 'Detecting...') : (address ? `${address.city}, ${address.state}` : (manualDistrict || t('farmInfo.selectLocation', 'Tap to detect')))}
                            </p>
                            {!loading && address && (
                                <p className="text-xs text-gray-500 mt-0.5">{displayLat.toFixed(4)}, {displayLng.toFixed(4)}</p>
                            )}
                        </div>
                        <button onClick={() => getLocation()} className="p-2 bg-green-50 rounded-full text-green-600">
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Manual Fallback */}
                    {!loading && !address && (
                        <div className="grid grid-cols-2 gap-3 mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div>
                                <input
                                    type="text"
                                    value={manualState}
                                    onChange={(e) => setManualState(e.target.value)}
                                    placeholder={t('profile.state', 'State')}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 outline-none font-bold text-sm"
                                />
                            </div>
                            <div>
                                <input
                                    type="text"
                                    value={manualDistrict}
                                    onChange={(e) => setManualDistrict(e.target.value)}
                                    placeholder={t('profile.district', 'District')}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 outline-none font-bold text-sm"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Land Size */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">{t('farmInfo.totalLandSize', 'Total Land Size')}</label>
                    <Card className="p-4">
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                value={landSize}
                                onChange={(e) => setLandSize(e.target.value)}
                                className="flex-1 text-3xl font-extrabold text-gray-900 outline-none border-b-2 border-transparent focus:border-green-500 pb-1 bg-transparent"
                            />
                            <span className="text-lg font-bold text-gray-400">{t('farmInfo.acres', 'Acres')}</span>
                        </div>
                    </Card>
                </div>

                {/* Water Source - Multiple Choice */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">{t('farmInfo.waterSource', 'Major Water Source')}</label>
                    <div className="grid grid-cols-2 gap-3">
                        {waterSources.map((source) => {
                            const Icon = source.icon;
                            const isSelected = waterSource === source.id;
                            const colorClasses = {
                                orange: { border: 'border-orange-400', bg: 'bg-orange-50', icon: 'text-orange-500' },
                                blue: { border: 'border-blue-400', bg: 'bg-blue-50', icon: 'text-blue-500' },
                                cyan: { border: 'border-cyan-400', bg: 'bg-cyan-50', icon: 'text-cyan-500' },
                                teal: { border: 'border-teal-400', bg: 'bg-teal-50', icon: 'text-teal-500' },
                            }[source.color] || { border: 'border-gray-200', bg: 'bg-gray-50', icon: 'text-gray-500' };

                            return (
                                <button
                                    key={source.id}
                                    onClick={() => setWaterSource(source.id)}
                                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${isSelected
                                        ? `${colorClasses.border} ${colorClasses.bg}`
                                        : 'border-gray-100 bg-white hover:bg-gray-50'
                                        }`}
                                >
                                    <Icon className={`w-7 h-7 ${isSelected ? colorClasses.icon : 'text-gray-400'}`} />
                                    <span className={`text-xs font-bold ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                                        {i18n.language === 'hi' ? source.labelHi : source.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Submit */}
                <div className="pt-4 pb-8 flex flex-col items-center gap-3">
                    {submitError && (
                        <div className="w-full p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                            <p className="text-sm text-red-600 font-medium">{submitError}</p>
                        </div>
                    )}
                    <Button
                        fullWidth
                        size="lg"
                        onClick={handleOnboard}
                        disabled={isSubmitting || !farmerName}
                        className="font-bold text-lg"
                    >
                        {isSubmitting ? t('common.loading', 'Saving...') : t('common.getStarted', 'Get Started')} <Check className="ml-2 w-5 h-5" />
                    </Button>
                </div>
            </div>
        </MobileContainer>
    );
};

export default FarmInformation;
