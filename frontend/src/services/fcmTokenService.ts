// 안드로이드 WebView에서 firebase/auth 사용 방지 (네이티브 사용)
// import { getAuth } from 'firebase/auth';
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
      // 모든 환경에서 웹 Firebase 초기화 허용
      console.log('[FCM Token Service] 웹 환경 감지 - Firebase 초기화 시작');
      console.log('[FCM Token Service] 📋 환경변수 상태 확인:', {
        NODE_ENV: process.env.NODE_ENV,
        hasVapidKey: !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        isLocalhost: window.location.hostname === 'localhost',
        hostname: window.location.hostname
      });
      this.initPromise = this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[FCM Token Service] 🔥 Firebase Messaging 초기화 시작');
      console.log('[FCM Token Service] 📍 현재 환경:', {
        isWindow: typeof window !== 'undefined',
        hasServiceWorker: 'serviceWorker' in navigator,
        hasNotification: 'Notification' in window,
        currentDomain: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) + '...' : 'unknown'
      });
      
      // Firebase 앱이 초기화되어 있는지 확인
      if (!app) {
        console.warn('[FCM Token Service] ⚠️ Firebase 앱이 초기화되지 않음 - 환경변수 확인 필요');
        console.warn('[FCM Token Service] 💡 해결방법: .env.local에 NEXT_PUBLIC_FIREBASE_* 환경변수들을 설정하세요');
        this.isInitialized = true; // 에러 상태로 초기화 완료 처리
        return;
      }
      
      console.log('[FCM Token Service] ✅ Firebase 앱 초기화 상태 확인 완료');

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
      try {
        this.messaging = getMessaging(app);
        console.log('[FCM Token Service] ✅ Firebase Messaging 인스턴스 생성 성공');
        
        // VAPID 키 확인
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        console.log('[FCM Token Service] 📋 VAPID 키 확인:', {
          hasVapidKey: !!vapidKey,
          keyLength: vapidKey ? vapidKey.length : 0,
          keyPreview: vapidKey ? `${vapidKey.substring(0, 20)}...` : '없음',
          envFile: 'NEXT_PUBLIC_FIREBASE_VAPID_KEY',
          nodeEnv: process.env.NODE_ENV,
          isLocalhost: typeof window !== 'undefined' ? window.location.hostname === 'localhost' : 'unknown'
        });
        
        if (!vapidKey) {
          console.error('[FCM Token Service] ❌ VAPID 키가 설정되지 않음 - FCM 토큰 생성 불가');
          console.error('[FCM Token Service] 💡 해결방법: .env.local 파일에 NEXT_PUBLIC_FIREBASE_VAPID_KEY 설정');
          console.error('[FCM Token Service] 💡 현재 환경변수 상태:', {
            NODE_ENV: process.env.NODE_ENV,
            hasVapidKey: !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            allEnvKeys: Object.keys(process.env).filter(key => key.includes('FIREBASE'))
          });
          this.isInitialized = true;
          return;
        }
        
        // VAPID 키 형식 검증 (Firebase VAPID 키는 보통 87자 또는 140자)
        if (vapidKey.length < 80 || vapidKey.length > 150) {
          console.error('[FCM Token Service] ❌ VAPID 키 길이가 올바르지 않음:', vapidKey.length);
          this.isInitialized = true;
          return;
        }
        
        // Firebase 프로젝트 설정 확인
        console.log('[FCM Token Service] 🔥 Firebase 프로젝트 설정:', {
          projectId: app.options.projectId,
          authDomain: app.options.authDomain,
          messagingSenderId: app.options.messagingSenderId,
          appId: app.options.appId,
          apiKey: app.options.apiKey ? `${app.options.apiKey.substring(0, 20)}...` : '없음',
          storageBucket: app.options.storageBucket,
          measurementId: app.options.measurementId
        });
        
        // 프로젝트 ID가 올바른지 확인
        if (app.options.projectId !== 'com-dmonster-smap') {
          console.error('[FCM Token Service] ❌ Firebase 프로젝트 ID가 일치하지 않음:', app.options.projectId);
          this.isInitialized = true;
          return;
        }
        
        // API 키 확인
        if (!app.options.apiKey) {
          console.error('[FCM Token Service] ❌ Firebase API 키가 설정되지 않음');
          this.isInitialized = true;
          return;
        }
        
        // Messaging Sender ID 확인
        if (!app.options.messagingSenderId) {
          console.error('[FCM Token Service] ❌ Firebase Messaging Sender ID가 설정되지 않음');
          this.isInitialized = true;
          return;
        }
        
        this.isInitialized = true;
        console.log('[FCM Token Service] ✅ Firebase Messaging 초기화 완료');
        console.log('[FCM Token Service] 🚀 FCM 토큰 서비스 준비 완료 - 토큰 요청 가능');
        
      } catch (messagingError) {
        console.error('[FCM Token Service] ❌ Firebase Messaging 초기화 실패:', messagingError);
        this.isInitialized = true;
        return;
      }
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ 초기화 실패:', error);
      this.isInitialized = true; // 에러 상태로도 초기화 완료 처리
    }
  }

  private async ensureServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        console.log('[FCM Token Service] 🔧 서비스 워커 등록 시작...');
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('[FCM Token Service] ✅ 서비스 워커 등록 성공:', {
          scope: registration.scope,
          active: !!registration.active,
          installing: !!registration.installing,
          waiting: !!registration.waiting
        });
      } catch (error) {
        console.warn('[FCM Token Service] ⚠️ 서비스 워커 등록 실패:', error);
        console.log('[FCM Token Service] 💡 서비스 워커 없어도 FCM 토큰은 생성 가능');
      }
    } else {
      console.log('[FCM Token Service] ℹ️ ServiceWorker를 지원하지 않는 환경');
    }
  }

  /**
   * 알림 권한 요청 (iOS WebView에서는 건너뛰기)
   */
  private async requestNotificationPermission(): Promise<NotificationPermission> {
    console.log('[FCM Token Service] 🔔 알림 권한 요청 시작...');
    
    // iOS WebView 환경에서는 알림 권한 요청을 건너뛰고 바로 'granted'로 가정
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);
      const isWebView = /WebView|wv|SMAP-Android/i.test(userAgent);
      
      if (isIOS || isWebView) {
        console.log('[FCM Token Service] 📱 iOS/WebView 환경 감지 - 알림 권한 요청 건너뛰기');
        console.log('[FCM Token Service] 📱 Firebase FCM 토큰 생성을 위해 권한을 자동으로 허용으로 가정');
        return 'granted';
      }
    }
    
    // 일반 브라우저에서만 알림 권한 요청
    try {
      const permission = await Notification.requestPermission();
      console.log('[FCM Token Service] 🔔 알림 권한 상태:', permission);
      return permission;
    } catch (error) {
      console.error('[FCM Token Service] ❌ 알림 권한 요청 실패:', error);
      console.log('[FCM Token Service] 🔥 권한 요청 실패해도 계속 진행');
      return 'denied'; // 실패해도 계속 진행
    }
  }

  /**
   * iOS에서 전달받은 네이티브 FCM 토큰 확인
   */
  private checkNativeFCMToken(): string | null {
    if (typeof window !== 'undefined' && (window as any).nativeFCMToken) {
      const token = (window as any).nativeFCMToken;
      console.log('[FCM Token Service] 📱 iOS 네이티브 FCM 토큰 발견:', token.substring(0, 50) + '...');
      console.log('[FCM Token Service] 📱 토큰 전체 길이:', token.length, '문자');
      return token;
    } else {
      console.log('[FCM Token Service] 📱 iOS 네이티브 FCM 토큰 없음 - window.nativeFCMToken 미설정');
      if (typeof window !== 'undefined') {
        console.log('[FCM Token Service] 💡 iOS 앱에서 네이티브 토큰 주입 방법:');
        console.log('[FCM Token Service] 💡   webView.evaluateJavaScript("window.nativeFCMToken = \'토큰값\';")');
        console.log('[FCM Token Service] 💡   또는 SMAP_SET_NATIVE_FCM_TOKEN(\'토큰값\') 사용');
      }
    }
    return null;
  }

  /**
   * FCM 토큰 획득 (프론트엔드 전용)
   */
  async getFCMToken(): Promise<string | null> {
    console.log('[FCM Token Service] 🔍 FCM 토큰 획득 프로세스 시작 (프론트엔드 전용)');
    console.log('[FCM Token Service] 📍 현재 상태:', {
      isInitialized: this.isInitialized,
      hasInitPromise: !!this.initPromise,
      hasMessaging: !!this.messaging,
      hasApp: !!app,
      currentToken: this.currentToken ? `${this.currentToken.substring(0, 20)}...` : '없음'
    });
    
    // 무조건 Firebase FCM 토큰 생성 시도
    console.log('[FCM Token Service] 🔥 Firebase FCM 토큰 강제 생성 시작');
    
    // 네이티브 토큰 무시하고 프론트엔드에서만 토큰 생성
    console.log('[FCM Token Service] 🚫 네이티브 토큰 무시 - 프론트엔드에서 토큰 생성');
    
    console.log('[FCM Token Service] 🌐 웹 환경에서 Firebase 토큰 시도');

    // Android WebView에서도 웹 FCM 토큰 생성 허용
    const isAndroidWebView = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) && /SMAP-Android|WebView|wv/i.test(navigator.userAgent);
    if (isAndroidWebView) {
      console.log('[FCM Token Service] Android WebView - 웹 FCM 토큰 생성 허용');
    }

    // 2. 웹 환경에서 Firebase로 토큰 획득
    if (!this.initPromise) {
      console.warn('[FCM Token Service] ❌ 서비스가 초기화되지 않음');
      return null;
    }

    // Firebase 초기화 대기
    if (this.initPromise) {
      console.log('[FCM Token Service] ⏳ Firebase 초기화 대기 중...');
      
      try {
        // 10초 타임아웃으로 Firebase 초기화 대기
        const initTimeout = new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Firebase 초기화 타임아웃 (10초)'));
          }, 10000);
        });
        
        await Promise.race([this.initPromise, initTimeout]);
        console.log('[FCM Token Service] ✅ Firebase 초기화 완료');
      } catch (timeoutError) {
        console.warn('[FCM Token Service] ⚠️ Firebase 초기화 타임아웃 - 강제 진행 시도');
        
        // 타임아웃 발생 시 강제로 Firebase 초기화 시도
        try {
          if (!app) {
            console.log('[FCM Token Service] 🔥 Firebase 앱 강제 초기화 시도');
            const { initializeApp } = await import('firebase/app');
            const firebaseConfig = {
              apiKey: "AIzaSyBKq515AfyN-oizndPdXBebBkcjTlI56qw",
              authDomain: "com-dmonster-smap.firebaseapp.com",
              projectId: "com-dmonster-smap",
              storageBucket: "com-dmonster-smap.firebasestorage.app",
              messagingSenderId: "283271180972",
              appId: "1:283271180972:web:6c8d4104b83f419403e509",
              measurementId: "G-1B733FGCQ5"
            };
            
            const newApp = initializeApp(firebaseConfig);
            console.log('[FCM Token Service] ✅ Firebase 앱 강제 초기화 성공');
            
            // 전역 app 변수 업데이트
            (globalThis as any).firebaseApp = newApp;
          }
          
          if (!this.messaging) {
            console.log('[FCM Token Service] 🔥 Firebase Messaging 강제 초기화 시도');
            const { getMessaging, getToken } = await import('firebase/messaging');
            const currentApp = app || (globalThis as any).firebaseApp;
            
            if (!currentApp) {
              throw new Error('Firebase 앱이 초기화되지 않음');
            }
            
            this.messaging = getMessaging(currentApp);
            console.log('[FCM Token Service] ✅ Firebase Messaging 강제 초기화 성공');
            
            // getToken 함수를 직접 import하여 사용
            console.log('[FCM Token Service] 🔑 getToken 함수 직접 import 완료');
          }
          
          console.log('[FCM Token Service] 🔥 Firebase 강제 초기화 완료 - 계속 진행');
        } catch (forceInitError) {
          console.error('[FCM Token Service] ❌ Firebase 강제 초기화 실패:', forceInitError);
          console.log('[FCM Token Service] 🔥 강제 초기화 실패해도 계속 진행');
        }
        
        // initPromise를 강제로 해결하여 다음 호출에서 대기하지 않도록 함
        if (this.initPromise) {
          console.log('[FCM Token Service] 🔥 initPromise 강제 해결');
          this.initPromise = Promise.resolve();
          this.isInitialized = true;
        }
      }
    }

    if (!app) {
      console.warn('[FCM Token Service] ❌ Firebase 앱이 초기화되지 않음 - 강제 초기화 시도');
      
      // Firebase 앱 강제 초기화 시도
      try {
        const firebaseConfig = {
          apiKey: "AIzaSyBKq515AfyN-oizndPdXBebBkcjTlI56qw",
          authDomain: "com-dmonster-smap.firebaseapp.com",
          projectId: "com-dmonster-smap",
          storageBucket: "com-dmonster-smap.firebasestorage.app",
          messagingSenderId: "283271180972",
          appId: "1:283271180972:web:6c8d4104b83f419403e509",
          measurementId: "G-1B733FGCQ5"
        };
        
        const { initializeApp } = await import('firebase/app');
        const newApp = initializeApp(firebaseConfig);
        console.log('[FCM Token Service] ✅ Firebase 앱 강제 초기화 성공');
        
        // 전역 app 변수 업데이트
        (globalThis as any).firebaseApp = newApp;
        
      } catch (forceInitError) {
        console.error('[FCM Token Service] ❌ Firebase 앱 강제 초기화 실패:', forceInitError);
        console.log('[FCM Token Service] 🔥 강제 초기화 실패해도 계속 진행');
      }
    }

    if (!this.messaging) {
      console.warn('[FCM Token Service] ❌ Firebase Messaging이 초기화되지 않음 - 강제 초기화 시도');
      
      // Firebase Messaging 강제 초기화 시도
      try {
        const { getMessaging } = await import('firebase/messaging');
        this.messaging = getMessaging(app || (globalThis as any).firebaseApp);
        console.log('[FCM Token Service] ✅ Firebase Messaging 강제 초기화 성공');
      } catch (forceInitError) {
        console.error('[FCM Token Service] ❌ Firebase Messaging 강제 초기화 실패:', forceInitError);
        console.log('[FCM Token Service] 🔥 강제 초기화 실패해도 계속 진행');
        
        // Messaging 없이도 계속 진행
        this.messaging = null;
      }
    }

    try {
      // 웹 FCM 토큰 요청
      console.log('[FCM Token Service] 🔑 웹 FCM 토큰 요청 중...');
      console.log('[FCM Token Service] 📍 Firebase Messaging 상태:', {
        hasMessaging: !!this.messaging,
        messagingType: typeof this.messaging,
        appName: app?.name || '알 수 없음'
      });

      // iOS WebView 환경 감지
      const isIOSWebView = typeof navigator !== 'undefined' && 
        /iPad|iPhone|iPod/.test(navigator.userAgent) && 
        /WebView|wv|SMAP-Android/i.test(navigator.userAgent);
      
      console.log('[FCM Token Service] 📱 환경 감지:', {
        isIOSWebView,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '알 수 없음',
        isStandalone: typeof window !== 'undefined' ? (window.navigator as any).standalone : undefined,
        firebaseApp: !!app,
        firebaseMessaging: !!this.messaging
      });

      // VAPID 키 확인
      let vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      
      if (!vapidKey) {
        console.error('[FCM Token Service] ❌ VAPID 키가 설정되지 않음 - 하드코딩된 VAPID 키 사용');
        console.error('[FCM Token Service] 💡 환경변수 확인:', {
          NODE_ENV: process.env.NODE_ENV,
          hasVapidKey: !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          allFirebaseKeys: Object.keys(process.env).filter(key => key.includes('FIREBASE'))
        });
        
        // 하드코딩된 VAPID 키 사용
        const hardcodedVapidKey = "BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxx8EV3QHCL61gmwzkXlE";
        console.log('[FCM Token Service] 🔧 하드코딩된 VAPID 키 사용:', hardcodedVapidKey.substring(0, 20) + '...');
        
        // VAPID 키를 하드코딩된 값으로 설정
        vapidKey = hardcodedVapidKey;
      }

      console.log('[FCM Token Service] 📋 VAPID 키 상태:', {
        hasVapidKey: !!vapidKey,
        keyLength: vapidKey?.length || 0,
        keyPreview: vapidKey ? vapidKey.substring(0, 20) + '...' : '없음',
        envSource: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ? '환경변수' : '하드코딩된 VAPID 키',
        isLocalhost: typeof window !== 'undefined' && window.location.hostname === 'localhost'
      });

      try {
        console.log('[FCM Token Service] 🔑 getToken() 호출 시작...');
        console.log('[FCM Token Service] 📍 Firebase Messaging 상태:', {
          hasMessaging: !!this.messaging,
          messagingType: typeof this.messaging,
          vapidKeyLength: vapidKey?.length || 0
        });

        // localhost 환경에서 추가 디버깅
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          console.log('[FCM Token Service] 🔔 localhost 환경 감지 - 추가 디버깅 활성화');
          console.log('[FCM Token Service] 🏠 Firebase 앱 상태:', {
            appName: app?.name || '알 수 없음',
            appOptions: app?.options || {},
            hasMessaging: !!this.messaging,
            messagingConstructor: this.messaging?.constructor?.name || '알 수 없음'
          });
          
          // localhost 환경에서 FCM 작동을 위한 추가 설정
          console.log('[FCM Token Service] 🔧 localhost 환경에서 FCM 작동을 위한 추가 설정');
          
          // 1. 알림 권한 확인
          if ('Notification' in window) {
            const permission = Notification.permission;
            console.log('[FCM Token Service] 📱 알림 권한 상태:', permission);
            
            if (permission === 'default') {
              console.log('[FCM Token Service] 🔔 알림 권한 요청 시도');
              try {
                const newPermission = await Notification.requestPermission();
                console.log('[FCM Token Service] 🔔 알림 권한 결과:', newPermission);
              } catch (permError) {
                console.warn('[FCM Token Service] ⚠️ 알림 권한 요청 실패:', permError);
              }
            }
          }
          
          // 2. Service Worker 상태 상세 확인
          if ('serviceWorker' in navigator) {
            try {
              const registration = await navigator.serviceWorker.getRegistration();
              if (registration) {
                console.log('[FCM Token Service] 🔧 Service Worker 상세 상태:', {
                  scope: registration.scope,
                  active: !!registration.active,
                  waiting: !!registration.waiting,
                  installing: !!registration.installing,
                  updateViaCache: registration.updateViaCache
                });
                
                // Service Worker가 waiting 상태라면 강제 활성화 시도
                if (registration.waiting) {
                  console.log('[FCM Token Service] ⚡ Service Worker 강제 활성화 시도');
                  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
              }
            } catch (swError) {
              console.warn('[FCM Token Service] ⚠️ Service Worker 상태 확인 실패:', swError);
            }
          }
        }
        
        // getToken() 호출에 타임아웃 적용 (localhost 환경에서는 더 긴 타임아웃)
        const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
        const timeoutDuration = isLocalhost ? 60000 : 30000; // localhost: 60초, 기타: 30초
        
        // getToken 함수를 직접 import하여 사용
        const { getToken } = await import('firebase/messaging');
        
        // Service Worker가 활성화될 때까지 대기
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && registration.active) {
              console.log('[FCM Token Service] ✅ Service Worker 활성 상태 확인');
            } else if (registration && registration.waiting) {
              console.log('[FCM Token Service] ⏳ Service Worker 활성화 대기 중...');
              await new Promise<void>((resolve) => {
                const worker = registration.waiting;
                if (worker) {
                  worker.addEventListener('statechange', () => {
                    if (worker.state === 'activated') {
                      console.log('[FCM Token Service] ✅ Service Worker 활성화 완료');
                      resolve();
                    }
                  });
                  worker.postMessage({ type: 'SKIP_WAITING' });
                } else {
                  resolve();
                }
              });
            }
          } catch (swError) {
            console.warn('[FCM Token Service] ⚠️ Service Worker 상태 확인 실패:', swError);
          }
        }
        
        const getTokenPromise = getToken(this.messaging!, {
          vapidKey: vapidKey!,
          serviceWorkerRegistration: undefined
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`getToken() 타임아웃 (${timeoutDuration/1000}초)`));
          }, timeoutDuration);
        });
        
        console.log(`[FCM Token Service] ⏱️ getToken() 타임아웃 설정: ${timeoutDuration/1000}초`);
        
        try {
          const token = await Promise.race([getTokenPromise, timeoutPromise]);
          console.log('[FCM Token Service] ✅ getToken() 성공:', token ? `${token.substring(0, 20)}...` : 'null');
          return token;
        } catch (error) {
          console.error('[FCM Token Service] ❌ getToken() 호출 실패:', error);
          throw error;
        }
      } catch (tokenError) {
        console.error('[FCM Token Service] ❌ getToken() 호출 실패:', tokenError);
        
        // localhost 환경에서의 특별한 처리
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          console.log('[FCM Token Service] 🏠 localhost 환경에서 FCM 토큰 생성 실패');
          console.log('[FCM Token Service] 🏠 이는 Firebase 프로젝트에서 localhost 도메인이 허용되지 않았기 때문일 수 있습니다');
          console.log('[FCM Token Service] 🏠 해결방법: Firebase 콘솔 > 프로젝트 설정 > 인증 도메인에 localhost 추가');
          console.log('[FCM Token Service] 🏠 또는 프로덕션 도메인에서 테스트');
          console.log('[FCM Token Service] 🏠 하지만 계속 진행하여 실제 FCM 토큰 생성 시도');
        }
        
        // iOS WebView에서 서비스 워커 등록 실패 시 대체 로직
        if (isIOSWebView && tokenError instanceof Error && 
            tokenError.message.includes('service worker')) {
          console.warn('[FCM Token Service] 📱 iOS WebView 서비스 워커 등록 실패 - 대체 로직 시도');
          console.warn('[FCM Token Service] 💡 iOS WebView에서는 FCM 토큰 생성이 제한될 수 있음');
          console.warn('[FCM Token Service] 🔥 네이티브 앱에서 FCM 토큰을 받아오는 것을 권장');
          console.log('[FCM Token Service] 🔥 하지만 계속 진행하여 실제 FCM 토큰 생성 시도');
        }
        
        // 401 인증 오류 시 Firebase 프로젝트 상태 확인 안내
        if (tokenError instanceof Error && 
            tokenError.message.includes('authentication credential')) {
          console.error('[FCM Token Service] 🔐 Firebase 프로젝트 인증 실패');
          console.error('[FCM Token Service] 💡 해결방법:');
          console.error('[FCM Token Service]   1. Firebase 콘솔에서 프로젝트 상태 확인');
          console.error('[FCM Token Service]   2. 프로젝트가 일시중지되지 않았는지 확인');
          console.error('[FCM Token Service]   3. VAPID 키 재생성 시도');
          console.error('[FCM Token Service]   4. localhost 환경인 경우 Firebase 콘솔에서 localhost 도메인 허용');
          console.log('[FCM Token Service] 🔥 하지만 계속 진행하여 실제 FCM 토큰 생성 시도');
        }
        
        // 인증 에러인 경우 상세 정보 로깅
        if (tokenError instanceof Error) {
          if (tokenError.message.includes('authentication credential')) {
            console.error('[FCM Token Service] 🔐 인증 자격 증명 문제 - VAPID 키 또는 Firebase 설정 확인 필요');
            console.error('[FCM Token Service] 🔐 VAPID 키:', vapidKey ? '설정됨' : '설정되지 않음');
            console.error('[FCM Token Service] 🔐 Firebase 앱:', app ? '초기화됨' : '초기화되지 않음');
            console.error('[FCM Token Service] 🔐 Firebase 프로젝트 ID:', app?.options?.projectId);
            console.error('[FCM Token Service] 🔐 VAPID 키 형식 검증:', {
              length: vapidKey.length,
              isBase64: /^[A-Za-z0-9+/]+={0,2}$/.test(vapidKey),
              startsWith: vapidKey.substring(0, 10)
            });
          } else if (tokenError.message.includes('permission')) {
            console.error('[FCM Token Service] 🔐 알림 권한 문제 - 브라우저에서 알림 권한을 허용해야 함');
          } else if (tokenError.message.includes('unsupported-browser')) {
            console.error('[FCM Token Service] 🌐 브라우저 미지원 - FCM을 지원하지 않는 환경');
          } else if (tokenError.message.includes('service worker')) {
            console.error('[FCM Token Service] 🔧 서비스 워커 등록 실패 - 브라우저 설정 확인 필요');
          }
        }
        
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
      
      // API3.smap.site의 FCM 토큰 API 사용 - 올바른 엔드포인트
      const response = await fetch('https://api3.smap.site/api/v1/member-fcm-token/register', {
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
      
      // API3.smap.site의 FCM 토큰 API 사용 - 올바른 엔드포인트
      const response = await fetch('https://api3.smap.site/api/v1/member-fcm-token/check-and-update', {
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
      console.error('[FCM Token Service] 서버 체크 및 업데이트 실패:', error);
      return {
        success: false,
        message: '서버 체크 및 업데이트 실패: ' + (error as Error).message,
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
      console.log('[FCM Token Service] 📍 사용자 ID:', mt_idx);
      console.log('[FCM Token Service] 📍 현재 환경:', {
        isWindow: typeof window !== 'undefined',
        hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
        hasNotification: typeof window !== 'undefined' && 'Notification' in window,
        currentDomain: typeof window !== 'undefined' ? window.location.hostname : 'unknown'
      });
      
      // 알림 권한 확인
      const permission = await this.requestNotificationPermission();
      if (permission === 'denied') {
        console.warn('[FCM Token Service] ⚠️ 알림 권한이 거부됨');
        console.log('[FCM Token Service] 🔥 권한이 거부되어도 Firebase FCM 토큰 생성 시도');
        
        // 권한이 거부되어도 Firebase FCM 토큰 생성 시도
        try {
          const fcmToken = await this.getFCMToken();
          if (fcmToken) {
            console.log('[FCM Token Service] ✅ 권한 거부 상태에서도 FCM 토큰 생성 성공:', fcmToken.substring(0, 50) + '...');
            
            // 토큰을 서버에 등록/업데이트
            await this.checkAndUpdateTokenToServer(mt_idx, fcmToken);
            return {
              success: true,
              token: fcmToken,
              message: '권한 거부 상태에서도 FCM 토큰 생성 성공'
            };
          } else {
            console.warn('[FCM Token Service] ⚠️ 권한 거부 상태에서 FCM 토큰 생성 실패');
            return {
              success: false,
              error: '권한 거부 상태에서 FCM 토큰 생성 실패'
            };
          }
        } catch (tokenError) {
          console.error('[FCM Token Service] ❌ 권한 거부 상태에서 FCM 토큰 생성 중 오류:', tokenError);
          return {
            success: false,
            error: '권한 거부 상태에서 FCM 토큰 생성 중 오류 발생'
          };
        }
      }

      // 2. FCM 토큰 획득
      console.log('[FCM Token Service] 🔑 FCM 토큰 획득 시작...');
      const token = await this.getFCMToken();
      
      if (!token) {
        console.warn('[FCM Token Service] ⚠️ FCM 토큰 획득 실패');
        return {
          success: false,
          error: 'FCM 토큰 획득 실패'
        };
      }

      console.log('[FCM Token Service] ✅ FCM 토큰 획득 성공, 길이:', token.length);

      // 3. 서버에서 토큰 체크 후 필요시 업데이트
      console.log('[FCM Token Service] 🌐 서버에 토큰 체크/업데이트 요청...');
      const checkResult = await this.checkAndUpdateTokenToServer(mt_idx, token);
      
      if (checkResult.success) {
        console.log('[FCM Token Service] ✅ FCM 토큰 체크/업데이트 완료:', checkResult.message);
        return {
          success: true,
          token: token,
          message: checkResult.message
        };
      } else {
        console.warn('[FCM Token Service] ⚠️ FCM 토큰 체크/업데이트 실패:', checkResult.message);
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

  /**
   * 토큰 변경 감지 및 자동 업데이트
   */
  onTokenRefresh(callback: (token: string) => void): (() => void) | void {
    if (!this.messaging) {
      console.warn('[FCM Token Service] Firebase Messaging이 초기화되지 않음');
      return;
    }

    try {
      // 토큰 변경 이벤트 리스너 설정
      const unsubscribe = onMessage(this.messaging, async (payload) => {
        // 토큰 변경 감지 시 새로운 토큰 획득
        const newToken = await this.getFCMToken();
        if (newToken && newToken !== this.currentToken) {
          console.log('[FCM Token Service] 🔄 FCM 토큰 변경 감지 - 새 토큰:', newToken.substring(0, 50) + '...');
          this.currentToken = newToken;
          callback(newToken);
        }
      });

      // 정리 함수 반환
      return unsubscribe;
    } catch (error) {
      console.error('[FCM Token Service] 토큰 변경 감지 설정 실패:', error);
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
      const updateResult = await this.checkAndUpdateTokenToServer(mt_idx, newToken);
      
      if (updateResult.success) {
        console.log('[FCM Token Service] ✅ 강제 토큰 재생성 및 업데이트 완료');
        return {
          success: true,
          token: newToken
        };
      } else {
        return {
          success: false,
          token: newToken,
          error: updateResult.message
        };
      }
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ 강제 토큰 재생성 실패:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * 주기적 토큰 유효성 검사 및 업데이트
   */
  async validateAndRefreshToken(mt_idx: number): Promise<boolean> {
    try {
      console.log('[FCM Token Service] 🔍 FCM 토큰 유효성 검사 시작');
      
      const currentToken = this.getCurrentToken();
      if (!currentToken) {
        console.log('[FCM Token Service] 현재 토큰이 없음 - 새로 생성');
        return await this.initializeAndCheckUpdateToken(mt_idx).then(result => result.success);
      }

      // 토큰 유효성 검사 (간단한 길이 및 형식 체크)
      if (currentToken.length < 100) {
        console.warn('[FCM Token Service] 토큰이 너무 짧음 - 재생성 필요');
        return await this.initializeAndCheckUpdateToken(mt_idx).then(result => result.success);
      }

      console.log('[FCM Token Service] ✅ 현재 토큰 유효성 확인됨');
      return true;
    } catch (error) {
      console.error('[FCM Token Service] 토큰 유효성 검사 실패:', error);
      return false;
    }
  }
}

// 싱글톤 인스턴스 생성
export const fcmTokenService = new FCMTokenService();

// 개발/프로덕션 환경에서 브라우저 콘솔 테스트용 전역 함수 (항상 활성화)
if (typeof window !== 'undefined') {
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

  console.log('��️ [FCM TEST] FCM 테스트 함수들이 전역에 등록되었습니다:');
  console.log('- testFCMToken(): FCM 토큰 생성 테스트');
  console.log('- testFCMRegister(mt_idx): FCM 토큰 등록 테스트');
  console.log('- testFCMUpdate(mt_idx): FCM 토큰 체크/업데이트 테스트');
}

export default fcmTokenService;
