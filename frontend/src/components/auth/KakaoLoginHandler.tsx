'use client';

import React, { useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { comprehensivePreloadData } from '@/services/dataPreloadService';
import authService from '@/services/authService';

interface KakaoLoginHandlerProps {
  onSuccess?: (userInfo: any) => void;
  onError?: (error: any) => void;
  onLoading?: (isLoading: boolean) => void;
}

interface KakaoLoginHandlerRef {
  login: () => void;
}

// 카카오 SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
    onNativeKakaoLoginSuccess?: (userInfo: any) => void;
    onNativeKakaoLoginError?: (error: any) => void;
  }
}

const KakaoLoginHandler = forwardRef<KakaoLoginHandlerRef, KakaoLoginHandlerProps>(({
  onSuccess,
  onError,
  onLoading
}, ref) => {
  const router = useRouter();
  const { 
    setUserProfile,
    setUserGroups,
    setGroupMembers,
    saveComprehensiveData,
    clearAllCache
  } = useDataCache();

  // 카카오 로그인 성공 처리
  const handleKakaoSuccess = useCallback(async (accessToken: string, userInfo: any) => {
    console.log('🎯 [KAKAO] 로그인 성공 처리 시작');
    console.log('🎯 [KAKAO] accessToken:', accessToken);
    console.log('🎯 [KAKAO] userInfo:', userInfo);

    try {
      onLoading?.(true);

      // 카카오 로그인 API 호출
      const response = await fetch('/api/kakao-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken
        }),
      });

      const data = await response.json();
      console.log('🎯 [KAKAO] API 응답:', data);

      if (data.success && data.user && data.token) {
        // 토큰 직접 저장
        authService.setToken(data.token);
        
        // 사용자 데이터 저장
        const userProfile = {
          ...data.user,
          mt_idx: data.user.mt_idx || data.user.id,
          mt_name: data.user.nickname || data.user.mt_name || '',
          mt_email: data.user.email || '',
          mt_file1: data.user.profile_image || '',
          groups: [],
          ownedGroups: [],
          joinedGroups: []
        };
        
        authService.setUserData(userProfile);

        // 데이터 프리로드
        try {
          const preloadResults = await comprehensivePreloadData(userProfile.mt_idx);
          
          if (preloadResults.success) {
            // DataCacheContext에 일괄 저장
            saveComprehensiveData({
              userProfile: preloadResults.userProfile,
              userGroups: preloadResults.userGroups,
              groupMembers: preloadResults.groupMembers,
              locationData: preloadResults.locationData,
              dailyLocationCounts: preloadResults.dailyCounts
            });
            
            console.log('🎯 [KAKAO] 전체 데이터 프리로딩 완료');
          }
        } catch (preloadError) {
          console.warn('🎯 [KAKAO] 데이터 프리로드 실패:', preloadError);
        }

        // FCM 토큰 처리 (백그라운드에서 실행)
        setTimeout(async () => {
          try {
            console.log('🔔 [KAKAO] 로그인 후 FCM 토큰 처리 시작');
            const fcmTokenService = (await import('@/services/fcmTokenService')).default;
            
            if (data.isNewUser) {
              // 신규 사용자 - FCM 토큰 등록
              const fcmResult = await fcmTokenService.initializeAndRegisterToken(userProfile.mt_idx);
              if (fcmResult.success) {
                console.log('✅ [KAKAO] 신규 사용자 FCM 토큰 등록 완료');
              } else {
                console.warn('⚠️ [KAKAO] 신규 사용자 FCM 토큰 등록 실패:', fcmResult.error);
              }
            } else {
              // 기존 사용자 - FCM 토큰 체크/업데이트
              const fcmResult = await fcmTokenService.initializeAndCheckUpdateToken(userProfile.mt_idx);
              if (fcmResult.success) {
                console.log('✅ [KAKAO] 기존 사용자 FCM 토큰 체크/업데이트 완료:', fcmResult.message);
              } else {
                console.warn('⚠️ [KAKAO] 기존 사용자 FCM 토큰 체크/업데이트 실패:', fcmResult.error);
              }
            }
          } catch (fcmError) {
            console.error('❌ [KAKAO] FCM 토큰 처리 중 오류:', fcmError);
          }
        }, 1000); // 로그인/회원가입 완료 후 1초 지연

        onSuccess?.(userInfo);
        
        // 신규 사용자인 경우 회원가입 페이지로, 기존 사용자는 홈으로
        if (data.isNewUser) {
          router.push('/register');
        } else {
          router.push('/home');
        }
      } else {
        throw new Error(data.error || data.message || '로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('🎯 [KAKAO] 로그인 처리 실패:', error);
      onError?.(error);
    } finally {
      onLoading?.(false);
    }
  }, [router, setUserProfile, setUserGroups, setGroupMembers, saveComprehensiveData, onSuccess, onError, onLoading]);

  // 카카오 로그인 에러 처리
  const handleKakaoError = useCallback((error: any) => {
    console.error('❌ [KAKAO] 로그인 에러:', error);
    onError?.(error);
    onLoading?.(false);
  }, [onError, onLoading]);

  // 웹 카카오 로그인
  const handleWebKakaoLogin = useCallback(() => {
    console.log('🌐 [KAKAO] 웹 카카오 로그인 시작');
    
    if (!window.Kakao) {
      console.error('🌐 [KAKAO] 카카오 SDK가 로드되지 않음');
      handleKakaoError(new Error('카카오 SDK가 로드되지 않았습니다.'));
      return;
    }

    try {
      onLoading?.(true);
      
      window.Kakao.Auth.login({
        success: (authObj: any) => {
          console.log('🌐 [KAKAO] 웹 로그인 성공:', authObj);
          
          // 사용자 정보 가져오기
          window.Kakao.API.request({
            url: '/v2/user/me',
            success: (userInfo: any) => {
              console.log('🌐 [KAKAO] 사용자 정보:', userInfo);
              handleKakaoSuccess(authObj.access_token, userInfo);
            },
            fail: (error: any) => {
              console.error('🌐 [KAKAO] 사용자 정보 가져오기 실패:', error);
              handleKakaoError(error);
            }
          });
        },
        fail: (error: any) => {
          console.error('🌐 [KAKAO] 웹 로그인 실패:', error);
          handleKakaoError(error);
        }
      });
    } catch (error) {
      console.error('🌐 [KAKAO] 웹 로그인 중 오류:', error);
      handleKakaoError(error);
    }
  }, [handleKakaoSuccess, handleKakaoError, onLoading]);

  // 네이티브 카카오 로그인 (iOS/Android)
  const handleNativeKakaoLogin = useCallback(() => {
    console.log('📱 [KAKAO] 네이티브 카카오 로그인 시작');
    
    try {
      // iOS WebView
      if ((window as any).webkit?.messageHandlers?.smapIos) {
        console.log('📱 [KAKAO] iOS 네이티브 로그인 호출');
        (window as any).webkit.messageHandlers.smapIos.postMessage({
          type: 'kakaoLogin'
        });
        return;
      }

      // Android WebView
      if ((window as any).Android?.kakaoLogin) {
        console.log('📱 [KAKAO] Android 네이티브 로그인 호출');
        (window as any).Android.kakaoLogin();
        return;
      }

      // 웹 환경에서는 카카오 SDK 사용
      handleWebKakaoLogin();
    } catch (error) {
      console.error('📱 [KAKAO] 네이티브 로그인 실패:', error);
      handleKakaoError(error);
    }
  }, [handleKakaoError, handleWebKakaoLogin]);

  // 컴포넌트 초기화
  useEffect(() => {
    console.log('🔧 [KAKAO] 핸들러 초기화');

    // 네이티브 콜백 함수 등록
    window.onNativeKakaoLoginSuccess = (userInfo: any) => {
      console.log('🎯 [KAKAO] 네이티브 성공 콜백:', userInfo);
      
      if (userInfo?.accessToken) {
        handleKakaoSuccess(userInfo.accessToken, userInfo);
      } else {
        console.error('🎯 [KAKAO] accessToken이 없습니다:', userInfo);
        handleKakaoError(new Error('액세스 토큰이 없습니다.'));
      }
    };

    window.onNativeKakaoLoginError = (error: any) => {
      console.error('❌ [KAKAO] 네이티브 에러 콜백:', error);
      handleKakaoError(error);
    };

    return () => {
      // 정리
      delete window.onNativeKakaoLoginSuccess;
      delete window.onNativeKakaoLoginError;
    };
  }, [handleKakaoSuccess, handleKakaoError]);

  // 외부에서 호출할 수 있는 함수들을 ref로 노출
  useImperativeHandle(ref, () => ({
    login: handleNativeKakaoLogin
  }), [handleNativeKakaoLogin]);

  return null; // 이 컴포넌트는 UI를 렌더링하지 않음
});

KakaoLoginHandler.displayName = 'KakaoLoginHandler';

export default KakaoLoginHandler;
export { type KakaoLoginHandlerProps, type KakaoLoginHandlerRef }; 