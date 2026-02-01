import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MobileContainer } from '../components/layout/MobileContainer';
import { Button } from '../components/common/Button';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/api';

const OTPVerification = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const phone = location.state?.phone || '';
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (!phone) navigate('/phone-login');
        inputsRef.current[0]?.focus();
    }, [phone, navigate]);

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) {
            const pasteData = value.split('').slice(0, 6);
            const newOtp = [...otp];
            pasteData.forEach((char, i) => {
                if (index + i < 6) newOtp[index + i] = char;
            });
            setOtp(newOtp);
            if (index + pasteData.length < 6) {
                inputsRef.current[index + pasteData.length]?.focus();
            } else {
                inputsRef.current[5]?.focus();
            }
            return;
        }

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        const otpString = otp.join('');
        if (otpString.length !== 6) return;

        setLoading(true);
        setError('');

        try {
            const response = await authService.verifyOtp(phone, otpString);
            if (response.access_token) {
                localStorage.setItem('token', response.access_token);
                localStorage.setItem('phone', `+91${phone}`);
                if (response.farmer_id) localStorage.setItem('farmerId', response.farmer_id.toString());

                if (response.is_new_user || !response.farmer_id) {
                    navigate('/farm-info');
                } else {
                    navigate('/dashboard');
                }
            } else {
                setError('Invalid OTP');
            }
        } catch (err: any) {
            console.error(err);
            const expectedOtp = location.state?.fakeOtp || '123456';
            if (otpString === expectedOtp) {
                // Demo mode: store phone and navigate to farm-info for proper onboarding
                localStorage.setItem('token', 'demo-token');
                localStorage.setItem('phone', `+91${phone}`);
                // Don't set fake farmerId - user needs to complete onboarding
                navigate('/farm-info');
            } else {
                setError(`Verification failed. Try ${expectedOtp} for demo.`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <MobileContainer className="bg-gray-50 flex flex-col p-6">
            <header className="mb-8">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full -ml-2">
                    <ArrowLeft className="w-6 h-6" />
                </button>
            </header>

            <div className="flex-1 flex flex-col items-center">
            </div>

            {location.state?.fakeOtp && (
                <div className="fixed top-4 left-4 right-4 animate-in slide-in-from-top-4 duration-500 z-50">
                    <div className="bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl p-4 border border-green-100 flex items-center gap-4">
                        <div className="bg-green-100 p-2 rounded-xl">
                            <div className="w-8 h-8 flex items-center justify-center text-2xl">💬</div>
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Messages • Now</p>
                            <p className="font-medium text-gray-900">
                                Your verification code is <span className="font-bold text-black text-lg">{location.state.fakeOtp}</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="text-center mb-8">

                <div className="flex gap-2 mb-8">
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={el => { inputsRef.current[index] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            className="w-12 h-14 rounded-xl border-2 border-gray-200 text-center text-2xl font-bold focus:border-green-500 focus:ring-0 outline-none bg-white"
                        />
                    ))}
                </div>

                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                <Button
                    fullWidth
                    size="lg"
                    onClick={handleVerify}
                    disabled={otp.join('').length !== 6 || loading}
                    className="text-lg font-bold"
                >
                    {loading ? 'Verifying...' : 'Verify'}
                </Button>

                <p className="mt-4 text-sm text-gray-500">
                    Didn't receive code? <button className="text-green-600 font-bold">Resend</button>
                </p>
            </div>
        </MobileContainer>
    );
};

export default OTPVerification;
