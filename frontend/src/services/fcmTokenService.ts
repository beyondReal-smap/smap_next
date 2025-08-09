import { getAuth } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from '../lib/firebase';

export interface FCMTokenUpdateResponse {
  success: boolean;
  message: string;
  mt_idx: number | null;
  has_token: boolean;
  token_preview: string | null;
}

class FCMTokenService {
  private messaging: any = null;
  private currentToken: string | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // 브라우저 환경에서만 초기화
    if (typeof window !== 'undefined') {
      this.initPromise = this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[FCM Token Service] Firebase Messaging 초기화 시작');
      
      // Firebase 앱이 초기화되어 있는지 확인
      if (!app) {
        console.warn('[FCM Token Service] ⚠️ Firebase 앱이 초기화되지 않음 - 환경변수 확인 필요');
        this.isInitialized = true; // 에러 상태로 초기화 완료 처리
        return;
      }

      // FCM 지원 환경인지 확인
      if (!('serviceWorker' in navigator)) {
        console.warn('[FCM Token Service] ⚠️ ServiceWorker를 지원하지 않는 환경');
        this.isInitialized = true;
        return;
      }

      if (!('Notification' in window)) {
        console.warn('[FCM Token Service] ⚠️ 알림을 지원하지 않는 환경');
        this.isInitialized = true;
        return;
      }
      
      // 서비스 워커를 먼저 등록
      await this.ensureServiceWorker();
      
      // Firebase Messaging 초기화
      this.messaging = getMessaging(app);
      
      this.isInitialized = true;
      console.log('[FCM Token Service] ✅ 초기화 완료');
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ 초기화 실패:', error);
      this.isInitialized = true; // 에러 상태로도 초기화 완료 처리
    }
  }

  private async ensureServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('[FCM Token Service] 서비스 워커 등록 성공:', registration);
      } catch (error) {
        console.warn('[FCM Token Service] 서비스 워커 등록 실패:', error);
        // 서비스 워커 없어도 FCM 토큰은 생성 가능
      }
    }
  }

  /**
   * iOS에서 전달받은 네이티브 FCM 토큰 확인
   */
  private checkNativeFCMToken(): string | null {
    if (typeof window !== 'undefined' && (window as any).nativeFCMToken) {
      const token = (window as any).nativeFCMToken;
      console.log('[FCM Token Service] iOS 네이티브 FCM 토큰 발견:', token.substring(0, 50) + '...');
      return token;
    }
    return null;
  }

  /**
   * FCM 토큰 획득 (웹/네이티브 통합)
   */
  async getFCMToken(): Promise<string | null> {
    // 1. 먼저 iOS 네이티브에서 전달된 토큰 확인
    const nativeToken = this.checkNativeFCMToken();
    if (nativeToken) {
      this.currentToken = nativeToken;
      return nativeToken;
    }

    // 2. 웹 환경에서 Firebase로 토큰 획득
    if (!this.initPromise) {
      console.warn('[FCM Token Service] 서비스가 초기화되지 않음');
      return null;
    }

    await this.initPromise;

    if (!app) {
      console.warn('[FCM Token Service] Firebase 앱이 초기화되지 않음 - 환경변수 확인 필요');
      return null;
    }

    if (!this.messaging) {
      console.warn('[FCM Token Service] Firebase Messaging이 초기화되지 않음');
      return null;
    }

    try {
      console.log('[FCM Token Service] 웹 FCM 토큰 요청 중...');
      
      // VAPID 키는 Firebase 콘솔에서 가져와야 함
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      
      const token = await getToken(this.messaging, {
        vapidKey: vapidKey
      });

      if (token) {
        this.currentToken = token;
        console.log('[FCM Token Service] ✅ FCM 토큰 획득 성공');
        console.log('[FCM Token Service] 토큰 길이:', token.length);
        console.log('[FCM Token Service] 토큰 미리보기:', token.substring(0, 50) + '...');
        return token;
      } else {
        console.warn('[FCM Token Service] ⚠️ FCM 토큰을 획득하지 못함 (권한 거부 또는 브라우저 미지원)');
        return null;
      }
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ FCM 토큰 획득 실패:', error);
      return null;
    }
  }

  /**
   * 현재 저장된 토큰 반환
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * FCM 토큰을 서버에 등록 (회원가입용)
   */
  async registerTokenToServer(mt_idx: number, token: string): Promise<FCMTokenUpdateResponse> {
    try {
      console.log('[FCM Token Service] 서버에 FCM 토큰 등록 요청 (회원가입용)');
      
      const response = await fetch('/api/member-fcm-token/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mt_idx: mt_idx,
          fcm_token: token
        }),
      });

      const data: FCMTokenUpdateResponse = await response.json();
      
      console.log('[FCM Token Service] 등록 응답:', {
        status: response.status,
        success: data.success,
        message: data.message
      });

      return data;
      
    } catch (error) {
      console.error('[FCM Token Service] 서버 등록 실패:', error);
      return {
        success: false,
        message: '서버 등록 실패: ' + (error as Error).message,
        mt_idx: null,
        has_token: false,
        token_preview: null
      };
    }
  }

  /**
   * FCM 토큰을 서버에 체크 후 업데이트 (로그인용)
   */
  async checkAndUpdateTokenToServer(mt_idx: number, token: string): Promise<FCMTokenUpdateResponse> {
    try {
      console.log('[FCM Token Service] 서버에 FCM 토큰 체크 및 업데이트 요청 (로그인용)');
      
      const response = await fetch('/api/member-fcm-token/check-and-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mt_idx: mt_idx,
          fcm_token: token
        }),
      });

      const data: FCMTokenUpdateResponse = await response.json();
      
      console.log('[FCM Token Service] 체크 및 업데이트 응답:', {
        status: response.status,
        success: data.success,
        message: data.message
      });

      return data;
      
    } catch (error) {
      console.error('[FCM Token Service] 서버 체크/업데이트 실패:', error);
      return {
        success: false,
        message: '서버 체크/업데이트 실패: ' + (error as Error).message,
        mt_idx: null,
        has_token: false,
        token_preview: null
      };
    }
  }

  /**
   * FCM 토큰 획득 및 서버 등록 (회원가입용)
   */
  async initializeAndRegisterToken(mt_idx: number): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      console.log('[FCM Token Service] 🔔 FCM 토큰 초기화 및 등록 시작 (회원가입)');
      
      // 1. FCM 토큰 획득
      const token = await this.getFCMToken();
      
      if (!token) {
        return {
          success: false,
          error: 'FCM 토큰 획득 실패'
        };
      }

      // 2. 서버에 토큰 등록
      const registerResult = await this.registerTokenToServer(mt_idx, token);
      
      if (registerResult.success) {
        console.log('[FCM Token Service] ✅ FCM 토큰 초기화 및 등록 완료');
        return {
          success: true,
          token: token
        };
      } else {
        return {
          success: false,
          token: token,
          error: registerResult.message
        };
      }
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ FCM 토큰 초기화 및 등록 실패:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * FCM 토큰 획득 및 서버 체크/업데이트 (로그인용 - 권장)
   */
  async initializeAndCheckUpdateToken(mt_idx: number): Promise<{ success: boolean; token?: string; error?: string; message?: string }> {
    try {
      console.log('[FCM Token Service] 🔔 FCM 토큰 초기화 및 체크/업데이트 시작 (로그인)');
      
      // 1. FCM 토큰 획득
      const token = await this.getFCMToken();
      
      if (!token) {
        return {
          success: false,
          error: 'FCM 토큰 획득 실패'
        };
      }

      // 2. 서버에서 토큰 체크 후 필요시 업데이트
      const checkResult = await this.checkAndUpdateTokenToServer(mt_idx, token);
      
      if (checkResult.success) {
        console.log('[FCM Token Service] ✅ FCM 토큰 체크/업데이트 완료:', checkResult.message);
        return {
          success: true,
          token: token,
          message: checkResult.message
        };
      } else {
        return {
          success: false,
          token: token,
          error: checkResult.message
        };
      }
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ FCM 토큰 체크/업데이트 실패:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * 포그라운드 메시지 리스너 설정
   */
  setupForegroundMessageListener(callback: (payload: any) => void): void {
    if (!this.messaging) {
      console.warn('[FCM Token Service] Firebase Messaging이 초기화되지 않음');
      return;
    }

    onMessage(this.messaging, (payload) => {
      console.log('[FCM Token Service] 포그라운드 메시지 수신:', payload);
      callback(payload);
    });
  }
}

// 싱글톤 인스턴스 생성
export const fcmTokenService = new FCMTokenService();

// 개발 환경에서 브라우저 콘솔 테스트용 전역 함수
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).testFCMToken = async () => {
    try {
      console.log('🔔 [FCM TEST] FCM 토큰 테스트 시작');
      const token = await fcmTokenService.getFCMToken();
      if (token) {
        console.log('✅ [FCM TEST] 토큰 생성 성공');
        console.log('📱 [FCM TEST] 토큰 길이:', token.length);
        console.log('🔑 [FCM TEST] 토큰 미리보기:', token.substring(0, 50) + '...');
        console.log('💾 [FCM TEST] 전체 토큰:', token);
        return token;
      } else {
        console.warn('⚠️ [FCM TEST] 토큰 생성 실패');
        return null;
      }
    } catch (error) {
      console.error('❌ [FCM TEST] 토큰 테스트 중 오류:', error);
      return null;
    }
  };

  (window as any).testFCMRegister = async (mt_idx: number) => {
    try {
      console.log('🔔 [FCM TEST] FCM 토큰 등록 테스트 시작');
      const result = await fcmTokenService.initializeAndRegisterToken(mt_idx);
      console.log('📋 [FCM TEST] 등록 결과:', result);
      return result;
    } catch (error) {
      console.error('❌ [FCM TEST] 등록 테스트 중 오류:', error);
      return null;
    }
  };

  (window as any).testFCMUpdate = async (mt_idx: number) => {
    try {
      console.log('🔔 [FCM TEST] FCM 토큰 체크/업데이트 테스트 시작');
      const result = await fcmTokenService.initializeAndCheckUpdateToken(mt_idx);
      console.log('📋 [FCM TEST] 체크/업데이트 결과:', result);
      return result;
    } catch (error) {
      console.error('❌ [FCM TEST] 체크/업데이트 테스트 중 오류:', error);
      return null;
    }
  };

  console.log('🛠️ [FCM TEST] FCM 테스트 함수들이 전역에 등록되었습니다:');
  console.log('- testFCMToken(): FCM 토큰 생성 테스트');
  console.log('- testFCMRegister(mt_idx): FCM 토큰 등록 테스트');
  console.log('- testFCMUpdate(mt_idx): FCM 토큰 체크/업데이트 테스트');
}

export default fcmTokenService;
