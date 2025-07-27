'use client';

import { useEffect, useState } from 'react';

export default function TestDebugPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [count, setCount] = useState(0);

  // 로그를 화면과 콘솔 양쪽에 출력하는 함수
  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}`;
    
    // 콘솔에 다양한 방식으로 출력
    console.log(`🚨 [TEST DEBUG] ${logMessage}`);
    console.warn(`🚨 [TEST DEBUG] ${logMessage}`);
    console.error(`🚨 [TEST DEBUG] ${logMessage}`);
    console.info(`🚨 [TEST DEBUG] ${logMessage}`);
    
    // window 객체에도 저장 (iOS Bridge에서 접근 가능하도록)
    if (typeof window !== 'undefined') {
      (window as any).SMAP_TEST_DEBUG_LOGS = (window as any).SMAP_TEST_DEBUG_LOGS || [];
      (window as any).SMAP_TEST_DEBUG_LOGS.push(logMessage);
    }
    
    // 화면에도 표시
    setLogs(prev => [...prev, logMessage]);
  };

  useEffect(() => {
    addLog('페이지 로드됨! URL: ' + window.location.href);
    
    // iOS Bridge 함수들 테스트
    const testIOSBridge = () => {
      addLog('iOS Bridge 테스트 시작');
      
      if (typeof window !== 'undefined') {
        // 전역 테스트 함수들 호출
        try {
          if ((window as any).TEST_ENV) {
            addLog('TEST_ENV 함수 호출');
            (window as any).TEST_ENV();
          } else {
            addLog('TEST_ENV 함수 없음');
          }
          
          if ((window as any).SMAP_DEBUG_INFO) {
            addLog('SMAP_DEBUG_INFO 함수 호출');
            (window as any).SMAP_DEBUG_INFO();
          } else {
            addLog('SMAP_DEBUG_INFO 함수 없음');
          }
          
          if ((window as any).TEST_HAPTIC) {
            addLog('TEST_HAPTIC 함수 호출');
            (window as any).TEST_HAPTIC('success');
          } else {
            addLog('TEST_HAPTIC 함수 없음');
          }
        } catch (error) {
          addLog('iOS Bridge 테스트 오류: ' + error);
        }
      }
    };

    // 1초 후에 iOS Bridge 테스트
    setTimeout(testIOSBridge, 1000);
    
    // 1초마다 로그 출력 (10번)
    let intervalCount = 0;
    const interval = setInterval(() => {
      intervalCount++;
      setCount(intervalCount);
      addLog(`${intervalCount}번째 반복 로그 - 카운트: ${intervalCount}`);
      
      if (intervalCount >= 10) {
        clearInterval(interval);
        addLog('로그 출력 완료!');
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      addLog('컴포넌트 언마운트됨');
    };
  }, []);

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#ff0000', 
      color: 'white', 
      fontSize: '16px',
      minHeight: '100vh',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>🚨 강화된 테스트 디버그 페이지</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <p>✅ 이 페이지가 보인다면 라우팅은 정상입니다</p>
        <p>📱 현재 카운트: {count}</p>
        <p>🌐 URL: {typeof window !== 'undefined' ? window.location.href : 'Server'}</p>
        <p>⏰ 페이지 로드 시간: {new Date().toLocaleTimeString()}</p>
      </div>

      <div style={{ 
        backgroundColor: 'rgba(0,0,0,0.3)', 
        padding: '10px', 
        borderRadius: '5px',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        <h3>📋 실시간 로그:</h3>
        {logs.map((log, index) => (
          <div key={index} style={{ 
            fontSize: '12px', 
            marginBottom: '5px',
            borderBottom: '1px solid rgba(255,255,255,0.2)',
            paddingBottom: '2px'
          }}>
            {log}
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '14px' }}>
        <p>💡 콘솔에서 다음 명령어들을 사용해보세요:</p>
        <ul style={{ textAlign: 'left', paddingLeft: '20px' }}>
          <li>TEST_ENV() - 환경 정보</li>
          <li>TEST_HAPTIC("success") - 햅틱 테스트</li>
          <li>SMAP_DEBUG_INFO() - 디버그 정보</li>
          <li>window.SMAP_TEST_DEBUG_LOGS - 저장된 로그 확인</li>
        </ul>
      </div>
    </div>
  );
} 