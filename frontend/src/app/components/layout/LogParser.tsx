'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ParsedLogData {
  level: string;
  message: string;
  timestamp: string;
  data?: {
    hapticType?: string;
    description?: string;
    page?: string;
    fullPath?: string;
    timestamp?: string;
    context?: {
      action?: string;
      component?: string;
      menuName?: string;
      menuPath?: string;
      currentPath?: string;
      iconType?: string;
      [key: string]: any;
    };
    environment?: string;
    [key: string]: any;
  };
}

const LogParser: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedLogData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseLogMessage = (logMessage: string) => {
    try {
      setParseError(null);
      
      // iOS 로그 메시지에서 param 부분 추출
      const paramMatch = logMessage.match(/param\s*=\s*"([^"]+)"/);
      if (!paramMatch) {
        throw new Error('param을 찾을 수 없습니다.');
      }
      
      // 유니코드 이스케이프 시퀀스를 실제 문자로 변환
      let paramStr = paramMatch[1];
      paramStr = paramStr.replace(/\\u([0-9a-fA-F]{4})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      });
      
      // JSON 이스케이프 처리
      paramStr = paramStr.replace(/\\"/g, '"');
      paramStr = paramStr.replace(/\\\\/g, '\\');
      
      // JSON 파싱
      const parsed = JSON.parse(paramStr);
      
      // data 필드가 문자열이면 다시 파싱
      if (parsed.data && typeof parsed.data === 'string') {
        try {
          parsed.data = JSON.parse(parsed.data);
        } catch (e) {
          console.warn('data 필드 파싱 실패:', e);
        }
      }
      
      setParsedData(parsed);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : '파싱 중 오류가 발생했습니다.');
      setParsedData(null);
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'info': return 'text-blue-600 bg-blue-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '📝';
    }
  };

  const getHapticIcon = (hapticType: string) => {
    switch (hapticType) {
      case 'light': return '🔥';
      case 'medium': return '💪';
      case 'heavy': return '⚡';
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'selection': return '👆';
      default: return '📳';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Seoul'
      });
    } catch (e) {
      return timestamp;
    }
  };

  return (
    <>
      {/* 로그 파서 토글 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 left-4 z-50 bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors"
        style={{ fontSize: '12px' }}
      >
        📋
      </button>

      {/* 로그 파서 모달 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* 헤더 */}
              <div className="bg-green-100 px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold text-green-800">📱 iOS 로그 파서</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>

              {/* 내용 */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {/* 입력 영역 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    iOS 로그 메시지 입력:
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="message smapIos body { param = ...; type = ...; } 형태의 로그를 붙여넣으세요"
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => parseLogMessage(inputText)}
                      disabled={!inputText.trim()}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      파싱하기
                    </button>
                    <button
                      onClick={() => {
                        setInputText('');
                        setParsedData(null);
                        setParseError(null);
                      }}
                      className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                    >
                      초기화
                    </button>
                  </div>
                </div>

                {/* 에러 표시 */}
                {parseError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg"
                  >
                    <div className="flex items-center">
                      <span className="text-red-600 text-lg mr-2">❌</span>
                      <span className="text-red-700 font-medium">파싱 오류</span>
                    </div>
                    <p className="text-red-600 mt-1">{parseError}</p>
                  </motion.div>
                )}

                {/* 파싱 결과 */}
                {parsedData && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* 기본 정보 */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <span className="mr-2">🔧</span>
                        메시지 기본 정보
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-3 rounded border">
                          <span className="text-sm text-gray-500">레벨</span>
                          <div className="flex items-center mt-1">
                            <span className="mr-2">{getLogLevelIcon(parsedData.level)}</span>
                            <span className={`px-2 py-1 rounded text-sm font-medium ${getLogLevelColor(parsedData.level)}`}>
                              {parsedData.level.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <span className="text-sm text-gray-500">타임스탬프</span>
                          <div className="text-sm font-mono mt-1">
                            {formatTimestamp(parsedData.timestamp)}
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <span className="text-sm text-gray-500">환경</span>
                          <div className="text-sm font-medium mt-1">
                            {parsedData.data?.environment || 'Unknown'}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 bg-white p-3 rounded border">
                        <span className="text-sm text-gray-500">메시지</span>
                        <div className="text-sm font-medium mt-1">{parsedData.message}</div>
                      </div>
                    </div>

                    {/* 햅틱 피드백 정보 */}
                    {parsedData.data?.hapticType && (
                      <div className="bg-orange-50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-orange-800 mb-3 flex items-center">
                          <span className="mr-2">🎯</span>
                          햅틱 피드백 정보
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white p-3 rounded border">
                            <span className="text-sm text-gray-500">햅틱 타입</span>
                            <div className="flex items-center mt-1">
                              <span className="mr-2">{getHapticIcon(parsedData.data.hapticType)}</span>
                              <span className="font-medium">{parsedData.data.hapticType}</span>
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <span className="text-sm text-gray-500">액션 설명</span>
                            <div className="text-sm font-medium mt-1">
                              {parsedData.data.description || '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 페이지/위치 정보 */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-blue-800 mb-3 flex items-center">
                        <span className="mr-2">📍</span>
                        페이지/위치 정보
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded border">
                          <span className="text-sm text-gray-500">현재 페이지</span>
                          <div className="text-sm font-mono mt-1">
                            {parsedData.data?.page || parsedData.data?.context?.currentPath || '-'}
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <span className="text-sm text-gray-500">전체 경로</span>
                          <div className="text-sm font-mono mt-1">
                            {parsedData.data?.fullPath || parsedData.data?.context?.currentPath || '-'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 상호작용 세부사항 */}
                    {parsedData.data?.context && (
                      <div className="bg-purple-50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center">
                          <span className="mr-2">🎮</span>
                          상호작용 세부사항
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(parsedData.data.context).map(([key, value]) => (
                            <div key={key} className="bg-white p-3 rounded border">
                              <span className="text-sm text-gray-500 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                              </span>
                              <div className="text-sm font-medium mt-1">
                                {typeof value === 'string' ? value : JSON.stringify(value)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 전체 JSON */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <span className="mr-2">📄</span>
                        전체 JSON 데이터
                      </h3>
                      <pre className="bg-black text-green-400 p-4 rounded overflow-x-auto text-xs">
                        {JSON.stringify(parsedData, null, 2)}
                      </pre>
                    </div>
                  </motion.div>
                )}

                {/* 사용 예시 */}
                {!parsedData && !parseError && (
                  <div className="text-center text-gray-500 py-8">
                    <div className="text-6xl mb-4">📱</div>
                    <h3 className="text-lg font-medium mb-2">iOS 로그 파서</h3>
                    <p className="text-sm mb-4">
                      iOS WebView에서 전송된 로그 메시지를 붙여넣어 예쁘게 파싱해보세요.
                    </p>
                    <div className="bg-gray-100 p-3 rounded text-left text-xs">
                      <div className="font-medium mb-1">예시:</div>
                      <code>
                        message smapIos<br/>
                        body &#123;<br/>
                        &nbsp;&nbsp;param = "&#123;\"level\":\"info\",\"message\":\"햅틱 피드백 실행\"...&#125;";<br/>
                        &nbsp;&nbsp;type = jsLog;<br/>
                        &#125;
                      </code>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LogParser; 