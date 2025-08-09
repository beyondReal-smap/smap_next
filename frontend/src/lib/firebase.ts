import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';

// Firebase 설정 (환경변수에서 가져오기)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'demo-app-id',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'demo-measurement-id'
};

// Firebase가 제대로 설정되었는지 확인
const isFirebaseConfigured = process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                             process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
                             process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'demo-api-key';

// Firebase 앱 초기화 (브라우저에서만, 그리고 설정이 되어있을 때만)
export const app = typeof window !== 'undefined' && isFirebaseConfigured ? 
  (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]) : 
  null;

// Firebase Auth 초기화 (앱이 있을 때만)
export const auth = app ? getAuth(app) : null;

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
    console.log('[Firebase] 🔥 Firebase 초기화 완료');
    console.log('[Firebase] Project ID:', firebaseConfig.projectId);
    console.log('[Firebase] Messaging Sender ID:', firebaseConfig.messagingSenderId);
  } else {
    console.warn('[Firebase] ⚠️ Firebase 환경변수가 설정되지 않음 - FCM 기능 비활성화');
  }
}
