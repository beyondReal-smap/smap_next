// 전역 리다이렉트 관리 시스템
// Next.js 라우터를 안전하게 사용하기 위한 유틸리티

interface NavigationManager {
  redirectToSignin: () => void;
  redirectToHome: () => void;
  isRedirecting: boolean;
}

class NavigationManagerImpl implements NavigationManager {
  private _isRedirecting = false;
  private _router: any = null;

  constructor() {
    // Next.js 라우터를 동적으로 로드
    this.loadRouter();
  }

  private async loadRouter() {
    try {
      const { useRouter } = await import('next/navigation');
      // useRouter는 React Hook이므로 여기서 직접 사용할 수 없음
      // 대신 전역 플래그를 사용하여 컴포넌트에서 처리
      console.log('[NAVIGATION] Next.js 라우터 로드 완료');
    } catch (error) {
      console.warn('[NAVIGATION] Next.js 라우터 로드 실패:', error);
    }
  }

  get isRedirecting(): boolean {
    return this._isRedirecting;
  }

  redirectToSignin(): void {
    if (this._isRedirecting) {
      console.log('[NAVIGATION] 이미 리다이렉트 중 - 중복 요청 무시');
      return;
    }

    // 🚫 에러 모달이 표시 중이면 리다이렉트 방지
    if (typeof window !== 'undefined' && (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
      console.log('[NAVIGATION] 🚫 에러 모달 표시 중 - signin 리다이렉트 방지');
      return;
    }

    // 🚫 모든 리다이렉트가 차단된 상태라면 리다이렉트 방지
    if (typeof window !== 'undefined' && (window as any).__BLOCK_ALL_REDIRECTS__) {
      console.log('[NAVIGATION] 🚫 리다이렉트 차단 상태 - signin 리다이렉트 방지');
      return;
    }

    this._isRedirecting = true;
    console.log('[NAVIGATION] signin 페이지로 리다이렉트 시작');

    // 전역 플래그 설정 (컴포넌트에서 감지하여 처리)
    if (typeof window !== 'undefined') {
      (window as any).__REDIRECT_TO_SIGNIN__ = true;
      (window as any).__REDIRECT_TIMESTAMP__ = Date.now();
    }

    // 3초 후 플래그 자동 정리
    setTimeout(() => {
      this._isRedirecting = false;
      if (typeof window !== 'undefined') {
        delete (window as any).__REDIRECT_TO_SIGNIN__;
        delete (window as any).__REDIRECT_TIMESTAMP__;
      }
    }, 3000);
  }

  redirectToHome(): void {
    if (this._isRedirecting) {
      console.log('[NAVIGATION] 이미 리다이렉트 중 - 중복 요청 무시');
      return;
    }

    this._isRedirecting = true;
    console.log('[NAVIGATION] 홈 페이지로 리다이렉트 시작');

    // 전역 플래그 설정 (컴포넌트에서 감지하여 처리)
    if (typeof window !== 'undefined') {
      (window as any).__REDIRECT_TO_HOME__ = true;
      (window as any).__REDIRECT_TIMESTAMP__ = Date.now();
    }

    // 3초 후 플래그 자동 정리
    setTimeout(() => {
      this._isRedirecting = false;
      if (typeof window !== 'undefined') {
        delete (window as any).__REDIRECT_TO_HOME__;
        delete (window as any).__REDIRECT_TIMESTAMP__;
      }
    }, 3000);
  }
}

// 전역 인스턴스 생성
const navigationManager = new NavigationManagerImpl();

export default navigationManager; 