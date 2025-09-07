import { API_KEYS } from '../config';
import { ensureNaverMapsLoaded } from './ensureNaverMaps';
import React from 'react';

// 지도 API 타입 정의
export type MapType = 'naver';

// 지도 API 키 상수
export const MAP_API_KEYS = {
  NAVER_CLIENT_ID: API_KEYS.NAVER_MAPS_CLIENT_ID
};

// 지도 초기화 상태 관리 인터페이스
export interface MapInitState {
  naverMapsLoaded: boolean;
}

// 위치 타입 정의
export interface Location {
  lat: number;
  lng: number;
}

// Google Maps API 관련 코드 제거됨 (사용하지 않음)

// Naver Maps API 로드 유틸리티
export const loadNaverMapsAPI = (callback: () => void): void => {
  ensureNaverMapsLoaded({ submodules: 'geocoder' })
    .then(() => callback())
    .catch(() => callback()); // 실패해도 페이지 동작을 막지 않음
};

// Google Maps 관련 코드 제거됨 (사용하지 않음)

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
  loadNaverMapsAPI,
  cleanupNaverMap
}; 