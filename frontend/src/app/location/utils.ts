import { ReverseGeocodeCache } from './types';

// 역지오코딩 호출 최적화: 결과 캐시 + 진행 중 요청 공용화
export const reverseGeocodeCache: ReverseGeocodeCache = {
  cache: new Map<string, string>(),
  inflight: new Map<string, Promise<string>>()
};

export const normalizeLatLngKey = (lat: number, lng: number, precision: number = 4) => {
  // 약 ~10m 그리드로 스냅하여 중복 호출 방지 (4자리 소수)
  return `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
};

// 기본 이미지 생성 함수
export const getDefaultImage = (gender: string = 'M', index: number = 0) => {
  const maleImages = [
    '/images/default/male1.png',
    '/images/default/male2.png',
    '/images/default/male3.png'
  ];
  const femaleImages = [
    '/images/default/female1.png',
    '/images/default/female2.png',
    '/images/default/female3.png'
  ];
  
  const images = gender === 'F' ? femaleImages : maleImages;
  return images[index % images.length] || images[0];
};

// 모바일 최적화된 CSS 스타일
export const mobileStyles = `
* {
  box-sizing: border-box;
}

html, body {
  width: 100%;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

body {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

.full-map-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  z-index: 1;
}

.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.glass-effect {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.location-info-panel {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

@media (max-width: 768px) {
  .mobile-optimized {
    font-size: 14px;
  }
}

.unified-animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
`;
