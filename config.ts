// API 키 설정
export const API_KEYS = {
  GOOGLE_MAPS: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  NAVER_MAPS: process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID || '',
  KAKAO_MAPS: process.env.NEXT_PUBLIC_KAKAO_MAPS_API_KEY || ''
};

// 기본 설정
export const CONFIG = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
  DEFAULT_MAP_CENTER: {
    lat: 37.5665,
    lng: 126.9780
  },
  DEFAULT_MAP_ZOOM: 13
};

export default {
  API_KEYS,
  CONFIG
}; 