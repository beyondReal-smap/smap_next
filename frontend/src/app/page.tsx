'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

export default function RootPage() {
  const router = useRouter();
  const { isLoggedIn, loading } = useAuth();
  const [redirectAttempted, setRedirectAttempted] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // iOS WebView 감지
  const isIOSWebView = typeof window !== 'undefined' && 
    (window as any).webkit && 
    (window as any).webkit.messageHandlers;

  useEffect(() => {
    console.log('[ROOT PAGE] 인증 상태 체크:', { 
      isLoggedIn, 
      loading, 
      redirectAttempted,
      isIOSWebView 
    });

    // 로딩 중이면 대기
    if (loading) {
      console.log('[ROOT PAGE] 로딩 중, 대기...');
      return;
    }

    // 이미 리다이렉트를 시도했다면 중복 실행 방지
    if (redirectAttempted) {
      console.log('[ROOT PAGE] 이미 리다이렉트 시도됨, 중복 실행 방지');
      return;
    }

    setRedirectAttempted(true);

    // 로그인된 사용자는 홈으로 리다이렉트
    if (isLoggedIn) {
      console.log('[ROOT PAGE] 로그인된 사용자, /home으로 리다이렉트');
      setRedirectPath('/home');
      
      // iOS WebView에서는 window.location.href 사용
      if (isIOSWebView) {
        console.log('[ROOT PAGE] iOS WebView에서 window.location.href 사용');
        setTimeout(() => {
          window.location.href = '/home';
        }, 100);
      } else {
        router.replace('/home');
      }
      return;
    }

    // 로그인되지 않은 사용자는 signin으로 리다이렉트
    console.log('[ROOT PAGE] 로그인되지 않은 사용자, /signin으로 리다이렉트');
    setRedirectPath('/signin');
    
    // iOS WebView에서는 window.location.href 사용
    if (isIOSWebView) {
      console.log('[ROOT PAGE] iOS WebView에서 window.location.href 사용');
      setTimeout(() => {
        window.location.href = '/signin';
      }, 100);
    } else {
      router.replace('/signin');
    }
  }, [isLoggedIn, loading, router, redirectAttempted, isIOSWebView]);

  // 추가 안전장치: 컴포넌트 마운트 시에도 체크
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading && !redirectAttempted) {
        console.log('[ROOT PAGE] 타이머 체크:', { isLoggedIn, loading, redirectAttempted });
        
        setRedirectAttempted(true);
        
        if (isLoggedIn) {
          setRedirectPath('/home');
          if (isIOSWebView) {
            window.location.href = '/home';
          } else {
            router.replace('/home');
          }
        } else {
          setRedirectPath('/signin');
          if (isIOSWebView) {
            window.location.href = '/signin';
          } else {
            router.replace('/signin');
          }
        }
      }
    }, 2000); // 2초 후 재체크

    return () => clearTimeout(timer);
  }, [isLoggedIn, loading, redirectAttempted, router, isIOSWebView]);

  // iOS WebView에서 페이지 로드 완료 알림
  useEffect(() => {
    if (isIOSWebView && typeof window !== 'undefined') {
      console.log('[ROOT PAGE] iOS WebView 페이지 로드 완료 알림');
      try {
        if ((window as any).webkit?.messageHandlers?.pageLoaded) {
          (window as any).webkit.messageHandlers.pageLoaded.postMessage({
            url: window.location.href,
            pathname: window.location.pathname,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.warn('[ROOT PAGE] iOS WebView 메시지 전송 실패:', error);
      }
    }
  }, [isIOSWebView]);

  // 로딩 화면 표시
  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(to bottom right, #f0f9ff, #fdf4ff)' }}
    >
      <div className="text-center">
        <div className="relative w-32 h-32 mx-auto mb-6">
          <Image 
            src="/images/smap_logo.webp"
            alt="SMAP Logo"
            width={128}
            height={128}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-4">SMAP</h2>
        
        <div className="flex items-center justify-center space-x-2">
          <div 
            className="animate-spin rounded-full h-6 w-6 border-4 border-gray-200 border-t-blue-500"
          ></div>
          <p className="text-gray-600">
            {loading ? '로딩 중...' : redirectPath ? `${redirectPath}로 이동 중...` : '페이지 이동 중...'}
          </p>
        </div>
        
        {/* iOS WebView 디버깅 정보 */}
        {isIOSWebView && (
          <div className="mt-4 text-xs text-gray-500">
            <p>iOS WebView 모드</p>
            <p>상태: {loading ? '로딩' : isLoggedIn ? '로그인됨' : '로그인 안됨'}</p>
            <p>리다이렉트: {redirectPath || '대기 중'}</p>
          </div>
        )}
      </div>
    </div>
  );
} 