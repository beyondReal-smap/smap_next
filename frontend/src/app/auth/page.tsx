'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processAuth = async () => {
      try {
        console.log('[AUTH PAGE] iOS 앱 인증 처리 시작');
        
        // URL 파라미터에서 토큰과 위치 정보 추출
        const mtTokenId = searchParams.get('mt_token_id');
        const mtLat = searchParams.get('mt_lat');
        const mtLong = searchParams.get('mt_long');
        
        console.log('[AUTH PAGE] 파라미터 확인:', {
          hasToken: !!mtTokenId,
          hasLat: !!mtLat,
          hasLong: !!mtLong,
          tokenLength: mtTokenId?.length || 0
        });

        // iOS WebView 감지
        const isIOSWebView = typeof window !== 'undefined' && 
          window.webkit && 
          window.webkit.messageHandlers;

        if (isIOSWebView) {
          console.log('[AUTH PAGE] iOS WebView 환경에서 인증 처리');
          
          // iOS WebView에 인증 성공 메시지 전송
          try {
            const messageHandlers = (window.webkit?.messageHandlers as any);
            if (messageHandlers?.authSuccess) {
              messageHandlers.authSuccess.postMessage({
                success: true,
                token: mtTokenId,
                location: {
                  lat: mtLat,
                  long: mtLong
                },
                timestamp: new Date().toISOString()
              });
            }
          } catch (error) {
            console.warn('[AUTH PAGE] iOS WebView 메시지 전송 실패:', error);
          }
        }

        // 토큰이 있으면 인증 처리
        if (mtTokenId) {
          console.log('[AUTH PAGE] 토큰 기반 인증 처리');
          
          // 토큰을 로컬 스토리지에 저장
          if (typeof window !== 'undefined') {
            localStorage.setItem('auth-token', mtTokenId);
            
            // 위치 정보도 저장
            if (mtLat && mtLong) {
              localStorage.setItem('user-location', JSON.stringify({
                lat: parseFloat(mtLat),
                long: parseFloat(mtLong),
                timestamp: new Date().toISOString()
              }));
            }
          }
          
          // 인증 성공 후 홈으로 리다이렉트
          console.log('[AUTH PAGE] 인증 성공, 홈으로 리다이렉트');
          
          if (isIOSWebView) {
            // iOS WebView에서는 window.location.href 사용
            setTimeout(() => {
              window.location.href = '/home';
            }, 500);
          } else {
            router.replace('/home');
          }
        } else {
          console.log('[AUTH PAGE] 토큰 없음, 로그인 페이지로 리다이렉트');
          setError('인증 토큰이 없습니다.');
          
          if (isIOSWebView) {
            setTimeout(() => {
              window.location.href = '/signin';
            }, 1000);
          } else {
            router.replace('/signin');
          }
        }
      } catch (error) {
        console.error('[AUTH PAGE] 인증 처리 중 오류:', error);
        setError('인증 처리 중 오류가 발생했습니다.');
        
        // 오류 발생 시 로그인 페이지로 리다이렉트
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.webkit) {
            window.location.href = '/signin';
          } else {
            router.replace('/signin');
          }
        }, 2000);
      } finally {
        setIsProcessing(false);
      }
    };

    processAuth();
  }, [searchParams, router, login]);

  // 로딩 화면
  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">iOS 앱 인증 처리 중...</p>
          <p className="text-sm text-gray-400 mt-2">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  // 에러 화면
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">인증 오류</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-400">로그인 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  return null;
} 