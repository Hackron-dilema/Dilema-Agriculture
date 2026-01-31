
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LanguageSelection from './pages/LanguageSelection';
import FarmInformation from './pages/FarmInformation';
import CropTimeline from './pages/CropTimeline';
import AdviceDetails from './pages/AdviceDetails';
import ChatAssistant from './pages/ChatAssistant';
import AddressForm from './components/AddressForm';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LanguageSelection />} />
        <Route path="/farm-info" element={<FarmInformation />} />
        <Route path="/crop-timeline" element={<CropTimeline />} />
        <Route path="/advice-details" element={<AdviceDetails />} />
        <Route path="/chat-assistant" element={<ChatAssistant />} />
        <Route path="/profile/address" element={<AddressForm />} />
        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
