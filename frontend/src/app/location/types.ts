// 커스텀 알림 상태
export interface CustomToast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// API 키 설정
export const API_KEYS = {
  NAVER_CLIENT_ID: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || '',
  NAVER_CLIENT_SECRET: process.env.NEXT_PUBLIC_NAVER_CLIENT_SECRET || '',
  KAKAO_REST_API_KEY: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY || '',
  NAVER_MAPS_CLIENT_ID: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || ''
};

// 네이버 맵 타입 정의
declare global {
  interface Window {
    naver: any;
  }
}

export type NaverMarker = any;
export type NaverInfoWindow = any;
export type NaverMap = any;
export type NaverLatLng = any;

// 그룹 멤버 타입
export interface GroupMember {
  id: string;
  name: string;
  photo?: string;
  coordinates: [number, number];
  savedLocationCount: number;
  isSelected?: boolean;
  mt_gender?: string;
  original_index?: number;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
  savedLocations?: LocationData[];
}

// 장소 데이터 타입
export interface LocationData {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number];
  memo?: string;
  category?: string;
}

// 모달 컨텐츠 타입
export interface ModalContent {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  onConfirm?: () => void;
}

// 토스트 모달 타입
export interface ToastModal {
  isOpen: boolean;
  type: 'success' | 'error' | 'info';
  message: string;
}

// 장소 정보 상태 타입
export interface NewLocation {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number];
  memo: string;
  notifications: boolean;
}

// 역지오코딩 캐시 타입
export interface ReverseGeocodeCache {
  cache: Map<string, string>;
  inflight: Map<string, Promise<string>>;
}
