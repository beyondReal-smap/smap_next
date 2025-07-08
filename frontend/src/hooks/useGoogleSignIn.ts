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
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // iOS 환경인지 확인
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroidDevice = /Android/.test(navigator.userAgent);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    if (isIOSDevice || isAndroidDevice) {
      // iOS/Android에서 Google Sign-In 콜백 함수들을 전역으로 등록
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
        // 에러 메시지를 한글로 변환
        let userFriendlyMessage = errorMessage;
        if (errorMessage.includes('cancelled') || errorMessage.includes('canceled') || errorMessage.includes('The user canceled the sign-in-flow')) {
          userFriendlyMessage = '로그인을 취소했습니다.';
        } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
          userFriendlyMessage = '네트워크 연결을 확인하고 다시 시도해주세요.';
        } else if (errorMessage.includes('configuration') || errorMessage.includes('Configuration')) {
          userFriendlyMessage = 'Google 로그인 설정에 문제가 있습니다. 앱을 다시 시작해주세요.';
        }
        
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: userFriendlyMessage
        }));
        console.error('Google Sign-In 오류:', userFriendlyMessage);
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
      if (isIOSDevice || isAndroidDevice) {
        delete (window as any).googleSignInSuccess;
        delete (window as any).googleSignInError;
        delete (window as any).googleSignOutSuccess;
        delete (window as any).googleSignInStatusResult;
      }
    };
  }, []);

  // Google 로그인 시작
  const signIn = useCallback(() => {
    if (!isIOS && !isAndroid) {
      console.warn('Google Sign-In은 iOS/Android에서만 지원됩니다.');
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    // Android 브리지 사용
    if (isAndroid && (window as any).androidBridge?.googleSignIn?.signIn) {
      (window as any).androidBridge.googleSignIn.signIn();
    }
    // iOS 브리지 사용
    else if (isIOS && (window as any).iosBridge?.googleSignIn?.signIn) {
      (window as any).iosBridge.googleSignIn.signIn();
    } else {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Google Sign-In을 사용할 수 없습니다.'
      }));
    }
  }, [isIOS, isAndroid]);

  // Google 로그아웃
  const signOut = useCallback(() => {
    if (!isIOS && !isAndroid) {
      console.warn('Google Sign-In은 iOS/Android에서만 지원됩니다.');
      return;
    }

    if (isAndroid && (window as any).androidBridge?.googleSignIn?.signOut) {
      (window as any).androidBridge.googleSignIn.signOut();
    } else if (isIOS && (window as any).iosBridge?.googleSignIn?.signOut) {
      (window as any).iosBridge.googleSignIn.signOut();
    }
  }, [isIOS, isAndroid]);

  // 현재 로그인 상태 확인
  const checkSignInStatus = useCallback(() => {
    if (!isIOS && !isAndroid) {
      return;
    }

    if (isAndroid && (window as any).androidBridge?.googleSignIn?.checkStatus) {
      (window as any).androidBridge.googleSignIn.checkStatus();
    } else if (isIOS && (window as any).iosBridge?.googleSignIn?.checkStatus) {
      (window as any).iosBridge.googleSignIn.checkStatus();
    }
  }, [isIOS, isAndroid]);

  // 에러 상태 초기화
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    isIOS,
    isAndroid,
    signIn,
    signOut,
    checkSignInStatus,
    clearError
  };
} 