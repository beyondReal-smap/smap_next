import { initializeApp, getApps } from 'firebase/app';
// 안드로이드 WebView에서 불필요한 firebase/auth import로 인한 사이드로드를 방지
// import { getAuth } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';

// Firebase 설정 (하드코딩으로 환경변수 문제 해결)
const firebaseConfig = {
  apiKey: "AIzaSyBKq515AfyN-oizndPdXBebBkcjTlI56qw",
  authDomain: "com-dmonster-smap.firebaseapp.com",
  projectId: "com-dmonster-smap",
  storageBucket: "com-dmonster-smap.firebasestorage.app",
  messagingSenderId: "283271180972",
  appId: "1:283271180972:web:6c8d4104b83f419403e509",
  measurementId: "G-1B733FGCQ5"
};

// Firebase가 제대로 설정되었는지 확인
const isFirebaseConfigured = true; // 하드코딩으로 항상 true

// Firebase 앱 초기화 (브라우저에서만, 그리고 설정이 되어있을 때만)
// 안드로이드 WebView에서는 Firebase Web 초기화 자체를 차단 (네이티브 사용)
// iOS WebView에서는 Firebase Web 초기화 허용 (FCM 토큰 생성 시도)
const isAndroidWebView = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) && /SMAP-Android|WebView|wv/i.test(navigator.userAgent);
const isIOSWebView = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(navigator as any).standalone;

export const app = typeof window !== 'undefined' && isFirebaseConfigured && !isAndroidWebView ? 
  (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]) : 
  null;

// Firebase Auth 초기화 (앱이 있을 때만)
// 안드로이드 WebView에서는 auth 미초기화 (네이티브 경로만 사용)
// export const auth = app ? getAuth(app) : null;
export const auth = null as any;

// Firebase Messaging 초기화 (브라우저에서만)
export const getFirebaseMessaging = async () => {
  if (typeof window !== 'undefined' && app && await isSupported()) {
    return getMessaging(app);
  }
  return null;
};

// 로깅은 브라우저에서만
if (typeof window !== 'undefined') {
  if (isFirebaseConfigured) {
    if (isAndroidWebView) {
      console.log('[Firebase] ⚠️ Android WebView 감지 - Firebase Web 초기화 차단(네이티브 사용)');
    } else if (isIOSWebView) {
      console.log('[Firebase] 📱 iOS WebView 감지 - Firebase Web 초기화 허용(FCM 토큰 생성 시도)');
      console.log('[Firebase] 🔥 Firebase 초기화 완료');
      console.log('[Firebase] Project ID:', firebaseConfig.projectId);
      console.log('[Firebase] Messaging Sender ID:', firebaseConfig.messagingSenderId);
    } else {
      console.log('[Firebase] 🔥 Firebase 초기화 완료');
      console.log('[Firebase] Project ID:', firebaseConfig.projectId);
      console.log('[Firebase] Messaging Sender ID:', firebaseConfig.messagingSenderId);
    }
  } else {
    console.warn('[Firebase] ⚠️ Firebase 환경변수가 설정되지 않음 - FCM 기능 비활성화');
  }
}
