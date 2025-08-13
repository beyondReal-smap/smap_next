'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
// import { SessionProvider } from 'next-auth/react'; // 임시 비활성화
import { BottomNavBar } from './components/layout';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { DataCacheProvider } from '@/contexts/DataCacheContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMapPreloader } from '@/hooks/useMapPreloader';
// iOS 호환 스피너 컴포넌트를 인라인으로 정의
// import { useServiceWorker } from '@/hooks/useServiceWorker';
// import PerformanceMonitor from '@/components/PerformanceMonitor';

// 인증이 필요하지 않은 페이지들 (이제 사용되지 않지만, 참고용으로 남겨둠)
// const PUBLIC_ROUTES = ['/signin', '/register', '/register/new-page', '/login', '/social-login', '/', '/group'];

// 그룹 가입 페이지는 공개 페이지로 처리 (인증 없이도 접근 가능)
const isGroupJoinPage = (pathname: string) => {
  const isJoinPage = /^\/group\/\d+\/join/.test(pathname);
  console.log('[AUTH GUARD] isGroupJoinPage 체크:', { pathname, isJoinPage });
  return isJoinPage;
};



// 인증 가드 컴포넌트 (리디렉션 로직 제거)
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();

  // 앱 시작 시 대기 중인 그룹 가입 처리 로직은 유지
  useEffect(() => {
    const handlePendingGroupJoin = async () => {
      // 로그인되지 않았거나 로딩 중이면 처리하지 않음
      if (!isLoggedIn || loading) return;
      
      const pendingJoin = localStorage.getItem('pendingGroupJoin');
      if (!pendingJoin) return;
      
      try {
        const { groupId, groupTitle, timestamp } = JSON.parse(pendingJoin);
        
        // 24시간 이내의 요청만 처리 (만료된 요청 방지)
        const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
        if (isExpired) {
          localStorage.removeItem('pendingGroupJoin');
          return;
        }
        
        console.log('[AuthGuard] 대기 중인 그룹 가입 처리:', { groupId, groupTitle });
        
        // 그룹 가입 API 호출
        const groupService = (await import('@/services/groupService')).default;
        await groupService.joinGroup(parseInt(groupId));
        
        // 성공 시 localStorage에서 제거
        localStorage.removeItem('pendingGroupJoin');
        
        // 그룹 페이지로 이동
        router.push('/group');
        
        // 성공 알림 (선택사항)
        console.log(`[AuthGuard] 그룹 "${groupTitle}" 가입 완료!`);
        
      } catch (error) {
        console.error('[AuthGuard] 자동 그룹 가입 실패:', error);
        // 실패해도 localStorage는 정리
        localStorage.removeItem('pendingGroupJoin');
      }
    };
    
    handlePendingGroupJoin();
  }, [isLoggedIn, loading, router]);

  // 로딩 중일 때도 children을 렌더링 (스피너 제거)
  // 리디렉션 책임은 하위의 (authenticated)/layout.tsx 로 위임

  return <>{children}</>;
}

function PermissionGuard() {
  const { isLoggedIn } = useAuth();
  useEffect(() => {
    try {
      if (!(window as any).__SMAP_PERMISSION_GUARD_INSTALLED__) {
        (window as any).__SMAP_PERMISSION_GUARD_INSTALLED__ = true;
        (window as any).__SMAP_PERM_ALLOW__ = false;
        const hasNotification = typeof (window as any).Notification !== 'undefined';
        const NotificationAny = (window as any).Notification;
        if (hasNotification && NotificationAny.requestPermission) {
          const originalReq = NotificationAny.requestPermission.bind(NotificationAny);
          NotificationAny.__originalRequestPermission__ = originalReq;
          NotificationAny.requestPermission = function(cb?: any){
            if (!(window as any).__SMAP_PERM_ALLOW__) {
              console.warn('[SMAP-PERM] Notification.requestPermission blocked until login');
              const p = Promise.resolve('default');
              if (typeof cb === 'function') { try { cb('default'); } catch(_) {} }
              return p as any;
            }
            return originalReq(cb);
          };
        }
        const md: any = (navigator as any).mediaDevices;
        if (md && typeof md.getUserMedia === 'function') {
          const originalGUM = md.getUserMedia.bind(md);
          md.__originalGetUserMedia__ = originalGUM;
          md.getUserMedia = function(constraints: any){
            if (!(window as any).__SMAP_PERM_ALLOW__) {
              console.warn('[SMAP-PERM] getUserMedia blocked until login');
              return Promise.reject(new DOMException('NotAllowedError', 'SMAP: blocked until login'));
            }
            return originalGUM(constraints);
          };
        }
        const perm: any = (navigator as any).permissions;
        if (perm && typeof perm.query === 'function') {
          const originalQuery = perm.query.bind(perm);
          perm.__originalQuery__ = originalQuery;
          perm.query = function(descriptor: any){
            try {
              const name = (descriptor && (descriptor.name || descriptor)) || '';
              if (!(window as any).__SMAP_PERM_ALLOW__ && (name === 'notifications' || name === 'camera' || name === 'microphone')) {
                return Promise.resolve({ state: 'prompt' });
              }
            } catch(_) {}
            return originalQuery(descriptor);
          };
        }
        ;(window as any).SMAP_ENABLE_PERMISSIONS = function(){
          (window as any).__SMAP_PERM_ALLOW__ = true;
          console.log('[SMAP-PERM] Permissions enabled after login');
        };
        console.log('[SMAP-PERM] Permission guard installed (web)');
      }
      (window as any).__SMAP_PERM_ALLOW__ = !!isLoggedIn;
    } catch (e) {
      console.error('[SMAP-PERM] guard error:', e);
    }
  }, [isLoggedIn]);
  return null;
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();

  // 지도 API 프리로딩 및 서비스 워커 등록
  useMapPreloader();
  // useServiceWorker(); // 임시 비활성화
  
  // Service Worker 완전 해제 (페이지 새로고침 방지)
  useEffect(() => {
    const unregisterServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
            console.log('[ClientLayout] Service Worker 해제 완료:', registration.scope);
          }
          
          // 캐시도 모두 삭제
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames.map(cacheName => caches.delete(cacheName))
            );
            console.log('[ClientLayout] 모든 캐시 삭제 완료');
          }
        } catch (error) {
          console.error('[ClientLayout] Service Worker 해제 실패:', error);
        }
      }
    };
    
    unregisterServiceWorker();
  }, []);

      // 네비게이션 바를 보여줄 페이지들만 지정 - 화이트리스트 방식
  const shouldHideNavBar = React.useMemo(() => {
    // 네비게이션바를 보여줄 페이지들 (정확한 경로 매칭)
    const showNavBarPages = ['/home', '/group', '/schedule', '/location', '/activelog'];
    
    // 현재 경로가 지정된 페이지들 중 하나로 시작하는지 확인
    const shouldShow = showNavBarPages.some(page => pathname?.startsWith(page));
    
    // notice 페이지는 네비게이션 바를 숨기는 페이지로 명시적 처리
    const isNoticePage = pathname?.startsWith('/notice');
    
    // setting 페이지는 네비게이션 바를 숨기는 페이지로 명시적 처리
    const isSettingPage = pathname?.startsWith('/setting');
    
    // 그룹 가입 페이지 패턴 체크 (/group/숫자/join)
    const isGroupJoinPage = /^\/group\/\d+\/join\/?$/.test(pathname || '');
    
    return !shouldShow || isNoticePage || isSettingPage || isGroupJoinPage; // 지정된 페이지가 아니거나 notice/setting 페이지이거나 그룹 가입 페이지면 숨김
  }, [pathname]);

  // body에 클래스 및 data-page 속성 추가/제거
  useEffect(() => {
    if (typeof document !== 'undefined') {
      // data-page 속성 설정 (CSS에서 페이지별 스타일링을 위해)
      document.body.setAttribute('data-page', pathname);
      document.documentElement.setAttribute('data-page', pathname);
      
      if (shouldHideNavBar) {
          document.body.classList.add('hide-bottom-nav');
      } else {
        document.body.classList.remove('hide-bottom-nav');
      }
    }
    
    // 컴포넌트 언마운트 시 클래스 및 속성 제거
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('hide-bottom-nav');
        document.body.removeAttribute('data-page');
        document.documentElement.removeAttribute('data-page');
      }
    };
  }, [shouldHideNavBar, pathname]);
  
  // 디버깅용 로그 - 개발 환경에서만 출력 (성능 최적화)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // pathname이 실제로 변경될 때만 로그 출력
      console.log('[ClientLayout] 경로 변경:', pathname, '네비게이션 숨김:', shouldHideNavBar);
    }
  }, [pathname, shouldHideNavBar]);

  // 클라이언트 측에서만 마운트
  useEffect(() => {
    setIsMounted(true);
    console.log('[ClientLayout] 🚀 앱 초기화 완료 - 지도 API 프리로딩 및 서비스 워커 활성화');
  }, []);

  if (!isMounted) {
    return null; // 서버 사이드 렌더링 중에는 아무것도 렌더링하지 않음
  }

  return (
    <>
      <DataCacheProvider>
        <AuthProvider>
          <UserProvider>
            <AuthGuard>
              <PermissionGuard />
              {children}
              {/* <PerformanceMonitor /> */}
            </AuthGuard>
          </UserProvider>
        </AuthProvider>
      </DataCacheProvider>
      
      {/* 전역 네비게이션 바 - 모든 페이지에서 일관된 위치 보장 */}
      {!shouldHideNavBar && <BottomNavBar />}
    </>
  );
} 