'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { format, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PageContainer, Card, Button } from '../components/layout';
import Script from 'next/script';
import { Loader } from '@googlemaps/js-api-loader';
// 공통 설정 및 서비스 임포트
import config, { API_KEYS, detectLanguage, MAP_CONFIG } from '../../config';
import mapService, { 
  MapType as MapTypeService, 
  MAP_API_KEYS, 
  Location, 
  cleanupGoogleMap, 
  cleanupNaverMap 
} from '../../services/mapService';

// window 전역 객체에 naver 및 google 프로퍼티 타입 선언
declare global {
  interface Window {
    naver: any;
    google: any;
  }
}

// 지도 API 키 설정 (공통 설정 파일에서 가져옴)
const GOOGLE_MAPS_API_KEY = MAP_API_KEYS.GOOGLE;
const NAVER_MAPS_CLIENT_ID = MAP_API_KEYS.NAVER_CLIENT_ID;

// 추천 장소 더미 데이터
const RECOMMENDED_PLACES = [
  { 
    id: '1', 
    title: '스타벅스 강남점', 
    distance: 0.3, 
    address: '서울시 강남구 역삼동 123-45',
    tel: '02-1234-5678',
    url: 'https://www.starbucks.co.kr'
  },
  { 
    id: '2', 
    title: '투썸플레이스 서초점', 
    distance: 0.5, 
    address: '서울시 서초구 서초동 456-78',
    tel: '02-2345-6789',
    url: 'https://www.twosome.co.kr'
  }
];

// 지도 타입 정의 (기존 타입 정의 제거 및 서비스의 타입 사용)
type MapType = MapTypeService;

// 각 지도 API 로드 상태 추적
const scriptStatus = {
  google: false,
  naver: false
};

export default function HomePage() {
  const [userName, setUserName] = useState('사용자');
  const [userLocation, setUserLocation] = useState<Location>({ lat: 37.5642, lng: 127.0016 }); // 기본: 서울
  const [recommendedPlaces, setRecommendedPlaces] = useState(RECOMMENDED_PLACES);
  const [recentSchedules, setRecentSchedules] = useState([
    { id: '1', title: '팀 미팅', date: '오늘 14:00', location: '강남 사무실' },
    { id: '2', title: '프로젝트 발표', date: '내일 10:00', location: '회의실 A' },
    { id: '3', title: '주간 회의', date: '수요일 11:00', location: '본사 대회의실' },
  ]);
  const [favoriteLocations, setFavoriteLocations] = useState([
    { id: '1', name: '회사', address: '서울시 강남구 테헤란로 123' },
    { id: '2', name: '자주 가는 카페', address: '서울시 강남구 역삼동 234' },
  ]);
  const [groupMembers, setGroupMembers] = useState([
    { id: '1', name: '김철수', photo: '/default-avatar.png', isSelected: false },
    { id: '2', name: '이영희', photo: '/default-avatar.png', isSelected: false },
    { id: '3', name: '박민수', photo: '/default-avatar.png', isSelected: false },
  ]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [todayWeather, setTodayWeather] = useState({ temp: '22°C', condition: '맑음', icon: '☀️' });
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [mapType, setMapType] = useState<MapType>('google'); // 기본값은 구글맵
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [naverMapsLoaded, setNaverMapsLoaded] = useState(false);
  
  // 별도의 컨테이너 사용 - 지도 타입 전환 시 DOM 충돌 방지
  const googleMapContainer = useRef<HTMLDivElement>(null);
  const naverMapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const naverMap = useRef<any>(null);
  const naverMarker = useRef<any>(null);
  
  // 스크립트 로드 및 지도 초기화 상태 추적
  const [mapsInitialized, setMapsInitialized] = useState({
    google: false,
    naver: false
  });

  // 사용자 위치 가져오기
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setIsLocationEnabled(true);
        },
        (error) => {
          console.log('위치 정보를 가져올 수 없습니다:', error);
          setIsLocationEnabled(false);
        }
      );
    }
  }, []);

  // 컴포넌트 마운트 시 초기 지도 타입 설정
  useEffect(() => {
    // 개발 환경에서는 기본적으로 구글 지도 사용 (네이버 지도 인증 문제 회피)
    if (process.env.NODE_ENV === 'development' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      setMapType('google');
    }
  }, []);

  // Google Maps API 스크립트 로드 핸들러
  const handleGoogleMapsLoad = () => {
    console.log('Google Maps API loaded');
    scriptStatus.google = true;
    setGoogleMapsLoaded(true);
  };

  // Naver Maps API 스크립트 로드 핸들러
  const handleNaverMapsLoad = () => {
    console.log('Naver Maps API loaded');
    scriptStatus.naver = true;
    setNaverMapsLoaded(true);
  };

  // Google 지도 초기화
  const initGoogleMap = () => {
    if (!googleMapContainer.current || !googleMapsLoaded || !window.google || !window.google.maps) {
      console.log('Google Maps 초기화를 위한 조건이 충족되지 않음');
      return;
    }

    try {
      // 기존 구글 지도 인스턴스가 있으면 마커만 업데이트
      if (map.current) {
        // 지도 중심 위치 및 마커 위치 업데이트
        map.current.setCenter(userLocation);
        if (marker.current) {
          marker.current.setPosition(userLocation);
        }
        return;
      }
      
      console.log('Google Maps 초기화 시작');
      setIsMapLoading(true);
      
      // 지도 생성
      const mapOptions = {
        ...MAP_CONFIG.GOOGLE.DEFAULT_OPTIONS,
        center: userLocation
      };
      
      map.current = new window.google.maps.Map(googleMapContainer.current, mapOptions);

      // 사용자 위치에 마커 추가
      marker.current = new window.google.maps.Marker({
        position: userLocation,
        map: map.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#4F46E5',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          scale: 8
        }
      });

      // 지도 로딩 완료
      window.google.maps.event.addListenerOnce(map.current, 'tilesloaded', () => {
        setIsMapLoading(false);
        setMapsInitialized(prev => ({...prev, google: true}));
        console.log('Google Maps 타일 로딩 완료');
      });
      
      console.log('Google Maps 초기화 완료');
    } catch (error) {
      console.error('Google Maps 초기화 오류:', error);
      setIsMapLoading(false);
    }
  };

  // Naver 지도 초기화
  const initNaverMap = () => {
    if (!naverMapContainer.current || !naverMapsLoaded || !window.naver || !window.naver.maps) {
      console.log('Naver Maps 초기화를 위한 조건이 충족되지 않음');
      return;
    }

    try {
      // 기존 네이버 지도 인스턴스가 있으면 마커만 업데이트
      if (naverMap.current) {
        // 지도 중심 위치 및 마커 위치 업데이트
        const latlng = new window.naver.maps.LatLng(userLocation.lat, userLocation.lng);
        naverMap.current.setCenter(latlng);
        if (naverMarker.current) {
          naverMarker.current.setPosition(latlng);
        }
        return;
      }
      
      console.log('Naver Maps 초기화 시작');
      setIsMapLoading(true);

      // 현재 URL 확인 및 로깅 (디버깅용)
      const currentDomain = window.location.hostname;
      const currentPort = window.location.port;
      const currentUrl = `${currentDomain}${currentPort ? ':'+currentPort : ''}`;
      console.log(`현재 도메인: ${currentUrl}`);
      console.log(`네이버 지도 허용 도메인 목록:`, MAP_CONFIG.NAVER.ALLOWED_DOMAINS);
      
      // 현재 도메인이 허용 목록에 있는지 확인
      const isDomainAllowed = MAP_CONFIG.NAVER.ALLOWED_DOMAINS.some(domain => 
        currentDomain === domain || 
        currentDomain.endsWith(`.${domain}`)
      );
      
      if (!isDomainAllowed) {
        console.warn(`현재 도메인(${currentUrl})이 네이버 지도 API 허용 목록에 없습니다. 인증 오류가 발생할 수 있습니다.`);
        // 개발 환경에서는 즉시 Google 지도로 전환
        if (process.env.NODE_ENV === 'development' && (currentDomain === 'localhost' || currentDomain === '127.0.0.1')) {
          console.info('개발 환경에서는 Google 지도를 사용합니다.');
          setMapType('google');
          setIsMapLoading(false);
          return; // 네이버 지도 초기화 중단
        }
      }

      // 인증 상태 확인 변수
      let authFailed = false;

      // Naver Maps 인증 오류 처리 리스너 추가
      const errorListener = window.naver.maps.Event.addListener(window.naver.maps, 'auth_failure', function(error: any) {
        authFailed = true; // 인증 실패 표시
        console.error('네이버 지도 인증 실패:', error);
        console.error(`현재 URL(${window.location.href})이 네이버 지도 API에 등록되어 있는지 확인하세요.`);
        console.error('네이버 클라우드 플랫폼 콘솔에서 "Application > Maps > Web 호스팅 URL"에 현재 도메인을 추가해야 합니다.');
        
        // 구글 지도로 전환
        setMapType('google');
        setIsMapLoading(false);
        
        // 사용자에게 알림 표시
        const useGoogleInstead = window.confirm('네이버 지도를 불러올 수 없습니다. 구글 지도를 사용하시겠습니까?');
        if (!useGoogleInstead) {
          setIsMapLoading(false);
        }
      });

      try {
        // 지도 옵션에 MAP_CONFIG의 기본 설정 사용
        const mapOptions = {
          ...MAP_CONFIG.NAVER.DEFAULT_OPTIONS,
          center: new window.naver.maps.LatLng(userLocation.lat, userLocation.lng)
        };
        
        naverMap.current = new window.naver.maps.Map(naverMapContainer.current, mapOptions);
        
        // 지도가 로드된 후에만 마커 생성
        const initListener = window.naver.maps.Event.addListener(naverMap.current, 'init', () => {
          if (!authFailed && naverMap.current) {
            // 인증 실패가 아닌 경우에만 마커 생성
            try {
              naverMarker.current = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(userLocation.lat, userLocation.lng),
                map: naverMap.current,
                icon: {
                  content: '<div style="width: 16px; height: 16px; background-color: #4F46E5; border: 2px solid #FFFFFF; border-radius: 50%;"></div>',
                  size: new window.naver.maps.Size(16, 16),
                  anchor: new window.naver.maps.Point(8, 8)
                }
              });
              
              console.log('Naver Maps 마커 생성 완료');
            } catch (markerError) {
              console.error('네이버 지도 마커 생성 오류:', markerError);
            }
          }
          
          setIsMapLoading(false);
          setMapsInitialized(prev => ({...prev, naver: true}));
          console.log('Naver Maps 초기화 완료');
          
          // 인증 오류 리스너 제거
          window.naver.maps.Event.removeListener(errorListener);
          window.naver.maps.Event.removeListener(initListener);
        });
      } catch (innerError) {
        console.error('Naver Maps 객체 생성 오류:', innerError);
        window.naver.maps.Event.removeListener(errorListener);
        setMapType('google'); // 구글 지도로 전환
      }
      
    } catch (error) {
      console.error('Naver Maps 초기화 오류:', error);
      setIsMapLoading(false);
      setMapType('google'); // 구글 지도로 전환
    }
  };

  // 지도 스크립트 로드 관리
  useEffect(() => {
    // 현재 선택된 지도 타입에 맞게 스크립트 로드
    if (mapType === 'google' && !scriptStatus.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.id = 'google-maps-script';
      script.onload = () => {
        scriptStatus.google = true;
        setGoogleMapsLoaded(true);
      };
      document.head.appendChild(script);
      
      return () => {
        // 스크립트 제거 함수
        const existingScript = document.getElementById('google-maps-script');
        if (existingScript && existingScript.parentNode) {
          existingScript.parentNode.removeChild(existingScript);
        }
      };
    } else if (mapType === 'naver' && !scriptStatus.naver) {
      // 개발 환경에서 네이버 맵 인증 오류 방지용 파라미터 추가
      const naverMapUrl = new URL(`https://openapi.map.naver.com/openapi/v3/maps.js`);
      naverMapUrl.searchParams.append('ncpClientId', NAVER_MAPS_CLIENT_ID);
      
      // 개발 환경일 경우 구글 지도로 즉시 전환 (옵션)
      if (process.env.NODE_ENV === 'development' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        console.info('개발 환경에서는 네이버 지도 API 인증 제한으로 인해 구글 지도를 사용합니다.');
        setMapType('google');
        return;
      }
      
      // submodules 파라미터 추가
      naverMapUrl.searchParams.append('submodules', 'panorama,geocoder,drawing,visualization');
      
      const script = document.createElement('script');
      script.src = naverMapUrl.toString();
      script.async = true;
      script.defer = true;
      script.id = 'naver-maps-script';
      script.onload = () => {
        scriptStatus.naver = true;
        setNaverMapsLoaded(true);
      };
      script.onerror = () => {
        console.error('네이버 지도 스크립트 로드 실패');
        setMapType('google'); // 로드 실패 시 구글 지도로 전환
      };
      document.head.appendChild(script);
      
      return () => {
        // 스크립트 제거 함수
        const existingScript = document.getElementById('naver-maps-script');
        if (existingScript && existingScript.parentNode) {
          existingScript.parentNode.removeChild(existingScript);
        }
      };
    }
  }, [mapType]);

  // 지도 타입 변경 & 지도 업데이트
  useEffect(() => {
    // 컴포넌트 마운트 시 또는 지도 타입 변경 시 지도 초기화
    if (mapType === 'google' && googleMapsLoaded) {
      // 구글 맵 표시, 네이버 맵 숨김
      if (googleMapContainer.current) googleMapContainer.current.style.display = 'block';
      if (naverMapContainer.current) naverMapContainer.current.style.display = 'none';
      
      // 네이버 지도 리소스 정리
      if (naverMap.current) {
        if (naverMarker.current) {
          naverMarker.current.setMap(null);
          naverMarker.current = null;
        }
        if (typeof naverMap.current.destroy === 'function') {
          naverMap.current.destroy();
        }
        naverMap.current = null;
      }
      
      initGoogleMap();
    } else if (mapType === 'naver' && naverMapsLoaded) {
      // 네이버 맵 표시, 구글 맵 숨김
      if (googleMapContainer.current) googleMapContainer.current.style.display = 'none';
      if (naverMapContainer.current) naverMapContainer.current.style.display = 'block';
      
      // 구글 지도 리소스 정리
      if (map.current) {
        if (marker.current) {
          marker.current.setMap(null);
          marker.current = null;
        }
        map.current = null;
      }
      
      initNaverMap();
    }

    // 컴포넌트 언마운트 시 지도 인스턴스 정리
    return () => {
      // 구글 맵 인스턴스 정리
      if (map.current && marker.current) {
        marker.current.setMap(null);
        marker.current = null;
      }
      
      // 네이버 맵 인스턴스 정리
      if (naverMap.current) {
        if (naverMarker.current) {
          naverMarker.current.setMap(null);
          naverMarker.current = null;
        }
        // 네이버 지도는 명시적으로 제거 가능
        if (typeof naverMap.current.destroy === 'function') {
          naverMap.current.destroy();
        }
        naverMap.current = null;
      }
    };
  }, [userLocation, mapType, googleMapsLoaded, naverMapsLoaded]);
  
  // 컴포넌트 마운트/언마운트 시 전체 정리
  useEffect(() => {
    return () => {
      // 구글 맵 인스턴스 정리
      if (map.current && marker.current) {
        marker.current.setMap(null);
        marker.current = null;
        map.current = null;
      }
      
      // 네이버 맵 인스턴스 정리
      if (naverMap.current) {
        if (naverMarker.current) {
          naverMarker.current.setMap(null);
          naverMarker.current = null;
        }
        if (typeof naverMap.current.destroy === 'function') {
          naverMap.current.destroy();
        }
        naverMap.current = null;
      }
      
      // 스크립트 태그 정리
      const googleScript = document.getElementById('google-maps-script');
      if (googleScript) document.head.removeChild(googleScript);
      
      const naverScript = document.getElementById('naver-maps-script');
      if (naverScript) document.head.removeChild(naverScript);
      
      // 초기화 상태 리셋
      scriptStatus.google = false;
      scriptStatus.naver = false;
    };
  }, []);

  // 그룹 멤버 선택 핸들러
  const handleMemberSelect = (id: string) => {
    setGroupMembers(
      groupMembers.map(member => 
        member.id === id 
          ? { ...member, isSelected: !member.isSelected } 
          : member
      )
    );
  };

  // 위치 정보를 지도에 업데이트
  const updateMapPosition = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setIsLocationEnabled(true);
          
          if (mapType === 'google' && map.current && googleMapsLoaded) {
            map.current.panTo({ lat: latitude, lng: longitude });
            map.current.setZoom(14);
            
            if (marker.current) {
              marker.current.setPosition({ lat: latitude, lng: longitude });
            }
          } else if (mapType === 'naver' && naverMap.current && naverMapsLoaded) {
            const naverLatLng = new window.naver.maps.LatLng(latitude, longitude);
            naverMap.current.setCenter(naverLatLng);
            naverMap.current.setZoom(14);
            
            if (naverMarker.current) {
              naverMarker.current.setPosition(naverLatLng);
            }
          }
        },
        (error) => {
          console.error('위치 정보를 가져올 수 없습니다:', error);
        }
      );
    }
  };

  // 지도 타입 변경 핸들러
  const handleMapTypeChange = () => {
    setMapType(prevType => prevType === 'google' ? 'naver' : 'google');
  };

  // 날짜 선택 핸들러
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    // 실제 구현 시에는 해당 날짜의 일정 및 위치 데이터를 불러옵니다
  };

  // 다음 5일 가져오기
  const getNext5Days = () => {
    return Array.from({ length: 5 }, (_, i) => {
      const date = addDays(new Date(), i);
      return {
        value: format(date, 'yyyy-MM-dd'),
        display: i === 0 ? '오늘' : format(date, 'MM.dd (E)', { locale: ko })
      };
    });
  };

  // 거리 포맷팅 함수
  const formatDistance = (km: number) => {
    return km < 1 ? `${(km * 1000).toFixed(0)}m` : `${km.toFixed(1)}km`;
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-suite">안녕하세요, {userName}님</h1>
        <div className="mt-2 flex justify-between items-center">
          <p className="text-gray-600">오늘의 일정과 자주 찾는 장소를 확인하세요</p>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>{todayWeather.icon}</span>
            <span>{todayWeather.temp}</span>
            <span>{todayWeather.condition}</span>
          </div>
        </div>
      </div>

      {/* 주요 메뉴 바로가기 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Link href="/group" className="bg-white p-4 rounded-xl shadow-sm text-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">그룹</span>
        </Link>
        
        <Link href="/schedule" className="bg-white p-4 rounded-xl shadow-sm text-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">일정</span>
        </Link>
        
        <Link href="/location" className="bg-white p-4 rounded-xl shadow-sm text-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">내장소</span>
        </Link>
        
        <Link href="/logs" className="bg-white p-4 rounded-xl shadow-sm text-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">로그</span>
        </Link>
      </div>

      {/* 지도 영역 */}
      <Card className="mb-8 relative overflow-hidden" noPadding>
        <div className="w-full h-64 relative">
          {/* 구글 지도 컨테이너 */}
          <div 
            ref={googleMapContainer} 
            className="w-full h-full absolute inset-0" 
            style={{ display: mapType === 'google' ? 'block' : 'none' }}
          ></div>
          
          {/* 네이버 지도 컨테이너 */}
          <div 
            ref={naverMapContainer} 
            className="w-full h-full absolute inset-0" 
            style={{ display: mapType === 'naver' ? 'block' : 'none' }}
          ></div>
          
          {/* 로딩 인디케이터 */}
          {isMapLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          
          {/* 지도 컨트롤 버튼 */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white py-2 px-4 rounded-full shadow-md text-sm z-10 flex space-x-2">
            {!isLocationEnabled ? (
              <button onClick={updateMapPosition} className="text-indigo-600 font-medium flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                내 위치 사용
              </button>
            ) : (
              <button onClick={updateMapPosition} className="text-indigo-600 font-medium flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                내 위치 업데이트
              </button>
            )}
            <button 
              onClick={handleMapTypeChange} 
              className="bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full font-medium text-xs"
            >
              {mapType === 'google' ? '네이버 지도로 보기' : '구글 지도로 보기'}
            </button>
          </div>
        </div>
      </Card>

      {/* 날짜 선택 바 */}
      <div className="mb-6 flex overflow-x-auto py-2 -mx-4 px-4 space-x-2">
        {getNext5Days().map((day) => (
          <button
            key={day.value}
            onClick={() => handleDateSelect(day.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium ${
              selectedDate === day.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {day.display}
          </button>
        ))}
      </div>

      {/* 그룹 멤버 선택 영역 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">그룹원 일정</h2>
        <div className="flex overflow-x-auto py-2 -mx-4 px-4 space-x-4">
          {groupMembers.map((member) => (
            <div
              key={member.id}
              onClick={() => handleMemberSelect(member.id)}
              className={`flex-shrink-0 flex flex-col items-center cursor-pointer transition-all ${
                member.isSelected ? 'opacity-100 scale-105' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <div 
                className={`w-16 h-16 rounded-full mb-2 overflow-hidden ${
                  member.isSelected ? 'ring-2 ring-indigo-600' : 'ring-1 ring-gray-200'
                }`}
              >
                <img 
                  src={member.photo} 
                  alt={member.name} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=User';
                  }}
                />
              </div>
              <span className="text-xs text-center font-medium">{member.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 다가오는 일정 */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">다가오는 일정</h2>
          <Link href="/schedule" className="text-sm text-indigo-600 hover:text-indigo-700">
            더보기
          </Link>
        </div>
        
        <div className="space-y-3">
          {recentSchedules.length > 0 ? (
            recentSchedules.map(schedule => (
              <div key={schedule.id} className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="font-medium text-gray-900">{schedule.title}</h3>
                <div className="mt-2 flex items-start text-sm text-gray-500">
                  <div className="flex-shrink-0 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span>{schedule.date}</span>
                </div>
                <div className="mt-1 flex items-start text-sm text-gray-500">
                  <div className="flex-shrink-0 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  <span>{schedule.location}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-sm text-center text-gray-500">
              일정이 없습니다
            </div>
          )}
        </div>
      </div>

      {/* 추천 장소 영역 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">주변 추천 장소</h2>
        <div className="space-y-3">
          {recommendedPlaces.map(place => (
            <div key={place.id} className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-orange-400">
              <div className="flex justify-between items-start">
                <div>
                  <div className="inline-block px-2 py-1 bg-orange-100 text-orange-600 text-xs font-medium rounded mb-2">
                    추천 장소
                  </div>
                  <h3 className="font-medium text-gray-900">{place.title} <span className="text-xs text-gray-500">({formatDistance(place.distance)})</span></h3>
                  <p className="text-sm text-gray-500 mt-1">{place.address}</p>
                  <p className="text-sm text-gray-500">{place.tel}</p>
                </div>
                {place.url && (
                  <a 
                    href={place.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-orange-500 p-1 rounded-full hover:bg-orange-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 즐겨찾는 장소 */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">즐겨찾는 장소</h2>
          <Link href="/location" className="text-sm text-indigo-600 hover:text-indigo-700">
            더보기
          </Link>
        </div>
        
        <div className="space-y-3">
          {favoriteLocations.length > 0 ? (
            favoriteLocations.map(location => (
              <div key={location.id} className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="font-medium text-gray-900">{location.name}</h3>
                <div className="mt-1 flex items-start text-sm text-gray-500">
                  <div className="flex-shrink-0 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  <span>{location.address}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-sm text-center text-gray-500">
              저장된 장소가 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 