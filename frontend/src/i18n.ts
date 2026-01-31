import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hi from './locales/hi.json';
import pa from './locales/pa.json';
import mr from './locales/mr.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import bn from './locales/bn.json';
import kn from './locales/kn.json';
import gu from './locales/gu.json';
import ml from './locales/ml.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            hi: { translation: hi },
            pa: { translation: pa },
            mr: { translation: mr },
            ta: { translation: ta },
            te: { translation: te },
            bn: { translation: bn },
            kn: { translation: kn },
            gu: { translation: gu },
            ml: { translation: ml },
        },
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
        },
    });

export default i18n;
