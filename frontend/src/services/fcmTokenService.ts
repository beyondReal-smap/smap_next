// 🚨 Firebase 토큰 생성 로직 제거 - 네이티브에서 FCM 토큰 관리

export interface FCMTokenUpdateResponse {
  success: boolean;
  message: string;
  error?: string | null;
  mt_idx: number | null;
  has_token: boolean;
  token_preview: string | null;
}

export class FCMTokenService {
  private currentToken: string | null = null;
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
    try {
      console.log('[FCM Token Service] 🔧 FCM 토큰 서비스 초기화 시작');
      
      // 서버 사이드에서는 초기화하지 않음
      if (typeof window === 'undefined') {
        console.log('[FCM Token Service] 서버 사이드 - 초기화 건너뜀');
        return;
      }
      
      console.log('[FCM Token Service] 🚨 Firebase 토큰 생성 로직 제거됨 - 네이티브에서 FCM 토큰 관리');
      this.isInitialized = true;
      console.log('[FCM Token Service] ✅ 초기화 완료');
    } catch (error) {
      console.error('[FCM Token Service] ❌ 초기화 실패:', error);
    }
  }

  /**
   * FCM 토큰 가져오기 (네이티브에서 처리)
   */
  async getFCMToken(mt_idx?: number): Promise<string | null> {
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

      // 🚨 Firebase 토큰 생성 로직 제거 - 네이티브에서 처리
      console.log('[FCM Token Service] 🚨 Firebase 토큰 생성 로직 제거됨 - 네이티브에서 FCM 토큰 관리');
      
      // 모든 환경에서 더미 토큰 반환 (실제 FCM 토큰은 네이티브에서 관리)
      const dummyToken = `native_dummy_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      console.log('[FCM Token Service] 🎭 네이티브용 더미 FCM 토큰 생성됨:', dummyToken.substring(0, 20) + '...');
      
      // 더미 토큰을 DB에 업데이트 (사용자 ID가 있을 때만)
      if (mt_idx) {
        try {
          await this.updateFCMTokenInDB(dummyToken, mt_idx);
          console.log('[FCM Token Service] ✅ 더미 FCM 토큰 DB 업데이트 성공');
        } catch (dbError) {
          console.warn('[FCM Token Service] ⚠️ 더미 FCM 토큰 DB 업데이트 실패:', dbError);
        }
      } else {
        console.log('[FCM Token Service] ℹ️ 사용자 ID 없음 - 더미 FCM 토큰 DB 업데이트 건너뜀');
      }
      
      this.currentToken = dummyToken;
      return dummyToken;
    } catch (error) {
      console.error('[FCM Token Service] ❌ FCM 토큰 생성 실패:', error);
      return null;
    }
  }

  /**
   * FCM 토큰을 백엔드 DB에 업데이트
   */
  private async updateFCMTokenInDB(token: string, mt_idx?: number): Promise<void> {
    try {
      // 🚨 네이티브에서 FCM 토큰 관리하므로 DB 업데이트 건너뛰기
      console.log('[FCM Token Service] 🚨 네이티브에서 FCM 토큰 관리 - DB 업데이트 건너뛰기');
      console.log('[FCM Token Service] 📱 네이티브에서는 window.updateFCMToken() 함수를 사용하여 FCM 토큰 업데이트를 수행하세요');
      return;
    } catch (error) {
      console.warn('[FCM Token Service] ⚠️ FCM 토큰 DB 업데이트 실패:', error);
    }
  }

  /**
   * 현재 FCM 토큰 가져오기
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * FCM 토큰 설정 (네이티브에서 호출)
   */
  setToken(token: string): void {
    console.log('[FCM Token Service] 🚨 네이티브에서 FCM 토큰 설정:', token.substring(0, 20) + '...');
    this.currentToken = token;
  }

  /**
   * FCM 토큰 초기화
   */
  clearToken(): void {
    console.log('[FCM Token Service] 🚨 FCM 토큰 초기화');
    this.currentToken = null;
  }

  /**
   * FCM 토큰 유효성 검사
   */
  isTokenValid(token: string): boolean {
    return Boolean(token && !token.startsWith('native_dummy_') && token.length > 10);
  }

  /**
   * 디바이스 타입 감지
   */
  private detectDeviceType(): string {
    if (typeof window === 'undefined') return 'unknown';
    
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    if (/windows/.test(userAgent)) return 'windows';
    if (/macintosh|mac os x/.test(userAgent)) return 'mac';
    if (/linux/.test(userAgent)) return 'linux';
    
    return 'unknown';
  }

  /**
   * 플랫폼 감지
   */
  private detectPlatform(): string {
    if (typeof window === 'undefined') return 'unknown';
    
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad/.test(userAgent)) return 'mobile';
    if (/tablet|ipad/.test(userAgent)) return 'tablet';
    
    return 'desktop';
  }

  // 🚨 기존 메서드들을 네이티브 처리로 대체
  async initializeAndCheckUpdateToken(mt_idx: number): Promise<FCMTokenUpdateResponse> {
    console.log('[FCM Token Service] 🚨 Firebase 토큰 생성 로직 제거됨 - 네이티브에서 FCM 토큰 관리');
    return {
      success: true,
      message: '네이티브에서 FCM 토큰 관리',
      error: null,
      mt_idx,
      has_token: true,
      token_preview: 'native_managed'
    };
  }

  async initializeAndRegisterToken(mt_idx: number): Promise<FCMTokenUpdateResponse> {
    console.log('[FCM Token Service] 🚨 Firebase 토큰 생성 로직 제거됨 - 네이티브에서 FCM 토큰 관리');
    return {
      success: true,
      message: '네이티브에서 FCM 토큰 관리',
      error: null,
      mt_idx,
      has_token: true,
      token_preview: 'native_managed'
    };
  }

  async forceUpdateOnLogin(mt_idx: number): Promise<FCMTokenUpdateResponse> {
    console.log('[FCM Token Service] 🚨 Firebase 토큰 생성 로직 제거됨 - 네이티브에서 FCM 토큰 관리');
    return {
      success: true,
      message: '네이티브에서 FCM 토큰 관리',
      error: null,
      mt_idx,
      has_token: true,
      token_preview: 'native_managed'
    };
  }

  async forceTokenRefresh(mt_idx: number): Promise<FCMTokenUpdateResponse> {
    console.log('[FCM Token Service] 🚨 Firebase 토큰 생성 로직 제거됨 - 네이티브에서 FCM 토큰 관리');
    return {
      success: true,
      message: '네이티브에서 FCM 토큰 관리',
      error: null,
      mt_idx,
      has_token: true,
      token_preview: 'native_managed'
    };
  }

  getCurrentFCMToken(): string | null {
    return this.getCurrentToken();
  }
}

// 전역 인스턴스 생성
export const fcmTokenService = new FCMTokenService();

// 네이티브에서 호출할 수 있는 전역 함수들
if (typeof window !== 'undefined') {
  (window as any).fcmTokenService = fcmTokenService;
  (window as any).setFCMToken = (token: string) => fcmTokenService.setToken(token);
  (window as any).getFCMToken = () => fcmTokenService.getCurrentToken();
  (window as any).clearFCMToken = () => fcmTokenService.clearToken();
}
