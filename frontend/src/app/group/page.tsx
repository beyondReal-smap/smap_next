'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageContainer } from '../components/layout';

// CSS 애니메이션 키프레임 스타일 (최상단에 추가)
const modalAnimation = `
@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.animate-slideUp {
  animation: slideUp 0.3s ease-out forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.2s ease-out forwards;
}
`;

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

// 새 그룹 폼 타입 정의
interface GroupForm {
  name: string;
  description: string;
}

export default function GroupPage() {
  const [groups, setGroups] = useState(MOCK_GROUPS);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newGroup, setNewGroup] = useState<GroupForm>({ name: '', description: '' });
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

  // 모달 닫기
  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setNewGroup({ name: '', description: '' });
  };

  // 새 그룹 입력 핸들러
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewGroup(prev => ({ ...prev, [name]: value }));
  };

  // 새 그룹 저장
  const handleSaveGroup = () => {
    if (newGroup.name.trim() === '') return;
    
    const newGroupItem = {
      id: `${groups.length + 1}`,
      name: newGroup.name,
      description: newGroup.description,
      members: []
    };
    
    setGroups([...groups, newGroupItem]);
    handleCloseModal();
  };

  return (
    <PageContainer title="그룹 관리" description="그룹을 생성하고 관리하여 일정과 장소를 공유하세요" showHeader={false}>
      {/* 그룹 목록 및 상세 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* 그룹 목록 */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-2 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">내 그룹 목록</h2>
              <button 
                onClick={handleAddGroup}
                className="inline-flex items-center justify-center p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                aria-label="새 그룹 추가"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="divide-y divide-gray-200 max-h-[70vh] overflow-y-auto">
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
        <div className="md:col-span-3">
          {selectedGroup ? (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-2 border-b border-gray-200 flex justify-between items-center">
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
              <p className="text-gray-500 text-center">그룹을 선택하세요</p>
            </div>
          )}
        </div>
      </div>

      {/* 새 그룹 추가 모달 */}
      {isAddModalOpen && (
        <>
          <style jsx global>{modalAnimation}</style>
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="flex items-end md:items-center justify-center min-h-screen text-center md:p-4">
              <div className="fixed inset-0 transition-opacity backdrop-blur-sm" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-70 animate-fadeIn"></div>
              </div>

              <div className="relative w-full md:inline-block md:align-middle md:max-w-lg bg-white md:rounded-lg text-left overflow-hidden shadow-xl transform transition-all animate-slideUp md:animate-fadeIn">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                      <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">새 그룹 만들기</h3>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                            그룹명
                          </label>
                          <input
                            type="text"
                            name="name"
                            id="name"
                            value={newGroup.name}
                            onChange={handleInputChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            placeholder="그룹 이름을 입력하세요"
                          />
                        </div>
                        <div>
                          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                            그룹 설명
                          </label>
                          <textarea
                            name="description"
                            id="description"
                            rows={3}
                            value={newGroup.description}
                            onChange={handleInputChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            placeholder="그룹에 대한 설명을 입력하세요"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleSaveGroup}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    그룹 만들기
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
} 