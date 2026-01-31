import { useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { MobileContainer } from '../components/layout/MobileContainer';
import { Header } from '../components/common/Header';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Check, Info, CloudRain, Flower2, Layers, HelpCircle } from 'lucide-react';
import { cn } from '../utils/cn';

const AdviceDetails = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const factors = [
        {
            id: 1,
            icon: CloudRain,
            title: t('adviceDetails.factors.rain'),
            desc: t('adviceDetails.factors.rainDesc'),
            status: 'good',
        },
        {
            id: 2,
            icon: Flower2,
            title: t('adviceDetails.factors.flowering'),
            desc: t('adviceDetails.factors.floweringDesc'),
            status: 'good',
        },
        {
            id: 3,
            icon: Layers,
            title: t('adviceDetails.factors.soil'),
            desc: t('adviceDetails.factors.soilDesc'),
            status: 'info',
        },
    ];

    return (
        <MobileContainer>
            <Header title={t('adviceDetails.title')} />

            <div className="px-5 pb-8 overflow-y-auto">
                <h1 className="text-3xl font-black text-gray-900 leading-tight mb-6 mt-2">
                    {t('adviceDetails.mainQuestion')}
                </h1>

                {/* Confidence Meter */}
                <div className="mb-8">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('adviceDetails.aiConfidence')}</span>
                        <span className="text-sm font-bold text-[#22C522]">{t('adviceDetails.high')} (85%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#22C522] w-[85%] rounded-full shadow-[0_0_10px_rgba(34,197,34,0.3)]"></div>
                    </div>
                </div>

                {/* Key Factors */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="flex gap-1 h-4 items-end">
                            <div className="w-1 h-3 bg-gray-300 rounded-full"></div>
                            <div className="w-1 h-4 bg-gray-300 rounded-full"></div>
                            <div className="w-1 h-2 bg-gray-300 rounded-full"></div>
                        </div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('adviceDetails.keyFactors')}</span>
                    </div>

                    <div className="space-y-3">
                        {factors.map((factor) => (
                            <Card key={factor.id} className="p-4 flex items-center gap-4 rounded-[2rem] shadow-sm border-gray-50">
                                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center flex-shrink-0">
                                    <factor.icon className={cn("w-6 h-6", factor.status === 'good' ? 'text-[#22C522]' : 'text-[#22C522]')} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 text-[15px]">{factor.title}</h3>
                                    <p className="text-gray-500 text-sm font-medium">{factor.desc}</p>
                                </div>
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                    factor.status === 'good' ? "bg-green-100" : "bg-gray-100"
                                )}>
                                    {factor.status === 'good' ? (
                                        <Check className="w-4 h-4 text-green-600 stroke-[3]" />
                                    ) : (
                                        <Info className="w-4 h-4 text-gray-500" />
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Transparency Note */}
                <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-3xl border border-green-50 mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        <HelpCircle className="w-5 h-5 text-[#22C522] fill-current text-white" />
                        <span className="text-xs font-bold text-gray-900 uppercase tracking-widest">{t('adviceDetails.modelTransparency')}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        <Trans i18nKey="adviceDetails.transparencyText">
                            Please note: AI models are helpful tools, but <span className="font-bold text-gray-800">you know your land best.</span> This advice is heavily dependent on the weather forecast and may change if the rain is delayed.
                        </Trans>
                    </p>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <Button
                        fullWidth
                        size="lg"
                        className="rounded-full py-7 font-bold text-lg shadow-xl shadow-green-500/20"
                        onClick={() => navigate('/chat-assistant')}
                    >
                        <div className="bg-black text-white p-0.5 rounded-full mr-2">
                            <Check className="w-3 h-3" />
                        </div>
                        {t('adviceDetails.applyFertilizer')}
                    </Button>
                    <Button
                        fullWidth
                        variant="ghost"
                        className="text-gray-500 font-bold"
                        onClick={() => navigate(-1)}
                    >
                        {t('common.dismiss')}
                    </Button>
                </div>
            </div>
        </MobileContainer>
    );
};

export default AdviceDetails;
