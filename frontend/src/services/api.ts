import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

// Types
export interface AuthResponse {
    success: boolean;
    message?: string;
    access_token?: string;
    farmer_id?: number;
    is_new_user?: boolean;
    detail?: string;
}

export interface ProfileData {
    phone: string;
    name: string;
    language: string;
    latitude: number;
    longitude: number;
    location_name: string;
    land_size_acres: number;
    irrigation_type: string;
}

export interface ChatResponse {
    response: string;
    alerts?: string[];
    data_sources?: any[];
    confidence?: number;
}

// API Instance
const api = axios.create({
    baseURL: API_BASE,
    timeout: 2000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const authService = {
    requestOtp: async (phone: string) => {
        const response = await api.post('/auth/request-otp', { phone: `+91${phone}` });
        return response.data;
    },

    verifyOtp: async (phone: string, otp: string) => {
        const response = await api.post('/auth/verify-otp', {
            phone: `+91${phone}`,
            otp
        });
        return response.data;
    }
};

export const profileService = {
    basicOnboard: async (data: ProfileData) => {
        const response = await api.post('/profile/basic-onboard', data);
        return response.data;
    },

    getProfile: async (farmerId: number) => {
        // Placeholder for future use
        console.log('Getting profile for', farmerId);
    }
};

export const cropService = {
    getCropStatus: async (farmerId: number) => {
        const response = await api.get(`/crop-status/${farmerId}`);
        return response.data;
    }
};

export const chatService = {
    sendMessage: async (content: string, farmerId: number) => {
        const response = await api.post('/chat', {
            content,
            farmer_id: farmerId
        });
        return response.data;
    }
};

export default api;
