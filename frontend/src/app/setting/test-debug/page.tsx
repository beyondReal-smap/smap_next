'use client';

import { useEffect } from 'react';

export default function TestDebugPage() {
  useEffect(() => {
    console.log('🚨 [TEST DEBUG] 페이지 로드됨!', {
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
    
    // 1초마다 로그 출력 (5번)
    let count = 0;
    const interval = setInterval(() => {
      count++;
      console.log(`🚨 [TEST DEBUG] ${count}번째 로그`, {
        count,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
      
      if (count >= 5) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: 'red', 
      color: 'white', 
      fontSize: '24px',
      textAlign: 'center',
      minHeight: '100vh'
    }}>
      <h1>🚨 테스트 디버그 페이지</h1>
      <p>이 페이지가 보인다면 라우팅은 정상입니다</p>
      <p>콘솔에서 [TEST DEBUG] 로그를 확인하세요</p>
      <p>URL: {typeof window !== 'undefined' ? window.location.href : 'Server'}</p>
    </div>
  );
} 