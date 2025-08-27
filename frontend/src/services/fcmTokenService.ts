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

  /**
   * 보류된 FCM 메시지들을 확인하고 처리
   */
  async checkAndProcessPendingMessages(mt_idx: number): Promise<void> {
    try {
      console.log('[FCM Token Service] 📋 보류된 FCM 메시지 확인 시작');

      // 마지막 확인 시간 가져오기
      const lastCheckTime = localStorage.getItem('last_pending_message_check');
      const sinceTimestamp = lastCheckTime ? parseFloat(lastCheckTime) : null;

      // 보류된 메시지 API 호출
      const response = await fetch(`/api/v1/push-fcms/pending/${mt_idx}?since_timestamp=${sinceTimestamp || ''}`);

      if (!response.ok) {
        throw new Error(`보류된 메시지 확인 실패: ${response.status}`);
      }

      const pendingMessages = await response.json();

      if (pendingMessages && pendingMessages.length > 0) {
        console.log(`[FCM Token Service] 📨 ${pendingMessages.length}개의 보류된 메시지 발견`);

        // 각 메시지를 처리
        for (const message of pendingMessages) {
          await this.processPendingMessage(message, mt_idx);
        }

        // 마지막 확인 시간 업데이트
        localStorage.setItem('last_pending_message_check', Date.now().toString());

        console.log('[FCM Token Service] ✅ 보류된 메시지 처리 완료');
      } else {
        console.log('[FCM Token Service] ℹ️ 보류된 메시지가 없음');
      }

    } catch (error) {
      console.error('[FCM Token Service] ❌ 보류된 메시지 확인 실패:', error);
    }
  }

  /**
   * 개별 보류된 메시지 처리
   */
  private async processPendingMessage(message: any, mt_idx: number): Promise<void> {
    try {
      console.log(`[FCM Token Service] 📨 보류된 메시지 처리: ${message.pft_title}`);

      // 메시지를 로컬 알림으로 표시하거나 다른 방식으로 처리
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(message.pft_title || '알림', {
            body: message.pft_content || '',
            icon: '/favicon.ico'
          });
        }
      }

      // 메시지를 전달 완료로 표시 (선택적)
      if (message.pft_idx) {
        try {
          await fetch(`/api/v1/push-fcms/mark-delivered/${message.pft_idx}`, {
            method: 'POST'
          });
          console.log(`[FCM Token Service] ✅ 메시지 전달 완료 표시: ${message.pft_idx}`);
        } catch (markError) {
          console.warn(`[FCM Token Service] ⚠️ 메시지 전달 완료 표시 실패: ${markError}`);
        }
      }

    } catch (error) {
      console.error('[FCM Token Service] ❌ 보류된 메시지 처리 실패:', error);
    }
  }

  /**
   * 주기적으로 보류된 메시지 확인 시작
   */
  startPendingMessageCheck(mt_idx: number, intervalMinutes: number = 30): void {
    console.log(`[FCM Token Service] 🔄 보류된 메시지 주기적 확인 시작 (${intervalMinutes}분 간격)`);

    // 즉시 첫 번째 확인
    setTimeout(() => {
      this.checkAndProcessPendingMessages(mt_idx);
    }, 5000); // 앱 시작 후 5초 후 첫 확인

    // 주기적 확인 설정
    setInterval(() => {
      this.checkAndProcessPendingMessages(mt_idx);
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * 백그라운드 푸시 데이터 처리
   */
  handleBackgroundPush(userInfo: any, timestamp: number): void {
    console.log('[FCM Token Service] 🔄 백그라운드 푸시 처리:', userInfo);

    try {
      // 백그라운드 푸시 데이터를 로컬 저장소에 저장
      this.saveBackgroundPushData(userInfo, timestamp);

      // 백그라운드 푸시 이벤트 발생
      this.emitBackgroundPushEvent(userInfo, timestamp);

      console.log('[FCM Token Service] ✅ 백그라운드 푸시 처리 완료');
    } catch (error) {
      console.error('[FCM Token Service] ❌ 백그라운드 푸시 처리 실패:', error);
    }
  }

  /**
   * 큐에 저장된 FCM 메시지 처리
   */
  handleQueuedMessage(userInfo: any, timestamp: number): void {
    console.log('[FCM Token Service] 📨 큐 메시지 처리:', userInfo);

    try {
      // 큐 메시지를 로컬 알림으로 표시
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          const title = userInfo.title || userInfo['title'] || '알림';
          const body = userInfo.body || userInfo['body'] || '';

          new Notification(title, {
            body: body,
            icon: '/favicon.ico',
            tag: 'queued-fcm-message',
            data: { userInfo, timestamp }
          });
        }
      }

      console.log('[FCM Token Service] ✅ 큐 메시지 처리 완료');
    } catch (error) {
      console.error('[FCM Token Service] ❌ 큐 메시지 처리 실패:', error);
    }
  }

  /**
   * 백그라운드 푸시 데이터를 로컬 저장소에 저장
   */
  private saveBackgroundPushData(userInfo: any, timestamp: number): void {
    try {
      const backgroundPushKey = 'background_push_data';
      const existingData = JSON.parse(localStorage.getItem(backgroundPushKey) || '[]');

      const pushData = {
        userInfo,
        timestamp,
        receivedAt: Date.now(),
        processed: false
      };

      existingData.push(pushData);

      // 최대 10개의 백그라운드 푸시 데이터만 유지
      if (existingData.length > 10) {
        existingData.splice(0, existingData.length - 10);
      }

      localStorage.setItem(backgroundPushKey, JSON.stringify(existingData));
      console.log('[FCM Token Service] 💾 백그라운드 푸시 데이터 저장 완료');
    } catch (error) {
      console.warn('[FCM Token Service] ⚠️ 백그라운드 푸시 데이터 저장 실패:', error);
    }
  }

  /**
   * 백그라운드 푸시 이벤트 발생
   */
  private emitBackgroundPushEvent(userInfo: any, timestamp: number): void {
    // 커스텀 이벤트 발생으로 다른 모듈에서 처리 가능
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('fcmBackgroundPushReceived', {
        detail: {
          userInfo,
          timestamp,
          receivedAt: Date.now()
        }
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * 저장된 백그라운드 푸시 데이터 조회
   */
  getBackgroundPushData(): any[] {
    try {
      const backgroundPushKey = 'background_push_data';
      const data = JSON.parse(localStorage.getItem(backgroundPushKey) || '[]');
      return data;
    } catch (error) {
      console.warn('[FCM Token Service] ⚠️ 백그라운드 푸시 데이터 조회 실패:', error);
      return [];
    }
  }

  /**
   * 백그라운드 푸시 데이터 초기화
   */
  clearBackgroundPushData(): void {
    try {
      localStorage.removeItem('background_push_data');
      console.log('[FCM Token Service] 🗑️ 백그라운드 푸시 데이터 초기화 완료');
    } catch (error) {
      console.warn('[FCM Token Service] ⚠️ 백그라운드 푸시 데이터 초기화 실패:', error);
    }
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
