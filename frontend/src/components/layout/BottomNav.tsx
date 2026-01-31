import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Sprout, Users, User } from 'lucide-react';

export const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center fixed bottom-0 w-full max-w-[480px] z-50 text-gray-500">
            <button
                onClick={() => navigate('/dashboard')}
                className={`flex flex-col items-center gap-1 ${isActive('/dashboard') ? 'text-green-600' : 'hover:text-green-600'}`}
            >
                <Home className={`w-6 h-6 ${isActive('/dashboard') ? 'fill-current' : ''}`} />
                <span className={`text-[10px] ${isActive('/dashboard') ? 'font-bold' : 'font-medium'}`}>
                    {t('dashboard.nav.home')}
                </span>
            </button>
            <button
                onClick={() => navigate('/my-crops')}
                className={`flex flex-col items-center gap-1 ${isActive('/my-crops') ? 'text-green-600' : 'hover:text-green-600'}`}
            >
                <Sprout className={`w-6 h-6 ${isActive('/my-crops') ? 'fill-current' : ''}`} />
                <span className={`text-[10px] ${isActive('/my-crops') ? 'font-bold' : 'font-medium'}`}>
                    {t('dashboard.nav.myFarm')}
                </span>
            </button>
            <button
                className="flex flex-col items-center gap-1 hover:text-green-600"
            >
                <Users className="w-6 h-6" />
                <span className="text-[10px] font-medium">
                    {t('dashboard.nav.community')}
                </span>
            </button>
            <button
                className="flex flex-col items-center gap-1 hover:text-green-600"
            >
                <User className="w-6 h-6" />
                <span className="text-[10px] font-medium">
                    {t('dashboard.nav.profile')}
                </span>
            </button>
        </div>
    );
};
