import { useEffect, useState, useCallback } from 'react';

interface GoogleUser {
  email: string;
  name: string;
  givenName: string;
  familyName: string;
  imageURL: string;
}

interface GoogleSignInState {
  isSignedIn: boolean;
  user: GoogleUser | null;
  isLoading: boolean;
  error: string | null;
}

export function useGoogleSignIn() {
  const [state, setState] = useState<GoogleSignInState>({
    isSignedIn: false,
    user: null,
    isLoading: false,
    error: null
  });

  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // iOS 환경인지 확인
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // iOS에서 Google Sign-In 콜백 함수들을 전역으로 등록
      (window as any).googleSignInSuccess = (idToken: string, userInfoJson: string) => {
        try {
          const userInfo = JSON.parse(userInfoJson) as GoogleUser;
          setState({
            isSignedIn: true,
            user: userInfo,
            isLoading: false,
            error: null
          });
          
          console.log('Google Sign-In 성공:', { idToken, userInfo });
        } catch (error) {
          console.error('Google Sign-In 사용자 정보 파싱 오류:', error);
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: '사용자 정보를 처리하는 중 오류가 발생했습니다.'
          }));
        }
      };

      (window as any).googleSignInError = (errorMessage: string) => {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage
        }));
        console.error('Google Sign-In 오류:', errorMessage);
      };

      (window as any).googleSignOutSuccess = () => {
        setState({
          isSignedIn: false,
          user: null,
          isLoading: false,
          error: null
        });
        console.log('Google Sign-Out 성공');
      };

      (window as any).googleSignInStatusResult = (isSignedIn: boolean, userInfoJson: string | null) => {
        if (isSignedIn && userInfoJson) {
          try {
            const userInfo = JSON.parse(userInfoJson) as GoogleUser;
            setState({
              isSignedIn: true,
              user: userInfo,
              isLoading: false,
              error: null
            });
          } catch (error) {
            console.error('Google Sign-In 상태 정보 파싱 오류:', error);
          }
        } else {
          setState({
            isSignedIn: false,
            user: null,
            isLoading: false,
            error: null
          });
        }
      };

      // 초기 로그인 상태 확인
      checkSignInStatus();
    }

    // 컴포넌트 언마운트 시 전역 함수 정리
    return () => {
      if (isIOSDevice) {
        delete (window as any).googleSignInSuccess;
        delete (window as any).googleSignInError;
        delete (window as any).googleSignOutSuccess;
        delete (window as any).googleSignInStatusResult;
      }
    };
  }, []);

  // Google 로그인 시작
  const signIn = useCallback(() => {
    if (!isIOS) {
      console.warn('Google Sign-In은 iOS에서만 지원됩니다.');
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    if ((window as any).iosBridge?.googleSignIn?.signIn) {
      (window as any).iosBridge.googleSignIn.signIn();
    } else {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Google Sign-In을 사용할 수 없습니다.'
      }));
    }
  }, [isIOS]);

  // Google 로그아웃
  const signOut = useCallback(() => {
    if (!isIOS) {
      console.warn('Google Sign-In은 iOS에서만 지원됩니다.');
      return;
    }

    if ((window as any).iosBridge?.googleSignIn?.signOut) {
      (window as any).iosBridge.googleSignIn.signOut();
    }
  }, [isIOS]);

  // 현재 로그인 상태 확인
  const checkSignInStatus = useCallback(() => {
    if (!isIOS) {
      return;
    }

    if ((window as any).iosBridge?.googleSignIn?.checkStatus) {
      (window as any).iosBridge.googleSignIn.checkStatus();
    }
  }, [isIOS]);

  // 에러 상태 초기화
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    isIOS,
    signIn,
    signOut,
    checkSignInStatus,
    clearError
  };
} 