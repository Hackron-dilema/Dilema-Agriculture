import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import Map from '../components/common/Map';
import { useGeolocation } from '../hooks/useGeolocation';
import { Settings, X, MapPin, Sparkles, Droplets, Loader2, Check, RefreshCw, Sun } from 'lucide-react';
import { profileService } from '../services/api';

const FarmInformation = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { latitude, longitude, address, loading, getLocation } = useGeolocation();

    const [farmerName, setFarmerName] = useState('');
    const [landSize, setLandSize] = useState('5');
    const [cropType, setCropType] = useState('rice');
    const [irrigationType, setIrrigationType] = useState<'dry' | 'wet'>('wet');
    const [sowingDate, setSowingDate] = useState(new Date().toISOString().split('T')[0]);
    const [manualState, setManualState] = useState('');
    const [manualDistrict, setManualDistrict] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Default coordinate (Haryana area) if sensing fails
    const defaultLat = 28.9931;
    const defaultLng = 77.0198;
    const displayLat = latitude || defaultLat;
    const displayLng = longitude || defaultLng;

    const handleOnboard = async () => {
        setIsSubmitting(true);
        try {
            const phone = localStorage.getItem('phone') || '';
            const response = await profileService.onboard({
                phone,
                name: farmerName || 'Farmer',
                language: i18n.language,
                latitude: displayLat,
                longitude: displayLng,
                location_name: address
                    ? `${address.city}, ${address.state}`
                    : (manualDistrict && manualState ? `${manualDistrict}, ${manualState}` : 'Haryana, India'),
                land_size_acres: parseFloat(landSize),
                irrigation_type: irrigationType,
                crop_type: cropType,
                sowing_date: sowingDate
            });

            if (response.success) {
                localStorage.setItem('token', response.access_token);
                localStorage.setItem('farmerId', response.farmer_id.toString());
                localStorage.setItem('farmerName', farmerName || 'Farmer');
                navigate('/dashboard');
            }
        } catch (err) {
            console.error('Onboarding failed', err);
            // Fallback for demo
            localStorage.setItem('farmerId', '1');
            navigate('/dashboard');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <MobileContainer>
            <Header
                title={t('farmInfo.title')}
                rightAction={
                    <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
                        <Settings className="w-6 h-6 text-gray-800" />
                    </Button>
                }
            />

            <div className="px-4 pb-6 space-y-6 overflow-y-auto">
                {/* AI Insight Banner */}
                <div className="bg-green-50 border border-green-100 rounded-2xl p-4 relative overflow-hidden">
                    <div className="flex items-start gap-3">
                        <div className="text-[#22C522] mt-0.5">
                            <Sparkles className="w-5 h-5 fill-current" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xs font-bold text-green-800 tracking-wider mb-1">{t('farmInfo.aiInsight')}</h3>
                            <p className="text-sm text-green-900 leading-snug">
                                {t('farmInfo.aiInsightText')}
                            </p>
                        </div>
                        <button className="text-green-800 p-1">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Location Section */}
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-3">{t('farmInfo.location')}</h2>
                    <div className="rounded-3xl overflow-hidden bg-gray-200 relative h-48 mb-4 border border-gray-100 shadow-inner">

                        {/* Dynamic Map */}
                        <div className="absolute inset-0 z-0">
                            <Map latitude={displayLat} longitude={displayLng} />
                        </div>

                        {/* Map UI Elements Overlay */}
                        <div className="absolute top-1/2 left-1/4 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
                            <div className="relative">
                                <div className="w-12 h-12 bg-green-500/30 rounded-full animate-ping absolute inset-0"></div>
                                <div className="w-12 h-12 bg-[#22C522] rounded-full border-4 border-white shadow-lg flex items-center justify-center relative z-10">
                                    <MapPin className="w-6 h-6 text-black fill-current" />
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Status Tag */}
                        <div className="absolute left-1/2 transform -translate-x-1/2 top-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-700 whitespace-nowrap shadow-sm z-10 flex items-center gap-2">
                            {loading ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> {t('farmInfo.detectingLocation')}</>
                            ) : (
                                <>{t('farmInfo.activeGeofence')}</>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('common.name', 'Your Name')}</label>
                                <input
                                    type="text"
                                    value={farmerName}
                                    onChange={(e) => setFarmerName(e.target.value)}
                                    placeholder="e.g. Ravi Kumar"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 outline-none font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('farmInfo.location')}</label>
                                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-gray-900 truncate">
                                            {loading ? t('farmInfo.detectingLocation') : (address ? `${address.city}, ${address.state}` : (manualDistrict || "Select Location"))}
                                        </p>
                                    </div>
                                    <button onClick={() => getLocation()} className="p-2 text-green-600">
                                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Manual Fallback */}
                            {!loading && !address && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('profile.state', 'State')}</label>
                                        <input
                                            type="text"
                                            value={manualState}
                                            onChange={(e) => setManualState(e.target.value)}
                                            placeholder="e.g. Haryana"
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-green-500 outline-none font-bold text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('profile.district', 'District')}</label>
                                        <input
                                            type="text"
                                            value={manualDistrict}
                                            onChange={(e) => setManualDistrict(e.target.value)}
                                            placeholder="e.g. Sonipat"
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-green-500 outline-none font-bold text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Farm Details */}
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-3">{t('farmInfo.farmDetails')}</h2>

                    <div className="grid gap-4">
                        {/* Land Size */}
                        <Card className="p-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('farmInfo.totalLandSize')}</p>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    value={landSize}
                                    onChange={(e) => setLandSize(e.target.value)}
                                    className="flex-1 text-2xl font-extrabold text-gray-900 outline-none border-b-2 border-transparent focus:border-green-500 pb-1"
                                />
                                <span className="text-lg font-medium text-gray-500">{t('farmInfo.acres')}</span>
                            </div>
                        </Card>

                        {/* Irrigation Type */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setIrrigationType('dry')}
                                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${irrigationType === 'dry' ? 'border-orange-400 bg-orange-50' : 'border-gray-100 bg-white'}`}
                            >
                                <Sun className={`w-6 h-6 ${irrigationType === 'dry' ? 'text-orange-500' : 'text-gray-400'}`} />
                                <span className="text-xs font-bold uppercase">{t('profile.dryLand', 'Dry Land')}</span>
                            </button>
                            <button
                                onClick={() => setIrrigationType('wet')}
                                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${irrigationType === 'wet' ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-white'}`}
                            >
                                <Droplets className={`w-6 h-6 ${irrigationType === 'wet' ? 'text-blue-500' : 'text-gray-400'}`} />
                                <span className="text-xs font-bold uppercase">{t('profile.wetLand', 'Wet Land')}</span>
                            </button>
                        </div>

                        {/* Crop and Date Selection */}
                        <div className="space-y-4">
                            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('farmInfo.currentCrop')}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['rice', 'wheat', 'cotton', 'maize', 'sugarcane', 'other'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setCropType(c)}
                                            className={`py-2 px-1 rounded-lg text-xs font-bold capitalize border-2 transition-all ${cropType === c ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 bg-gray-50 text-gray-500'}`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('farmInfo.sowingDate')}</label>
                                <input
                                    type="date"
                                    value={sowingDate}
                                    onChange={(e) => setSowingDate(e.target.value)}
                                    className="w-full text-lg font-bold text-gray-900 outline-none border-b-2 border-transparent focus:border-green-500 pb-1"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 pb-8 flex justify-center">
                    <Button
                        fullWidth
                        size="lg"
                        onClick={handleOnboard}
                        disabled={isSubmitting || !farmerName}
                        className="font-bold text-lg"
                    >
                        {isSubmitting ? t('common.loading', 'Saving...') : t('common.next', 'Finish Onboarding')} <Check className="ml-2 w-5 h-5" />
                    </Button>
                </div>
            </div>
        </MobileContainer>
    );
};

export default FarmInformation;
