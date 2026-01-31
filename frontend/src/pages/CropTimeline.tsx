import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import { Header } from '../components/common/Header';
import { Button } from '../components/common/Button';
import { MoreVertical, Check, Sparkles, Sprout, Tractor, Settings2, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { cropService } from '../services/api';

const CropTimeline = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [cropData, setCropData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCropData = async () => {
            try {
                const farmerId = localStorage.getItem('farmerId');
                if (!farmerId) {
                    setLoading(false);
                    return;
                }
                const data = await cropService.getCropStatus(parseInt(farmerId));
                if (data.crops && data.crops.length > 0) {
                    setCropData(data.crops[0]);
                }
            } catch (error) {
                console.error('Failed to fetch crop data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCropData();
    }, []);

    const getStageStatus = (stageName: string, currentStage: string) => {
        const stageOrder = ['germination', 'vegetative', 'flowering', 'maturity', 'harvest'];
        const currentIndex = stageOrder.indexOf(currentStage.toLowerCase());
        const stageIndex = stageOrder.indexOf(stageName.toLowerCase());

        if (stageIndex < currentIndex) return 'completed';
        if (stageIndex === currentIndex) return 'current';
        return 'upcoming';
    };

    const stages = [
        {
            id: 1,
            title: t('cropTimeline.stages.sowing'),
            detail: cropData ? t('cropTimeline.stages.sowingDetail', { date: new Date(cropData.sowing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }) : '',
            status: 'completed',
            Icon: Check,
        },
        {
            id: 2,
            title: t('cropTimeline.stages.vegetative'),
            detail: t('cropTimeline.stages.vegetativeDetail'),
            status: cropData ? getStageStatus('vegetative', cropData.stage) : 'upcoming',
            Icon: Sprout,
        },
        {
            id: 3,
            title: t('cropTimeline.stages.flowering'),
            detail: t('cropTimeline.stages.floweringDetail', { date: 'TBD' }),
            status: cropData ? getStageStatus('flowering', cropData.stage) : 'upcoming',
            Icon: Settings2,
        },
        {
            id: 4,
            title: t('cropTimeline.stages.harvest'),
            detail: t('cropTimeline.stages.harvestDetail', { date: 'TBD' }),
            status: cropData ? getStageStatus('harvest', cropData.stage) : 'upcoming',
            Icon: Tractor,
        },
    ];

    return (
        <MobileContainer>
            <Header
                title={t('cropTimeline.title')}
                rightAction={<Button variant="ghost" size="icon"><MoreVertical className="w-5 h-5" /></Button>}
            />

            <div className="flex-1 overflow-y-auto pb-20">
                <div className="px-4 pt-2 pb-6">
                    {/* Main Crop Card */}
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                        </div>
                    )}

                    {!loading && cropData && (
                        <div className="bg-white rounded-3xl overflow-hidden shadow-lg shadow-gray-200/50 mb-8 border border-gray-100">
                            <div className="h-48 relative bg-gray-200">
                                <img
                                    src="https://images.unsplash.com/photo-1535242208474-9a2793260ca8?q=80&w=2564&auto=format&fit=crop"
                                    alt={cropData.crop_name || cropData.crop_type}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement!.style.backgroundColor = '#166534';
                                    }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                <div className="absolute bottom-4 left-5 text-white">
                                    <h2 className="text-2xl font-bold mb-0.5 capitalize">{cropData.crop_name || cropData.crop_type}</h2>
                                    <p className="text-sm font-medium opacity-90">Day {cropData.days_since_sowing}</p>
                                </div>
                            </div>
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('cropTimeline.totalCycle')}</span>
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('cropTimeline.estHarvest')}</span>
                                </div>
                                <div className="flex justify-between items-baseline mb-4">
                                    <div className="text-2xl font-bold text-gray-900">
                                        {t('cropTimeline.daysOf', { current: cropData.days_since_sowing, total: 120 }).split(' ').map((word, i) => (
                                            i === 0 ? word + ' ' : <span key={i} className="text-lg text-gray-400 font-medium">{word} </span>
                                        ))}
                                    </div>
                                    <div className="text-xl font-bold text-gray-900">TBD</div>
                                </div>

                                <div className="flex justify-between items-center text-sm font-bold text-[#22C522] mb-1.5">
                                    <span>{t('cropTimeline.complete', { percent: Math.round(cropData.overall_progress * 100) })}</span>
                                </div>
                                {/* Progress Bar */}
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#22C522] rounded-full shadow-[0_0_10px_rgba(34,197,34,0.5)]" style={{ width: `${cropData.overall_progress * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Lifecycle Stages */}
                    <h3 className="text-xl font-bold text-gray-900 mb-6">{t('cropTimeline.lifecycleStages')}</h3>

                    <div className="relative pl-4 space-y-0">
                        {/* Timeline Line */}
                        <div className="absolute left-[27px] top-4 bottom-10 w-0.5 bg-gray-200"></div>

                        {stages.map((stage) => {
                            const isCompleted = stage.status === 'completed';
                            const isCurrent = stage.status === 'current';

                            return (
                                <div key={stage.id} className="relative flex gap-6 pb-8 last:pb-0 group">
                                    {/* Icon Wrapper */}
                                    <div className={cn(
                                        "relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-4 border-white transition-all duration-300",
                                        isCompleted && "bg-[#22C522] shadow-md",
                                        isCurrent && "bg-[#22C522] shadow-[0_0_0_4px_rgba(34,197,34,0.15)] scale-110",
                                        stage.status === 'upcoming' && "bg-white border-gray-100 text-gray-300"
                                    )}>
                                        {isCompleted ? (
                                            <Check className="w-6 h-6 text-white" />
                                        ) : (
                                            <stage.Icon className={cn("w-6 h-6", isCurrent ? 'text-black fill-current' : 'text-gray-300')} />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className={cn(
                                        "flex-1 pt-0.5 transition-all duration-300",
                                        isCurrent && "bg-white p-5 rounded-3xl border border-green-100 shadow-sm -mt-2 -ml-2 relative z-0"
                                    )}>
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className={cn("text-lg font-bold", isCurrent ? 'text-gray-900' : 'text-gray-700')}>{stage.title}</h4>
                                            {isCurrent && (
                                                <span className="bg-green-100 text-green-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wide">
                                                    {t('cropTimeline.current')}
                                                </span>
                                            )}
                                        </div>
                                        <p className={cn("text-sm leading-relaxed", isCurrent ? "text-gray-600 font-medium" : "text-gray-400")}>
                                            {stage.detail}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Floating Action Button */}
            <div className="absolute bottom-6 left-6 right-6 z-20">
                <Button
                    fullWidth
                    size="lg"
                    className="rounded-full shadow-lg shadow-green-500/30 text-lg font-bold py-7"
                    onClick={() => navigate('/advice-details')}
                >
                    <Sparkles className="w-5 h-5 mr-2 fill-black" /> {t('cropTimeline.aiRecommendations')}
                </Button>
            </div>
        </MobileContainer>
    );
};

export default CropTimeline;
