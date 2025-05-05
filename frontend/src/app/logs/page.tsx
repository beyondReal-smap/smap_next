'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 모의 로그 데이터
const MOCK_LOGS = [
  {
    id: '1',
    type: 'schedule',
    action: 'create',
    title: '팀 미팅 일정이 생성되었습니다.',
    description: '9월 15일 오후 2시 - 강남 사무실',
    user: '김철수',
    timestamp: '2023-09-10T14:32:00',
  },
  {
    id: '2',
    type: 'location',
    action: 'update',
    title: '장소 정보가 업데이트되었습니다.',
    description: '강남 사무실 - 주소 변경',
    user: '이영희',
    timestamp: '2023-09-09T11:15:00',
  },
  {
    id: '3',
    type: 'group',
    action: 'add_member',
    title: '그룹원이 추가되었습니다.',
    description: '개발팀 - 박지민 추가',
    user: '김철수',
    timestamp: '2023-09-08T16:45:00',
  },
  {
    id: '4',
    type: 'schedule',
    action: 'delete',
    title: '일정이 취소되었습니다.',
    description: '9월 12일 프로젝트 중간점검 - 취소',
    user: '이영희',
    timestamp: '2023-09-07T09:20:00',
  },
  {
    id: '5',
    type: 'location',
    action: 'create',
    title: '새 장소가 등록되었습니다.',
    description: '을지로 오피스 - 추가됨',
    user: '김철수',
    timestamp: '2023-09-06T13:10:00',
  },
  {
    id: '6',
    type: 'group',
    action: 'remove_member',
    title: '그룹원이 제거되었습니다.',
    description: '마케팅팀 - 홍길동 제거',
    user: '정민지',
    timestamp: '2023-09-05T15:30:00',
  },
  {
    id: '7',
    type: 'schedule',
    action: 'update',
    title: '일정이 수정되었습니다.',
    description: '9월 20일 고객 미팅 - 시간 변경',
    user: '이영희',
    timestamp: '2023-09-04T10:25:00',
  }
];

export default function LogsPage() {
  const [logs, setLogs] = useState(MOCK_LOGS);
  const [filteredLogs, setFilteredLogs] = useState(MOCK_LOGS);
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  // 필터링 적용
  useEffect(() => {
    let filtered = logs;
    
    // 유형 필터링
    if (selectedType !== 'all') {
      filtered = filtered.filter(log => log.type === selectedType);
    }
    
    // 검색어 필터링
    if (searchQuery) {
      filtered = filtered.filter(log => 
        log.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredLogs(filtered);
  }, [logs, selectedType, searchQuery]);

  // 타임스탬프 포맷팅
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // 로그 유형 아이콘 및 배경색 지정
  const getLogTypeStyles = (type: string) => {
    switch(type) {
      case 'schedule':
        return {
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-600'
        };
      case 'location':
        return {
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          ),
          bgColor: 'bg-green-100',
          textColor: 'text-green-600'
        };
      case 'group':
        return {
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-600'
        };
      default:
        return {
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-600'
        };
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-suite">활동 로그</h1>
        <p className="mt-2 text-gray-600">일정, 장소, 그룹 관련 활동 기록을 확인하세요</p>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white p-4 rounded-xl shadow-md mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full sm:w-auto">
            <select
              className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="all">전체 유형</option>
              <option value="schedule">일정</option>
              <option value="location">장소</option>
              <option value="group">그룹</option>
            </select>
          </div>
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="검색..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 로그 목록 */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {filteredLogs.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredLogs.map(log => {
              const { icon, bgColor, textColor } = getLogTypeStyles(log.type);
              
              return (
                <div key={log.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start">
                    <div className={`flex-shrink-0 rounded-md p-2 ${bgColor} ${textColor}`}>
                      {icon}
                    </div>
                    
                    <div className="ml-4 flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="text-sm font-medium text-gray-900">{log.title}</h3>
                        <span className="text-xs text-gray-500">{formatTimestamp(log.timestamp)}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{log.description}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        <span>작업자: {log.user}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>표시할 로그가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
} 