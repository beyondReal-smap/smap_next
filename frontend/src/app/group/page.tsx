'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageContainer } from '../components/layout';
import { FaUsers, FaLayerGroup, FaXmark, FaUserPlus, FaPlus } from 'react-icons/fa6';
import { RiKakaoTalkFill } from 'react-icons/ri';
import { FiLink, FiChevronRight } from 'react-icons/fi';
import { MdOutlineMessage } from 'react-icons/md';
import { FaCheckCircle } from 'react-icons/fa';

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

/* scaleIn 애니메이션 추가 */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-slideUp {
  animation: slideUp 0.3s ease-out forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.2s ease-out forwards;
}

/* animate-scaleIn 클래스 추가 */
.animate-scaleIn {
  animation: scaleIn 0.2s ease-out forwards;
}
`;

// 모의 그룹 데이터
const MOCK_GROUPS = [
  {
    id: '1',
    name: '개발팀',
    description: '프로젝트 개발 및 일정 관리',
    members: [
      { id: '1', name: '김개발', position: '팀장', avatar: '/images/avatar1.png' },
      { id: '2', name: '이코딩', position: '프론트엔드', avatar: '/images/avatar2.png' },
      { id: '3', name: '박서버', position: '백엔드', avatar: '/images/avatar3.png' },
      { id: '4', name: '최디비', position: 'DBA', avatar: '/images/avatar4.png' },
    ]
  },
  {
    id: '2',
    name: '마케팅팀',
    description: '마케팅 전략 및 일정 공유',
    members: [
      { id: '5', name: '정마케팅', position: '팀장', avatar: '/images/avatar5.png' },
      { id: '6', name: '한기획', position: '기획자', avatar: '/images/avatar6.png' },
      { id: '7', name: '윤디자인', position: '디자이너', avatar: '/images/avatar7.png' },
    ]
  }
];

// 새 그룹 폼 타입 정의
interface GroupForm {
  name: string;
  description: string;
}

// 기존 페이지 로직을 포함하는 내부 컴포넌트
function GroupPageContent() {
  const [groups, setGroups] = useState(MOCK_GROUPS);
  const [selectedGroup, setSelectedGroup] = useState<any>(MOCK_GROUPS[0]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newGroup, setNewGroup] = useState<GroupForm>({ name: '', description: '' });
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
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
    setSelectedGroup(newGroupItem);
    handleCloseModal();
  };

  // 공유 기능 함수들
  const handleShareKakao: () => void = () => {
    console.log("Share via Kakao: Not yet implemented. Group ID: ", selectedGroup?.id);
    alert('카카오톡 공유 기능은 준비 중입니다.');
  };

  const handleCopyLink = () => {
    // 실제 초대 링크 생성 로직 필요 (예: /group/[groupId]/invite)
    const inviteLink = `${window.location.origin}/group/${selectedGroup?.id}/join`; 
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        alert('초대 링크가 복사되었습니다! (임시 링크)');
        setIsShareModalOpen(false);
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
        alert('링크 복사에 실패했습니다.');
      });
  };

  const handleShareSms = () => {
    console.log("Share via SMS: Not yet implemented. Group ID: ", selectedGroup?.id);
    alert('문자 공유 기능은 준비 중입니다.');
  };

  return (
    <PageContainer title="그룹 관리" description="그룹을 생성하고 관리하여 일정과 장소를 공유하세요" showHeader={false} showBackButton={false} className="h-full flex flex-col">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 flex-grow overflow-y-auto bg-gray-50">
        {/* 그룹 목록 - 파란색 계열 테마, 헤더 배경 제거 */}
        <div className="md:col-span-2 h-full flex flex-col">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col border-r-4 border-blue-500">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center">
                <FaUsers className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
                <h2 className="text-lg text-gray-900 font-normal">내 그룹 목록</h2>
              </div>
              <button 
                onClick={handleAddGroup}
                className="inline-flex items-center justify-center p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                aria-label="새 그룹 추가"
              >
                <FaPlus className="h-5 w-5" />
              </button>
            </div>
            <div className="divide-y divide-gray-200 overflow-y-auto flex-grow">
              {filteredGroups.length > 0 ? (
                filteredGroups.map(group => {
                  const isSelected = selectedGroup?.id === group.id;
                  const baseClasses = 'cursor-pointer transition-colors duration-150 ease-in-out px-4 py-2';
                  const selectedClasses = isSelected ? 'bg-blue-100' : 'hover:bg-gray-100';

                  return (
                    <div
                      key={group.id}
                      className={`${baseClasses} ${selectedClasses}`}
                      onClick={() => handleGroupSelect(group)}
                    >
                      <div className="flex items-center">
                        {isSelected ? (
                          <FaCheckCircle className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
                        ) : (
                          <div className="w-4 h-4 mr-2 flex-shrink-0"></div>
                        )}
                        <div>
                          <h3 className="text-base font-medium text-gray-900">{group.name}</h3>
                          <p className="mt-1 text-sm text-gray-500">{group.description}</p>
                          <p className="mt-2 text-xs text-gray-400">멤버: {group.members.length}명</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-gray-500">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 그룹 상세 정보 - 주황색 계열 테마, 헤더 배경 제거 */}
        <div className="md:col-span-3 h-full flex flex-col">
          {selectedGroup ? (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col border-r-4 border-orange-500">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center">
                  <FaLayerGroup className="w-5 h-5 text-orange-600 mr-2 flex-shrink-0" />
                  <h2 className="text-lg text-gray-900 font-normal">{selectedGroup.name}</h2>
                </div>
                {/* 액션 버튼 그룹: 수정, 삭제, 그룹원 추가 순서로 변경 */}
                <div className="flex items-center space-x-2">
                  {/* 수정 버튼 (아이콘) */}
                  <button className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-colors duration-150 ease-in-out">
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  {/* 삭제 버튼 (아이콘) */}
                  <button className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors duration-150 ease-in-out">
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {/* 그룹원 추가 버튼 (아이콘만) */}
                  <button 
                    onClick={() => setIsShareModalOpen(true)}
                    className="p-2 rounded-full bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                  >
                    <FaUserPlus className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto flex-grow bg-white">
                <p className="text-gray-700">{selectedGroup.description}</p>
                <div className="mt-6">
                  <h3 className="text-base font-medium text-gray-900 mb-3">그룹원 ({selectedGroup.members.length}명)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedGroup.members.map((member: any) => (
                      <div key={member.id} className="flex items-center p-3 border border-gray-300 rounded-lg bg-gray-100 hover:shadow-md hover:border-indigo-400 transition-all duration-150 ease-in-out">
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
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center justify-center h-full border-r-4 border-gray-300">
              <svg className="h-20 w-20 text-gray-300 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-lg font-medium text-gray-400 text-center">그룹을 선택하세요</p>
            </div>
          )}
        </div>
      </div>

      {/* 새 그룹 추가 모달 */}
      {isAddModalOpen && (
        <>
          <style jsx global>{modalAnimation}</style>
          <div 
            className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out"
            onClick={handleCloseModal}
          >
            <div 
              className="bg-white rounded-lg shadow-xl max-w-lg w-full animate-scaleIn text-left overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 수정 */}
              <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-200">
                <h3 className="text-xl leading-6 font-semibold text-gray-900 font-light">새 그룹 만들기</h3>
                <button 
                  onClick={handleCloseModal}
                  className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  aria-label="닫기"
                >
                  <FaXmark className="h-5 w-5" />
                </button>
              </div>

              {/* 모달 본문 수정 */}
              <div className="px-5 pt-8 pb-4 flex flex-col">
                <label htmlFor="name" className="mb-2 font-semibold text-gray-700">그룹명</label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={newGroup.name}
                  onChange={handleInputChange}
                  className="w-full bg-gray-100 rounded-2xl px-4 py-4 text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 border-none"
                  placeholder="그룹 이름을 입력하세요"
                />
                <label htmlFor="description" className="mb-2 font-semibold text-gray-700">그룹 설명</label>
                <textarea
                  name="description"
                  id="description"
                  rows={4}
                  value={newGroup.description}
                  onChange={handleInputChange}
                  className="w-full bg-gray-100 rounded-2xl px-4 py-4 text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 border-none resize-none"
                  placeholder="그룹에 대한 설명을 입력하세요 (선택 사항)"
                />
              </div>
              {/* 모달 푸터 수정 */}
              <div className="flex flex-col gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleSaveGroup}
                  className="w-full max-w-xs mx-auto py-4 rounded-2xl bg-indigo-600 text-white text-lg font-bold shadow-md active:bg-indigo-700 transition disabled:opacity-50"
                  disabled={newGroup.name.trim() === ''}
                >
                  그룹 만들기
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full max-w-xs mx-auto py-4 rounded-2xl bg-gray-100 text-gray-700 text-lg font-bold shadow-md active:bg-gray-200 transition mb-6"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 공유 모달 */}
      {isShareModalOpen && selectedGroup && (
        <>
          <style jsx global>{modalAnimation}</style>
          <div 
            className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 animate-fadeIn"
            onClick={() => setIsShareModalOpen(false)}
          >
            <div 
              className="bg-white rounded-2xl shadow-xl max-w-md w-full px-5 pt-8 pb-4 flex flex-col relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="text-xl font-semibold text-center mb-8">그룹 초대</div>
              <div className="space-y-3 mb-6">
                <button onClick={handleShareKakao} className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-[#FEE500] text-[#3C1E1E] font-normal text-base shadow-sm hover:bg-yellow-200 transition">
                  <RiKakaoTalkFill className="h-7 w-7" />
                  카카오톡으로 공유
                </button>
                <button onClick={handleCopyLink} className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-pink-700 text-white font-normal text-base shadow-sm hover:bg-pink-900 transition">
                  <FiLink className="h-7 w-7 text-pink-200" />
                  초대 링크 복사
                </button>
                <button onClick={handleShareSms} className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-indigo-700 text-white font-normal text-base shadow-sm hover:bg-green-200 transition">
                  <MdOutlineMessage className="h-7 w-7 text-indigo-200" />
                  문자/주소록으로 공유
                </button>
              </div>
              <button type="button" onClick={() => setIsShareModalOpen(false)} className="w-full max-w-xs mx-auto py-4 rounded-2xl bg-gray-100 text-gray-700 text-lg font-normal shadow-sm active:bg-gray-200 transition mb-2 mt-2">닫기</button>
            </div>
          </div>
        </> 
      )}
    </PageContainer>
  );
}

// 페이지를 Suspense로 감싸는 기본 export 함수
export default function GroupPageWithSuspense() {
  return (
    <Suspense fallback={<div>Loading...</div>}> 
      <GroupPageContent />
    </Suspense>
  );
} 