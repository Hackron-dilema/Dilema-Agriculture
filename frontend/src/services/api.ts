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
    latitude?: number;
    longitude?: number;
    location_name?: string;
    land_size_acres?: number;
    irrigation_type?: string;
}

export interface ChatResponse {
    response: string;
    alerts?: string[];
    data_sources?: string[];
    confidence?: number;
    reasoning?: string;
}

// API Instance
const api = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
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
    onboard: async (data: any) => {
        const response = await api.post('/profile/onboard', data);
        return response.data;
    },

    basicOnboard: async (data: any) => {
        const response = await api.post('/profile/basic-onboard', data);
        return response.data;
    },

    getMe: async () => {
        const response = await api.get('/profile/me');
        return response.data;
    },

    getFarmerCrops: async (farmerId: number) => {
        const response = await api.get(`/profile/farmer/${farmerId}/crops`);
        return response.data;
    },

    updateProfile: async (data: { phone: string; latitude?: number; longitude?: number; location_name?: string; language?: string }) => {
        const response = await api.post('/profile/basic-onboard', data);
        return response.data;
    }
};

export const cropService = {
    getCropStatus: async (farmerId: number) => {
        const response = await api.get(`/crop-status/${farmerId}`);
        return response.data;
    },
    getWeather: async (farmerId: number) => {
        const response = await api.get(`/weather/${farmerId}`);
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
    },
    getHistory: async (farmerId: number) => {
        const response = await api.get(`/history/${farmerId}`);
        return response.data;
    }
};

export default api;
