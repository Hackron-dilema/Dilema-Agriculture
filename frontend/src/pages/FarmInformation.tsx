import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import Map from '../components/common/Map';
import { useGeolocation } from '../hooks/useGeolocation';
import { Settings, X, MapPin, Edit2, Pencil, Sparkles, Droplets, Loader2 } from 'lucide-react';

const FarmInformation = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { latitude, longitude, address, loading, error } = useGeolocation();

    // Default coordinate (Ames, Iowa) if sensing fails
    const defaultLat = 42.0308;
    const defaultLng = -93.6319;
    const displayLat = latitude || defaultLat;
    const displayLng = longitude || defaultLng;

    return (
        <MobileContainer>
            <Header
                title={t('farmInfo.title')}
                rightAction={<Settings className="w-6 h-6 text-gray-800" />}
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
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-full">
                                <h3 className="text-xl font-bold text-gray-900 mb-1">
                                    {loading ? (
                                        <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
                                    ) : address?.road ? (
                                        address.road
                                    ) : (
                                        "Green Valley Farm"
                                    )}
                                </h3>
                                <p className="text-gray-500 text-sm truncate">
                                    {loading ? (
                                        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mt-1" />
                                    ) : address ? (
                                        [address.city, address.state, address.country].filter(Boolean).join(', ')
                                    ) : (
                                        "1284 County Rd, Ames, Iowa"
                                    )}
                                </p>
                                <p className="text-gray-400 text-xs mt-1 font-mono">
                                    {loading ? "..." : `${displayLat.toFixed(4)}° N, ${displayLng.toFixed(4)}° W`}
                                </p>

                                {error && (
                                    <p className="text-amber-500 text-xs mt-2 font-medium">
                                        ⚠️ {t('farmInfo.usingDefault')}
                                    </p>
                                )}
                            </div>
                        </div>
                        <Button fullWidth onClick={() => { }} className="gap-2 font-bold bg-[#22C522] hover:bg-[#1da81d] text-black">
                            <Edit2 className="w-4 h-4" /> {t('farmInfo.editLocation')}
                        </Button>
                    </div>
                </div>

                {/* Farm Details */}
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-3">{t('farmInfo.farmDetails')}</h2>

                    <div className="grid gap-4">
                        {/* Land Size */}
                        <Card className="flex items-center justify-between p-1 pr-1 relative overflow-hidden">
                            <div className="p-4 z-10">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('farmInfo.totalLandSize')}</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-extrabold text-gray-900">450</span>
                                    <span className="text-lg font-medium text-gray-500">{t('farmInfo.acres')}</span>
                                </div>
                                <button className="mt-3 flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200 text-sm font-bold text-gray-900 bg-white hover:bg-gray-50 transition-colors">
                                    {t('common.edit')} <Pencil className="w-3 h-3" />
                                </button>
                            </div>
                            {/* Abstract Circle Graphic */}
                            <div className="w-24 h-24 rounded-full bg-green-900/90 mr-4 relative overflow-hidden">
                                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]"></div>
                                <div className="absolute inset-0 border-2 border-green-700/50 rounded-full"></div>
                            </div>
                        </Card>

                        {/* Current Crop */}
                        <Card className="flex items-center justify-between p-1 pr-1 relative overflow-hidden">
                            <div className="p-4 z-10 flex-1">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('farmInfo.currentCrop')}</p>
                                <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Winter Wheat</h3>
                                <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 px-2.5 py-1 rounded-lg text-xs font-bold">
                                    <Droplets className="w-3 h-3 fill-current" /> {t('farmInfo.lowWaterNeeds')}
                                </div>
                                <div className="mt-4">
                                    <button className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200 text-sm font-bold text-gray-900 bg-white hover:bg-gray-50 transition-colors">
                                        {t('common.edit')} <Pencil className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            <div className="w-24 h-24 rounded-full overflow-hidden mr-4 border-2 border-white shadow-md bg-gray-100">
                                <img
                                    src="https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?q=80&w=2589&auto=format&fit=crop"
                                    alt="Wheat"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement!.style.backgroundColor = '#fbbf24';
                                    }}
                                />
                            </div>
                        </Card>

                        {/* Sowing Date */}
                        <Card className="flex items-center justify-between p-1 pr-1 relative overflow-hidden">
                            <div className="p-4 z-10 flex-1">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('farmInfo.sowingDate')}</p>
                                <h3 className="text-2xl font-extrabold text-gray-900 mb-1">Oct 15, 2023</h3>
                                <p className="text-xs text-gray-500 font-medium mb-3">{t('farmInfo.harvestExpected', { date: 'July 2024' })}</p>
                                <button className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200 text-sm font-bold text-gray-900 bg-white hover:bg-gray-50 transition-colors">
                                    {t('common.edit')} <Pencil className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="w-24 h-24 rounded-full bg-green-50 mr-4 flex flex-col items-center justify-center border border-green-100">
                                <span className="text-xs font-bold text-green-600 uppercase">OCT</span>
                                <span className="text-3xl font-black text-gray-900">15</span>
                            </div>
                        </Card>
                    </div>
                </div>

                <div className="pt-4 pb-8 flex justify-center">
                    <Button className="font-bold bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full py-2 px-6 text-sm" onClick={() => navigate('/crop-timeline')}>
                        {t('farmInfo.nextCropTimeline')}
                    </Button>
                </div>
            </div>
        </MobileContainer>
    );
};

export default FarmInformation;
