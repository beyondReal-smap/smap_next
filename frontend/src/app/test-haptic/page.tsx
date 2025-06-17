'use client';

import React, { useState, useEffect } from 'react';
import { hapticFeedback } from '@/utils/haptic';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export default function HapticTestPage() {
  const { haptic, isIOS } = useHapticFeedback();
  const [logs, setLogs] = useState<string[]>([]);
  const [environment, setEnvironment] = useState<string>('');

  useEffect(() => {
    // 환경 정보 설정
    const userAgent = navigator.userAgent;
    const hasWebKit = !!(window as any).webkit;
    const hasHandler = !!(window as any).webkit?.messageHandlers?.smapIos;
    
    setEnvironment(`
      UserAgent: ${userAgent}
      iOS: ${isIOS}
      WebKit: ${hasWebKit}
      Handler: ${hasHandler}
    `);

    // 콘솔 로그 캡처
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog(...args);
      const message = args.join(' ');
      if (message.includes('[HAPTIC]') || message.includes('햅틱')) {
        setLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
      }
    };

    return () => {
      console.log = originalLog;
    };
  }, [isIOS]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testHaptic = (type: string, description: string) => {
    addLog(`테스트 시작: ${type} - ${description}`);
    
    switch (type) {
      case 'light':
        hapticFeedback.menuSelect({ test: true, type });
        break;
      case 'medium':
        hapticFeedback.buttonClick({ test: true, type });
        break;
      case 'heavy':
        hapticFeedback.error({ test: true, type });
        break;
      case 'success':
        hapticFeedback.success({ test: true, type });
        break;
      case 'warning':
        hapticFeedback.warning({ test: true, type });
        break;
      case 'selection':
        hapticFeedback.sliderMove({ test: true, type });
        break;
    }
  };

  const testAllHaptics = () => {
    const types = [
      { type: 'light', description: '가벼운 터치' },
      { type: 'medium', description: '중간 터치' },
      { type: 'heavy', description: '강한 터치' },
      { type: 'success', description: '성공' },
      { type: 'warning', description: '경고' },
      { type: 'selection', description: '선택' }
    ];

    types.forEach((hapticType, index) => {
      setTimeout(() => {
        testHaptic(hapticType.type, hapticType.description);
      }, index * 1000);
    });
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            🎮 햅틱 피드백 테스트
          </h1>
          <p className="text-sm text-gray-600">
            실제 기기에서 햅틱이 작동하는지 테스트합니다.
          </p>
        </div>

        {/* 환경 정보 */}
        <div className="mb-6 p-4 bg-gray-100 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">환경 정보</h3>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap">
            {environment}
          </pre>
        </div>

        {/* 개별 햅틱 테스트 버튼들 */}
        <div className="space-y-3 mb-6">
          <h3 className="text-lg font-semibold text-gray-800">개별 테스트</h3>
          
          <button
            onClick={() => testHaptic('light', '가벼운 터치')}
            className="w-full p-3 bg-blue-100 hover:bg-blue-200 rounded-lg text-blue-800 font-medium transition-colors"
          >
            💡 Light - 가벼운 터치
          </button>
          
          <button
            onClick={() => testHaptic('medium', '중간 터치')}
            className="w-full p-3 bg-purple-100 hover:bg-purple-200 rounded-lg text-purple-800 font-medium transition-colors"
          >
            🔷 Medium - 중간 터치
          </button>
          
          <button
            onClick={() => testHaptic('heavy', '강한 터치')}
            className="w-full p-3 bg-red-100 hover:bg-red-200 rounded-lg text-red-800 font-medium transition-colors"
          >
            🔶 Heavy - 강한 터치
          </button>
          
          <button
            onClick={() => testHaptic('success', '성공')}
            className="w-full p-3 bg-green-100 hover:bg-green-200 rounded-lg text-green-800 font-medium transition-colors"
          >
            ✅ Success - 성공
          </button>
          
          <button
            onClick={() => testHaptic('warning', '경고')}
            className="w-full p-3 bg-yellow-100 hover:bg-yellow-200 rounded-lg text-yellow-800 font-medium transition-colors"
          >
            ⚠️ Warning - 경고
          </button>
          
          <button
            onClick={() => testHaptic('selection', '선택')}
            className="w-full p-3 bg-indigo-100 hover:bg-indigo-200 rounded-lg text-indigo-800 font-medium transition-colors"
          >
            🎯 Selection - 선택
          </button>
        </div>

        {/* 전체 테스트 버튼 */}
        <div className="space-y-3 mb-6">
          <button
            onClick={testAllHaptics}
            className="w-full p-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg text-white font-bold transition-all transform hover:scale-105"
          >
            🚀 모든 햅틱 순차 테스트 (6초)
          </button>
        </div>

        {/* 로그 영역 */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-800">실시간 로그</h3>
            <button
              onClick={clearLogs}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm text-gray-700 transition-colors"
            >
              지우기
            </button>
          </div>
          
          <div className="h-64 p-3 bg-black rounded-lg overflow-y-auto text-sm font-mono">
            {logs.length === 0 ? (
              <p className="text-green-400">햅틱 버튼을 눌러 로그를 확인하세요...</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-green-400 mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 도움말 */}
        <div className="text-xs text-gray-500 text-center">
          <p>💡 팁: iOS 실제 기기에서 사운드가 꺼져있어도 햅틱은 작동합니다.</p>
          <p>🔧 문제가 있다면 개발자 콘솔을 확인해보세요.</p>
        </div>
      </div>
    </div>
  );
} 