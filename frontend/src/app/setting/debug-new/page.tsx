"use client";

// 🚨🚨🚨 완전 새로운 파일 - 캐시 우회
(function() {
  const debugId = `NEW-DEBUG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🚨🚨🚨🚨🚨 [${debugId}] 완전 새로운 디버그 파일 실행됨!!!`, {
    debugId,
    timestamp: new Date().toISOString(),
    location: window.location.href,
    userAgent: navigator.userAgent,
    isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent),
    isWebKit: /WebKit/i.test(navigator.userAgent)
  });
  
  // 강제 알림
  alert(`🚨 완전 새로운 DEBUG 파일! ID: ${debugId.substr(-6)}`);
  
  // 글로벌 함수
  (window as any).SMAP_NEW_DEBUG = () => {
    console.log(`🚨🚨🚨 [${debugId}] 새로운 글로벌 함수 호출됨!`);
    alert(`새로운 DEBUG: ${debugId}`);
  };
})();

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DebugNewPage() {
  const router = useRouter();

  useEffect(() => {
    console.log('🚨🚨🚨 [DEBUG-NEW] 컴포넌트 시작!!!', new Date().toISOString());
  }, []);

  const handleBack = () => {
    router.push('/setting');
  };

  return (
    <div style={{
      padding: '20px',
      minHeight: '100vh',
      background: 'linear-gradient(45deg, #ff9a9e, #fecfef, #fecfef)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '20px',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '0 auto',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{ 
          color: '#ff6b6b', 
          fontSize: '32px', 
          marginBottom: '20px',
          textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
        }}>
          🚨 완전 새로운 DEBUG 페이지 🚨
        </h1>
        
        <p style={{ fontSize: '18px', color: '#333', marginBottom: '20px' }}>
          이 페이지가 보인다면 새로운 파일이 정상 배포됨!
        </p>
        
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '30px' }}>
          현재 시간: {new Date().toISOString()}
        </p>
        
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={handleBack}
            style={{
              padding: '15px 30px',
              backgroundColor: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              cursor: 'pointer',
              marginRight: '10px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
            }}
          >
            ← 설정으로 돌아가기
          </button>
          
          <button 
            onClick={() => {
              console.log('🚨🚨🚨 [DEBUG-NEW] 테스트 버튼 클릭됨!');
              alert('새로운 DEBUG 페이지의 테스트 버튼이 클릭되었습니다!');
            }}
            style={{
              padding: '15px 30px',
              backgroundColor: '#4ecdc4',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
            }}
          >
            🚨 테스트 버튼 🚨
          </button>
        </div>
        
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '10px',
          marginTop: '20px'
        }}>
          <h3 style={{ color: '#333', marginBottom: '10px' }}>디버그 정보</h3>
          <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
            경로: /setting/debug-new
          </p>
          <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
            파일: frontend/src/app/setting/debug-new/page.tsx
          </p>
          <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
            빌드: 2025-01-24T10:40:00Z
          </p>
        </div>
      </div>
    </div>
  );
} 