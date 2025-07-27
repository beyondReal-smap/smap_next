'use client';

import { useEffect, useState } from 'react';

interface ApiTestResult {
  endpoint: string;
  method: string;
  status: 'pending' | 'success' | 'error';
  statusCode?: number;
  data?: any;
  error?: string;
  responseTime?: number;
}

export default function TestDebugPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [apiResults, setApiResults] = useState<ApiTestResult[]>([]);
  const [isTestingAPIs, setIsTestingAPIs] = useState(false);
  const [authInfo, setAuthInfo] = useState<{
    hasToken: boolean;
    tokenPreview: string;
    userId: string;
    userInfo: any;
  }>({
    hasToken: false,
    tokenPreview: '',
    userId: '',
    userInfo: null
  });

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

  // API 테스트 함수
  const testAPI = async (endpoint: string, method: string = 'GET', body?: any): Promise<ApiTestResult> => {
    const startTime = Date.now();
    const result: ApiTestResult = {
      endpoint,
      method,
      status: 'pending'
    };

    try {
      addLog(`API 테스트 시작: ${method} ${endpoint}`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 인증이 필요한 API들에 자동으로 토큰 추가
      if (endpoint.includes('/v1/members/') || endpoint.includes('/v1/groups/') || endpoint.includes('/v1/notices/')) {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          addLog(`🔑 토큰 추가됨: ${endpoint}`);
        } else {
          addLog(`⚠️ 토큰 없음: ${endpoint} (인증 필요한 API)`);
        }
      }

      const options: RequestInit = {
        method,
        headers
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(endpoint, options);
      const responseTime = Date.now() - startTime;
      
      result.statusCode = response.status;
      result.responseTime = responseTime;

      if (response.ok) {
        const data = await response.json();
        result.status = 'success';
        result.data = data;
        addLog(`✅ API 성공: ${endpoint} (${response.status}) - ${responseTime}ms`);
        
        // 성공 응답의 주요 정보 로깅
        if (data.success !== undefined) {
          addLog(`📊 응답 상태: ${data.success ? '성공' : '실패'} - ${data.message || '메시지 없음'}`);
        }
      } else {
        result.status = 'error';
        const errorText = await response.text();
        result.error = `HTTP ${response.status}: ${errorText}`;
        addLog(`❌ API 실패: ${endpoint} (${response.status}) - ${errorText}`);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      result.status = 'error';
      result.responseTime = responseTime;
      result.error = error instanceof Error ? error.message : String(error);
      addLog(`💥 API 오류: ${endpoint} - ${result.error}`);
    }

    return result;
  };

  // 전체 API 테스트 실행
  const runAPITests = async () => {
    setIsTestingAPIs(true);
    setApiResults([]);
    addLog('=== API 테스트 시작 ===');

    const apiEndpoints = [
      { endpoint: '/api/auth', method: 'GET' },
      { endpoint: '/api/v1/test', method: 'GET' },
      { endpoint: '/api/test-backend', method: 'GET' },
      { endpoint: '/api/v1/members/profile', method: 'GET' },
      { endpoint: '/api/v1/members/consent/1186', method: 'GET' },
      { endpoint: '/api/v1/groups/member/1186', method: 'GET' },
      { endpoint: '/api/v1/notices', method: 'GET' },
      { endpoint: '/api/groups', method: 'GET' },
      { endpoint: '/api/members', method: 'GET' },
    ];

    const results: ApiTestResult[] = [];

    for (const api of apiEndpoints) {
      const result = await testAPI(api.endpoint, api.method);
      results.push(result);
      setApiResults([...results]); // 실시간 업데이트
      
      // 각 API 테스트 간 짧은 지연
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    addLog('=== API 테스트 완료 ===');
    setIsTestingAPIs(false);
  };

  // 인증 정보 확인 함수
  const checkAuthInfo = () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('user_id');
      const userInfo = localStorage.getItem('user_info');
      
      setAuthInfo({
        hasToken: !!token,
        tokenPreview: token ? `${token.substring(0, 20)}...` : '',
        userId: userId || '',
        userInfo: userInfo ? JSON.parse(userInfo) : null
      });

      addLog(`🔐 인증 정보 확인: 토큰=${!!token}, 사용자ID=${userId || '없음'}`);
    }
  };

  useEffect(() => {
    addLog('페이지 로드됨! URL: ' + window.location.href);
    
    // 초기 인증 정보 확인
    checkAuthInfo();
    
    // iOS Bridge 함수들 테스트
    const testIOSBridge = () => {
      addLog('iOS Bridge 테스트 시작');
      
      if (typeof window !== 'undefined') {
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
    
    // 3초 후에 인증 정보 재확인 후 API 테스트 시작
    setTimeout(() => {
      addLog('자동 API 테스트 시작...');
      checkAuthInfo(); // 인증 정보 재확인
      setTimeout(() => runAPITests(), 500); // 0.5초 후에 API 테스트 시작
    }, 3000);
    
    // 1초마다 로그 출력 (5번만)
    let intervalCount = 0;
    const interval = setInterval(() => {
      intervalCount++;
      setCount(intervalCount);
      addLog(`${intervalCount}번째 반복 로그 - 카운트: ${intervalCount}`);
      
      if (intervalCount >= 5) {
        clearInterval(interval);
        addLog('반복 로그 출력 완료!');
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      addLog('컴포넌트 언마운트됨');
    };
  }, []);

  const getStatusColor = (status: ApiTestResult['status']) => {
    switch (status) {
      case 'success': return '#00ff00';
      case 'error': return '#ff0000';
      case 'pending': return '#ffff00';
      default: return '#ffffff';
    }
  };

  const getStatusIcon = (status: ApiTestResult['status']) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '⚪';
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#ff0000', 
      color: 'white', 
      fontSize: '14px',
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

      {/* 인증 정보 섹션 */}
      <div style={{ 
        backgroundColor: 'rgba(0,0,0,0.4)', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3>🔑 인증 정보</h3>
        <p>토큰 존재: {authInfo.hasToken ? '예' : '아니오'}</p>
        <p>토큰 미리보기: {authInfo.tokenPreview}</p>
        <p>사용자 ID: {authInfo.userId || '없음'}</p>
        {authInfo.userInfo && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#aaffaa' }}>
            사용자 정보: {JSON.stringify(authInfo.userInfo, null, 2)}
          </div>
        )}
        <button 
          onClick={checkAuthInfo}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          인증 정보 확인
        </button>
      </div>

      {/* API 테스트 섹션 */}
      <div style={{ 
        backgroundColor: 'rgba(0,0,0,0.4)', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3>🔌 API 연결 테스트</h3>
          <button 
            onClick={runAPITests}
            disabled={isTestingAPIs}
            style={{
              padding: '8px 16px',
              backgroundColor: isTestingAPIs ? '#666' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isTestingAPIs ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            {isTestingAPIs ? '테스트 중...' : 'API 테스트 다시 실행'}
          </button>
        </div>
        
        {apiResults.length > 0 && (
          <div style={{ marginBottom: '15px' }}>
            {apiResults.map((result, index) => (
              <div key={index} style={{ 
                marginBottom: '8px',
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    {getStatusIcon(result.status)} {result.method} {result.endpoint}
                  </span>
                  <span style={{ color: getStatusColor(result.status) }}>
                    {result.statusCode ? `${result.statusCode}` : ''} 
                    {result.responseTime ? ` (${result.responseTime}ms)` : ''}
                  </span>
                </div>
                {result.error && (
                  <div style={{ marginTop: '4px', color: '#ffaaaa', fontSize: '10px' }}>
                    오류: {result.error}
                  </div>
                )}
                {result.data && (
                  <div style={{ marginTop: '4px', color: '#aaffaa', fontSize: '10px', maxHeight: '100px', overflow: 'auto' }}>
                    응답: {JSON.stringify(result.data, null, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        <div style={{ fontSize: '12px', color: '#cccccc' }}>
          {isTestingAPIs ? '⏳ API 테스트 진행 중...' : `📊 총 ${apiResults.length}개 API 테스트 완료`}
        </div>
      </div>

      {/* 로그 섹션 */}
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