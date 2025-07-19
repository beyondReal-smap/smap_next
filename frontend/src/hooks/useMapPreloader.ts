'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { API_KEYS } from '../config';

interface MapPreloadStatus {
  naver: boolean;
  google: boolean;
}

// 전역 상태로 API 로드 상태 관리
let globalMapLoadStatus: MapPreloadStatus = {
  naver: false,
  google: false
};

// 로드 중인 상태 추적
let loadingInProgress = {
  naver: false,
  google: false
};

export const useMapPreloader = () => {
  const hasInitialized = useRef(false);
  const pathname = usePathname();
  
  // notice 페이지에서는 지도 프리로딩 비활성화
  const isNoticePage = pathname?.startsWith('/notice');

  // 네이버 지도 API 프리로드
  const preloadNaverMaps = () => {
    if (globalMapLoadStatus.naver || loadingInProgress.naver || window.naver?.maps) {
      console.log('[MapPreloader] Naver Maps API 이미 로드됨 또는 로딩 중');
      globalMapLoadStatus.naver = true;
      return Promise.resolve();
    }

    loadingInProgress.naver = true;
    console.log('[MapPreloader] Naver Maps API 프리로딩 시작');

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${API_KEYS.NAVER_MAPS_CLIENT_ID}&submodules=geocoder,drawing,visualization`;
      script.async = true;
      script.defer = true;
      script.id = 'naver-maps-preload';

      script.onload = () => {
        console.log('[MapPreloader] Naver Maps API 프리로딩 완료');
        globalMapLoadStatus.naver = true;
        loadingInProgress.naver = false;
        resolve();
      };

      script.onerror = (error) => {
        console.error('[MapPreloader] Naver Maps API 프리로딩 실패:', error);
        loadingInProgress.naver = false;
        reject(error);
      };

      // 기존 스크립트 제거 후 추가
      const existingScript = document.getElementById('naver-maps-preload');
      if (existingScript) {
        existingScript.remove();
      }

      document.head.appendChild(script);
    });
  };

  // Google 지도 API 프리로드
  const preloadGoogleMaps = () => {
    if (globalMapLoadStatus.google || loadingInProgress.google || window.google?.maps) {
      console.log('[MapPreloader] Google Maps API 이미 로드됨 또는 로딩 중');
      globalMapLoadStatus.google = true;
      return Promise.resolve();
    }

    loadingInProgress.google = true;
    console.log('[MapPreloader] Google Maps API 프리로딩 시작');

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
             script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEYS.GOOGLE_MAPS_API_KEY}&libraries=places,geometry&language=ko&region=KR&loading=async`;
      script.id = 'google-maps-preload';

      script.onload = () => {
        console.log('[MapPreloader] Google Maps API 프리로딩 완료');
        globalMapLoadStatus.google = true;
        loadingInProgress.google = false;
        resolve();
      };

      script.onerror = (error) => {
        console.error('[MapPreloader] Google Maps API 프리로딩 실패:', error);
        loadingInProgress.google = false;
        reject(error);
      };

      // 기존 스크립트 제거 후 추가
      const existingScript = document.getElementById('google-maps-preload');
      if (existingScript) {
        existingScript.remove();
      }

      document.head.appendChild(script);
    });
  };

  // 앱 시작 시 백그라운드에서 지도 API 프리로딩
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // notice 페이지에서는 지도 프리로딩 건너뛰기
    if (isNoticePage) {
      console.log('[MapPreloader] Notice 페이지 - 지도 API 프리로딩 건너뛰기');
      return;
    }

    console.log('[MapPreloader] 지도 API 백그라운드 프리로딩 시작');

    // 두 API를 병렬로 프리로드
    Promise.allSettled([
      preloadNaverMaps(),
      preloadGoogleMaps()
    ]).then((results) => {
      const naverResult = results[0];
      const googleResult = results[1];

      console.log('[MapPreloader] 프리로딩 완료:', {
        naver: naverResult.status === 'fulfilled' ? '성공' : '실패',
        google: googleResult.status === 'fulfilled' ? '성공' : '실패'
      });

      // 프리로딩 성공 통계
      if (naverResult.status === 'fulfilled' && googleResult.status === 'fulfilled') {
        console.log('[MapPreloader] 🚀 모든 지도 API 프리로딩 성공 - 페이지 로딩 속도 향상!');
      }
    });
  }, []);

  // API 로드 상태 확인 함수들
  const isNaverLoaded = () => globalMapLoadStatus.naver || !!window.naver?.maps;
  const isGoogleLoaded = () => globalMapLoadStatus.google || !!window.google?.maps;
  const isAllLoaded = () => isNaverLoaded() && isGoogleLoaded();

  return {
    isNaverLoaded,
    isGoogleLoaded, 
    isAllLoaded,
    preloadNaverMaps,
    preloadGoogleMaps
  };
};

// 전역 상태 접근을 위한 유틸리티 함수들
export const getMapLoadStatus = () => globalMapLoadStatus;
export const isMapAPILoaded = (type: 'naver' | 'google') => {
  if (type === 'naver') {
    return globalMapLoadStatus.naver || !!window.naver?.maps;
  }
  return globalMapLoadStatus.google || !!window.google?.maps;
}; 