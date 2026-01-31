import { useState, useEffect } from 'react';
import axios from 'axios';

interface Address {
    road?: string;
    city?: string;
    state?: string;
    country?: string;
    display_name?: string;
}

interface GeolocationState {
    latitude: number | null;
    longitude: number | null;
    address: Address | null;
    loading: boolean;
    error: string | null;
}

export const useGeolocation = () => {
    const [state, setState] = useState<GeolocationState>({
        latitude: null,
        longitude: null,
        address: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        if (!navigator.geolocation) {
            setState(prev => ({ ...prev, loading: false, error: 'Geolocation not supported' }));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    // Reverse geocoding using OpenStreetMap Nominatim API
                    const response = await axios.get(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
                        {
                            headers: {
                                // It's good practice to provide a user-agent
                                'User-Agent': 'DilemaAgricultureApp/1.0'
                            }
                        }
                    );

                    const address = response.data.address;

                    setState({
                        latitude,
                        longitude,
                        address: {
                            road: address.road || address.pedestrian || address.suburb,
                            city: address.city || address.town || address.village || address.county,
                            state: address.state,
                            country: address.country,
                            display_name: response.data.display_name
                        },
                        loading: false,
                        error: null,
                    });
                } catch (error) {
                    console.error("Reverse geocoding error:", error);
                    setState({
                        latitude,
                        longitude,
                        address: null,
                        loading: false,
                        error: 'Failed to fetch address details',
                    });
                }
            },
            (error) => {
                setState(prev => ({ ...prev, loading: false, error: error.message }));
            }
        );
    }, []);

    return state;
};
