import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import {
    Menu,
    Languages,
    User as UserIcon,
    Plus,
    Home,
    Sprout,
    Store,
    MessageSquareText,
    Droplets,
    Bug
} from 'lucide-react';

const MyCrops = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const crops = [
        {
            id: 1,
            name: "Rice (Basmati)",
            image: "https://images.unsplash.com/photo-1536304993881-ff000997fb66?q=80&w=2070&auto=format&fit=crop",
            status: "healthy",
            statusText: t('myCrops.healthy'),
            sownText: t('myCrops.sown', { count: 20 }),
            stage: t('myCrops.growthPhase'),
            nextStep: t('myCrops.addFertilizer'),
            nextStepIcon: <Droplets className="w-4 h-4 fill-current" />,
            action: t('myCrops.doItNow'),
            actionType: 'primary',
            theme: 'green'
        },
        {
            id: 2,
            name: "Wheat",
            image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?q=80&w=2589&auto=format&fit=crop",
            status: "warning",
            statusText: t('myCrops.warning'),
            sownText: t('myCrops.sown', { count: 45 }),
            stage: t('myCrops.maturing'),
            nextStep: t('myCrops.waterNow'),
            nextStepIcon: <Droplets className="w-4 h-4 fill-current" />,
            action: t('myCrops.doItNow'),
            actionType: 'primary',
            theme: 'yellow'
        },
        {
            id: 3,
            name: "Tomato",
            image: "https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=1587&auto=format&fit=crop",
            status: "critical",
            statusText: t('myCrops.critical'),
            sownText: t('myCrops.sown', { count: 10 }),
            stage: t('myCrops.seedling'),
            nextStep: t('myCrops.checkPests'),
            nextStepIcon: <Bug className="w-4 h-4" />,
            action: t('myCrops.consultAi'),
            actionType: 'secondary',
            theme: 'red'
        }
    ];

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
                {crops.map((crop) => (
                    <div key={crop.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        {/* Image & Status */}
                        <div className="relative h-48 rounded-xl overflow-hidden mb-4">
                            <img src={crop.image} alt={crop.name} className="w-full h-full object-cover" />
                            <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 uppercase shadow-sm ${crop.status === 'healthy' ? 'bg-green-100 text-green-700' :
                                crop.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                <span className={`w-2 h-2 rounded-full ${crop.status === 'healthy' ? 'bg-green-500' :
                                    crop.status === 'warning' ? 'bg-yellow-500' :
                                        'bg-red-500'
                                    }`}></span>
                                {crop.statusText}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="mb-4">
                            <h2 className="text-xl font-bold text-gray-900 mb-1">{crop.name}</h2>
                            <p className="text-gray-500 text-sm font-medium">{crop.sownText} • {crop.stage}</p>
                        </div>

                        {/* Action Box */}
                        <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('myCrops.nextStep')}</p>
                                <div className={`flex items-center gap-2 font-bold ${crop.status === 'healthy' ? 'text-green-600' :
                                    crop.status === 'warning' ? 'text-yellow-600' :
                                        'text-red-500'
                                    }`}>
                                    {crop.nextStepIcon}
                                    <span>{crop.nextStep}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => crop.actionType === 'secondary' ? navigate('/chat-assistant') : null}
                                className={`px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-green-500/20 active:scale-95 transition-transform ${crop.actionType === 'primary'
                                    ? 'bg-[#22C522] text-black'
                                    : 'bg-[#22C522] text-black' // Design shows Consult AI also green
                                    }`}>
                                {crop.action}
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add Button */}
                <div className="fixed bottom-24 right-6 z-20">
                    <button className="w-14 h-14 bg-[#22C522] rounded-full flex items-center justify-center shadow-xl shadow-green-500/40 text-black hover:scale-105 transition-transform">
                        <Plus className="w-8 h-8" />
                    </button>
                </div>
            </div>

            {/* Bottom Navigation (Sticky) - Matching Dashboard for consistency but simpler */}
            <div className="bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center fixed bottom-0 w-full max-w-[480px] z-50 text-gray-500">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex flex-col items-center gap-1 hover:text-green-600"
                >
                    <Home className="w-6 h-6" />
                    <span className="text-[10px] font-medium">{t('dashboard.nav.home')}</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-green-600">
                    <Sprout className="w-6 h-6 fill-current" />
                    <span className="text-[10px] font-bold">{t('dashboard.nav.myFarm')}</span>
                </button>
                <button className="flex flex-col items-center gap-1 hover:text-green-600">
                    <Store className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Market</span>
                </button>
                <button className="flex flex-col items-center gap-1 hover:text-green-600">
                    <MessageSquareText className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Expert</span>
                </button>
            </div>

        </MobileContainer>
    );
};

export default MyCrops;
