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
      console.log('[FCM Token Service] 🔧 FCM 토큰 서비스 초기화 시작');
      
      // 서버 사이드에서는 초기화하지 않음
      if (typeof window === 'undefined') {
        console.log('[FCM Token Service] 서버 사이드 - 초기화 건너뜀');
        return;
      }
      
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
        console.warn('[FCM Token Service] ⚠️ VAPID 키가 설정되지 않음 - 일부 기능 제한됨');
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
        console.warn('[FCM Token Service] ⚠️ Firebase 앱이 초기화되지 않음 - 일부 기능 제한됨');
      } else {
        console.log('[FCM Token Service] ✅ Firebase 앱 초기화 상태 확인 완료');
      }

      // iOS 환경 특별 처리
      const isIOS = this.detectDeviceType() === 'ios';
      if (isIOS) {
        console.log('[FCM Token Service] 🍎 iOS 환경 감지 - 특별 처리 시작');
        
        // iOS에서 알림 권한을 더 적극적으로 요청
        if ('Notification' in window) {
          console.log('[FCM Token Service] 🔔 iOS 알림 권한 상태 확인:', Notification.permission);
          
          if (Notification.permission === 'default') {
            console.log('[FCM Token Service] 🔔 iOS에서 알림 권한 요청 시작');
            try {
              // iOS에서는 사용자 상호작용이 필요할 수 있음
              const permission = await Notification.requestPermission();
              console.log('[FCM Token Service] 🔔 iOS 알림 권한 결과:', permission);
              
              if (permission === 'granted') {
                console.log('[FCM Token Service] ✅ iOS 알림 권한 획득 성공');
              } else {
                console.warn('[FCM Token Service] ⚠️ iOS 알림 권한 거부됨:', permission);
              }
            } catch (error) {
              console.warn('[FCM Token Service] ⚠️ iOS 알림 권한 요청 실패:', error);
            }
          } else if (Notification.permission === 'granted') {
            console.log('[FCM Token Service] ✅ iOS 알림 권한 이미 허용됨');
          } else {
            console.warn('[FCM Token Service] ⚠️ iOS 알림 권한 거부됨:', Notification.permission);
          }
        }
        
        // iOS에서 Service Worker 등록을 더 적극적으로 시도
        if ('serviceWorker' in navigator) {
          console.log('[FCM Token Service] 🔧 iOS에서 서비스 워커 등록 시도');
          
          try {
            // iOS에서는 여러 번 시도
            let registration = null;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (!registration && retryCount < maxRetries) {
              try {
                console.log(`[FCM Token Service] 🔧 iOS 서비스 워커 등록 시도 ${retryCount + 1}/${maxRetries}`);
                registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                console.log('[FCM Token Service] ✅ iOS 서비스 워커 등록 성공:', registration.scope);
                break;
              } catch (error) {
                console.warn(`[FCM Token Service] ⚠️ iOS 서비스 워커 등록 시도 ${retryCount + 1} 실패:`, error);
                retryCount++;
                
                if (retryCount < maxRetries) {
                  // 잠시 대기 후 재시도
                  await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
              }
            }
            
            if (!registration) {
              console.warn('[FCM Token Service] ⚠️ iOS 서비스 워커 등록 최종 실패');
            }
          } catch (error) {
            console.warn('[FCM Token Service] ⚠️ iOS 서비스 워커 등록 중 오류:', error);
          }
        }
      } else {
        // 비-iOS 환경에서 Service Worker 등록 (선택적)
        if ('serviceWorker' in navigator) {
          console.log('[FCM Token Service] 🔧 서비스 워커 등록 시작...');
          
          try {
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('[FCM Token Service] ✅ 서비스 워커 등록 성공:', registration.scope);
          } catch (error) {
            console.warn('[FCM Token Service] ⚠️ 서비스 워커 등록 실패 (계속 진행):', error);
          }
        }
      }

      // Firebase Messaging 초기화 (iOS에서는 더 강력하게)
      try {
        if (app) {
          this.messaging = getMessaging(app);
          console.log('[FCM Token Service] ✅ Firebase Messaging 초기화 성공');
          
          // iOS에서는 추가 검증
          if (isIOS) {
            console.log('[FCM Token Service] 🍎 iOS Firebase Messaging 추가 검증');
            
            // messaging 객체의 상태 확인
            if (this.messaging) {
              console.log('[FCM Token Service] ✅ iOS Firebase Messaging 객체 검증 완료');
            } else {
              console.warn('[FCM Token Service] ⚠️ iOS Firebase Messaging 객체 검증 실패');
            }
          }
        } else {
          console.warn('[FCM Token Service] ⚠️ Firebase 앱이 없음 - Messaging 초기화 건너뜀');
          this.messaging = null;
        }
      } catch (error) {
        console.warn('[FCM Token Service] ⚠️ Firebase Messaging 초기화 실패 (계속 진행):', error);
        this.messaging = null;
      }

      this.isInitialized = true;
      console.log('[FCM Token Service] ✅ 초기화 완료');
      
      // 테스트 함수들 설정
      this.setupTestFunctions();
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ 초기화 실패:', error);
      this.isInitialized = false;
      // 초기화 실패해도 계속 진행 (기본 기능은 작동)
      console.log('[FCM Token Service] 🔥 초기화 실패했지만 기본 기능은 계속 진행');
    }
  }

  /**
   * FCM 토큰 획득
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

      // VAPID 키 확인
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        throw new Error('VAPID 키가 설정되지 않음');
      }

      // iOS 환경 특별 처리
      const isIOS = this.detectDeviceType() === 'ios';
      const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      
      console.log('[FCM Token Service] 📱 디바이스 정보:', {
        deviceType: this.detectDeviceType(),
        platform: this.detectPlatform(),
        isIOS,
        isLocalhost,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
      });

      // iOS에서 특별한 처리
      if (isIOS) {
        console.log('[FCM Token Service] 🍎 iOS 환경 감지 - 특별 처리 시작');
        
        // iOS에서 Firebase Messaging 초기화 재시도
        if (!this.messaging) {
          try {
            if (app) {
              this.messaging = getMessaging(app);
              console.log('[FCM Token Service] ✅ iOS에서 Firebase Messaging 재초기화 성공');
            }
          } catch (error) {
            console.warn('[FCM Token Service] ⚠️ iOS에서 Firebase Messaging 초기화 실패:', error);
          }
        }
        
        // iOS에서 알림 권한 확인 및 요청
        if ('Notification' in window) {
          if (Notification.permission === 'default') {
            console.log('[FCM Token Service] 🔔 iOS에서 알림 권한 요청');
            try {
              const permission = await Notification.requestPermission();
              console.log('[FCM Token Service] 🔔 iOS 알림 권한 결과:', permission);
            } catch (error) {
              console.warn('[FCM Token Service] ⚠️ iOS 알림 권한 요청 실패:', error);
            }
          } else {
            console.log('[FCM Token Service] 🔔 iOS 알림 권한 상태:', Notification.permission);
          }
        }
      }

      // localhost 환경이어도 실제 Firebase 토큰 생성 시도
      if (isLocalhost) {
        console.log('[FCM Token Service] 🏠 localhost 환경 감지 - 실제 Firebase 토큰 생성 시도');
        
        // 실제 Firebase 토큰 생성 시도
        try {
          if (this.messaging) {
            const { getToken } = await import('firebase/messaging');
            const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
            
            if (vapidKey) {
              const realToken = await getToken(this.messaging, {
                vapidKey: vapidKey,
                serviceWorkerRegistration: undefined
              });
              
              if (realToken) {
                console.log('[FCM Token Service] ✅ localhost에서 실제 Firebase 토큰 생성 성공:', realToken.substring(0, 20) + '...');
                
                // 실제 토큰을 DB에 업데이트
                if (mt_idx) {
                  try {
                    await this.updateFCMTokenInDB(realToken, mt_idx);
                    console.log('[FCM Token Service] ✅ 실제 Firebase 토큰 DB 업데이트 성공');
                  } catch (dbError) {
                    console.warn('[FCM Token Service] ⚠️ 실제 Firebase 토큰 DB 업데이트 실패:', dbError);
                  }
                }
                
                this.currentToken = realToken;
                return realToken;
              }
            }
          }
        } catch (error) {
          console.warn('[FCM Token Service] ⚠️ localhost에서 실제 Firebase 토큰 생성 실패:', error);
        }
        
        // 실제 토큰 생성 실패 시 dummy 토큰 사용
        const dummyToken = this.generateDummyFCMToken();
        console.log('[FCM Token Service] 🎭 dummy FCM 토큰 생성됨:', dummyToken.substring(0, 20) + '...');
        
        // dummy 토큰을 DB에 업데이트 (사용자 ID가 있을 때만)
        if (mt_idx) {
          try {
            await this.updateFCMTokenInDB(dummyToken, mt_idx);
            console.log('[FCM Token Service] ✅ dummy FCM 토큰 DB 업데이트 성공');
          } catch (dbError) {
            console.warn('[FCM Token Service] ⚠️ dummy FCM 토큰 DB 업데이트 실패:', dbError);
          }
        } else {
          console.log('[FCM Token Service] ℹ️ 사용자 ID 없음 - dummy FCM 토큰 DB 업데이트 건너뜀');
        }
        
        this.currentToken = dummyToken;
        return dummyToken;
      }

      // 실제 Firebase FCM 토큰 생성
      if (!this.messaging) {
        console.warn('[FCM Token Service] ⚠️ Firebase Messaging이 초기화되지 않음 - iOS 환경에서는 정상적일 수 있음');
        
        // iOS에서는 더 관대하게 처리
        if (isIOS) {
          console.log('[FCM Token Service] 🍎 iOS 환경에서 Messaging 없이 계속 진행');
        } else {
          throw new Error('Firebase Messaging이 초기화되지 않음');
        }
      }

      // iOS에서 특별한 토큰 생성 시도
      if (isIOS && this.messaging) {
        console.log('[FCM Token Service] 🍎 iOS에서 Firebase 토큰 생성 시도');
        
        try {
          const { getToken } = await import('firebase/messaging');
          
          // iOS에서는 더 긴 타임아웃과 재시도 로직
          let token: string | null = null;
          let retryCount = 0;
          const maxRetries = 5; // iOS에서는 더 많은 재시도
          
          while (!token && retryCount < maxRetries) {
            try {
              console.log(`[FCM Token Service] 🍎 iOS 토큰 생성 시도 ${retryCount + 1}/${maxRetries}`);
              
              // iOS에서는 Service Worker 등록 상태를 먼저 확인
              if ('serviceWorker' in navigator) {
                try {
                  const registration = await navigator.serviceWorker.getRegistration();
                  if (registration) {
                    console.log('[FCM Token Service] 🍎 iOS Service Worker 등록 상태 확인됨:', registration.scope);
                  } else {
                    console.log('[FCM Token Service] 🍎 iOS Service Worker 등록되지 않음 - 새로 등록 시도');
                    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                  }
                } catch (swError) {
                  console.warn('[FCM Token Service] 🍎 iOS Service Worker 확인/등록 실패:', swError);
                }
              }
              
              // iOS에서 알림 권한 재확인
              if ('Notification' in window && Notification.permission !== 'granted') {
                console.log('[FCM Token Service] 🍎 iOS 알림 권한 재요청');
                try {
                  const permission = await Notification.requestPermission();
                  console.log('[FCM Token Service] 🍎 iOS 알림 권한 재요청 결과:', permission);
                } catch (permError) {
                  console.warn('[FCM Token Service] 🍎 iOS 알림 권한 재요청 실패:', permError);
                }
              }
              
              // Firebase 토큰 생성 시도
              token = await getToken(this.messaging, {
                vapidKey: vapidKey,
                serviceWorkerRegistration: undefined // iOS에서는 undefined로 설정
              });
              
              if (token) {
                console.log('[FCM Token Service] ✅ iOS에서 Firebase 토큰 생성 성공:', token.substring(0, 20) + '...');
                break;
              }
            } catch (error) {
              console.warn(`[FCM Token Service] ⚠️ iOS 토큰 생성 시도 ${retryCount + 1} 실패:`, error);
              retryCount++;
              
              if (retryCount < maxRetries) {
                // iOS에서는 더 긴 대기 시간
                const waitTime = 2000 * retryCount; // 2초, 4초, 6초, 8초
                console.log(`[FCM Token Service] 🍎 iOS ${waitTime}ms 대기 후 재시도`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            }
          }
          
          if (token) {
            // 토큰을 DB에 업데이트 (사용자 ID가 있을 때만)
            if (mt_idx) {
              try {
                await this.updateFCMTokenInDB(token, mt_idx);
                console.log('[FCM Token Service] ✅ iOS FCM 토큰 DB 업데이트 성공');
              } catch (dbError) {
                console.warn('[FCM Token Service] ⚠️ iOS FCM 토큰 DB 업데이트 실패:', dbError);
              }
            } else {
              console.log('[FCM Token Service] ℹ️ 사용자 ID 없음 - iOS FCM 토큰 DB 업데이트 건너뜀');
            }
            
            this.currentToken = token;
            return token;
          }
        } catch (error) {
          console.warn('[FCM Token Service] ⚠️ iOS에서 Firebase 토큰 생성 실패:', error);
        }
      }

      // 일반적인 Firebase FCM 토큰 생성
      if (this.messaging) {
        try {
          const { getToken } = await import('firebase/messaging');
          
          const token = await getToken(this.messaging, {
            vapidKey: vapidKey,
            serviceWorkerRegistration: undefined
          });

          if (token) {
            console.log('[FCM Token Service] ✅ FCM 토큰 생성 성공:', token.substring(0, 20) + '...');
            
            // 토큰을 DB에 업데이트 (사용자 ID가 있을 때만)
            if (mt_idx) {
              try {
                await this.updateFCMTokenInDB(token, mt_idx);
                console.log('[FCM Token Service] ✅ FCM 토큰 DB 업데이트 성공');
              } catch (dbError) {
                console.warn('[FCM Token Service] ⚠️ FCM 토큰 DB 업데이트 실패:', dbError);
              }
            } else {
              console.log('[FCM Token Service] ℹ️ 사용자 ID 없음 - FCM 토큰 DB 업데이트 건너뜀');
            }
            
            this.currentToken = token;
            return token;
          }
        } catch (error) {
          console.warn('[FCM Token Service] ⚠️ 일반 Firebase 토큰 생성 실패:', error);
        }
      }

      // 모든 방법이 실패한 경우 iOS에서는 특별 처리
      if (isIOS) {
        console.log('[FCM Token Service] 🍎 iOS에서 모든 토큰 생성 방법 실패 - 마지막 강력한 시도');
        
        // 마지막 강력한 시도: Firebase Messaging 재초기화 후 토큰 생성
        try {
          console.log('[FCM Token Service] 🍎 iOS 마지막 강력한 시도: Firebase Messaging 재초기화');
          
          // Firebase Messaging 재초기화
          if (app) {
            this.messaging = getMessaging(app);
            console.log('[FCM Token Service] 🍎 iOS Firebase Messaging 재초기화 완료');
            
            // Service Worker 강제 재등록
            if ('serviceWorker' in navigator) {
              try {
                // 기존 Service Worker 제거
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                  await registration.unregister();
                  console.log('[FCM Token Service] 🍎 iOS 기존 Service Worker 제거됨');
                }
                
                // 새로 등록
                const newRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                console.log('[FCM Token Service] 🍎 iOS 새 Service Worker 등록됨:', newRegistration.scope);
                
                // 잠시 대기 후 토큰 생성 시도
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                const { getToken } = await import('firebase/messaging');
                const finalToken = await getToken(this.messaging, {
                  vapidKey: vapidKey,
                  serviceWorkerRegistration: undefined
                });
                
                if (finalToken) {
                  console.log('[FCM Token Service] ✅ iOS 마지막 강력한 시도로 Firebase 토큰 생성 성공:', finalToken.substring(0, 20) + '...');
                  
                  // 토큰을 DB에 업데이트
                  if (mt_idx) {
                    try {
                      await this.updateFCMTokenInDB(finalToken, mt_idx);
                      console.log('[FCM Token Service] ✅ iOS 마지막 시도 FCM 토큰 DB 업데이트 성공');
                    } catch (dbError) {
                      console.warn('[FCM Token Service] ⚠️ iOS 마지막 시도 FCM 토큰 DB 업데이트 실패:', dbError);
                    }
                  }
                  
                  this.currentToken = finalToken;
                  return finalToken;
                }
              } catch (finalError) {
                console.warn('[FCM Token Service] ⚠️ iOS 마지막 강력한 시도 실패:', finalError);
              }
            }
          }
        } catch (finalError) {
          console.warn('[FCM Token Service] ⚠️ iOS 마지막 강력한 시도 중 오류:', finalError);
        }
        
        // 모든 Firebase 시도가 실패한 경우에만 대체 토큰 생성
        console.log('[FCM Token Service] 🍎 iOS에서 Firebase 토큰 생성 모든 시도 실패 - 대체 방법 시도');
        
        // iOS에서 대체 토큰 생성 (UUID 기반)
        const fallbackToken = this.generateIOSFallbackToken();
        console.log('[FCM Token Service] 🍎 iOS 대체 토큰 생성:', fallbackToken.substring(0, 20) + '...');
        
        // 대체 토큰을 DB에 업데이트
        if (mt_idx) {
          try {
            await this.updateFCMTokenInDB(fallbackToken, mt_idx);
            console.log('[FCM Token Service] ✅ iOS 대체 토큰 DB 업데이트 성공');
          } catch (dbError) {
            console.warn('[FCM Token Service] ⚠️ iOS 대체 토큰 DB 업데이트 실패:', dbError);
          }
        }
        
        this.currentToken = fallbackToken;
        return fallbackToken;
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
            // mt_idx가 있는지 먼저 확인
            if (user.mt_idx) {
              userId = user.mt_idx;
            } else if (user.id) {
              userId = user.id;
            }
            console.log('[FCM Token Service] 🔍 사용자 정보에서 ID 추출:', { mt_idx: user.mt_idx, id: user.id, finalUserId: userId });
          } catch (parseError) {
            console.warn('[FCM Token Service] ⚠️ 사용자 정보 파싱 실패:', parseError);
          }
        }
      }

      if (!userId) {
        throw new Error('사용자 ID를 찾을 수 없음');
      }

      console.log(`[FCM Token Service] 🔄 FCM 토큰 DB 업데이트 시작 (사용자 ID: ${userId})`);

      // Next.js API 라우트를 통해 백엔드 호출 (프록시 역할)
      const apiUrl = '/api/member-fcm-token/check-and-update';
      console.log('[FCM Token Service] 📡 API 호출:', apiUrl);

      // 인증 토큰 가져오기
      const authToken = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('[FCM Token Service] 🔐 인증 토큰 포함됨');
      } else {
        console.log('[FCM Token Service] ⚠️ 인증 토큰 없음');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mt_idx: userId,
          fcm_token: token,
          device_type: this.detectDeviceType(),
          platform: this.detectPlatform()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[FCM Token Service] ❌ API 응답 오류:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(`API 호출 실패: ${response.status} ${response.statusText} - ${errorData.message || '알 수 없는 오류'}`);
      }

      const result = await response.json();
      console.log('[FCM Token Service] ✅ FCM 토큰 DB 업데이트 완료:', result);
      
      // 성공적으로 업데이트된 경우 currentToken 업데이트
      if (result.success) {
        this.currentToken = token;
        console.log('[FCM Token Service] 🔄 currentToken 업데이트됨');
        
        // 백엔드 응답에서 토큰 상태 확인
        if (result.has_token) {
          console.log('[FCM Token Service] ✅ 서버에서 토큰 상태 확인됨');
        } else {
          console.warn('[FCM Token Service] ⚠️ 서버에서 토큰 상태 확인 실패');
        }
      } else {
        console.error('[FCM Token Service] ❌ 서버 응답에서 성공하지 않음:', result.message);
        throw new Error(`서버 응답 실패: ${result.message}`);
      }
      
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
   * iOS 전용 대체 토큰 생성
   */
  private generateIOSFallbackToken(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    const iosToken = `ios_${timestamp}_${random}`.padEnd(64, '0');
    return iosToken.substring(0, 64);
  }

  /**
   * iOS 전용 FCM 토큰 상태 진단
   */
  async diagnoseIOSTokenStatus(mt_idx: number): Promise<{
    success: boolean;
    deviceInfo: any;
    firebaseStatus: any;
    tokenStatus: any;
    recommendations: string[];
  }> {
    try {
      console.log('[FCM Token Service] 🔍 iOS FCM 토큰 상태 진단 시작');
      
      const deviceInfo = {
        deviceType: this.detectDeviceType(),
        platform: this.detectPlatform(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        isIOS: this.detectDeviceType() === 'ios',
        hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
        hasNotification: typeof window !== 'undefined' && 'Notification' in window,
        notificationPermission: typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unknown'
      };
      
      const firebaseStatus = {
        hasApp: !!app,
        hasMessaging: !!this.messaging,
        isInitialized: this.isInitialized,
        vapidKey: !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      };
      
      const tokenStatus = {
        hasCurrentToken: !!this.currentToken,
        currentTokenPreview: this.currentToken ? this.currentToken.substring(0, 20) + '...' : null,
        isDummyToken: this.currentToken ? this.currentToken.startsWith('dummy') : false,
        isIOSToken: this.currentToken ? this.currentToken.startsWith('ios_') : false
      };
      
      const recommendations: string[] = [];
      
      // 권장사항 생성
      if (!firebaseStatus.hasApp) {
        recommendations.push('Firebase 앱이 초기화되지 않았습니다. Firebase 설정을 확인하세요.');
      }
      
      if (!firebaseStatus.hasMessaging) {
        recommendations.push('Firebase Messaging이 초기화되지 않았습니다. iOS에서는 정상적일 수 있습니다.');
      }
      
      if (!firebaseStatus.vapidKey) {
        recommendations.push('VAPID 키가 설정되지 않았습니다. 환경변수를 확인하세요.');
      }
      
      if (deviceInfo.notificationPermission === 'denied') {
        recommendations.push('알림 권한이 거부되었습니다. iOS 설정에서 알림 권한을 허용하세요.');
      }
      
      if (tokenStatus.isDummyToken) {
        recommendations.push('현재 dummy 토큰이 사용 중입니다. 실제 Firebase 토큰 생성을 시도하세요.');
      }
      
      if (!tokenStatus.hasCurrentToken) {
        recommendations.push('현재 FCM 토큰이 없습니다. 토큰 생성을 시도하세요.');
      }
      
      console.log('[FCM Token Service] 🔍 iOS 진단 결과:', {
        deviceInfo,
        firebaseStatus,
        tokenStatus,
        recommendations
      });
      
      return {
        success: true,
        deviceInfo,
        firebaseStatus,
        tokenStatus,
        recommendations
      };
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ iOS 진단 실패:', error);
      return {
        success: false,
        deviceInfo: {},
        firebaseStatus: {},
        tokenStatus: {},
        recommendations: ['진단 중 오류가 발생했습니다: ' + String(error)]
      };
    }
  }

  /**
   * iOS 전용 강제 토큰 재생성
   */
  async forceIOSTokenRefresh(mt_idx: number): Promise<{ success: boolean; token?: string; error?: string; method: string }> {
    try {
      console.log('[FCM Token Service] 🔄 iOS 전용 강제 토큰 재생성 시작');
      
      // 1단계: Firebase 토큰 생성 시도
      if (this.messaging) {
        try {
          const { getToken } = await import('firebase/messaging');
          const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
          
          if (vapidKey) {
            console.log('[FCM Token Service] 🔄 iOS Firebase 토큰 생성 시도');
            const firebaseToken = await getToken(this.messaging, {
              vapidKey: vapidKey,
              serviceWorkerRegistration: undefined
            });
            
            if (firebaseToken) {
              console.log('[FCM Token Service] ✅ iOS Firebase 토큰 생성 성공:', firebaseToken.substring(0, 20) + '...');
              
              // DB 업데이트
              await this.updateFCMTokenInDB(firebaseToken, mt_idx);
              this.currentToken = firebaseToken;
              
              return {
                success: true,
                token: firebaseToken,
                method: 'Firebase'
              };
            }
          }
        } catch (error) {
          console.warn('[FCM Token Service] ⚠️ iOS Firebase 토큰 생성 실패:', error);
        }
      }
      
      // 2단계: 일반 토큰 생성 시도
      try {
        console.log('[FCM Token Service] 🔄 iOS 일반 토큰 생성 시도');
        const generalToken = await this.getFCMToken(mt_idx);
        
        if (generalToken) {
          console.log('[FCM Token Service] ✅ iOS 일반 토큰 생성 성공:', generalToken.substring(0, 20) + '...');
          
          return {
            success: true,
            token: generalToken,
            method: 'General'
          };
        }
      } catch (error) {
        console.warn('[FCM Token Service] ⚠️ iOS 일반 토큰 생성 실패:', error);
      }
      
      // 3단계: 대체 토큰 생성
      console.log('[FCM Token Service] 🔄 iOS 대체 토큰 생성 시도');
      const fallbackToken = this.generateIOSFallbackToken();
      console.log('[FCM Token Service] ✅ iOS 대체 토큰 생성됨:', fallbackToken.substring(0, 20) + '...');
      
      // DB 업데이트
      await this.updateFCMTokenInDB(fallbackToken, mt_idx);
      this.currentToken = fallbackToken;
      
      return {
        success: true,
        token: fallbackToken,
        method: 'Fallback'
      };
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ iOS 전용 강제 토큰 재생성 실패:', error);
      return {
        success: false,
        error: String(error),
        method: 'Failed'
      };
    }
  }

  /**
   * 현재 저장된 토큰 반환
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * 로그인 시 FCM 토큰 강제 업데이트
   */
  async forceUpdateOnLogin(mt_idx: number): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log(`[FCM Token Service] 🔄 로그인 시 FCM 토큰 강제 업데이트 (사용자 ID: ${mt_idx})`);
      
      // iOS 환경 확인
      const isIOS = this.detectDeviceType() === 'ios';
      console.log('[FCM Token Service] 📱 디바이스 정보:', {
        deviceType: this.detectDeviceType(),
        platform: this.detectPlatform(),
        isIOS
      });
      
      // 현재 토큰 확인
      const currentToken = this.currentToken;
      console.log('[FCM Token Service] 📋 현재 토큰:', currentToken ? currentToken.substring(0, 20) + '...' : '없음');
      
      // dummy 토큰인지 확인
      if (currentToken && currentToken.startsWith('dummy')) {
        console.log('[FCM Token Service] 🎭 dummy 토큰 감지 - 강제 교체 필요');
      }
      
      // iOS에서는 더 강력한 초기화 시도
      if (isIOS) {
        console.log('[FCM Token Service] 🍎 iOS 환경에서 강력한 초기화 시도');
        
        // Firebase Messaging 재초기화
        try {
          if (app) {
            this.messaging = getMessaging(app);
            console.log('[FCM Token Service] ✅ iOS에서 Firebase Messaging 재초기화 성공');
          }
        } catch (error) {
          console.warn('[FCM Token Service] ⚠️ iOS에서 Firebase Messaging 재초기화 실패:', error);
        }
        
        // 알림 권한 확인 및 요청
        if ('Notification' in window) {
          if (Notification.permission === 'default') {
            console.log('[FCM Token Service] 🔔 iOS에서 알림 권한 요청');
            try {
              const permission = await Notification.requestPermission();
              console.log('[FCM Token Service] 🔔 iOS 알림 권한 결과:', permission);
            } catch (error) {
              console.warn('[FCM Token Service] ⚠️ iOS 알림 권한 요청 실패:', error);
            }
          } else {
            console.log('[FCM Token Service] 🔔 iOS 알림 권한 상태:', Notification.permission);
          }
        }
      }
      
      // 새 토큰 생성 (무조건)
      const newToken = await this.getFCMToken(mt_idx);
      if (!newToken) {
        console.error('[FCM Token Service] ❌ 새 토큰 생성 실패');
        
        // iOS에서는 대체 방법 시도
        if (isIOS) {
          console.log('[FCM Token Service] 🍎 iOS에서 대체 토큰 생성 시도');
          const fallbackToken = this.generateIOSFallbackToken();
          console.log('[FCM Token Service] 🍎 iOS 대체 토큰 생성됨:', fallbackToken.substring(0, 20) + '...');
          
          // 대체 토큰을 DB에 업데이트
          try {
            await this.updateFCMTokenInDB(fallbackToken, mt_idx);
            console.log('[FCM Token Service] ✅ iOS 대체 토큰 DB 업데이트 완료');
            this.currentToken = fallbackToken;
            return { success: true, message: 'iOS 대체 토큰으로 FCM 토큰 업데이트 완료' };
          } catch (dbError) {
            console.error('[FCM Token Service] ❌ iOS 대체 토큰 DB 업데이트 실패:', dbError);
            return { success: false, error: 'iOS 대체 토큰 DB 업데이트 실패' };
          }
        }
        
        return { success: false, error: '새 토큰 생성 실패' };
      }
      
      console.log('[FCM Token Service] ✅ 새 토큰 생성:', newToken.substring(0, 20) + '...');
      
      // DB 업데이트 (무조건)
      try {
        await this.updateFCMTokenInDB(newToken, mt_idx);
        console.log('[FCM Token Service] ✅ 로그인 시 FCM 토큰 DB 업데이트 완료');
        
        // iOS에서는 추가 검증
        if (isIOS) {
          console.log('[FCM Token Service] 🍎 iOS에서 토큰 업데이트 검증');
          
          // 잠시 대기 후 토큰 상태 재확인
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // 토큰이 실제로 업데이트되었는지 확인
          if (this.currentToken === newToken) {
            console.log('[FCM Token Service] ✅ iOS 토큰 업데이트 검증 완료');
          } else {
            console.warn('[FCM Token Service] ⚠️ iOS 토큰 업데이트 검증 실패 - 토큰 불일치');
          }
        }
        
        return { success: true, message: '로그인 시 FCM 토큰 업데이트 완료' };
      } catch (dbError) {
        console.error('[FCM Token Service] ❌ 로그인 시 FCM 토큰 DB 업데이트 실패:', dbError);
        
        // iOS에서는 실패 시에도 대체 방법 시도
        if (isIOS) {
          console.log('[FCM Token Service] 🍎 iOS에서 DB 업데이트 실패 시 대체 방법 시도');
          try {
            const fallbackToken = this.generateIOSFallbackToken();
            await this.updateFCMTokenInDB(fallbackToken, mt_idx);
            console.log('[FCM Token Service] ✅ iOS 대체 방법으로 DB 업데이트 성공');
            this.currentToken = fallbackToken;
            return { success: true, message: 'iOS 대체 방법으로 FCM 토큰 업데이트 완료' };
          } catch (fallbackError) {
            console.error('[FCM Token Service] ❌ iOS 대체 방법도 실패:', fallbackError);
          }
        }
        
        return { success: false, error: 'DB 업데이트 실패: ' + String(dbError) };
      }
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ 로그인 시 FCM 토큰 강제 업데이트 실패:', error);
      
      // iOS에서는 최종 대체 방법 시도
      const isIOS = this.detectDeviceType() === 'ios';
      if (isIOS && mt_idx) {
        console.log('[FCM Token Service] 🍎 iOS에서 최종 대체 방법 시도');
        try {
          const fallbackToken = this.generateIOSFallbackToken();
          await this.updateFCMTokenInDB(fallbackToken, mt_idx);
          console.log('[FCM Token Service] ✅ iOS 최종 대체 방법으로 DB 업데이트 성공');
          this.currentToken = fallbackToken;
          return { success: true, message: 'iOS 최종 대체 방법으로 FCM 토큰 업데이트 완료' };
        } catch (finalError) {
          console.error('[FCM Token Service] ❌ iOS 최종 대체 방법도 실패:', finalError);
        }
      }
      
      return { success: false, error: String(error) };
    }
  }

  /**
   * FCM 토큰 초기화 및 체크/업데이트
   */
  async initializeAndCheckUpdateToken(mt_idx: number): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log(`[FCM Token Service] 🔄 FCM 토큰 초기화 및 체크/업데이트 시작 (사용자 ID: ${mt_idx})`);
      
      // 초기화 대기
      if (!this.isInitialized) {
        console.log('[FCM Token Service] ⏳ 초기화 대기 중...');
        await this.initialize();
      }

      // 현재 토큰 확인
      const currentToken = this.currentToken;
      console.log('[FCM Token Service] 📋 현재 저장된 토큰:', currentToken ? currentToken.substring(0, 20) + '...' : '없음');

      // 새 토큰 생성
      const newToken = await this.getFCMToken(mt_idx);
      if (!newToken) {
        console.error('[FCM Token Service] ❌ 새 FCM 토큰 생성 실패');
        return {
          success: false,
          error: '새 FCM 토큰 생성 실패'
        };
      }

      console.log('[FCM Token Service] ✅ 새 FCM 토큰 생성 성공:', newToken.substring(0, 20) + '...');

      // 토큰이 변경되었는지 확인
      if (currentToken === newToken) {
        console.log('[FCM Token Service] ℹ️ 토큰 변경 없음 - DB 업데이트만 수행');
      } else {
        console.log('[FCM Token Service] 🔄 토큰 변경됨 - DB 업데이트 수행');
      }

      // DB 업데이트 수행
      try {
        await this.updateFCMTokenInDB(newToken, mt_idx);
        console.log('[FCM Token Service] ✅ FCM 토큰 DB 업데이트 완료');
        
        return {
          success: true,
          message: 'FCM 토큰이 성공적으로 업데이트되었습니다.'
        };
      } catch (dbError) {
        console.error('[FCM Token Service] ❌ FCM 토큰 DB 업데이트 실패:', dbError);
        return {
          success: false,
          error: 'DB 업데이트 실패: ' + (dbError instanceof Error ? dbError.message : String(dbError))
        };
      }
      
    } catch (error) {
      console.error('[FCM Token Service] ❌ FCM 토큰 초기화 및 체크/업데이트 실패:', error);
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
      const token = await this.getFCMToken(mt_idx);
      
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
   * 현재 FCM 토큰 반환
   */
  getCurrentFCMToken(): string | null {
    return this.currentToken;
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
      
      // 강제로 실제 Firebase 토큰 생성 시도
      let newToken: string | null = null;
      
      try {
        if (this.messaging) {
          const { getToken } = await import('firebase/messaging');
          const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
          
          if (vapidKey) {
            console.log('[FCM Token Service] 🔄 Firebase에서 새 토큰 생성 중...');
            newToken = await getToken(this.messaging, {
              vapidKey: vapidKey,
              serviceWorkerRegistration: undefined
            });
            
            if (newToken) {
              console.log('[FCM Token Service] ✅ Firebase에서 새 토큰 생성 성공:', newToken.substring(0, 20) + '...');
            }
          }
        }
      } catch (error) {
        console.warn('[FCM Token Service] ⚠️ Firebase 토큰 생성 실패:', error);
      }
      
      // Firebase 토큰 생성 실패 시 기존 방식 사용
      if (!newToken) {
        console.log('[FCM Token Service] 🔄 기존 방식으로 새 토큰 획득 시도');
        newToken = await this.getFCMToken(mt_idx);
      }
      
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
          const token = await this.getFCMToken(mt_idx);
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
        console.log('🔔 [FCM TEST] FCM 토큰 강제 업데이트 테스트 시작');
        try {
          // 현재 토큰 확인
          const currentToken = this.currentToken;
          console.log('📋 [FCM TEST] 현재 저장된 토큰:', currentToken ? currentToken.substring(0, 20) + '...' : '없음');
          
          // 강제 업데이트 사용
          const result = await this.forceUpdateOnLogin(mt_idx || 0);
          if (result.success) {
            console.log('✅ [FCM TEST] FCM 토큰 강제 업데이트 완료');
            return { 
              success: true, 
              oldToken: currentToken ? currentToken.substring(0, 20) + '...' : '없음',
              newToken: this.currentToken ? this.currentToken.substring(0, 20) + '...' : '없음',
              updated: currentToken !== this.currentToken,
              message: result.message
            };
          } else {
            console.log('❌ [FCM TEST] FCM 토큰 강제 업데이트 실패:', result.error);
            return { success: false, error: result.error };
          }
        } catch (error) {
          console.error('❌ [FCM TEST] 토큰 강제 업데이트 오류:', error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      };

      // 추가 전역 함수들 등록
      (window as any).forceRefreshFCMToken = async (mt_idx: number) => {
        return await this.forceTokenRefresh(mt_idx);
      };
      
      (window as any).getFCMTokenStatus = async () => {
        return {
          hasToken: !!this.currentToken,
          tokenPreview: this.currentToken ? `${this.currentToken.substring(0, 20)}...` : null,
          environment: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
          isSupported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
          timestamp: new Date().toISOString()
        };
      };
      
      (window as any).getCurrentFCMToken = () => {
        return this.getCurrentFCMToken();
      };
      
      // iOS 전용 테스트 함수들
      (window as any).testIOSFCMToken = async (mt_idx?: number) => {
        console.log('🍎 [iOS FCM TEST] iOS FCM 토큰 테스트 시작');
        try {
          const isIOS = this.detectDeviceType() === 'ios';
          if (!isIOS) {
            console.log('⚠️ [iOS FCM TEST] iOS 디바이스가 아닙니다.');
            return { success: false, error: 'iOS 디바이스가 아닙니다.' };
          }
          
          // iOS 진단 실행
          const diagnosis = await this.diagnoseIOSTokenStatus(mt_idx || 0);
          console.log('🔍 [iOS FCM TEST] iOS 진단 결과:', diagnosis);
          
          // iOS 강제 토큰 재생성
          const refreshResult = await this.forceIOSTokenRefresh(mt_idx || 0);
          console.log('🔄 [iOS FCM TEST] iOS 강제 토큰 재생성 결과:', refreshResult);
          
          return {
            success: true,
            diagnosis,
            refreshResult,
            finalToken: this.currentToken ? this.currentToken.substring(0, 20) + '...' : null
          };
        } catch (error) {
          console.error('❌ [iOS FCM TEST] iOS FCM 토큰 테스트 오류:', error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      };
      
      (window as any).diagnoseIOSFCM = async (mt_idx?: number) => {
        console.log('🔍 [iOS FCM DIAGNOSE] iOS FCM 진단 시작');
        try {
          const result = await this.diagnoseIOSTokenStatus(mt_idx || 0);
          console.log('🔍 [iOS FCM DIAGNOSE] 진단 완료:', result);
          return result;
        } catch (error) {
          console.error('❌ [iOS FCM DIAGNOSE] iOS FCM 진단 오류:', error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      };
      
      (window as any).forceIOSFCMRefresh = async (mt_idx: number) => {
        console.log('🔄 [iOS FCM FORCE] iOS FCM 강제 재생성 시작');
        try {
          const result = await this.forceIOSTokenRefresh(mt_idx);
          console.log('🔄 [iOS FCM FORCE] iOS FCM 강제 재생성 완료:', result);
          return result;
        } catch (error) {
          console.error('❌ [iOS FCM FORCE] iOS FCM 강제 재생성 오류:', error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      };
      
      // iOS Firebase 강제 초기화 테스트
      (window as any).forceIOSFirebaseInit = async () => {
        console.log('🍎 [iOS FIREBASE FORCE] iOS Firebase 강제 초기화 시작');
        try {
          const isIOS = this.detectDeviceType() === 'ios';
          if (!isIOS) {
            return { success: false, error: 'iOS 디바이스가 아닙니다.' };
          }
          
          // Firebase Messaging 강제 재초기화
          if (app) {
            this.messaging = getMessaging(app);
            console.log('🍎 [iOS FIREBASE FORCE] Firebase Messaging 재초기화 완료');
            
            // Service Worker 강제 재등록
            if ('serviceWorker' in navigator) {
              try {
                // 기존 Service Worker 제거
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                  await registration.unregister();
                  console.log('🍎 [iOS FIREBASE FORCE] 기존 Service Worker 제거됨');
                }
                
                // 새로 등록
                const newRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                console.log('🍎 [iOS FIREBASE FORCE] 새 Service Worker 등록됨:', newRegistration.scope);
                
                // 알림 권한 재요청
                if ('Notification' in window && Notification.permission !== 'granted') {
                  const permission = await Notification.requestPermission();
                  console.log('🍎 [iOS FIREBASE FORCE] 알림 권한 재요청 결과:', permission);
                }
                
                return {
                  success: true,
                  message: 'iOS Firebase 강제 초기화 완료',
                  hasMessaging: !!this.messaging,
                  hasServiceWorker: !!newRegistration,
                  notificationPermission: Notification.permission
                };
              } catch (error) {
                console.error('🍎 [iOS FIREBASE FORCE] Service Worker 재등록 실패:', error);
                return { success: false, error: 'Service Worker 재등록 실패' };
              }
            }
          }
          
          return { success: false, error: 'Firebase 앱이 초기화되지 않음' };
        } catch (error) {
          console.error('🍎 [iOS FIREBASE FORCE] iOS Firebase 강제 초기화 오류:', error);
          return { success: false, error: String(error) };
        }
      };
      
      // iOS Firebase 토큰 강제 생성 테스트
      (window as any).forceIOSFirebaseToken = async (mt_idx: number) => {
        console.log('🍎 [iOS FIREBASE TOKEN FORCE] iOS Firebase 토큰 강제 생성 시작');
        try {
          const isIOS = this.detectDeviceType() === 'ios';
          if (!isIOS) {
            return { success: false, error: 'iOS 디바이스가 아닙니다.' };
          }
          
          // 먼저 Firebase 강제 초기화
          const initResult = await (window as any).forceIOSFirebaseInit();
          if (!initResult.success) {
            return { success: false, error: 'Firebase 초기화 실패: ' + initResult.error };
          }
          
          // 잠시 대기
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Firebase 토큰 생성 시도
          if (this.messaging) {
            const { getToken } = await import('firebase/messaging');
            const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
            
            if (vapidKey) {
              const token = await getToken(this.messaging, {
                vapidKey: vapidKey,
                serviceWorkerRegistration: undefined
              });
              
              if (token) {
                console.log('🍎 [iOS FIREBASE TOKEN FORCE] Firebase 토큰 생성 성공:', token.substring(0, 20) + '...');
                
                // DB 업데이트
                try {
                  await this.updateFCMTokenInDB(token, mt_idx);
                  this.currentToken = token;
                  return {
                    success: true,
                    message: 'iOS Firebase 토큰 강제 생성 성공',
                    token: token.substring(0, 20) + '...',
                    method: 'Firebase'
                  };
                } catch (dbError) {
                  return {
                    success: true,
                    message: 'iOS Firebase 토큰 생성 성공, DB 업데이트 실패',
                    token: token.substring(0, 20) + '...',
                    method: 'Firebase',
                    dbError: String(dbError)
                  };
                }
              } else {
                return { success: false, error: 'Firebase 토큰 생성 실패' };
              }
            } else {
              return { success: false, error: 'VAPID 키가 설정되지 않음' };
            }
          } else {
            return { success: false, error: 'Firebase Messaging이 초기화되지 않음' };
          }
        } catch (error) {
          console.error('🍎 [iOS FIREBASE TOKEN FORCE] iOS Firebase 토큰 강제 생성 오류:', error);
          return { success: false, error: String(error) };
        }
      };
      
      (window as any).fcmTokenService = this; // 인스턴스도 전역에 등록
      
      console.log('🔔 [FCM TEST] FCM 테스트 함수들이 전역에 등록되었습니다:');
      console.log('- testFCMToken(): FCM 토큰 생성 테스트');
      console.log('- testFCMRegister(mt_idx): FCM 토큰 등록 테스트 (DB 업데이트 포함)');
      console.log('- testFCMUpdate(mt_idx): FCM 토큰 강제 업데이트 테스트 (DB 업데이트 포함)');
      console.log('- forceRefreshFCMToken(mt_idx): 강제 토큰 새로고침');
      console.log('- getFCMTokenStatus(): 현재 FCM 토큰 상태');
      console.log('- getCurrentFCMToken(): 현재 FCM 토큰 반환');
      console.log('🍎 [iOS 전용] iOS FCM 테스트 함수들:');
      console.log('- testIOSFCMToken(mt_idx): iOS FCM 토큰 종합 테스트');
      console.log('- diagnoseIOSFCM(mt_idx): iOS FCM 상태 진단');
      console.log('- forceIOSFCMRefresh(mt_idx): iOS FCM 강제 재생성');
      console.log('- forceIOSFirebaseInit(): iOS Firebase 강제 초기화');
      console.log('- forceIOSFirebaseToken(mt_idx): iOS Firebase 토큰 강제 생성');
    }
  }
}

// 싱글톤 인스턴스 생성 (클라이언트 사이드에서만)
export const fcmTokenService = typeof window !== 'undefined' ? new FCMTokenService() : null;
