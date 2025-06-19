/**
 * iOS 네이티브 로깅 시스템
 * Google/Kakao 로그인 시 상세한 데이터 전송 및 엔드포인트 호출 내역을 Xcode에서 확인
 */

interface LogData {
  [key: string]: any;
}

interface APICallLog {
  method: string;
  url: string;
  headers?: any;
  body?: any;
  response?: any;
  status?: number;
  timestamp: string;
  duration?: number;
}

// 로그 레벨 정의
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warning', 
  ERROR = 'error',
  CRITICAL = 'critical'
}

// 로그 카테고리 정의
export enum LogCategory {
  AUTH = 'AUTH',
  API = 'API',
  GOOGLE_LOGIN = 'GOOGLE_LOGIN',
  KAKAO_LOGIN = 'KAKAO_LOGIN',
  NETWORK = 'NETWORK',
  USER_ACTION = 'USER_ACTION',
  SYSTEM = 'SYSTEM'
}

class IOSLogger {
  private isEnabled: boolean = true;
  private logQueue: any[] = [];
  private maxQueueSize: number = 100;

  constructor() {
    // iOS 환경에서만 활성화
    this.isEnabled = this.isIOSWebView();
    
    if (this.isEnabled) {
      console.log('🍎 [iOS Logger] iOS 로깅 시스템 활성화');
      this.setupGlobalErrorHandling();
    }
  }

  /**
   * iOS WebView 환경 감지
   */
  private isIOSWebView(): boolean {
    if (typeof window === 'undefined') return false;
    
    const hasWebKit = !!(window as any).webkit;
    const hasMessageHandlers = !!(window as any).webkit?.messageHandlers;
    const hasSmapIos = !!(window as any).webkit?.messageHandlers?.smapIos;
    const isIOSUserAgent = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    return (hasWebKit && hasMessageHandlers) || (isIOSUserAgent && hasSmapIos);
  }

  /**
   * 전역 에러 핸들링 설정
   */
  private setupGlobalErrorHandling(): void {
    // JavaScript 에러 캐치
    window.addEventListener('error', (event) => {
      this.error(LogCategory.SYSTEM, 'JavaScript 에러 발생', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // Promise rejection 캐치
    window.addEventListener('unhandledrejection', (event) => {
      this.error(LogCategory.SYSTEM, 'Unhandled Promise Rejection', {
        reason: event.reason,
        stack: event.reason?.stack
      });
    });
  }

  /**
   * iOS 네이티브로 로그 전송
   */
  private sendToiOS(level: LogLevel, category: LogCategory, message: string, data?: LogData): void {
    if (!this.isEnabled) return;

    const logEntry = {
      level,
      category,
      message,
      data: data || {},
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.getSessionId()
    };

    // 큐에 추가 (메모리 관리)
    this.logQueue.push(logEntry);
    if (this.logQueue.length > this.maxQueueSize) {
      this.logQueue.shift();
    }

    try {
      // iOS 네이티브로 전송
      if ((window as any).webkit?.messageHandlers?.smapIos) {
        (window as any).webkit.messageHandlers.smapIos.postMessage({
          type: 'jsLog',
          param: JSON.stringify(logEntry)
        });
      }

      // 콘솔에도 출력 (개발 시 편의성)
      const emoji = this.getEmojiForLevel(level);
      const categoryTag = `[${category}]`;
      console.log(`${emoji} ${categoryTag} ${message}`, data || '');
      
    } catch (error) {
      console.error('iOS 로그 전송 실패:', error);
    }
  }

  /**
   * 로그 레벨별 이모지 반환
   */
  private getEmojiForLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '🔍';
      case LogLevel.INFO: return '📝';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.ERROR: return '❌';
      case LogLevel.CRITICAL: return '🚨';
      default: return '📄';
    }
  }

  /**
   * 세션 ID 생성/반환
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('smap_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('smap_session_id', sessionId);
    }
    return sessionId;
  }

  // 로그 레벨별 메서드들
  debug(category: LogCategory, message: string, data?: LogData): void {
    this.sendToiOS(LogLevel.DEBUG, category, message, data);
  }

  info(category: LogCategory, message: string, data?: LogData): void {
    this.sendToiOS(LogLevel.INFO, category, message, data);
  }

  warn(category: LogCategory, message: string, data?: LogData): void {
    this.sendToiOS(LogLevel.WARN, category, message, data);
  }

  error(category: LogCategory, message: string, data?: LogData): void {
    this.sendToiOS(LogLevel.ERROR, category, message, data);
  }

  critical(category: LogCategory, message: string, data?: LogData): void {
    this.sendToiOS(LogLevel.CRITICAL, category, message, data);
  }

  /**
   * API 호출 로깅 (요청/응답 포함)
   */
  logAPICall(apiLog: APICallLog): void {
    this.info(LogCategory.API, `API 호출: ${apiLog.method} ${apiLog.url}`, {
      method: apiLog.method,
      url: apiLog.url,
      headers: apiLog.headers,
      requestBody: apiLog.body,
      responseStatus: apiLog.status,
      responseData: apiLog.response,
      duration: apiLog.duration,
      timestamp: apiLog.timestamp
    });
  }

  /**
   * Google 로그인 관련 로깅
   */
  logGoogleLogin(step: string, data?: LogData): void {
    this.info(LogCategory.GOOGLE_LOGIN, `Google 로그인: ${step}`, {
      step,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * Kakao 로그인 관련 로깅
   */
  logKakaoLogin(step: string, data?: LogData): void {
    this.info(LogCategory.KAKAO_LOGIN, `Kakao 로그인: ${step}`, {
      step,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * 사용자 액션 로깅
   */
  logUserAction(action: string, data?: LogData): void {
    this.info(LogCategory.USER_ACTION, `사용자 액션: ${action}`, {
      action,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * 네트워크 오류 로깅
   */
  logNetworkError(url: string, error: any): void {
    this.error(LogCategory.NETWORK, `네트워크 오류: ${url}`, {
      url,
      error: error.message || error,
      status: error.status,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 로그 큐 내보내기 (디버깅용)
   */
  exportLogs(): any[] {
    return [...this.logQueue];
  }

  /**
   * 로그 큐 초기화
   */
  clearLogs(): void {
    this.logQueue = [];
    this.info(LogCategory.SYSTEM, '로그 큐 초기화 완료');
  }

  /**
   * iOS 네이티브로 대용량 데이터 전송 (청크 단위)
   */
  sendLargeData(category: LogCategory, message: string, data: any): void {
    try {
      const jsonString = JSON.stringify(data);
      const chunkSize = 1000; // 1000자 단위로 분할
      
      if (jsonString.length <= chunkSize) {
        this.info(category, message, data);
        return;
      }

      // 대용량 데이터를 청크로 분할
      const chunks: string[] = [];
      for (let i = 0; i < jsonString.length; i += chunkSize) {
        chunks.push(jsonString.slice(i, i + chunkSize));
      }

      const sessionId = `large_data_${Date.now()}`;
      
      // 첫 번째 청크에 메타데이터 포함
      this.info(category, `${message} (청크 1/${chunks.length})`, {
        sessionId,
        totalChunks: chunks.length,
        chunkIndex: 0,
        chunk: chunks[0],
        isLargeData: true
      });

      // 나머지 청크들 전송
      chunks.slice(1).forEach((chunk, index) => {
        setTimeout(() => {
          this.info(category, `${message} (청크 ${index + 2}/${chunks.length})`, {
            sessionId,
            totalChunks: chunks.length,
            chunkIndex: index + 1,
            chunk,
            isLargeData: true
          });
        }, (index + 1) * 100); // 100ms 간격으로 전송
      });
      
         } catch (error) {
       this.error(LogCategory.SYSTEM, '대용량 데이터 전송 실패', {
         error: error instanceof Error ? error.message : String(error),
         dataSize: JSON.stringify(data).length
       });
     }
  }
}

// 싱글톤 인스턴스 생성
const iosLogger = new IOSLogger();

// 전역 함수들 등록 (개발자 도구에서 사용 가능)
if (typeof window !== 'undefined') {
  (window as any).iosLogger = iosLogger;
  (window as any).exportIOSLogs = () => iosLogger.exportLogs();
  (window as any).clearIOSLogs = () => iosLogger.clearLogs();
}

export default iosLogger; 