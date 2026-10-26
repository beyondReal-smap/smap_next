'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { useUser } from '@/contexts/UserContext';

interface DiagnosticResult {
  component: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Context 훅들
  const auth = useAuth();
  const dataCache = useDataCache();
  const user = useUser();

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: DiagnosticResult[] = [];

    try {
      // 1. 로컬스토리지 토큰 확인
      const token = localStorage.getItem('auth-token');
      results.push({
        component: 'localStorage Token',
        status: token ? 'success' : 'error',
        message: token ? '토큰 존재함' : '토큰 없음',
        details: token ? { tokenLength: token.length, tokenStart: token.substring(0, 20) + '...' } : null
      });

      // 2. AuthContext 상태 확인
      results.push({
        component: 'AuthContext',
        status: auth.isLoggedIn ? 'success' : 'error',
        message: auth.isLoggedIn ? '로그인됨' : '로그인 안됨',
        details: {
          loading: auth.loading,
          user: auth.user ? { mt_idx: auth.user.mt_idx, mt_name: auth.user.mt_name } : null,
          selectedGroup: auth.selectedGroup ? { sgt_idx: auth.selectedGroup.sgt_idx, sgt_title: auth.selectedGroup.sgt_title } : null,
          error: auth.error
        }
      });

      // 3. UserContext 상태 확인
      results.push({
        component: 'UserContext',
        status: user.userInfo ? 'success' : user.isUserDataLoading ? 'warning' : 'error',
        message: user.userInfo ? '사용자 데이터 있음' : user.isUserDataLoading ? '로딩 중...' : '사용자 데이터 없음',
        details: {
          userInfo: user.userInfo ? { mt_idx: user.userInfo.mt_idx, name: user.userInfo.name } : null,
          selectedGroupId: user.selectedGroupId,
          userGroups: user.userGroups ? user.userGroups.length : 0,
          isUserDataLoading: user.isUserDataLoading,
          userDataError: user.userDataError,
          // AuthContext 의존성 상태
          authContext: {
            isLoggedIn: auth.isLoggedIn,
            loading: auth.loading,
            isPreloadingComplete: auth.isPreloadingComplete,
            hasUser: !!auth.user,
            userId: auth.user?.mt_idx || null
          }
        }
      });

      // 4. API 연결 테스트
      try {
        const testResponse = await fetch('/api/groups', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        results.push({
          component: 'API Connection',
          status: testResponse.ok ? 'success' : 'error',
          message: testResponse.ok ? 'API 연결 성공' : `API 연결 실패 (${testResponse.status})`,
          details: {
            status: testResponse.status,
            statusText: testResponse.statusText,
            url: '/api/groups'
          }
        });

        if (testResponse.ok) {
          const data = await testResponse.json();
          results.push({
            component: 'Groups API Data',
            status: data.success ? 'success' : 'warning',
            message: data.success ? `그룹 데이터 ${data.data?.length || 0}개` : '그룹 데이터 오류',
            details: data
          });
        }
      } catch (apiError) {
        results.push({
          component: 'API Connection',
          status: 'error',
          message: 'API 연결 예외 발생',
          details: { error: apiError instanceof Error ? apiError.message : String(apiError) }
        });
      }

      // 5. DataCache 상태 확인
      const cachedGroups = dataCache.getUserGroups();
      const cachedProfile = dataCache.getUserProfile();
      
      results.push({
        component: 'DataCache',
        status: (cachedGroups || cachedProfile) ? 'success' : 'warning',
        message: `캐시된 데이터: ${cachedGroups ? '그룹 ' : ''}${cachedProfile ? '프로필 ' : ''}${!cachedGroups && !cachedProfile ? '없음' : ''}`,
        details: {
          groups: cachedGroups?.length || 0,
          profile: cachedProfile ? { mt_idx: cachedProfile.mt_idx, mt_name: cachedProfile.mt_name } : null
        }
      });

      // 6. 백엔드 직접 연결 테스트
      try {
        const userId = auth.user?.mt_idx || user.userInfo?.mt_idx;
        if (userId) {
          const directResponse = await fetch(`https://api3.aiagnt.kr/api/v1/groups/member/${userId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });
          
          results.push({
            component: 'Direct Backend',
            status: directResponse.ok ? 'success' : 'error',
            message: directResponse.ok ? '백엔드 직접 연결 성공' : `백엔드 직접 연결 실패 (${directResponse.status})`,
            details: {
              status: directResponse.status,
              statusText: directResponse.statusText,
              userId,
              url: `https://api3.aiagnt.kr/api/v1/groups/member/${userId}`
            }
          });
        }
      } catch (backendError) {
        results.push({
          component: 'Direct Backend',
          status: 'error',
          message: '백엔드 직접 연결 예외',
          details: { error: backendError instanceof Error ? backendError.message : String(backendError) }
        });
      }

    } catch (error) {
      results.push({
        component: 'Diagnostics',
        status: 'error',
        message: '진단 중 오류 발생',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  return (
    <>
      {/* 디버그 패널 토글 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        style={{ fontSize: '12px' }}
      >
        🔧
      </button>

      {/* 디버그 패널 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* 헤더 */}
            <div className="bg-gray-100 px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">데이터 로딩 진단</h2>
              <div className="flex gap-2">
                <button
                  onClick={runDiagnostics}
                  disabled={isRunning}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRunning ? '진단 중...' : '진단 실행'}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 내용 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {diagnostics.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  진단을 실행하여 데이터 로딩 상태를 확인하세요.
                </div>
              ) : (
                <div className="space-y-4">
                  {diagnostics.map((result, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getStatusIcon(result.status)}</span>
                          <h3 className="font-semibold text-gray-800">{result.component}</h3>
                        </div>
                        <span className={`px-2 py-1 rounded text-sm font-medium ${getStatusColor(result.status)}`}>
                          {result.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-2">{result.message}</p>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                            세부 정보 보기
                          </summary>
                          <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DebugPanel; 