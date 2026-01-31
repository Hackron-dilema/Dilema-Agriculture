import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import { BottomNav } from '../components/layout/BottomNav';
import {
    Menu,
    Languages,
    User as UserIcon,
    Plus,
    Droplets,
    Bug,
    Loader2
} from 'lucide-react';
import { cropService } from '../services/api';

interface CropData {
    id: number;
    crop_type: string;
    crop_name: string;
    stage: string;
    stage_progress: number;
    overall_progress: number;
    water_need: string;
    days_since_sowing: number;
    sowing_date: string;
}

const MyCrops = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [crops, setCrops] = useState<CropData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCrops = async () => {
            try {
                const farmerId = localStorage.getItem('farmerId');
                if (!farmerId) {
                    setLoading(false);
                    return;
                }
                const data = await cropService.getCropStatus(parseInt(farmerId));
                setCrops(data.crops || []);
            } catch (error) {
                console.error('Failed to fetch crops:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCrops();
    }, []);

    const getStatusFromProgress = (progress: number) => {
        if (progress >= 0.7) return 'healthy';
        if (progress >= 0.4) return 'warning';
        return 'critical';
    };

    const getStatusText = (status: string) => {
        if (status === 'healthy') return t('myCrops.healthy');
        if (status === 'warning') return t('myCrops.warning');
        return t('myCrops.critical');
    };

    const getNextStep = (stage: string, waterNeed: string) => {
        if (waterNeed === 'high') return t('myCrops.waterNow');
        if (stage === 'germination') return t('myCrops.checkPests');
        return t('myCrops.addFertilizer');
    };

    return (
        <MobileContainer className="bg-gray-50 flex flex-col h-full relative">
            {/* Header */}
            <header className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <button className="p-2 bg-gray-100 rounded-lg text-gray-800" onClick={() => navigate('/dashboard')}>
                    <Menu className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold text-gray-900">{t('myCrops.title')}</h1>
                <div className="flex gap-2">
                    <button className="p-2 bg-green-50 rounded-full text-green-600">
                        <Languages className="w-5 h-5" />
                    </button>
                    <button className="p-2 bg-green-50 rounded-full text-green-600">
                        <UserIcon className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                    </div>
                )}

                {!loading && crops.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-500">{t('myCrops.noCrops', 'No crops found. Add your first crop!')}</p>
                    </div>
                )}

                {!loading && crops.map((crop) => {
                    const status = getStatusFromProgress(crop.overall_progress);
                    const statusText = getStatusText(status);
                    const nextStep = getNextStep(crop.stage, crop.water_need);
                    const cropImage = crop.crop_type === 'rice'
                        ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Paddy_Fields_in_Tamil_Nadu_-_panoramio.jpg/1200px-Paddy_Fields_in_Tamil_Nadu_-_panoramio.jpg'
                        : crop.crop_type === 'wheat'
                            ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Vehn%C3%A4pelto_6.jpg/1200px-Vehn%C3%A4pelto_6.jpg'
                            : 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?q=80&w=800';

                    return (
                        <div key={crop.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                            {/* Image & Status */}
                            <div className="relative h-48 rounded-xl overflow-hidden mb-4">
                                <img src={cropImage} alt={crop.crop_name} className="w-full h-full object-cover" />
                                <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 uppercase shadow-sm ${status === 'healthy' ? 'bg-green-100 text-green-700' :
                                    status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                    <span className={`w-2 h-2 rounded-full ${status === 'healthy' ? 'bg-green-500' :
                                        status === 'warning' ? 'bg-yellow-500' :
                                            'bg-red-500'
                                        }`}></span>
                                    {statusText}
                                </div>
                            </div>

                            {/* Info */}
                            <div className="mb-4">
                                <h2 className="text-xl font-bold text-gray-900 mb-1 capitalize">{crop.crop_name || crop.crop_type}</h2>
                                <p className="text-gray-500 text-sm font-medium">
                                    {t('myCrops.sown', { count: crop.days_since_sowing })} • {crop.stage.replace('_', ' ')}
                                </p>
                            </div>

                            {/* Action Box */}
                            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('myCrops.nextStep')}</p>
                                    <div className={`flex items-center gap-2 font-bold ${status === 'healthy' ? 'text-green-600' :
                                        status === 'warning' ? 'text-yellow-600' :
                                            'text-red-500'
                                        }`}>
                                        {crop.water_need === 'high' ? <Droplets className="w-4 h-4 fill-current" /> : <Bug className="w-4 h-4" />}
                                        <span>{nextStep}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => status === 'critical' ? navigate('/chat-assistant') : null}
                                    className="px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-green-500/20 active:scale-95 transition-transform bg-[#22C522] text-black">
                                    {status === 'critical' ? t('myCrops.consultAi') : t('myCrops.doItNow')}
                                </button>
                            </div>
                        </div>
                    );
                })}

                {/* Add Button */}
                <div className="fixed bottom-24 right-6 z-20">
                    <button className="w-14 h-14 bg-[#22C522] rounded-full flex items-center justify-center shadow-xl shadow-green-500/40 text-black hover:scale-105 transition-transform">
                        <Plus className="w-8 h-8" />
                    </button>
                </div>
            </div>

            {/* Bottom Navigation (Sticky) */}
            <BottomNav />

        </MobileContainer>
    );
};

export default MyCrops;
