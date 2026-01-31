import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileContainer } from '../components/layout/MobileContainer';
import { Button } from '../components/common/Button';
import { ArrowRight, Phone } from 'lucide-react';
import { authService } from '../services/api';
import { useTranslation } from 'react-i18next';

const PhoneLogin = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendOtp = async () => {
        if (phone.length !== 10) {
            setError('Please enter a valid 10-digit number');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await authService.requestOtp(phone);
            if (response.success) {
                navigate('/otp-verification', { state: { phone } });
            } else {
                setError(response.message || 'Failed to send OTP');
            }
        } catch (err: any) {
            console.error('Backend error, using demo mode:', err);
            // Demo fallback - Explicitly requested by user
            alert('Demo Mode: Your OTP is 123456');
            navigate('/otp-verification', { state: { phone } });
        } finally {
            setLoading(false);
        }
    };

    return (
        <MobileContainer className="bg-gray-50 flex flex-col p-6">
            <div className="flex-1 flex flex-col justify-center">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Phone className="w-8 h-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('login.title', 'Login with Phone')}</h1>
                    <p className="text-gray-500">{t('login.subtitle', 'We will send you a verification code')}</p>
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">+91</span>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="w-full pl-14 pr-4 py-4 rounded-2xl border-2 border-gray-100 focus:border-green-500 focus:ring-0 outline-none text-xl font-bold tracking-widest bg-white"
                            placeholder="00000 00000"
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <Button
                        fullWidth
                        size="lg"
                        onClick={handleSendOtp}
                        disabled={phone.length !== 10 || loading}
                        className="text-lg font-bold"
                    >
                        {loading ? 'Sending...' : 'Get OTP'} <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                </div>
            </div>
        </MobileContainer>
    );
};

export default PhoneLogin;
