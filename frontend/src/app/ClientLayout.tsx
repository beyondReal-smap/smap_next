'use client';

// 🚨🚨🚨 EMERGENCY PERMISSION BLOCK - 즉시 실행 🚨🚨🚨
if (typeof window !== 'undefined') {
  console.log('🚨🚨🚨 EMERGENCY PERMISSION GUARD LOADING... 🚨🚨🚨');
  (window as any).__SMAP_PERM_ALLOW__ = false;
  (window as any).__SMAP_EMERGENCY_BLOCK__ = true;
  
  // 즉시 모든 권한 API 차단
  if (typeof (window as any).Notification !== 'undefined' && (window as any).Notification.requestPermission) {
    const origNotif = (window as any).Notification.requestPermission;
    (window as any).Notification.requestPermission = function() {
      console.warn('🚨🚨🚨 EMERGENCY: Notification blocked immediately! 🚨🚨🚨');
      return Promise.resolve('denied');
    };
  }
  
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function() {
      console.warn('🚨🚨🚨 EMERGENCY: Camera/Mic blocked immediately! 🚨🚨🚨');
      return Promise.reject(new Error('EMERGENCY: Camera/Mic blocked until login'));
    };
  }
  
  console.log('🚨🚨🚨 EMERGENCY PERMISSION GUARD INSTALLED IMMEDIATELY! 🚨🚨🚨');
}

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
// import { SessionProvider } from 'next-auth/react'; // 임시 비활성화
import { BottomNavBar } from './components/layout';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { DataCacheProvider } from '@/contexts/DataCacheContext';
import { useAndroidPermissionChecker } from '@/hooks/useAndroidPermissionChecker';
import { initializePermissionState } from '@/utils/androidPermissions';

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





function PermissionGuard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 로컬 스토리지에서 로그인 상태 확인
  useEffect(() => {
    try {
      const token = localStorage.getItem('smap_auth_token');
      const userData = localStorage.getItem('smap_user_data');
      const loginTime = localStorage.getItem('smap_login_time');
      
      // 로그인 시간 유효성 확인 (7일)
      let isValidSession = false;
      if (token && userData && loginTime) {
        const currentTime = Date.now();
        const timeSinceLogin = currentTime - parseInt(loginTime, 10);
        const sessionDuration = 7 * 24 * 60 * 60 * 1000; // 7일
        
        if (timeSinceLogin < sessionDuration) {
          isValidSession = true;
          console.log('[PermissionGuard] 유효한 로그인 세션 발견, 자동 로그인 유지');
        } else {
          console.log('[PermissionGuard] 로그인 세션 만료, 데이터 정리');
          localStorage.removeItem('smap_auth_token');
          localStorage.removeItem('smap_user_data');
          localStorage.removeItem('smap_login_time');
        }
      }
      
      setIsLoggedIn(isValidSession);
    } catch (error) {
      console.warn('[PermissionGuard] 로컬 스토리지 접근 실패:', error);
      setIsLoggedIn(false);
    }
  }, []);
  useEffect(() => {
    try {
      if (!(window as any).__SMAP_PERMISSION_GUARD_INSTALLED__) {
        (window as any).__SMAP_PERMISSION_GUARD_INSTALLED__ = true;
        (window as any).__SMAP_PERM_ALLOW__ = false;
        
        console.log('🚨🚨🚨 [SMAP-PERM] EMERGENCY GUARD v2.0: BLOCKING ALL PERMISSIONS UNTIL LOGIN 🚨🚨🚨');
        console.log('🚨🚨🚨 [SMAP-PERM] BUILD TIME:', '2025-08-13-v2.0', 'FORCE CACHE BREAK 🚨🚨🚨');
        
        // 🚨 CRITICAL: 모든 권한 요청을 원천 차단
        const w: any = window as any;
        
        // 🚨 1. IMMEDIATE BLOCK: 즉시 모든 권한 API를 무력화
        w.__SMAP_BLOCK_ALL_PERMISSIONS__ = true;
        
        // 🚨 EMERGENCY: 모든 권한 관련 함수를 즉시 무력화
        const emergencyBlock = () => {
          console.warn('🚨🚨🚨 [EMERGENCY] PERMISSION REQUEST BLOCKED - LOGIN FIRST! 🚨🚨🚨');
          return Promise.resolve('denied');
        };
        
        // 🚨 전역 권한 차단 플래그 설정
        w.__SMAP_EMERGENCY_PERMISSION_BLOCK__ = true;
        
        // 🚨 2. Notification API 완전 차단
        const hasNotification = typeof (window as any).Notification !== 'undefined';
        const NotificationAny = (window as any).Notification;
        if (hasNotification && NotificationAny.requestPermission) {
          const originalReq = NotificationAny.requestPermission.bind(NotificationAny);
          NotificationAny.__originalRequestPermission__ = originalReq;
          NotificationAny.requestPermission = function(cb?: any){
            console.warn('🚨🚨🚨 [EMERGENCY] Notification.requestPermission COMPLETELY BLOCKED! 🚨🚨🚨');
            if (!(window as any).__SMAP_PERM_ALLOW__) {
              const p = Promise.resolve('denied');
              if (typeof cb === 'function') { try { cb('denied'); } catch(_) {} }
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
            console.warn('🚨🚨🚨 [EMERGENCY] getUserMedia (CAMERA/MIC) COMPLETELY BLOCKED! 🚨🚨🚨');
            if (!(window as any).__SMAP_PERM_ALLOW__) {
              return Promise.reject(new DOMException('NotAllowedError', 'SMAP EMERGENCY: Camera/Microphone blocked until login'));
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
              if (!(window as any).__SMAP_PERM_ALLOW__ && (name === 'notifications' || name === 'camera' || name === 'microphone' || name === 'geolocation')) {
                console.warn('🚨 [SMAP-PERM] CRITICAL BLOCK: permissions.query DENIED UNTIL LOGIN for:', name);
                return Promise.resolve({ 
                  state: 'denied',
                  onchange: null
                });
              }
            } catch(_) {}
            return originalQuery(descriptor);
          };
        }
        ;(window as any).SMAP_ENABLE_PERMISSIONS = function(){
          (window as any).__SMAP_PERM_ALLOW__ = true;
          (window as any).__SMAP_EMERGENCY_BLOCK__ = false;
          (window as any).__SMAP_EMERGENCY_PERMISSION_BLOCK__ = false;
          console.log('🔓 [SMAP-PERM] 모든 권한 해제 완료 - 로그인 후 정상 사용 가능');
          
          // geolocation 함수들 복원
          const geo: any = navigator.geolocation as any;
          if (geo && (window as any).__SMAP_ORIG_GETCURRENT__) {
            geo.getCurrentPosition = (window as any).__SMAP_ORIG_GETCURRENT__;
            console.log('🔓 [SMAP-PERM] geolocation.getCurrentPosition 복원 완료');
          }
          if (geo && (window as any).__SMAP_ORIG_WATCH__) {
            geo.watchPosition = (window as any).__SMAP_ORIG_WATCH__;
            console.log('🔓 [SMAP-PERM] geolocation.watchPosition 복원 완료');
          }
          if (geo && (window as any).__SMAP_ORIG_CLEARWATCH__) {
            geo.clearWatch = (window as any).__SMAP_ORIG_CLEARWATCH__;
            console.log('🔓 [SMAP-PERM] geolocation.clearWatch 복원 완료');
          }
        };
        console.log('[SMAP-PERM] Permission guard installed (web)');

        // iOS 네이티브 브리지 가드: 로그인 전 권한 유발 메시지 차단
        const mh = w.webkit?.messageHandlers;
        if (mh && mh.smapIos && typeof mh.smapIos.postMessage === 'function') {
          if (!w.__SMAP_POSTMESSAGE_GUARD_INSTALLED__) {
            w.__SMAP_POSTMESSAGE_GUARD_INSTALLED__ = true;
            w.__SMAP_ORIG_POSTMESSAGE__ = mh.smapIos.postMessage.bind(mh.smapIos);
            mh.smapIos.postMessage = function(message: any) {
              try {
                const allow = !!w.__SMAP_PERM_ALLOW__;
                const type = message?.type || '';
                const isPermissionTrigger = (
                  type === 'requestCameraPermission' ||
                  type === 'requestPhotoLibraryPermission' ||
                  type === 'requestMicrophonePermission' ||
                  type === 'requestLocationPermission' ||
                  type === 'setAlarmPermission' ||
                  type === 'openPhoto' ||
                  type === 'openAlbum' ||
                  type === 'checkLocationPermission' ||
                  type === 'startLocationUpdates'
                );
                if (!allow && isPermissionTrigger) {
                  console.warn('[SMAP-PERM] smapIos.postMessage blocked until login:', type);
                  return; // 차단
                }
              } catch (_) {}
              return w.__SMAP_ORIG_POSTMESSAGE__(message);
            };
            console.log('[SMAP-PERM] iOS bridge guard installed');
          }
        }

        // 전역 권한 요청 함수들 차단
        if (!w.__SMAP_GLOBAL_PERMS_GUARDED__) {
          w.__SMAP_GLOBAL_PERMS_GUARDED__ = true;
          
          // 전역 alert/confirm도 권한 관련이면 차단
          const origAlert = w.alert;
          const origConfirm = w.confirm;
          if (origAlert) {
            w.__SMAP_ORIG_ALERT__ = origAlert;
            w.alert = function(message: any) {
              if (!w.__SMAP_PERM_ALLOW__ && typeof message === 'string') {
                const msg = message.toLowerCase();
                if (msg.includes('권한') || msg.includes('permission') || msg.includes('camera') || msg.includes('location') || msg.includes('microphone')) {
                  console.warn('[SMAP-PERM] alert blocked (permission-related):', message);
                  return;
                }
              }
              return origAlert(message);
            };
          }
          if (origConfirm) {
            w.__SMAP_ORIG_CONFIRM__ = origConfirm;
            w.confirm = function(message: any) {
              if (!w.__SMAP_PERM_ALLOW__ && typeof message === 'string') {
                const msg = message.toLowerCase();
                if (msg.includes('권한') || msg.includes('permission') || msg.includes('camera') || msg.includes('location') || msg.includes('microphone')) {
                  console.warn('[SMAP-PERM] confirm blocked (permission-related):', message);
                  return false;
                }
              }
              return origConfirm(message);
            };
          }
          console.log('[SMAP-PERM] Global permission guards installed');
        }

        // geolocation 가드: 로그인 전 위치 권한 요청 차단 (강화)
        if (!w.__SMAP_GEO_GUARD_INSTALLED__ && 'geolocation' in navigator) {
          w.__SMAP_GEO_GUARD_INSTALLED__ = true;
          const geo: any = navigator.geolocation as any;
          
          // getCurrentPosition 차단
          if (typeof geo.getCurrentPosition === 'function') {
            w.__SMAP_ORIG_GETCURRENT__ = geo.getCurrentPosition.bind(geo);
            geo.getCurrentPosition = function(success: any, error?: any, options?: any) {
              if (!w.__SMAP_PERM_ALLOW__) {
                console.warn('🚨 [SMAP-PERM] geolocation.getCurrentPosition BLOCKED - 로그인 후 사용 가능');
                if (typeof error === 'function') {
                  try { 
                    error({ 
                      code: 1, 
                      message: 'SMAP: 위치 권한이 로그인 전에 차단되었습니다', 
                      PERMISSION_DENIED: 1 
                    }); 
                  } catch(_) {}
                }
                return;
              }
              return w.__SMAP_ORIG_GETCURRENT__(success, error, options);
            };
          }
          
          // watchPosition 차단
          if (typeof geo.watchPosition === 'function') {
            w.__SMAP_ORIG_WATCH__ = geo.watchPosition.bind(geo);
            geo.watchPosition = function(success: any, error?: any, options?: any) {
              if (!w.__SMAP_PERM_ALLOW__) {
                console.warn('🚨 [SMAP-PERM] geolocation.watchPosition BLOCKED - 로그인 후 사용 가능');
                if (typeof error === 'function') {
                  try { 
                    error({ 
                      code: 1, 
                      message: 'SMAP: 위치 추적이 로그인 전에 차단되었습니다', 
                      PERMISSION_DENIED: 1 
                    }); 
                  } catch(_) {}
                }
                return -1;
              }
              return w.__SMAP_ORIG_WATCH__(success, error, options);
            };
          }
          
          // clearWatch도 원본 함수로 복원
          if (typeof geo.clearWatch === 'function') {
            w.__SMAP_ORIG_CLEARWATCH__ = geo.clearWatch.bind(geo);
            geo.clearWatch = function(watchId: any) {
              return w.__SMAP_ORIG_CLEARWATCH__(watchId);
            };
          }
          
          console.log('🚨 [SMAP-PERM] geolocation guard 강화 설치 완료');
        }

        // 🚨 웹뷰 페이지 로드 시 자동 권한 체크/요청 차단
        if (!w.__SMAP_PAGE_PERM_GUARD__) {
          w.__SMAP_PAGE_PERM_GUARD__ = true;
          
          // 페이지 로드 완료 이벤트도 차단
          const origAddEventListener = w.addEventListener;
          if (origAddEventListener) {
            w.__SMAP_ORIG_ADDEVENT__ = origAddEventListener;
            w.addEventListener = function(type: string, listener: any, options?: any) {
              if (!w.__SMAP_PERM_ALLOW__ && (type === 'load' || type === 'DOMContentLoaded')) {
                const wrappedListener = function(event: any) {
                  console.warn('[SMAP-PERM] Page load event listener blocked until login:', type);
                  // 로그인 전에는 권한 요청 코드가 실행되지 않도록 리스너 차단
                  if (w.__SMAP_PERM_ALLOW__) {
                    return listener(event);
                  }
                };
                return origAddEventListener.call(this, type, wrappedListener, options);
              }
              return origAddEventListener.call(this, type, listener, options);
            };
          }
          
          // fetch/XMLHttpRequest도 권한 관련 API 호출 차단
          const origFetch = w.fetch;
          if (origFetch) {
            w.__SMAP_ORIG_FETCH__ = origFetch;
            w.fetch = function(input: any, init?: any) {
              const url = typeof input === 'string' ? input : input?.url || '';
              if (!w.__SMAP_PERM_ALLOW__ && typeof url === 'string') {
                const blockedPaths = [
                  '/api/permissions',
                  '/api/fcm',
                  '/api/location',
                  'requestPermission',
                  'checkPermission'
                ];
                if (blockedPaths.some(path => url.includes(path))) {
                  console.warn('[SMAP-PERM] fetch blocked (permission-related):', url);
                  return Promise.reject(new Error('SMAP: Permission API blocked until login'));
                }
              }
              return origFetch.call(this, input, init);
            };
          }
          console.log('[SMAP-PERM] Page-level permission guards installed');
        }
      }
      // 로그인 여부와 무관하게, 네이티브 완료 신호(SMAP_ENABLE_PERMISSIONS)로만 해제
      // (window as any).__SMAP_PERM_ALLOW__ = !!isLoggedIn;
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();
  const { handleAppResumed } = useAndroidPermissionChecker();

  // 로컬 스토리지에서 로그인 상태 확인 및 자동 로그인 처리
  useEffect(() => {
    const performAutoLogin = async () => {
      try {
        console.log('🔍 [AUTO-LOGIN] 자동 로그인 검사 시작');
        
        // 다양한 키에서 사용자 데이터 확인 (호환성 개선)
        const possibleUserKeys = [
          'smap_user_data', 
          'user', 
          'userData', 
          'user_data',
          'smap_user_profile'
        ];
        
        const possibleTokenKeys = [
          'smap_auth_token',
          'authToken', 
          'auth_token',
          'token'
        ];
        
        const possibleTimeKeys = [
          'smap_login_time',
          'loginTime',
          'login_time'
        ];
        
        let userData = null;
        let token = null;
        let loginTime = null;
        
        // 사용자 데이터 찾기
        for (const key of possibleUserKeys) {
          const data = localStorage.getItem(key);
          if (data) {
            try {
              userData = JSON.parse(data);
              if (userData?.mt_idx) {
                console.log(`✅ [AUTO-LOGIN] 사용자 데이터 발견 (키: ${key}):`, userData.mt_name);
                break;
              }
            } catch (e) {
              console.warn(`⚠️ [AUTO-LOGIN] 사용자 데이터 파싱 실패 (키: ${key}):`, e);
            }
          }
        }
        
        // 토큰 찾기
        for (const key of possibleTokenKeys) {
          const tokenData = localStorage.getItem(key);
          if (tokenData && tokenData !== 'null' && tokenData !== '') {
            token = tokenData;
            console.log(`✅ [AUTO-LOGIN] 인증 토큰 발견 (키: ${key})`);
            break;
          }
        }
        
        // 로그인 시간 찾기
        for (const key of possibleTimeKeys) {
          const timeData = localStorage.getItem(key);
          if (timeData && timeData !== 'null' && timeData !== '') {
            loginTime = timeData;
            console.log(`✅ [AUTO-LOGIN] 로그인 시간 발견 (키: ${key})`);
            break;
          }
        }
        
        // mt_idx만 있어도 자동 로그인 시도 (최소 요구사항)
        if (userData?.mt_idx) {
          console.log('🔄 [AUTO-LOGIN] mt_idx 기반 자동 로그인 시작:', userData.mt_idx);
          
          // 로그인 시간 유효성 확인 (7일)
          let isValidSession = true; // 기본값 true (시간 정보가 없어도 허용)
          
          if (loginTime) {
            const currentTime = Date.now();
            const timeSinceLogin = currentTime - parseInt(loginTime, 10);
            const sessionDuration = 7 * 24 * 60 * 60 * 1000; // 7일
            
            if (timeSinceLogin >= sessionDuration) {
              isValidSession = false;
              console.log('⏰ [AUTO-LOGIN] 로그인 세션 만료 (7일 초과)');
            } else {
              console.log(`⏰ [AUTO-LOGIN] 로그인 세션 유효 (${Math.floor(timeSinceLogin / (1000 * 60 * 60))}시간 경과)`);
            }
          } else {
            console.log('⏰ [AUTO-LOGIN] 로그인 시간 정보 없음 - 자동 로그인 허용');
          }
          
          if (isValidSession) {
            // AuthService에 사용자 데이터 설정
            if (typeof window !== 'undefined') {
              import('@/services/authService').then(({ default: authService }) => {
                authService.setUserData(userData);
                
                // 표준화된 키로 데이터 저장
                localStorage.setItem('smap_user_data', JSON.stringify(userData));
                localStorage.setItem('smap_auth_token', token || 'auto_login_token');
                localStorage.setItem('smap_login_time', loginTime || Date.now().toString());
                localStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('authToken', 'authenticated');
                
                console.log('✅ [AUTO-LOGIN] 자동 로그인 성공 - 인증 상태 복원 완료');
                setIsLoggedIn(true);
                
                // 🔥 자동 로그인 성공 시 권한 해제
                if (typeof (window as any).SMAP_ENABLE_PERMISSIONS === 'function') {
                  (window as any).SMAP_ENABLE_PERMISSIONS();
                  console.log('🔓 [AUTO-LOGIN] 위치 권한 등 모든 권한 해제 완료');
                }
                
                // 현재 페이지가 로그인/회원가입 페이지면 홈으로 리다이렉트
                if (pathname === '/signin' || pathname === '/register' || pathname === '/') {
                  console.log('🏠 [AUTO-LOGIN] 홈페이지로 자동 리다이렉트');
                  window.location.href = '/home';
                }
              }).catch(error => {
                console.error('❌ [AUTO-LOGIN] AuthService import 실패:', error);
                setIsLoggedIn(false);
              });
              
              return;
            }
          } else {
            // 세션 만료 시 데이터 정리
            console.log('🧹 [AUTO-LOGIN] 만료된 세션 데이터 정리');
            possibleUserKeys.concat(possibleTokenKeys, possibleTimeKeys).forEach(key => {
              localStorage.removeItem(key);
            });
            localStorage.removeItem('isLoggedIn');
            sessionStorage.removeItem('authToken');
          }
        } else {
          console.log('❌ [AUTO-LOGIN] 유효한 사용자 데이터 없음 (mt_idx 필요)');
        }
        
        setIsLoggedIn(false);
      } catch (error) {
        console.error('❌ [AUTO-LOGIN] 자동 로그인 처리 실패:', error);
        setIsLoggedIn(false);
      }
    };

    performAutoLogin();
  }, [pathname]);
  
  // 🔥 앱 시작 시 권한 상태 초기화
  useEffect(() => {
    try {
      console.log('🚀 [CLIENT_LAYOUT] 앱 시작 - 권한 상태 초기화');
      initializePermissionState();
    } catch (error) {
      console.error('❌ [CLIENT_LAYOUT] 권한 상태 초기화 중 오류:', error);
    }
  }, []);
  
  // 앱 포커스 시 권한 체크
  useEffect(() => {
    const handleFocus = () => {
      if (isLoggedIn) {
        handleAppResumed();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isLoggedIn, handleAppResumed]);

  // 🔥 안드로이드 권한 지속적 체크 (이미 useMapPreloader에서 처리됨)
  // useAndroidPermissionChecker(); // 중복 호출 제거됨
  
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
              <PermissionGuard />
              {children}
              {/* <PerformanceMonitor /> */}
            </UserProvider>
          </AuthProvider>
        </DataCacheProvider>
        
        {/* 전역 네비게이션 바 - 모든 페이지에서 일관된 위치 보장 */}
        {!shouldHideNavBar && <BottomNavBar />}
    </>
  );
} // force change Wed Aug 13 19:53:43 KST 2025
