'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// import Image from 'next/image'; // 더 이상 사용하지 않으므로 주석 처리 또는 삭제
import { PageContainer } from '../components/layout';
import { FaUsers, FaLayerGroup, FaXmark, FaUserPlus, FaPlus } from 'react-icons/fa6';
import { RiKakaoTalkFill } from 'react-icons/ri';
import { FiLink, FiChevronRight } from 'react-icons/fi';
import { MdOutlineMessage } from 'react-icons/md';
import { FaCheckCircle } from 'react-icons/fa';
import groupService, { Group } from '@/services/groupService';
import memberService from '@/services/memberService';
import LoadingSpinner from '../components/common/LoadingSpinner';

export const dynamic = 'force-dynamic';

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
  animation: fadeIn 1s ease-out forwards;
}

/* animate-scaleIn 클래스 추가 */
.animate-scaleIn {
  animation: scaleIn 0.2s ease-out forwards;
}
`;

// 새 그룹 폼 타입 정의
interface GroupForm {
  name: string;
  description: string;
}

// GroupMember 타입 정의 (홈 페이지와 동일)
interface GroupMember {
  mt_idx: number;
  mt_type: number;
  mt_level: number;
  mt_status: number;
  mt_id: string;
  mt_name: string;
  mt_nickname: string;
  mt_hp: string;
  mt_email: string;
  mt_birth?: string;
  mt_gender: number;
  mt_file1: string;
  mt_lat: number;
  mt_long: number;
  mt_sido: string;
  mt_gu: string;
  mt_dong: string;
  mt_onboarding?: string;
  mt_push1?: string;
  mt_plan_check?: string;
  mt_plan_date?: string;
  mt_weather_pop?: string;
  mt_weather_sky: number;
  mt_weather_tmn: number;
  mt_weather_tmx: number;
  mt_weather_date: string;
  mt_ldate: string;
  mt_adate: string;
  // 그룹 상세 정보
  sgdt_idx: number;
  sgt_idx: number;
  sgdt_owner_chk: string;
  sgdt_leader_chk: string;
  sgdt_discharge?: string;
  sgdt_group_chk?: string;
  sgdt_exit?: string;
  sgdt_show?: string;
  sgdt_push_chk?: string;
  sgdt_wdate?: string;
  sgdt_udate?: string;
  sgdt_ddate?: string;
  sgdt_xdate?: string;
  sgdt_adate?: string;
}

// 기존 페이지 로직을 포함하는 내부 컴포넌트
function GroupPageContent() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupMemberCounts, setGroupMemberCounts] = useState<{[key: number]: number}>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newGroup, setNewGroup] = useState<GroupForm>({ name: '', description: '' });
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const router = useRouter();

  // 사용자 그룹 목록 조회
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const data = await groupService.getMyGroups(1186);
        console.log('[Group Page] 그룹 목록 조회 결과:', data);
        setGroups(data);
        
        // 첫 번째 그룹을 기본 선택
        if (data.length > 0) {
          setSelectedGroup(data[0]);
        }

        // 각 그룹의 멤버 수 조회
        const memberCounts: {[key: number]: number} = {};
        for (const group of data) {
          try {
            const members = await memberService.getGroupMembers(group.sgt_idx.toString());
            memberCounts[group.sgt_idx] = members.length;
            console.log(`[Group Page] 그룹 ${group.sgt_title} 멤버 수:`, members.length);
          } catch (error) {
            console.error(`[Group Page] 그룹 ${group.sgt_idx} 멤버 수 조회 오류:`, error);
            memberCounts[group.sgt_idx] = 0;
          }
        }
        setGroupMemberCounts(memberCounts);
        
      } catch (error) {
        console.error('[Group Page] 그룹 목록 조회 오류:', error);
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, []);

  // 선택된 그룹의 멤버 목록 조회
  useEffect(() => {
    const fetchGroupMembers = async () => {
      if (!selectedGroup) {
        setGroupMembers([]);
        return;
      }

      try {
        setMembersLoading(true);
        console.log('[Group Page] 그룹 멤버 조회 시작:', selectedGroup.sgt_idx);
        
        // memberService 사용 (홈 페이지와 동일)
        const memberData = await memberService.getGroupMembers(selectedGroup.sgt_idx.toString());
        console.log('[Group Page] 그룹 멤버 조회 결과:', memberData);
        
        // 홈 페이지와 동일한 방식으로 데이터 변환
        const transformedMembers: GroupMember[] = memberData.map((member: any, index: number) => ({
          mt_idx: member.mt_idx,
          mt_type: member.mt_type || 1,
          mt_level: member.mt_level || 2,
          mt_status: member.mt_status || 1,
          mt_id: member.mt_id || '',
          mt_name: member.mt_name || `멤버 ${index + 1}`,
          mt_nickname: member.mt_nickname || member.mt_name || `멤버 ${index + 1}`,
          mt_hp: member.mt_hp || '',
          mt_email: member.mt_email || '',
          mt_birth: member.mt_birth,
          mt_gender: member.mt_gender || 1,
          mt_file1: member.mt_file1 || '',
          mt_lat: parseFloat(member.mt_lat || '37.5642'),
          mt_long: parseFloat(member.mt_long || '127.0016'),
          mt_sido: member.mt_sido || '',
          mt_gu: member.mt_gu || '',
          mt_dong: member.mt_dong || '',
          mt_onboarding: member.mt_onboarding,
          mt_push1: member.mt_push1,
          mt_plan_check: member.mt_plan_check,
          mt_plan_date: member.mt_plan_date,
          mt_weather_pop: member.mt_weather_pop,
          mt_weather_sky: member.mt_weather_sky || 1,
          mt_weather_tmn: member.mt_weather_tmn || 15,
          mt_weather_tmx: member.mt_weather_tmx || 25,
          mt_weather_date: member.mt_weather_date || new Date().toISOString(),
          mt_ldate: member.mt_ldate || new Date().toISOString(),
          mt_adate: member.mt_adate || new Date().toISOString(),
          // 그룹 상세 정보 (기본값 설정)
          sgdt_idx: member.sgdt_idx || index + 1,
          sgt_idx: selectedGroup.sgt_idx,
          sgdt_owner_chk: member.sgdt_owner_chk || (index === 0 ? 'Y' : 'N'), // 첫 번째는 그룹장
          sgdt_leader_chk: member.sgdt_leader_chk || 'N',
          sgdt_discharge: member.sgdt_discharge || 'N',
          sgdt_group_chk: member.sgdt_group_chk || 'Y',
          sgdt_exit: member.sgdt_exit || 'N',
          sgdt_show: member.sgdt_show || 'Y',
          sgdt_push_chk: member.sgdt_push_chk || 'Y',
          sgdt_wdate: member.sgdt_wdate,
          sgdt_udate: member.sgdt_udate,
          sgdt_ddate: member.sgdt_ddate,
          sgdt_xdate: member.sgdt_xdate,
          sgdt_adate: member.sgdt_adate,
        }));
        
        setGroupMembers(transformedMembers);
      } catch (error) {
        console.error('[Group Page] 그룹 멤버 조회 오류:', error);
        setGroupMembers([]);
      } finally {
        setMembersLoading(false);
      }
    };

    fetchGroupMembers();
  }, [selectedGroup]);

  // 그룹 선택
  const handleGroupSelect = (group: Group) => {
    setSelectedGroup(group);
  };

  // 검색 필터링
  const filteredGroups = groups.filter(group => 
    group.sgt_title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (group.sgt_content && group.sgt_content.toLowerCase().includes(searchQuery.toLowerCase()))
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

  // 새 그룹 저장 (추후 API 연동 필요)
  const handleSaveGroup = () => {
    if (newGroup.name.trim() === '') return;
    
    // TODO: 실제 그룹 생성 API 호출
    const newGroupItem: Group = {
      sgt_idx: groups.length + 1,
      sgt_title: newGroup.name,
      sgt_content: newGroup.description,
      mt_idx: 1186,
      sgt_show: 'Y',
      sgt_wdate: new Date().toISOString(),
      memberCount: 0
    };
    
    setGroups([...groups, newGroupItem]);
    setSelectedGroup(newGroupItem);
    handleCloseModal();
  };

  // 공유 기능 함수들
  const handleShareKakao: () => void = () => {
    console.log("Share via Kakao: Not yet implemented. Group ID: ", selectedGroup?.sgt_idx);
    alert('카카오톡 공유 기능은 준비 중입니다.');
  };

  const handleCopyLink = () => {
    // 실제 초대 링크 생성 로직 필요 (예: /group/[groupId]/invite)
    const inviteLink = `${window.location.origin}/group/${selectedGroup?.sgt_idx}/join`; 
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
    console.log("Share via SMS: Not yet implemented. Group ID: ", selectedGroup?.sgt_idx);
    alert('문자 공유 기능은 준비 중입니다.');
  };

  // 로딩 중일 때
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
        <LoadingSpinner 
          message="그룹 목록을 불러오는 중입니다..." 
          fullScreen={true}
          type="ripple"
          size="md"
          color="indigo"
        />
      </div>
    );
  }

  return (
    <PageContainer title="그룹 관리" description="그룹을 생성하고 관리하여 일정과 장소를 공유하세요" showHeader={false} showBackButton={false} className="h-full flex flex-col bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 flex-grow p-6 overflow-auto">
        {/* 그룹 목록 - 파란색 계열 테마, 헤더 배경 제거 */}
        <div className="md:col-span-2 flex flex-col md:mb-0">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col border-r-4 border-blue-500">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center">
                {/* 로고 제거: <Image src="/images/smap_logo.webp" alt="SMAP Logo" width={24} height={24} className="mr-2" /> */}
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
                  const isSelected = selectedGroup?.sgt_idx === group.sgt_idx;
                  const baseClasses = 'cursor-pointer transition-all duration-200 ease-in-out px-4 py-3 border-l-4';
                  const selectedClasses = isSelected 
                    ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-l-blue-500 shadow-lg transform scale-[1.02]' 
                    : 'border-l-transparent hover:bg-gray-50 hover:border-l-blue-200';

                  return (
                    <div
                      key={group.sgt_idx}
                      className={`${baseClasses} ${selectedClasses}`}
                      onClick={() => handleGroupSelect(group)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-1">
                          {isSelected ? (
                            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center mr-3 flex-shrink-0">
                              <FaCheckCircle className="w-3 h-3 text-white" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 mr-3 flex-shrink-0"></div>
                          )}
                          <div className="flex-1">
                            <h3 className={`text-base font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                              {group.sgt_title}
                            </h3>
                            <p className={`mt-1 text-sm ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                              {group.sgt_content}
                            </p>
                          </div>
                        </div>
                        <div className="ml-3 flex items-center">
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            isSelected 
                              ? 'bg-blue-200 text-blue-800' 
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {groupMemberCounts[group.sgt_idx] || 0}명
                          </div>
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
        <div className="md:col-span-3 flex flex-col pb-16">
          {selectedGroup ? (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col border-r-4 border-orange-500">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center">
                  {/* 로고 제거: <Image src="/images/smap_logo.webp" alt="SMAP Logo" width={24} height={24} className="mr-2" /> */}
                  <FaLayerGroup className="w-5 h-5 text-orange-600 mr-2 flex-shrink-0" />
                  <h2 className="text-lg text-gray-900 font-normal">{selectedGroup.sgt_title}</h2>
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
                <p className="text-gray-700">{selectedGroup.sgt_content}</p>
                <div>
                  {/* <h3 className="text-base font-medium text-gray-900 mb-3">그룹멤버 ({groupMembers.length}명)</h3> */}
                  <h3 className="text-base font-medium text-gray-900 mb-3">그룹멤버</h3>
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner 
                        message="그룹원을 불러오는 중..." 
                        fullScreen={false}
                        type="ripple"
                        size="sm"
                        color="indigo"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {groupMembers.length > 0 ? (
                        groupMembers.map((member: GroupMember) => (
                          <div key={member.mt_idx} className="flex items-center p-3 border border-gray-300 rounded-lg bg-gray-100 hover:shadow-md hover:border-indigo-400 transition-all duration-150 ease-in-out">
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                              <svg className="h-6 w-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">
                                {member.mt_nickname || member.mt_name || '이름 없음'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {member.sgdt_owner_chk === 'Y' ? '그룹장' : member.sgdt_leader_chk === 'Y' ? '리더' : '멤버'}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-2 text-center text-gray-500 py-8">
                          그룹원이 없습니다.
                        </div>
                      )}
                    </div>
                  )}
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