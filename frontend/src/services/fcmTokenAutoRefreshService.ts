// fcmTokenService는 동적으로 import하여 서버사이드 렌더링 문제 방지

interface AutoRefreshConfig {
  enabled: boolean;
  interval: number; // 밀리초 단위
  maxRetries: number;
  retryDelay: number; // 밀리초 단위
  userId: number | null;
  isActive: boolean;
}

class FCMTokenAutoRefreshService {
  private config: AutoRefreshConfig = {
    enabled: true,
    interval: 30 * 60 * 1000, // 30분마다 갱신
    maxRetries: 3,
    retryDelay: 5 * 60 * 1000, // 5분 후 재시도
    userId: null,
    isActive: false
  };

  private intervalId: NodeJS.Timeout | null = null;
  private retryCount: number = 0;
  private lastRefreshTime: number = 0;

  constructor() {
    console.log('[FCM Auto Refresh] 🔄 FCM 토큰 자동 갱신 서비스 초기화');
    
    // 페이지 포커스/블러 이벤트 리스너 등록
    this.setupVisibilityListeners();
    
    // 네트워크 상태 변경 리스너 등록
    this.setupNetworkListeners();
  }

  /**
   * 자동 갱신 서비스 시작
   */
  startPeriodicRefresh(userId: number, customInterval?: number): void {
    try {
      console.log(`[FCM Auto Refresh] 🔄 자동 갱신 서비스 시작 (사용자 ID: ${userId})`);
      
      // 기존 인터벌 정리
      this.stopPeriodicRefresh();
      
      // 설정 업데이트
      this.config.userId = userId;
      this.config.isActive = true;
      this.config.interval = customInterval || this.config.interval;
      
      console.log(`[FCM Auto Refresh] 📋 설정:`, {
        interval: `${this.config.interval / 1000 / 60}분`,
        maxRetries: this.config.maxRetries,
        retryDelay: `${this.config.retryDelay / 1000 / 60}분`,
        userId: this.config.userId
      });

      // 즉시 첫 번째 갱신 실행
      this.refreshToken();

      // 주기적 갱신 시작
      this.intervalId = setInterval(() => {
        this.refreshToken();
      }, this.config.interval);

      console.log(`[FCM Auto Refresh] ✅ 자동 갱신 서비스 시작 완료 (${this.config.interval / 1000 / 60}분 간격)`);
      
    } catch (error) {
      console.error('[FCM Auto Refresh] ❌ 자동 갱신 서비스 시작 실패:', error);
    }
  }

  /**
   * 자동 갱신 서비스 중지
   */
  stopPeriodicRefresh(): void {
    try {
      console.log('[FCM Auto Refresh] ⏹️ 자동 갱신 서비스 중지');
      
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      
      this.config.isActive = false;
      this.retryCount = 0;
      
      console.log('[FCM Auto Refresh] ✅ 자동 갱신 서비스 중지 완료');
      
    } catch (error) {
      console.error('[FCM Auto Refresh] ❌ 자동 갱신 서비스 중지 실패:', error);
    }
  }

  /**
   * FCM 토큰 갱신 실행
   */
  private async refreshToken(): Promise<void> {
    try {
      if (!this.config.userId || !this.config.isActive) {
        console.log('[FCM Auto Refresh] ⏸️ 갱신 스킵: 사용자 ID 없음 또는 서비스 비활성');
        return;
      }

      // 네트워크 상태 확인
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log('[FCM Auto Refresh] 📡 네트워크 오프라인 - 갱신 스킵');
        return;
      }

      // 페이지가 숨겨져 있는지 확인 (백그라운드 상태)
      if (typeof document !== 'undefined' && document.hidden) {
        console.log('[FCM Auto Refresh] 👁️ 페이지 숨김 상태 - 갱신 스킵');
        return;
      }

      console.log(`[FCM Auto Refresh] 🔄 FCM 토큰 자동 갱신 시작 (사용자 ID: ${this.config.userId})`);
      
      const startTime = Date.now();
      
      // FCM 토큰 갱신 실행
      try {
        const { fcmTokenService } = await import('./fcmTokenService');
        if (fcmTokenService) {
          const result = await fcmTokenService.initializeAndCheckUpdateToken(this.config.userId);
          
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          if (result.success) {
            console.log(`[FCM Auto Refresh] ✅ 토큰 갱신 성공 (${duration}ms):`, result.message);
            this.retryCount = 0; // 성공 시 재시도 카운트 리셋
            this.lastRefreshTime = Date.now();
          } else {
            console.warn(`[FCM Auto Refresh] ⚠️ 토큰 갱신 실패 (${duration}ms):`, result.error);
            this.handleRefreshFailure();
          }
        } else {
          console.warn('[FCM Auto Refresh] ⚠️ fcmTokenService 초기화 실패');
          this.handleRefreshFailure();
        }
      } catch (error) {
        console.error('[FCM Auto Refresh] ❌ fcmTokenService import 실패:', error);
        this.handleRefreshFailure();
      }
      
    } catch (error) {
      console.error('[FCM Auto Refresh] ❌ 토큰 갱신 중 예상치 못한 오류:', error);
      this.handleRefreshFailure();
    }
  }

  /**
   * 갱신 실패 처리
   */
  private handleRefreshFailure(): void {
    this.retryCount++;
    
    if (this.retryCount <= this.config.maxRetries) {
      console.log(`[FCM Auto Refresh] 🔄 재시도 ${this.retryCount}/${this.config.maxRetries} - ${this.config.retryDelay / 1000}초 후 재시도`);
      
      setTimeout(() => {
        this.refreshToken();
      }, this.config.retryDelay);
    } else {
      console.error(`[FCM Auto Refresh] ❌ 최대 재시도 횟수 초과 (${this.config.maxRetries}회) - 자동 갱신 중단`);
      this.retryCount = 0; // 재시도 카운트 리셋
    }
  }

  /**
   * 페이지 가시성 변경 리스너 설정
   */
  private setupVisibilityListeners(): void {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[FCM Auto Refresh] 👁️ 페이지 숨김 - 백그라운드 모드');
      } else {
        console.log('[FCM Auto Refresh] 👁️ 페이지 표시 - 포그라운드 모드');
        
        // 페이지가 다시 보이면 즉시 갱신 시도
        if (this.config.isActive && this.config.userId) {
          console.log('[FCM Auto Refresh] 🔄 페이지 포커스 시 즉시 토큰 갱신');
          setTimeout(() => {
            this.refreshToken();
          }, 2000); // 2초 후 갱신 (페이지 로딩 완료 대기)
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 페이지 포커스/블러 이벤트도 추가
    window.addEventListener('focus', () => {
      console.log('[FCM Auto Refresh] 🎯 페이지 포커스');
      if (this.config.isActive && this.config.userId) {
        setTimeout(() => {
          this.refreshToken();
        }, 1000);
      }
    });

    window.addEventListener('blur', () => {
      console.log('[FCM Auto Refresh] 🎯 페이지 블러');
    });
  }

  /**
   * 네트워크 상태 변경 리스너 설정
   */
  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('[FCM Auto Refresh] 📡 네트워크 온라인 - 토큰 갱신 재시작');
      if (this.config.isActive && this.config.userId) {
        setTimeout(() => {
          this.refreshToken();
        }, 3000); // 3초 후 갱신 (네트워크 안정화 대기)
      }
    };

    const handleOffline = () => {
      console.log('[FCM Auto Refresh] 📡 네트워크 오프라인 - 갱신 일시 중단');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  /**
   * 수동 갱신 트리거
   */
  async triggerManualRefresh(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (!this.config.userId) {
        return {
          success: false,
          error: '사용자 ID가 설정되지 않음'
        };
      }

      console.log(`[FCM Auto Refresh] 🔄 수동 갱신 트리거 (사용자 ID: ${this.config.userId})`);
      
      try {
        const { fcmTokenService } = await import('./fcmTokenService');
        if (fcmTokenService) {
          const result = await fcmTokenService.initializeAndCheckUpdateToken(this.config.userId);
          
          if (result.success) {
            this.lastRefreshTime = Date.now();
            return {
              success: true,
              message: result.message || '수동 갱신 성공'
            };
          } else {
            return {
              success: false,
              error: result.error || '수동 갱신 실패'
            };
          }
        } else {
          return {
            success: false,
            error: 'fcmTokenService 초기화 실패'
          };
        }
      } catch (error) {
        console.error('[FCM Auto Refresh] ❌ fcmTokenService import 실패:', error);
        return {
          success: false,
          error: 'fcmTokenService import 실패'
        };
      }
      
    } catch (error) {
      console.error('[FCM Auto Refresh] ❌ 수동 갱신 중 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      };
    }
  }

  /**
   * 서비스 상태 확인
   */
  getStatus(): {
    isActive: boolean;
    userId: number | null;
    interval: number;
    lastRefreshTime: number;
    retryCount: number;
    maxRetries: number;
  } {
    return {
      isActive: this.config.isActive,
      userId: this.config.userId,
      interval: this.config.interval,
      lastRefreshTime: this.lastRefreshTime,
      retryCount: this.retryCount,
      maxRetries: this.config.maxRetries
    };
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<AutoRefreshConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[FCM Auto Refresh] ⚙️ 설정 업데이트:', this.config);
  }
}

// 싱글톤 인스턴스 생성
export const fcmTokenAutoRefreshService = new FCMTokenAutoRefreshService();

// 전역 함수로 등록 (개발자 도구에서 사용)
if (typeof window !== 'undefined') {
  (window as any).fcmTokenAutoRefreshService = fcmTokenAutoRefreshService;
  
  // 편의 함수들 등록
  (window as any).startFCMAutoRefresh = (userId: number, interval?: number) => {
    fcmTokenAutoRefreshService.startPeriodicRefresh(userId, interval);
  };
  
  (window as any).stopFCMAutoRefresh = () => {
    fcmTokenAutoRefreshService.stopPeriodicRefresh();
  };
  
  (window as any).triggerFCMRefresh = () => {
    return fcmTokenAutoRefreshService.triggerManualRefresh();
  };
  
  (window as any).getFCMAutoRefreshStatus = () => {
    return fcmTokenAutoRefreshService.getStatus();
  };
  
  console.log('[FCM Auto Refresh] 🌐 전역 함수 등록 완료:');
  console.log('- startFCMAutoRefresh(userId, interval)');
  console.log('- stopFCMAutoRefresh()');
  console.log('- triggerFCMRefresh()');
  console.log('- getFCMAutoRefreshStatus()');
}

export default fcmTokenAutoRefreshService;
