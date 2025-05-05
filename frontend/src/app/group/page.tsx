'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// 모의 그룹 데이터
const MOCK_GROUPS = [
  {
    id: '1',
    name: '개발팀',
    description: '프로젝트 개발 및 일정 관리',
    members: [
      { id: '1', name: '김개발', position: '팀장', avatar: '/avatars/user1.png' },
      { id: '2', name: '이코딩', position: '프론트엔드', avatar: '/avatars/user2.png' },
      { id: '3', name: '박서버', position: '백엔드', avatar: '/avatars/user3.png' },
      { id: '4', name: '최디비', position: 'DBA', avatar: '/avatars/user4.png' },
    ]
  },
  {
    id: '2',
    name: '마케팅팀',
    description: '마케팅 전략 및 일정 공유',
    members: [
      { id: '5', name: '정마케팅', position: '팀장', avatar: '/avatars/user5.png' },
      { id: '6', name: '한기획', position: '기획자', avatar: '/avatars/user6.png' },
      { id: '7', name: '윤디자인', position: '디자이너', avatar: '/avatars/user7.png' },
    ]
  }
];

export default function GroupPage() {
  const [groups, setGroups] = useState(MOCK_GROUPS);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  // 그룹 선택
  const handleGroupSelect = (group: any) => {
    setSelectedGroup(group);
  };

  // 검색 필터링
  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    group.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 새 그룹 추가 모달
  const handleAddGroup = () => {
    setIsAddModalOpen(true);
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-suite">그룹 관리</h1>
        <p className="mt-2 text-gray-600">그룹을 생성하고 관리하여 일정과 장소를 공유하세요</p>
      </div>

      {/* 검색 및 추가 버튼 */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="그룹 검색..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        <button
          onClick={handleAddGroup}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center"
        >
          <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          새 그룹 만들기
        </button>
      </div>

      {/* 그룹 목록 및 상세 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 그룹 목록 */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">내 그룹 목록</h2>
            </div>
            <div className="divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
              {filteredGroups.length > 0 ? (
                filteredGroups.map(group => (
                  <div
                    key={group.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedGroup?.id === group.id ? 'bg-indigo-50' : ''}`}
                    onClick={() => handleGroupSelect(group)}
                  >
                    <h3 className="text-base font-medium text-gray-900">{group.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">{group.description}</p>
                    <p className="mt-2 text-xs text-gray-400">멤버: {group.members.length}명</p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 그룹 상세 정보 */}
        <div className="md:col-span-2">
          {selectedGroup ? (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">{selectedGroup.name}</h2>
                <div className="flex space-x-2">
                  <button className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-indigo-600">
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-red-600">
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-4">
                <p className="text-gray-700">{selectedGroup.description}</p>

                <div className="mt-6">
                  <h3 className="text-base font-medium text-gray-900 mb-3">그룹원 ({selectedGroup.members.length}명)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedGroup.members.map((member: any) => (
                      <div key={member.id} className="flex items-center p-3 border border-gray-200 rounded-lg">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.name} className="h-10 w-10 rounded-full" />
                          ) : (
                            <svg className="h-6 w-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.position}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex justify-center">
                  <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center">
                    <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                    </svg>
                    그룹원 추가
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md p-8 flex flex-col items-center justify-center h-full">
              <svg className="h-16 w-16 text-gray-300 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-500 text-center">그룹을 선택하거나 새 그룹을 만들어보세요</p>
              <button
                onClick={handleAddGroup}
                className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center"
              >
                <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                새 그룹 만들기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 