/**
 * Krishi Mitra - AI Farm Advisor
 * Chat-first mobile application
 */

// API Configuration
const API_BASE = 'http://localhost:8000/api';

// Application State
const state = {
    language: 'en',
    phone: '',
    token: null,
    farmerId: null,
    isNewUser: true,
    location: { latitude: null, longitude: null, name: null },
    farm: null,
    crops: [],
    primaryCrop: null
};

// DOM Elements
const screens = {
    language: document.getElementById('screen-language'),
    phone: document.getElementById('screen-phone'),
    otp: document.getElementById('screen-otp'),
    location: document.getElementById('screen-location'),
    farmSetup: document.getElementById('screen-farm-setup'),
    chat: document.getElementById('screen-chat')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

// ============== INITIALIZATION ==============

function initializeApp() {
    // Check for saved session
    const savedToken = localStorage.getItem('token');
    const savedFarmerId = localStorage.getItem('farmerId');
    
    if (savedToken && savedFarmerId) {
        state.token = savedToken;
        state.farmerId = parseInt(savedFarmerId);
        state.isNewUser = false;
        
        // Go directly to chat
        navigateTo('screen-chat');
        loadChatData();
    }
    
    // Set default sowing date to today
    const sowingDateInput = document.getElementById('sowing-date');
    if (sowingDateInput) {
        sowingDateInput.valueAsDate = new Date();
    }
}

function setupEventListeners() {
    // Language Selection
    document.querySelectorAll('.language-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.language = btn.dataset.lang;
            document.querySelectorAll('.language-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            navigateTo(btn.dataset.next);
        });
    });
    
    // Back Buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateTo(btn.dataset.back);
        });
    });
    
    // Phone OTP Request
    document.getElementById('btn-send-otp').addEventListener('click', requestOTP);
    document.getElementById('phone-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') requestOTP();
    });
    
    // OTP Verification
    setupOTPInputs();
    document.getElementById('btn-verify-otp').addEventListener('click', verifyOTP);
    
    // Location - go to farm setup form
    document.getElementById('btn-get-location').addEventListener('click', getLocation);
    document.getElementById('btn-continue-location').addEventListener('click', () => {
        navigateTo('screen-farm-setup');
    });
    
    // Farm Setup - irrigation card selection
    setupIrrigationCards();
    document.getElementById('btn-complete-setup').addEventListener('click', completeOnboarding);
    
    // Chat
    document.getElementById('btn-send').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Quick Actions
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const query = btn.dataset.query;
            document.getElementById('message-input').value = query;
            sendMessage();
        });
    });
    
    // Menu
    document.getElementById('btn-menu').addEventListener('click', () => {
        document.getElementById('side-menu').classList.add('open');
        document.getElementById('menu-overlay').classList.add('open');
    });
    
    document.getElementById('close-menu').addEventListener('click', closeMenu);
    document.getElementById('menu-overlay').addEventListener('click', closeMenu);
    
    document.getElementById('btn-logout').addEventListener('click', logout);
}

// ============== NAVIGATION ==============

function navigateTo(screenId) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// ============== AUTHENTICATION ==============

async function requestOTP() {
    const phone = document.getElementById('phone-input').value.trim();
    
    if (phone.length !== 10) {
        showToast('Please enter a valid 10-digit phone number', 'error');
        return;
    }
    
    state.phone = phone;
    showLoading('Sending OTP...');
    
    try {
        const response = await fetch(`${API_BASE}/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: `+91${phone}` })
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            document.getElementById('otp-phone').textContent = `+91 ${phone}`;
            navigateTo('screen-otp');
            showToast('OTP sent successfully!', 'success');
        } else {
            showToast(data.message || 'Failed to send OTP', 'error');
        }
    } catch (error) {
        hideLoading();
        // For demo, allow proceeding anyway
        document.getElementById('otp-phone').textContent = `+91 ${phone}`;
        navigateTo('screen-otp');
        showToast('Demo mode: Use OTP 123456', 'warning');
    }
}

function setupOTPInputs() {
    const inputs = document.querySelectorAll('.otp-input');
    
    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
        
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').slice(0, 6);
            pasteData.split('').forEach((char, i) => {
                if (inputs[i]) inputs[i].value = char;
            });
        });
    });
}

async function verifyOTP() {
    const inputs = document.querySelectorAll('.otp-input');
    const otp = Array.from(inputs).map(i => i.value).join('');
    
    if (otp.length !== 6) {
        showToast('Please enter the complete OTP', 'error');
        return;
    }
    
    showLoading('Verifying...');
    
    try {
        const response = await fetch(`${API_BASE}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                phone: `+91${state.phone}`,
                otp: otp 
            })
        });
        
        const data = await response.json();
        hideLoading();
        
        if (response.ok) {
            state.token = data.access_token;
            state.farmerId = data.farmer_id;
            state.isNewUser = data.is_new_user;
            
            localStorage.setItem('token', state.token);
            
            if (state.isNewUser || !state.farmerId) {
                navigateTo('screen-location');
            } else {
                localStorage.setItem('farmerId', state.farmerId);
                navigateTo('screen-chat');
                loadChatData();
            }
        } else {
            showToast(data.detail || 'Invalid OTP', 'error');
        }
    } catch (error) {
        hideLoading();
        // Demo mode fallback
        if (otp === '123456') {
            state.token = 'demo-token';
            state.isNewUser = true;
            navigateTo('screen-location');
            showToast('Demo mode active', 'success');
        } else {
            showToast('Invalid OTP. Use 123456 for demo.', 'error');
        }
    }
}

// ============== LOCATION ==============

function getLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported', 'error');
        document.getElementById('manual-location').style.display = 'block';
        return;
    }
    
    showLoading('Getting location...');
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            state.location.latitude = position.coords.latitude;
            state.location.longitude = position.coords.longitude;
            
            // Reverse geocode
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`
                );
                const data = await response.json();
                state.location.name = data.display_name || 'Location found';
            } catch {
                state.location.name = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
            }
            
            hideLoading();
            
            document.getElementById('location-display').style.display = 'flex';
            document.getElementById('location-text').textContent = state.location.name;
            document.getElementById('btn-get-location').style.display = 'none';
            document.getElementById('btn-continue-location').style.display = 'block';
            
            showToast('Location found!', 'success');
        },
        (error) => {
            hideLoading();
            showToast('Could not get location. Please enter manually.', 'warning');
            document.getElementById('manual-location').style.display = 'block';
            document.getElementById('btn-continue-location').style.display = 'block';
            
            // Default location for demo
            state.location.latitude = 17.3850;
            state.location.longitude = 78.4867;
            state.location.name = 'Hyderabad, India';
        }
    );
}

// ============== ONBOARDING ==============

// Setup irrigation card selection
function setupIrrigationCards() {
    const cards = document.querySelectorAll('.irrigation-card');
    const hiddenInput = document.getElementById('irrigation-type');
    const submitBtn = document.getElementById('btn-complete-setup');
    
    cards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove selected from all
            cards.forEach(c => c.classList.remove('selected'));
            // Select this one
            card.classList.add('selected');
            // Set hidden input value
            hiddenInput.value = card.dataset.value;
            // Enable submit button
            updateSubmitButton();
        });
    });
    
    // Monitor form fields for submit button state
    document.getElementById('farmer-name').addEventListener('input', updateSubmitButton);
    document.getElementById('land-size').addEventListener('input', updateSubmitButton);
}

function updateSubmitButton() {
    const name = document.getElementById('farmer-name').value.trim();
    const landSize = document.getElementById('land-size').value;
    const irrigationType = document.getElementById('irrigation-type').value;
    const submitBtn = document.getElementById('btn-complete-setup');
    
    if (name && landSize && parseFloat(landSize) > 0 && irrigationType) {
        submitBtn.disabled = false;
    } else {
        submitBtn.disabled = true;
    }
}

async function completeOnboarding() {
    const name = document.getElementById('farmer-name').value.trim();
    const landSize = parseFloat(document.getElementById('land-size').value);
    const landUnit = document.getElementById('land-unit').value;
    const irrigationType = document.getElementById('irrigation-type').value;
    
    // Validation
    if (!name) {
        showToast('Please enter your name', 'error');
        return;
    }
    
    if (!landSize || landSize <= 0) {
        showToast('Please enter land size', 'error');
        return;
    }
    
    if (!irrigationType) {
        showToast('Please select irrigation type', 'error');
        return;
    }
    
    // Convert to acres if needed
    let landSizeAcres = landSize;
    if (landUnit === 'bigha') {
        landSizeAcres = landSize * 0.62; // Approximate conversion
    } else if (landUnit === 'hectares') {
        landSizeAcres = landSize * 2.47;
    }
    
    showLoading('Setting up your profile...');
    
    const onboardingData = {
        phone: `+91${state.phone}`,
        name: name,
        language: state.language,
        latitude: state.location.latitude || 17.3850,
        longitude: state.location.longitude || 78.4867,
        location_name: state.location.name || 'India',
        land_size_acres: landSizeAcres,
        irrigation_type: irrigationType
    };
    
    // Store for chat context
    state.farmerName = name;
    state.landSize = landSizeAcres;
    state.irrigationType = irrigationType;
    
    try {
        const response = await fetch(`${API_BASE}/profile/basic-onboard`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(onboardingData)
        });
        
        const data = await response.json();
        hideLoading();
        
        if (response.ok) {
            state.farmerId = data.farmer_id;
            state.token = data.access_token;
            
            localStorage.setItem('token', state.token);
            localStorage.setItem('farmerId', state.farmerId);
            localStorage.setItem('farmerName', name);
            
            navigateTo('screen-chat');
            hideCropStatusBar(); // Hide until crop is set
            showCropOnboardingMessage();
            showToast(`Welcome ${name}! 🌾`, 'success');
        } else {
            showToast(data.detail || 'Setup failed', 'error');
        }
    } catch (error) {
        hideLoading();
        // Demo mode fallback
        state.farmerId = 1;
        localStorage.setItem('farmerId', 1);
        localStorage.setItem('farmerName', name);
        navigateTo('screen-chat');
        hideCropStatusBar();
        showCropOnboardingMessage();
        showToast(`Welcome ${name}! 🌾`, 'success');
    }
}

// Chat message asking about crops
function showCropOnboardingMessage() {
    const name = state.farmerName || 'Farmer';
    
    const messages = {
        'en': `**Hello ${name}! 👋**

I'm your AI farming assistant. Your profile is set up!

Now tell me about your crops:

🌱 **Are you currently growing a crop?** 
   → Tell me which crop and when you planted it

🌾 **Planning to start a new crop?**
   → Tell me what you're planning to grow

Just type naturally, like:
• *"I planted rice on January 15"*
• *"I want to grow wheat"*
• *"My tomatoes are 2 weeks old"*`,

        'hi': `**नमस्ते ${name}! 👋**

मैं आपका AI किसान सहायक हूं। आपकी प्रोफ़ाइल तैयार है!

अब मुझे अपनी फसल के बारे में बताएं:

🌱 **क्या आप अभी कोई फसल उगा रहे हैं?**
   → कौन सी फसल और कब बोई

🌾 **नई फसल की योजना है?**
   → क्या उगाने की सोच रहे हैं

बस लिखें जैसे:
• *"मैंने 15 जनवरी को धान बोया"*
• *"मैं गेहूं उगाना चाहता हूं"*
• *"मेरे टमाटर 2 हफ्ते पुराने हैं"*`,

        'te': `**హలో ${name}! 👋**

నేను మీ AI వ్యవసాయ సహాయకుడను. మీ ప్రొఫైల్ సెటప్ అయింది!

ఇప్పుడు మీ పంట గురించి చెప్పండి:

🌱 **ప్రస్తుతం ఏదైనా పంట పెంచుతున్నారా?**
   → ఏ పంట, ఎప్పుడు వేసారో చెప్పండి

🌾 **కొత్త పంట ప్లాన్ చేస్తున్నారా?**
   → ఏమి పండించాలనుకుంటున్నారో చెప్పండి

ఇలా టైప్ చేయండి:
• *"నేను జనవరి 15న వరి వేసాను"*
• *"నేను గోధుమ పండించాలి"*`
    };
    
    const message = messages[state.language] || messages['en'];
    addMessage(message, 'bot');
}

// ============== CHAT ==============

async function loadChatData() {
    // Load crop status if available
    try {
        const response = await fetch(`${API_BASE}/crop-status/${state.farmerId}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.crops && data.crops.length > 0) {
                state.primaryCrop = data.crops[0];
                updateCropStatusBar(state.primaryCrop);
            } else {
                // No crop set - show onboarding message in chat
                hideCropStatusBar();
                showAIWelcomeMessage();
            }
        } else {
            hideCropStatusBar();
            showAIWelcomeMessage();
        }
    } catch (error) {
        // Show AI welcome message asking for crop info
        hideCropStatusBar();
        showAIWelcomeMessage();
    }
    
    // Update farm summary in menu
    updateFarmSummary();
}

// Simplified onboarding - only basic info, crop will be asked by AI
async function completeBasicOnboarding() {
    showLoading('Setting up...');
    
    const onboardingData = {
        phone: `+91${state.phone}`,
        name: null,
        language: state.language,
        latitude: state.location.latitude || 17.3850,
        longitude: state.location.longitude || 78.4867,
        location_name: state.location.name || 'India'
    };
    
    try {
        const response = await fetch(`${API_BASE}/profile/basic-onboard`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(onboardingData)
        });
        
        const data = await response.json();
        hideLoading();
        
        if (response.ok) {
            state.farmerId = data.farmer_id;
            state.token = data.access_token;
            
            localStorage.setItem('token', state.token);
            localStorage.setItem('farmerId', state.farmerId);
            
            navigateTo('screen-chat');
            loadChatData();
            showToast('Welcome! 🌾', 'success');
        } else {
            // Fallback - try full onboard without crop
            navigateTo('screen-chat');
            showAIWelcomeMessage();
        }
    } catch (error) {
        hideLoading();
        // Demo mode fallback
        state.farmerId = 1;
        localStorage.setItem('farmerId', 1);
        navigateTo('screen-chat');
        showAIWelcomeMessage();
        showToast('Let\'s get started! 🌾', 'success');
    }
}

function hideCropStatusBar() {
    const statusBar = document.querySelector('.crop-status-bar');
    if (statusBar) {
        statusBar.style.display = 'none';
    }
}

function showCropStatusBar() {
    const statusBar = document.querySelector('.crop-status-bar');
    if (statusBar) {
        statusBar.style.display = 'flex';
    }
}

function showAIWelcomeMessage() {
    // AI welcome message with questions
    const greetings = {
        'en': `**Welcome to Krishi Mitra! 🌾**

I'm your AI farming assistant. To give you personalized advice, please tell me about yourself and your farm.

**Please share:**
1. 👤 **Your name** - What should I call you?
2. 🌱 **Your crop** - What are you growing?
3. 📅 **Sowing date** - When did you plant it?
4. 📏 **Land size** - How many acres/bigha?

You can type like: *"I am Ramesh, growing rice, sowed January 15, 2 acres"*

Or just tell me your name first, and I'll guide you step by step! 😊`,

        'hi': `**कृषि मित्र में आपका स्वागत है! 🌾**

मैं आपका AI किसान सहायक हूं। व्यक्तिगत सलाह देने के लिए मुझे आपके बारे में जानना होगा।

**कृपया बताएं:**
1. 👤 **आपका नाम** - मैं आपको क्या बुलाऊं?
2. 🌱 **आपकी फसल** - क्या उगा रहे हैं?
3. 📅 **बुआई की तारीख** - कब बोया?
4. 📏 **जमीन** - कितने एकड़/बीघा?

आप लिख सकते हैं: *"मैं रमेश हूं, धान उगा रहा हूं, 15 जनवरी को बोया, 2 एकड़"*

या पहले अपना नाम बताएं, मैं आगे पूछूंगा! 😊`,

        'te': `**కృషి మిత్రకు స్వాగతం! 🌾**

నేను మీ AI వ్యవసాయ సహాయకుడను. వ్యక్తిగత సలహా ఇవ్వడానికి మీ గురించి తెలుసుకోవాలి.

**దయచేసి చెప్పండి:**
1. 👤 **మీ పేరు** - నేను మిమ్మల్ని ఏమని పిలవాలి?
2. 🌱 **మీ పంట** - ఏమి పండిస్తున్నారు?
3. 📅 **విత్తన తేదీ** - ఎప్పుడు వేసారు?
4. 📏 **భూమి** - ఎన్ని ఎకరాలు?

మీరు ఇలా టైప్ చేయవచ్చు: *"నేను రమేష్, వరి పండిస్తున్నాను, జనవరి 15న విత్తాను, 2 ఎకరాలు"*

లేదా ముందుగా మీ పేరు చెప్పండి! 😊`
    };
    
    const message = greetings[state.language] || greetings['en'];
    addMessage(message, 'bot');
    
    // Show irrigation type selection after a delay
    setTimeout(() => {
        showIrrigationTypeSelection();
    }, 1000);
}

function showIrrigationTypeSelection() {
    // Create irrigation type visual selection
    const container = document.getElementById('messages-container');
    
    const irrigationTypes = {
        'en': {
            title: '**What type of irrigation do you use?**',
            subtitle: 'Tap to select:',
            types: [
                { id: 'drip', name: 'Drip', emoji: '💧', desc: 'Water drops to roots' },
                { id: 'sprinkler', name: 'Sprinkler', emoji: '🌧️', desc: 'Spray from above' },
                { id: 'flood', name: 'Flood/Canal', emoji: '🌊', desc: 'Field flooding' },
                { id: 'rainfed', name: 'Rainfed', emoji: '☔', desc: 'Only rainfall' },
                { id: 'borewell', name: 'Borewell', emoji: '🕳️', desc: 'Underground water' }
            ]
        },
        'hi': {
            title: '**आप किस प्रकार की सिंचाई करते हैं?**',
            subtitle: 'चुनने के लिए टैप करें:',
            types: [
                { id: 'drip', name: 'ड्रिप', emoji: '💧', desc: 'बूंद-बूंद सिंचाई' },
                { id: 'sprinkler', name: 'स्प्रिंकलर', emoji: '🌧️', desc: 'छिड़काव' },
                { id: 'flood', name: 'नहर/बाढ़', emoji: '🌊', desc: 'खेत में पानी भरना' },
                { id: 'rainfed', name: 'बारिश', emoji: '☔', desc: 'सिर्फ बारिश' },
                { id: 'borewell', name: 'बोरवेल', emoji: '🕳️', desc: 'भूमिगत पानी' }
            ]
        },
        'te': {
            title: '**మీరు ఏ రకమైన నీటిపారుదల వాడుతున్నారు?**',
            subtitle: 'ఎంచుకోండి:',
            types: [
                { id: 'drip', name: 'డ్రిప్', emoji: '💧', desc: 'చుక్క చుక్కగా' },
                { id: 'sprinkler', name: 'స్ప్రింక్లర్', emoji: '🌧️', desc: 'పైనుండి చల్లడం' },
                { id: 'flood', name: 'కాలువ', emoji: '🌊', desc: 'నీరు నింపడం' },
                { id: 'rainfed', name: 'వర్షాధారం', emoji: '☔', desc: 'వర్షం మాత్రమే' },
                { id: 'borewell', name: 'బోరు బావి', emoji: '🕳️', desc: 'భూగర్భ జలం' }
            ]
        }
    };
    
    const langData = irrigationTypes[state.language] || irrigationTypes['en'];
    
    // Create message div
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🌾';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Title
    const titleDiv = document.createElement('div');
    titleDiv.innerHTML = langData.title.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    titleDiv.style.marginBottom = '8px';
    
    const subtitleDiv = document.createElement('div');
    subtitleDiv.textContent = langData.subtitle;
    subtitleDiv.style.marginBottom = '12px';
    subtitleDiv.style.opacity = '0.8';
    subtitleDiv.style.fontSize = '0.9em';
    
    // Irrigation cards grid
    const gridDiv = document.createElement('div');
    gridDiv.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px;';
    
    langData.types.forEach(type => {
        const card = document.createElement('div');
        card.className = 'irrigation-card';
        card.dataset.type = type.id;
        card.style.cssText = `
            background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(139, 195, 74, 0.1));
            border: 2px solid rgba(76, 175, 80, 0.3);
            border-radius: 12px;
            padding: 12px 8px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        
        card.innerHTML = `
            <div style="font-size: 2em; margin-bottom: 4px;">${type.emoji}</div>
            <div style="font-weight: bold; font-size: 0.95em;">${type.name}</div>
            <div style="font-size: 0.75em; opacity: 0.7; margin-top: 2px;">${type.desc}</div>
        `;
        
        card.addEventListener('click', () => selectIrrigationType(type));
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = 'var(--primary)';
            card.style.transform = 'scale(1.02)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.borderColor = 'rgba(76, 175, 80, 0.3)';
            card.style.transform = 'scale(1)';
        });
        
        gridDiv.appendChild(card);
    });
    
    contentDiv.appendChild(titleDiv);
    contentDiv.appendChild(subtitleDiv);
    contentDiv.appendChild(gridDiv);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function selectIrrigationType(type) {
    // Store selected irrigation type
    state.irrigationType = type.id;
    
    // Add user selection as message
    addMessage(`${type.emoji} ${type.name}`, 'user');
    
    // AI confirmation
    const confirmations = {
        'en': `Great! You use **${type.name}** irrigation. ${type.emoji}\n\nNow please tell me about your crop and when you sowed it. For example: *"I'm growing rice, sowed on January 15"*`,
        'hi': `बहुत अच्छा! आप **${type.name}** सिंचाई उपयोग करते हैं। ${type.emoji}\n\nअब कृपया अपनी फसल और बुआई की तारीख बताएं। जैसे: *"मैं धान उगा रहा हूं, 15 जनवरी को बोया"*`,
        'te': `బాగుంది! మీరు **${type.name}** నీటిపారుదల వాడుతున్నారు. ${type.emoji}\n\nఇప్పుడు మీ పంట మరియు విత్తన తేదీ చెప్పండి. ఉదా: *"నేను వరి పండిస్తున్నాను, జనవరి 15న విత్తాను"*`
    };
    
    addMessage(confirmations[state.language] || confirmations['en'], 'bot');
}

function updateCropStatusBar(crop) {
    const nameEl = document.getElementById('crop-name-display');
    const stageEl = document.getElementById('crop-stage-display');
    const progressEl = document.getElementById('crop-progress-bar');
    
    const cropName = crop.crop_name || crop.crop_type || 'Unknown';
    const stage = crop.stage || crop.current_stage || 'Unknown';
    const progress = (crop.overall_progress || 0) * 100;
    
    nameEl.textContent = cropName.charAt(0).toUpperCase() + cropName.slice(1);
    stageEl.textContent = stage.replace('_', ' ');
    progressEl.style.width = `${progress}%`;
    
    // Update icon based on stage
    const iconEl = document.querySelector('.crop-status-bar .crop-icon');
    const stageIcons = {
        'germination': '🌱',
        'seedling': '🌿',
        'vegetative': '🌿',
        'flowering': '🌸',
        'fruiting': '🍎',
        'maturity': '🌾',
        'harvest': '✂️'
    };
    iconEl.textContent = stageIcons[stage] || '🌱';
}

function updateFarmSummary() {
    const summaryEl = document.getElementById('farm-summary');
    if (state.primaryCrop) {
        summaryEl.innerHTML = `
            <p><strong>Crop:</strong> ${state.primaryCrop.crop_type || 'Not set'}</p>
            <p><strong>Stage:</strong> ${(state.primaryCrop.stage || state.primaryCrop.current_stage || 'Unknown').replace('_', ' ')}</p>
            <p><strong>Progress:</strong> ${Math.round((state.primaryCrop.overall_progress || 0) * 100)}%</p>
        `;
    } else {
        summaryEl.innerHTML = '<p>No active crop</p>';
    }
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Clear input
    input.value = '';
    
    // Add user message to chat
    addMessage(message, 'user');
    
    // Show typing indicator
    const typingId = showTypingIndicator();
    
    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                content: message,
                farmer_id: state.farmerId
            })
        });
        
        removeTypingIndicator(typingId);
        
        if (response.ok) {
            const data = await response.json();
            addMessage(data.response, 'bot', data.alerts);
            
            // Show confidence and sources if available
            if (data.data_sources && data.data_sources.length > 0) {
                console.log('Data sources:', data.data_sources);
                console.log('Confidence:', data.confidence);
            }
        } else {
            addMessage('Sorry, I encountered an error. Please try again.', 'bot');
        }
    } catch (error) {
        removeTypingIndicator(typingId);
        
        // Demo mode fallback responses
        const demoResponse = getDemoResponse(message);
        addMessage(demoResponse, 'bot');
    }
}

function getDemoResponse(query) {
    const q = query.toLowerCase();
    
    if (q.includes('water') || q.includes('irrigat')) {
        return `**Irrigation Recommendation**
        
Based on current conditions:
• Temperature: 32°C
• Humidity: 65%
• Rain probability: 20%

✅ **Yes, irrigation is recommended today.**

Your rice is in vegetative stage with high water needs. No significant rain expected in the next 3 days.

💡 Best time to irrigate: Early morning or late evening.`;
    }
    
    if (q.includes('weather')) {
        return `**Weather Forecast**

🌡️ **Today:** 32°C, Partly Cloudy
Humidity: 65% | Wind: 12 km/h

📅 **Next 3 Days:**
• Tomorrow: 30-34°C, Sunny
• Day 2: 29-33°C, Cloudy
• Day 3: 28-32°C, 40% rain chance

✅ Good conditions for field work
❌ Not ideal for spraying (wind expected)`;
    }
    
    if (q.includes('crop') || q.includes('status') || q.includes('how is')) {
        return `**Crop Status Report** 🌾

Your **Rice** is in **Vegetative Stage** (35% complete)

📊 **Progress:**
• Days since sowing: 28
• GDD accumulated: 420
• Stage progress: 65%

💧 **Current Needs:**
• Water: High
• Nutrients: Medium-High (Nitrogen important)

⚠️ **Note:** Monitor for stem borer in this stage.`;
    }
    
    if (q.includes('harvest')) {
        return `**Harvest Timeline** 🌾

Your rice is currently in **vegetative stage**.

📅 **Estimated timeline:**
• Flowering expected: ~30 days
• Maturity expected: ~60 days
• Harvest ready: ~75-90 days

🔔 I'll send you alerts as harvest approaches!`;
    }
    
    return `I understand you're asking about: "${query}"

I can help you with:
• 💧 Irrigation advice
• 🌦️ Weather forecasts
• 🌱 Crop status
• ⚠️ Risk alerts
• 🌾 Harvest timing

Try asking something specific like "Should I water today?" or "How is my crop doing?"`;
}

function addMessage(content, type, alerts = null) {
    const container = document.getElementById('messages-container');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = type === 'bot' ? '🌾' : '👤';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Parse markdown-like formatting
    let formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/• /g, '• ');
    
    contentDiv.innerHTML = formattedContent;
    
    // Add alerts if present
    if (alerts && alerts.length > 0) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'message-alerts';
        alertDiv.style.marginTop = '8px';
        alertDiv.style.padding = '8px';
        alertDiv.style.background = 'rgba(234, 179, 8, 0.2)';
        alertDiv.style.borderRadius = '8px';
        alertDiv.innerHTML = alerts.map(a => `⚠️ ${a}`).join('<br>');
        contentDiv.appendChild(alertDiv);
    }
    
    // Add speaker button for bot messages
    if (type === 'bot') {
        const speakerBtn = document.createElement('span');
        speakerBtn.className = 'message-speaker';
        speakerBtn.textContent = '🔊';
        speakerBtn.title = 'Listen';
        speakerBtn.onclick = () => speakMessage(content);
        contentDiv.appendChild(speakerBtn);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    
    // Auto-speak bot messages if TTS is enabled
    if (type === 'bot' && typeof voiceState !== 'undefined' && voiceState.ttsEnabled) {
        // Delay slightly to let user see the message first
        setTimeout(() => speakMessage(content), 300);
    }
}

function showTypingIndicator() {
    const container = document.getElementById('messages-container');
    const id = 'typing-' + Date.now();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.id = id;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🌾';
    
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(indicator);
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    
    return id;
}

function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

// ============== MENU ==============

function closeMenu() {
    document.getElementById('side-menu').classList.remove('open');
    document.getElementById('menu-overlay').classList.remove('open');
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('farmerId');
    state.token = null;
    state.farmerId = null;
    state.isNewUser = true;
    
    closeMenu();
    navigateTo('screen-language');
    showToast('Logged out successfully', 'success');
}

// ============== UTILITIES ==============

function showLoading(text = 'Loading...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${getToastIcon(type)}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getToastIcon(type) {
    switch (type) {
        case 'success': return '✓';
        case 'error': return '✕';
        case 'warning': return '⚠';
        default: return 'ℹ';
    }
}

// ============== VOICE FEATURES (TTS & STT) ==============

// Voice state
const voiceState = {
    ttsEnabled: true,
    recognition: null,
    synthesis: window.speechSynthesis,
    isListening: false,
    isSpeaking: false
};

// Language code mappings for Web Speech API
const languageVoiceCodes = {
    'en': 'en-IN',  // English (India)
    'hi': 'hi-IN',  // Hindi
    'te': 'te-IN',  // Telugu
    'ta': 'ta-IN',  // Tamil
    'kn': 'kn-IN',  // Kannada
    'mr': 'mr-IN'   // Marathi
};

// Initialize voice features
function initializeVoice() {
    // Setup TTS toggle
    const ttsToggle = document.getElementById('btn-tts-toggle');
    if (ttsToggle) {
        ttsToggle.addEventListener('click', toggleTTS);
        // Load saved preference
        const savedTTS = localStorage.getItem('ttsEnabled');
        voiceState.ttsEnabled = savedTTS !== 'false';
        updateTTSButton();
    }
    
    // Setup voice input button
    const voiceBtn = document.getElementById('btn-voice');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', toggleVoiceInput);
    }
    
    // Check for Speech Recognition support
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        voiceState.recognition = new SpeechRecognition();
        voiceState.recognition.continuous = false;
        voiceState.recognition.interimResults = true;
        voiceState.recognition.maxAlternatives = 1;
        
        // Set language immediately based on current state
        voiceState.recognition.lang = languageVoiceCodes[state.language] || 'en-IN';
        
        voiceState.recognition.onstart = () => {
            voiceState.isListening = true;
            const voiceBtn = document.getElementById('btn-voice');
            if (voiceBtn) voiceBtn.classList.add('listening');
            
            // Show language-specific listening message
            const listeningMsgs = {
                'en': 'Listening... 🎤',
                'hi': 'सुन रहा हूं... 🎤',
                'te': 'వింటున్నాను... 🎤'
            };
            showVoiceStatus(listeningMsgs[state.language] || listeningMsgs['en']);
        };
        
        voiceState.recognition.onend = () => {
            voiceState.isListening = false;
            const voiceBtn = document.getElementById('btn-voice');
            if (voiceBtn) voiceBtn.classList.remove('listening');
            hideVoiceStatus();
        };
        
        voiceState.recognition.onresult = (event) => {
            let transcript = '';
            let isFinal = false;
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    isFinal = true;
                }
            }
            
            // Show interim results in input
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.value = transcript;
            }
            
            // Update status to show what's being heard
            if (!isFinal) {
                showVoiceStatus(`"${transcript.substring(0, 30)}${transcript.length > 30 ? '...' : ''}" 🎤`);
            }
            
            // If final, send message
            if (isFinal && transcript.trim()) {
                hideVoiceStatus();
                setTimeout(() => {
                    sendMessage();
                }, 300);
            }
        };
        
        voiceState.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            voiceState.isListening = false;
            const voiceBtn = document.getElementById('btn-voice');
            if (voiceBtn) voiceBtn.classList.remove('listening');
            hideVoiceStatus();
            
            // Language-specific error messages
            const errorMsgs = {
                'not-allowed': {
                    'en': 'Microphone blocked. Allow access in browser settings.',
                    'hi': 'माइक्रोफोन ब्लॉक है। ब्राउज़र सेटिंग्स में अनुमति दें।',
                    'te': 'మైక్రోఫోన్ బ్లాక్ చేయబడింది. బ్రౌజర్ సెట్టింగ్స్‌లో అనుమతించండి.'
                },
                'no-speech': {
                    'en': 'No speech detected. Tap and speak clearly.',
                    'hi': 'कोई आवाज नहीं सुनाई दी। बोलें और स्पष्ट बोलें।',
                    'te': 'మాట వినబడలేదు. మళ్ళీ ప్రయత్నించండి.'
                },
                'network': {
                    'en': 'Network error. Check your internet connection.',
                    'hi': 'नेटवर्क त्रुटि। इंटरनेट कनेक्शन जांचें।',
                    'te': 'నెట్‌వర్క్ లోపం. ఇంటర్నెట్ కనెక్షన్ చెక్ చేయండి.'
                }
            };
            
            const errMsgs = errorMsgs[event.error] || errorMsgs['no-speech'];
            const msg = errMsgs[state.language] || errMsgs['en'];
            showToast(msg, event.error === 'not-allowed' ? 'error' : 'warning');
        };
        
        voiceState.recognition.onnomatch = () => {
            showToast('Could not understand. Please try again.', 'warning');
        };
        
    } else {
        // Hide voice button if not supported
        const voiceBtn = document.getElementById('btn-voice');
        if (voiceBtn) {
            voiceBtn.style.display = 'none';
        }
        console.warn('Speech recognition not supported in this browser');
    }
}

// Toggle voice input
function toggleVoiceInput() {
    if (!voiceState.recognition) {
        showToast('Voice input not supported in this browser', 'error');
        return;
    }
    
    if (voiceState.isListening) {
        voiceState.recognition.stop();
    } else {
        // Set language for recognition
        const langCode = languageVoiceCodes[state.language] || 'en-IN';
        voiceState.recognition.lang = langCode;
        
        try {
            voiceState.recognition.start();
        } catch (e) {
            console.error('Speech recognition start error:', e);
        }
    }
}

// Show voice status
function showVoiceStatus(text) {
    const statusDiv = document.getElementById('voice-status');
    const statusText = document.getElementById('voice-status-text');
    if (statusDiv && statusText) {
        statusText.textContent = text;
        statusDiv.style.display = 'block';
    }
}

// Hide voice status
function hideVoiceStatus() {
    const statusDiv = document.getElementById('voice-status');
    if (statusDiv) {
        statusDiv.style.display = 'none';
    }
}

// Text-to-Speech: Speak a message
function speakMessage(text, language = null) {
    if (!voiceState.ttsEnabled || !voiceState.synthesis) return;
    
    // Cancel any ongoing speech
    voiceState.synthesis.cancel();
    
    // Clean text for speech (remove markdown, emojis)
    const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
        .replace(/\*(.*?)\*/g, '$1')       // Remove italic markdown
        .replace(/#{1,6}\s/g, '')          // Remove headers
        .replace(/[•\-]\s/g, '')           // Remove bullets
        .replace(/\n+/g, '. ')             // Replace newlines with pauses
        .replace(/[🌾🌱💧🌦️⚠️🌡️📍👤📅📏☔🌧️🌊💧🕳️🔄✅❌👋😊]/g, '') // Remove emojis
        .trim();
    
    if (!cleanText) return;
    
    // Debug: Log what we're about to speak
    console.log('TTS Speaking:', cleanText.substring(0, 100) + '...');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Set language - use proper Indian language codes
    const langCode = languageVoiceCodes[language || state.language] || 'en-IN';
    utterance.lang = langCode;
    
    // Find the best voice for this language
    const voices = voiceState.synthesis.getVoices();
    
    // For Telugu, try multiple voice patterns
    let selectedVoice = null;
    if (langCode === 'te-IN') {
        // Try to find Telugu voice with various patterns
        selectedVoice = voices.find(v => 
            v.lang === 'te-IN' || 
            v.lang === 'te_IN' ||
            v.lang.toLowerCase().includes('telugu') ||
            v.name.toLowerCase().includes('telugu')
        );
    } else if (langCode === 'hi-IN') {
        // Hindi voice
        selectedVoice = voices.find(v => 
            v.lang === 'hi-IN' || 
            v.lang === 'hi_IN' ||
            v.lang.toLowerCase().includes('hindi') ||
            v.name.toLowerCase().includes('hindi')
        );
    } else {
        // For other languages, match by prefix
        selectedVoice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
    }
    
    // Fallback to Google voice if available
    if (!selectedVoice) {
        selectedVoice = voices.find(v => 
            v.name.includes('Google') && v.lang.startsWith(langCode.split('-')[0])
        );
    }
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('TTS Voice selected:', selectedVoice.name, selectedVoice.lang);
    } else {
        console.log('TTS: No voice found for', langCode, '- using default');
    }
    
    // Adjust rate for Indian languages (slightly slower for clarity)
    utterance.rate = ['hi', 'te', 'ta', 'kn', 'mr'].includes(state.language) ? 0.85 : 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onstart = () => {
        voiceState.isSpeaking = true;
        // Update TTS button to show it's speaking
        const ttsBtn = document.getElementById('btn-tts-toggle');
        if (ttsBtn) {
            ttsBtn.textContent = '⏸️';
            ttsBtn.title = 'Tap to stop';
        }
    };
    
    utterance.onend = () => {
        voiceState.isSpeaking = false;
        updateTTSButton();
    };
    
    utterance.onerror = (event) => {
        console.error('TTS error:', event.error);
        voiceState.isSpeaking = false;
        updateTTSButton();
    };
    
    voiceState.synthesis.speak(utterance);
}

// Stop speaking
function stopSpeaking() {
    if (voiceState.synthesis) {
        voiceState.synthesis.cancel();
        voiceState.isSpeaking = false;
        updateTTSButton();
        showToast('Stopped speaking', 'info');
    }
}

// Toggle TTS - also stops if currently speaking
function toggleTTS() {
    // If currently speaking, stop it
    if (voiceState.isSpeaking) {
        stopSpeaking();
        return;
    }
    
    // Otherwise toggle TTS on/off
    voiceState.ttsEnabled = !voiceState.ttsEnabled;
    localStorage.setItem('ttsEnabled', voiceState.ttsEnabled);
    updateTTSButton();
    
    if (voiceState.ttsEnabled) {
        showToast('Voice responses ON 🔊', 'success');
    } else {
        voiceState.synthesis.cancel();
        showToast('Voice responses OFF 🔇', 'info');
    }
}

function updateTTSButton() {
    const btn = document.getElementById('btn-tts-toggle');
    if (btn) {
        if (voiceState.isSpeaking) {
            btn.textContent = '⏸️';
            btn.title = 'Tap to stop speaking';
            btn.classList.add('active');
            btn.classList.remove('muted');
        } else if (voiceState.ttsEnabled) {
            btn.textContent = '🔊';
            btn.title = 'Voice ON - tap to turn OFF';
            btn.classList.add('active');
            btn.classList.remove('muted');
        } else {
            btn.textContent = '🔇';
            btn.title = 'Voice OFF - tap to turn ON';
            btn.classList.remove('active');
            btn.classList.add('muted');
        }
    }
}

// Load voices when available
if (window.speechSynthesis) {
    // Force load voices
    window.speechSynthesis.getVoices();
    
    window.speechSynthesis.onvoiceschanged = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log('Available TTS voices:', voices.length);
        
        // Log Indian language voices for debugging
        const indianVoices = voices.filter(v => 
            v.lang.includes('IN') || 
            v.lang.includes('hi') || 
            v.lang.includes('te') ||
            v.lang.includes('ta')
        );
        console.log('Indian voices:', indianVoices.map(v => `${v.name} (${v.lang})`));
    };
}

// Initialize voice when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeVoice();
    
    // Also listen for clicks on TTS toggle
    const ttsBtn = document.getElementById('btn-tts-toggle');
    if (ttsBtn) {
        ttsBtn.removeEventListener('click', toggleTTS);
        ttsBtn.addEventListener('click', toggleTTS);
    }
});
