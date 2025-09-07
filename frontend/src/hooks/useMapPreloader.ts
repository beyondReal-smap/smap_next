'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { API_KEYS } from '../config';
import { ensureNaverMapsLoaded } from '../services/ensureNaverMaps';

interface MapPreloadStatus {
  naver: boolean;
}

// 전역 상태로 API 로드 상태 관리
let globalMapLoadStatus: MapPreloadStatus = {
  naver: false
};

// 로드 중인 상태 추적
let loadingInProgress = {
  naver: false
};

// 재시도 횟수 추적
let retryCount = {
  naver: 0
};

const MAX_RETRIES = 2;
const RETRY_DELAY = 3000; // 3초

export const useMapPreloader = () => {
  const hasInitialized = useRef(false);
  const pathname = usePathname();
  
  // notice 페이지에서는 지도 프리로딩 비활성화
  const isNoticePage = pathname?.startsWith('/notice');

  // 네트워크 상태 확인
  const checkNetworkStatus = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
      return navigator.onLine;
    }
    return true; // 기본적으로 온라인으로 가정
  };

  // 네이버 지도 API 프리로드
  const preloadNaverMaps = () => {
    if (globalMapLoadStatus.naver || loadingInProgress.naver || window.naver?.maps) {
      console.log('[MapPreloader] Naver Maps API 이미 로드됨 또는 로딩 중');
      globalMapLoadStatus.naver = true;
      return Promise.resolve();
    }

    // 네트워크 상태 확인
    if (!checkNetworkStatus()) {
      console.log('[MapPreloader] 네트워크 오프라인 - Naver Maps API 프리로딩 건너뛰기');
      return Promise.resolve();
    }

    loadingInProgress.naver = true;
    console.log('[MapPreloader] Naver Maps API 프리로딩 시작');

    return ensureNaverMapsLoaded({ submodules: 'geocoder,drawing,visualization' })
      .then(() => {
        console.log('[MapPreloader] Naver Maps API 프리로딩 완료');
        globalMapLoadStatus.naver = true;
        loadingInProgress.naver = false;
        retryCount.naver = 0;
      })
      .catch((error) => {
        console.warn('[MapPreloader] Naver Maps API 프리로딩 실패:', error);
        loadingInProgress.naver = false;
        if (retryCount.naver < MAX_RETRIES) {
          retryCount.naver++;
          console.log(`[MapPreloader] Naver Maps API 재시도 ${retryCount.naver}/${MAX_RETRIES}`);
          return new Promise<void>((resolve, reject) =>
            setTimeout(() => {
              preloadNaverMaps().then(resolve).catch(reject);
            }, RETRY_DELAY)
          );
        } else {
          console.log('[MapPreloader] Naver Maps API 최대 재시도 횟수 초과 - 프리로딩 건너뛰기');
          retryCount.naver = 0;
        }
      });
  };

  // Google Maps API 관련 코드 제거됨 (사용하지 않음)

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

    // Naver Maps API만 프리로드
    preloadNaverMaps().then(() => {
      console.log('[MapPreloader] 🚀 Naver Maps API 프리로딩 성공 - 페이지 로딩 속도 향상!');
    }).catch(() => {
      console.log('[MapPreloader] ⚠️ Naver Maps API 프리로딩 실패 - 필요 시 동적 로딩으로 대체');
    });
  }, []);

  // API 로드 상태 확인 함수들
  const isNaverLoaded = () => globalMapLoadStatus.naver || !!window.naver?.maps;
  const isAllLoaded = () => isNaverLoaded();

  return {
    isNaverLoaded,
    isAllLoaded,
    preloadNaverMaps
  };
};

// 전역 상태 접근을 위한 유틸리티 함수들
export const getMapLoadStatus = () => globalMapLoadStatus;
export const isMapAPILoaded = (type: 'naver') => {
  if (type === 'naver') {
    return globalMapLoadStatus.naver || !!window.naver?.maps;
  }
  return false;
}; 