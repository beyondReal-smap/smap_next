// 안드로이드 WebView에서 firebase/auth 사용 방지 (네이티브 사용)
// import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

export interface FCMTokenUpdateResponse {
  success: boolean;
  message: string;
  mt_idx: number | null;
  has_token: boolean;
  token_preview: string | null;
}

export class FCMTokenService {
  private messaging: any = null;
  private currentToken: string | null = null;
  private initPromise: Promise<void> | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // 서버 사이드에서는 초기화하지 않음
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  /**
   * FCM Token Service 초기화
   */
  private async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  /**
   * 실제 초기화 수행
   */
  private async performInitialization(): Promise<void> {
    try {
      console.log('[FCM Token Service] 웹 환경 감지 - Firebase 초기화 시작');
      
      // 환경변수 상태 확인
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      
      console.log('[FCM Token Service] 📋 환경변수 상태 확인:', {
        NODE_ENV: process.env.NODE_ENV,
        hasVapidKey: !!vapidKey,
        hasApiKey: !!apiKey,
        hasProjectId: !!projectId,
        isLocalhost: typeof window !== 'undefined' && window.location.hostname === 'localhost'
      });

      if (!vapidKey) {
        throw new Error('VAPID 키가 설정되지 않음');
      }

      console.log('[FCM Token Service] 🔥 Firebase Messaging 초기화 시작');
      
      // 현재 환경 확인
      const currentEnv = {
        isWindow: typeof window !== 'undefined',
        hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
        hasNotification: typeof window !== 'undefined' && 'Notification' in window,
        currentDomain: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
      };
      
      console.log('[FCM Token Service] 📍 현재 환경:', currentEnv);

      // Firebase 앱 초기화 상태 확인
      if (!app) {
        throw new Error('Firebase 앱이 초기화되지 않음');
      }
      
      console.log('[FCM Token Service] ✅ Firebase 앱 초기화 상태 확인 완료');

      // Service Worker 등록
      if ('serviceWorker' in navigator) {
        console.log('[FCM Token Service] 🔧 서비스 워커 등록 시작...');
        
        try {
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('[FCM Token Service] ✅ 서비스 워커 등록 성공:', registration.scope);
        } catch (error) {
          console.warn('[FCM Token Service] ⚠️ 서비스 워커 등록 실패:', error);
        }
      }

      // Firebase Messaging 초기화
      try {
        this.messaging = getMessaging(app);
        console.log('[FCM Token Service] ✅ Firebase Messaging 초기화 성공');
      } catch (error) {
        console.error('[FCM Token Service] ❌ Firebase Messaging 초기화 실패:', error);
        throw error;
      }

      this.isInitialized = true;
      console.log('[FCM Token Service] ✅ 초기화 완료');
      
      // 테스트 함수들 설정
      this.setupTestFunctions();
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ 초기화 실패:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * FCM 토큰 획득
   */
  async getFCMToken(): Promise<string | null> {
    try {
      // 서버 사이드에서는 FCM 토큰 생성 불가
      if (typeof window === 'undefined') {
        console.log('[FCM Token Service] 서버 사이드 - FCM 토큰 생성 불가');
        return null;
      }

      // 초기화 대기
      if (!this.isInitialized) {
        await this.initialize();
      }

      // VAPID 키 확인
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        throw new Error('VAPID 키가 설정되지 않음');
      }

      // localhost 환경 감지
      const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      
      if (isLocalhost) {
        console.log('[FCM Token Service] 🏠 localhost 환경 감지 - dummy FCM 토큰 생성');
        const dummyToken = this.generateDummyFCMToken();
        console.log('[FCM Token Service] 🎭 dummy FCM 토큰 생성됨:', dummyToken.substring(0, 20) + '...');
        
        // dummy 토큰을 DB에 업데이트
        try {
          await this.updateFCMTokenInDB(dummyToken);
          console.log('[FCM Token Service] ✅ dummy FCM 토큰 DB 업데이트 성공');
          this.currentToken = dummyToken;
          return dummyToken;
        } catch (dbError) {
          console.warn('[FCM Token Service] ⚠️ dummy FCM 토큰 DB 업데이트 실패:', dbError);
          // DB 업데이트 실패해도 dummy 토큰은 반환
          this.currentToken = dummyToken;
          return dummyToken;
        }
      }

      // 실제 Firebase FCM 토큰 생성
      if (!this.messaging) {
        throw new Error('Firebase Messaging이 초기화되지 않음');
      }

      const { getToken } = await import('firebase/messaging');
      
      const token = await getToken(this.messaging, {
        vapidKey: vapidKey,
        serviceWorkerRegistration: undefined
      });

      if (token) {
        console.log('[FCM Token Service] ✅ FCM 토큰 생성 성공:', token.substring(0, 20) + '...');
        
        // 토큰을 DB에 업데이트
        try {
          await this.updateFCMTokenInDB(token);
          console.log('[FCM Token Service] ✅ FCM 토큰 DB 업데이트 성공');
        } catch (dbError) {
          console.warn('[FCM Token Service] ⚠️ FCM 토큰 DB 업데이트 실패:', dbError);
        }
        
        this.currentToken = token;
        return token;
      }

      return null;
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ FCM 토큰 획득 실패:', error);
      return null;
    }
  }

  /**
   * FCM 토큰을 백엔드 DB에 업데이트
   */
  private async updateFCMTokenInDB(token: string, mt_idx?: number): Promise<void> {
    try {
      // 현재 사용자 ID 가져오기
      let userId = mt_idx;
      if (!userId) {
        // localStorage에서 사용자 ID 가져오기
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            userId = user.id;
          } catch (parseError) {
            console.warn('[FCM Token Service] ⚠️ 사용자 정보 파싱 실패:', parseError);
          }
        }
      }

      if (!userId) {
        throw new Error('사용자 ID를 찾을 수 없음');
      }

      console.log(`[FCM Token Service] 🔄 FCM 토큰 DB 업데이트 시작 (사용자 ID: ${userId})`);

      // API 호출
      const response = await fetch(`https://api3.smap.site/api/v1/member-fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          mt_idx: userId,
          fcm_token: token,
          device_type: this.detectDeviceType(),
          platform: this.detectPlatform()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API 호출 실패: ${response.status} ${response.statusText} - ${errorData.message || '알 수 없는 오류'}`);
      }

      const result = await response.json();
      console.log('[FCM Token Service] ✅ FCM 토큰 DB 업데이트 완료:', result);
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ FCM 토큰 DB 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 디바이스 타입 감지
   */
  private detectDeviceType(): string {
    if (typeof window === 'undefined') return 'unknown';
    
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    if (/windows/.test(userAgent)) return 'desktop';
    if (/macintosh|mac os x/.test(userAgent)) return 'desktop';
    if (/linux/.test(userAgent)) return 'desktop';
    
    return 'mobile';
  }

  /**
   * 플랫폼 감지
   */
  private detectPlatform(): string {
    if (typeof window === 'undefined') return 'unknown';
    
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    if (/windows/.test(userAgent)) return 'windows';
    if (/macintosh|mac os x/.test(userAgent)) return 'macos';
    if (/linux/.test(userAgent)) return 'linux';
    
    return 'web';
  }

  /**
   * 더미 FCM 토큰 생성 (localhost 환경에서 사용)
   */
  private generateDummyFCMToken(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    const dummyToken = `dummy_${timestamp}_${random}`.padEnd(64, '0');
    return dummyToken.substring(0, 64);
  }

  /**
   * 현재 저장된 토큰 반환
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * FCM 토큰 획득 및 서버 체크/업데이트 (로그인용)
   */
  async initializeAndCheckUpdateToken(mt_idx: number): Promise<{ success: boolean; token?: string; error?: string; message?: string }> {
    try {
      console.log('[FCM Token Service] 🔔 FCM 토큰 초기화 및 체크/업데이트 시작 (로그인)');
      console.log('[FCM Token Service] 📍 사용자 ID:', mt_idx);
      
      // FCM 토큰 획득
      const token = await this.getFCMToken();
      
      if (!token) {
        console.warn('[FCM Token Service] ⚠️ FCM 토큰 획득 실패');
        return {
          success: false,
          error: 'FCM 토큰 획득 실패'
        };
      }

      console.log('[FCM Token Service] ✅ FCM 토큰 획득 성공, 길이:', token.length);

      // 토큰을 DB에 업데이트
      try {
        await this.updateFCMTokenInDB(token, mt_idx);
        console.log('[FCM Token Service] ✅ FCM 토큰 DB 업데이트 완료');
        return {
          success: true,
          token: token,
          message: 'FCM 토큰 초기화 및 DB 업데이트 완료'
        };
      } catch (dbError) {
        console.warn('[FCM Token Service] ⚠️ FCM 토큰 DB 업데이트 실패:', dbError);
        return {
          success: false,
          token: token,
          error: 'DB 업데이트 실패: ' + (dbError instanceof Error ? dbError.message : String(dbError))
        };
      }
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ FCM 토큰 체크/업데이트 실패:', error);
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * FCM 토큰 획득 및 서버 등록 (회원가입용)
   */
  async initializeAndRegisterToken(mt_idx: number): Promise<{ success: boolean; token?: string; error?: string; message?: string }> {
    try {
      console.log('[FCM Token Service] 🔔 FCM 토큰 초기화 및 등록 시작 (회원가입)');
      console.log('[FCM Token Service] 📍 사용자 ID:', mt_idx);
      
      // FCM 토큰 획득
      const token = await this.getFCMToken();
      
      if (!token) {
        console.warn('[FCM Token Service] ⚠️ FCM 토큰 획득 실패');
        return {
          success: false,
          error: 'FCM 토큰 획득 실패'
        };
      }

      console.log('[FCM Token Service] ✅ FCM 토큰 획득 성공, 길이:', token.length);

      // 토큰을 DB에 등록
      try {
        await this.updateFCMTokenInDB(token, mt_idx);
        console.log('[FCM Token Service] ✅ FCM 토큰 DB 등록 완료');
        return {
          success: true,
          token: token,
          message: 'FCM 토큰 초기화 및 DB 등록 완료'
        };
      } catch (dbError) {
        console.warn('[FCM Token Service] ⚠️ FCM 토큰 DB 등록 실패:', dbError);
        return {
          success: false,
          token: token,
          error: 'DB 등록 실패: ' + (dbError instanceof Error ? dbError.message : String(dbError))
        };
      }
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ FCM 토큰 초기화 및 등록 실패:', error);
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * FCM 토큰 유효성 검사 및 필요시 재생성
   */
  async validateAndRefreshToken(mt_idx: number): Promise<boolean> {
    try {
      console.log('[FCM Token Service] 🔍 FCM 토큰 유효성 검사 시작');
      
      const currentToken = this.getCurrentToken();
      if (!currentToken) {
        console.log('[FCM Token Service] 현재 토큰이 없음 - 새로 생성');
        const result = await this.initializeAndCheckUpdateToken(mt_idx);
        return result.success;
      }

      // 토큰 유효성 검사 (간단한 길이 및 형식 체크)
      if (currentToken.length < 20) {
        console.warn('[FCM Token Service] 토큰이 너무 짧음 - 재생성 필요');
        const result = await this.initializeAndCheckUpdateToken(mt_idx);
        return result.success;
      }

      console.log('[FCM Token Service] ✅ 현재 토큰 유효성 확인됨');
      return true;
    } catch (error) {
      console.error('[FCM Token Service] 토큰 유효성 검사 실패:', error);
      return false;
    }
  }

  /**
   * 강제 토큰 재생성 및 서버 업데이트
   */
  async forceTokenRefresh(mt_idx: number): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      console.log('[FCM Token Service] 🔄 강제 FCM 토큰 재생성 시작');
      
      // 현재 토큰 초기화
      this.currentToken = null;
      
      // 새 토큰 획득
      const newToken = await this.getFCMToken();
      if (!newToken) {
        return {
          success: false,
          error: '새 FCM 토큰 획득 실패'
        };
      }

      // 서버에 새 토큰 업데이트
      try {
        await this.updateFCMTokenInDB(newToken, mt_idx);
        console.log('[FCM Token Service] ✅ 강제 토큰 재생성 및 업데이트 완료');
        return {
          success: true,
          token: newToken
        };
      } catch (dbError) {
        console.warn('[FCM Token Service] ⚠️ 강제 토큰 재생성 중 DB 업데이트 실패:', dbError);
        return {
          success: false,
          token: newToken,
          error: 'DB 업데이트 실패: ' + (dbError instanceof Error ? dbError.message : String(dbError))
        };
      }
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ 강제 토큰 재생성 실패:', error);
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * FCM 테스트 함수들 (개발용)
   */
  private setupTestFunctions() {
    if (typeof window !== 'undefined') {
      // FCM 토큰 생성 테스트
      (window as any).testFCMToken = async () => {
        console.log('🔔 [FCM TEST] FCM 토큰 테스트 시작');
        try {
          const token = await this.getFCMToken();
          if (token) {
            console.log('✅ [FCM TEST] 토큰 생성 성공:', token.substring(0, 20) + '...');
            console.log('📏 [FCM TEST] 토큰 길이:', token.length);
            return token;
          } else {
            console.log('❌ [FCM TEST] 토큰 생성 실패');
            return null;
          }
        } catch (error) {
          console.error('❌ [FCM TEST] 토큰 생성 오류:', error);
          return null;
        }
      };

      // FCM 토큰 등록 테스트 (DB 업데이트 포함)
      (window as any).testFCMRegister = async (mt_idx?: number) => {
        console.log('🔔 [FCM TEST] FCM 토큰 등록 테스트 시작');
        try {
          const token = await this.getFCMToken();
          if (token) {
            console.log('✅ [FCM TEST] 토큰 생성 성공:', token.substring(0, 20) + '...');
            
            // DB 업데이트
            await this.updateFCMTokenInDB(token, mt_idx);
            console.log('✅ [FCM TEST] FCM 토큰 DB 등록 완료');
            
            return { success: true, token: token.substring(0, 20) + '...' };
          } else {
            console.log('❌ [FCM TEST] 토큰 생성 실패');
            return { success: false, error: '토큰 생성 실패' };
          }
        } catch (error) {
          console.error('❌ [FCM TEST] 토큰 등록 오류:', error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      };

      // FCM 토큰 체크/업데이트 테스트
      (window as any).testFCMUpdate = async (mt_idx?: number) => {
        console.log('🔔 [FCM TEST] FCM 토큰 체크/업데이트 테스트 시작');
        try {
          // 현재 토큰 확인
          const currentToken = this.currentToken;
          console.log('📋 [FCM TEST] 현재 저장된 토큰:', currentToken ? currentToken.substring(0, 20) + '...' : '없음');
          
          // 새 토큰 생성 및 DB 업데이트
          const newToken = await this.getFCMToken();
          if (newToken) {
            console.log('✅ [FCM TEST] 새 토큰 생성 성공:', newToken.substring(0, 20) + '...');
            
            // DB 업데이트
            await this.updateFCMTokenInDB(newToken, mt_idx);
            console.log('✅ [FCM TEST] FCM 토큰 DB 업데이트 완료');
            
            return { 
              success: true, 
              oldToken: currentToken ? currentToken.substring(0, 20) + '...' : '없음',
              newToken: newToken.substring(0, 20) + '...',
              updated: currentToken !== newToken
            };
          } else {
            console.log('❌ [FCM TEST] 새 토큰 생성 실패');
            return { success: false, error: '새 토큰 생성 실패' };
          }
        } catch (error) {
          console.error('❌ [FCM TEST] 토큰 업데이트 오류:', error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      };

      console.log('🔔 [FCM TEST] FCM 테스트 함수들이 전역에 등록되었습니다:');
      console.log('- testFCMToken(): FCM 토큰 생성 테스트');
      console.log('- testFCMRegister(mt_idx): FCM 토큰 등록 테스트 (DB 업데이트 포함)');
      console.log('- testFCMUpdate(mt_idx): FCM 토큰 체크/업데이트 테스트 (DB 업데이트 포함)');
    }
  }
}

// 싱글톤 인스턴스 생성 (클라이언트 사이드에서만)
export const fcmTokenService = typeof window !== 'undefined' ? new FCMTokenService() : null;
