'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '../components/layout/AppLayout';
import locationTrackingService from '@/services/locationTrackingService';
// 서버 전용 API는 클라이언트 컴포넌트에서 사용하지 않음

// 범용 로딩 스피너 컴포넌트
function FullPageSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );
}

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();

  // SSR 쿠키 확인 로직은 서버 컴포넌트에서 처리 (여기는 클라이언트 전용)

  useEffect(() => {
    // 로딩이 끝났는데, 로그인이 되어있지 않다면 signin 페이지로 리디렉션
    if (!loading && !isLoggedIn) {
      console.log('[AUTH_LAYOUT] Not logged in, redirecting to signin...');
      router.push('/signin');
    }
  }, [isLoggedIn, loading, router]);

  // 로그인 후 위치 추적 시작
  useEffect(() => {
    if (isLoggedIn && !loading) {
      console.log('📍 [AUTH_LAYOUT] 로그인 확인됨, 위치 추적 시작');
      console.log('📍 [AUTH_LAYOUT] locationTrackingService 상태:', {
        isTracking: locationTrackingService.isCurrentlyTracking(),
        lastLocation: locationTrackingService.getLastLocation()
      });
      
      // 위치 추적 시작
      locationTrackingService.startTracking({
        enableHighAccuracy: true,
        distanceFilter: 10, // 10미터마다 업데이트
        updateInterval: 30000 // 30초마다 업데이트
      });

      // 위치 업데이트 콜백 등록
      locationTrackingService.onLocationUpdate((location) => {
        console.log('📍 [AUTH_LAYOUT] 위치 업데이트 수신:', {
          lat: location.latitude,
          lng: location.longitude,
          accuracy: location.accuracy,
          source: location.source
        });
      });

      // 에러 콜백 등록
      locationTrackingService.onError((error) => {
        console.error('📍 [AUTH_LAYOUT] 위치 추적 오류:', error);
      });

      // 컴포넌트 언마운트 시 위치 추적 중지
      return () => {
        console.log('📍 [AUTH_LAYOUT] 레이아웃 언마운트, 위치 추적 중지');
        locationTrackingService.stopTracking();
      };
    }
  }, [isLoggedIn, loading]);

  // 로딩 중일 때는 로딩 화면을 보여줌
  if (loading) {
    return <FullPageSpinner />;
  }

  // 로그인 상태일 때만 실제 레이아웃과 컨텐츠를 렌더링
  if (isLoggedIn) {
    return <AppLayout>{children}</AppLayout>;
  }

  // 리디렉션이 실행되기 전까지 아무것도 렌더링하지 않음 (깜빡임 방지)
  return null;
} 