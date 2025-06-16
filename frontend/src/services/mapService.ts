import { API_KEYS } from '../config';
import React from 'react';

// 지도 API 타입 정의
export type MapType = 'google' | 'naver';

// 지도 API 키 상수
export const MAP_API_KEYS = {
  GOOGLE: API_KEYS.GOOGLE_MAPS_API_KEY,
  NAVER_CLIENT_ID: API_KEYS.NAVER_MAPS_CLIENT_ID
};

// 지도 초기화 상태 관리 인터페이스
export interface MapInitState {
  googleMapsLoaded: boolean;
  naverMapsLoaded: boolean;
}

// 위치 타입 정의
export interface Location {
  lat: number;
  lng: number;
}

// Google Maps API 로드 유틸리티
export const loadGoogleMapsAPI = (callback: () => void): void => {
  if (typeof window === 'undefined' || window.google?.maps) {
    callback();
    return;
  }

  // 스크립트 요소 생성 (만약 Next.js Script 컴포넌트를 사용하지 않을 경우)
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${MAP_API_KEYS.GOOGLE}&libraries=places`;
  script.async = true;
  script.defer = true;
  script.onload = callback;
  document.head.appendChild(script);
};

// Naver Maps API 로드 유틸리티
export const loadNaverMapsAPI = (callback: () => void): void => {
  if (typeof window === 'undefined' || window.naver?.maps) {
    callback();
    return;
  }

  // 스크립트 요소 생성 (올바른 파라미터명과 서브모듈 사용)
  const script = document.createElement('script');
  script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${MAP_API_KEYS.NAVER_CLIENT_ID}&submodules=geocoder`;
  script.async = true;
  script.defer = true;
  script.onload = callback;
  document.head.appendChild(script);
};

// Google 지도 인스턴스 정리 유틸리티
export const cleanupGoogleMap = (map: React.MutableRefObject<any>, marker: React.MutableRefObject<any>): void => {
  if (marker.current) {
    marker.current.setMap(null);
    marker.current = null;
  }
  map.current = null;
  // Google Maps는 명시적 제거 메서드가 없음
};

// Naver 지도 인스턴스 정리 유틸리티
export const cleanupNaverMap = (map: React.MutableRefObject<any>, marker: React.MutableRefObject<any>): void => {
  if (marker.current) {
    marker.current.setMap(null);
    marker.current = null;
  }
  if (map.current && typeof map.current.destroy === 'function') {
    map.current.destroy();
  }
  map.current = null;
};

export default {
  MAP_API_KEYS,
  loadGoogleMapsAPI,
  loadNaverMapsAPI,
  cleanupGoogleMap,
  cleanupNaverMap
}; 