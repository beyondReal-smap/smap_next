'use client';

import { useEffect, useState } from 'react';

// 카카오 SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

export default function TestKakaoPage() {
  const [isKakaoLoaded, setIsKakaoLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    // 카카오 SDK 로드
    const script = document.createElement('script');
    script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
    script.async = true;
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        const kakaoAppKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
        if (kakaoAppKey) {
          window.Kakao.init(kakaoAppKey);
          console.log('카카오 SDK 초기화 완료');
          setIsKakaoLoaded(true);
        } else {
          console.error('카카오 앱 키가 설정되지 않았습니다.');
        }
      }
    };
    document.head.appendChild(script);
  }, []);

  const handleKakaoLogin = async () => {
    if (!isKakaoLoaded || !window.Kakao) {
      alert('카카오 SDK가 로드되지 않았습니다.');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      window.Kakao.Auth.login({
        success: async (authObj: any) => {
          try {
            console.log('카카오 로그인 성공:', authObj);
            
            // 백엔드 API로 액세스 토큰 전송
            const response = await fetch('/api/kakao-auth', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                access_token: authObj.access_token,
              }),
            });

            console.log('API 응답 상태:', response.status);
            const data = await response.text(); // JSON 대신 text로 받아서 확인
            console.log('API 응답 데이터:', data);

            try {
              const jsonData = JSON.parse(data);
              setResult({
                success: true,
                kakaoAuth: authObj,
                apiResponse: jsonData
              });
            } catch (parseError) {
              setResult({
                success: false,
                error: 'API 응답이 JSON이 아닙니다',
                rawResponse: data.substring(0, 500)
              });
            }
          } catch (error: any) {
            console.error('카카오 로그인 처리 오류:', error);
            setResult({
              success: false,
              error: error.message,
              kakaoAuth: authObj
            });
          } finally {
            setIsLoading(false);
          }
        },
        fail: (error: any) => {
          console.error('카카오 로그인 실패:', error);
          setResult({
            success: false,
            error: '카카오 로그인 실패',
            kakaoError: error
          });
          setIsLoading(false);
        },
      });
    } catch (error: any) {
      console.error('카카오 로그인 오류:', error);
      setResult({
        success: false,
        error: error.message
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">카카오 로그인 테스트</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              카카오 SDK 상태: {isKakaoLoaded ? '✅ 로드됨' : '⏳ 로딩 중...'}
            </p>
            
            <button
              onClick={handleKakaoLogin}
              disabled={isLoading || !isKakaoLoaded}
              className="w-full py-3 px-4 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '로그인 중...' : '카카오 로그인 테스트'}
            </button>
          </div>

          {result && (
            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <h3 className="font-bold mb-2">결과:</h3>
              <pre className="text-sm overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 