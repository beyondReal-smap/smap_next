'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageContainer, Button } from '../components/layout';
import { 
  FaUsers, 
  FaLayerGroup, 
  FaUserPlus, 
  FaPlus, 
  FaCrown,
  FaSearch,
  FaCog,
  FaEye,
  FaTrash,
  FaEdit,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaShare,
  FaArrowLeft,
  FaBars
} from 'react-icons/fa';
import { 
  HiSparkles, 
  HiUserGroup, 
  HiChatBubbleLeftEllipsis,
  HiEllipsisVertical 
} from 'react-icons/hi2';
import { RiKakaoTalkFill } from 'react-icons/ri';
import { FiLink, FiX, FiCopy, FiSettings } from 'react-icons/fi';
import { MdOutlineMessage, MdGroupAdd } from 'react-icons/md';
import { BsThreeDots } from 'react-icons/bs';
import groupService, { Group } from '@/services/groupService';
import memberService from '@/services/memberService';
import LoadingSpinner from '../components/common/LoadingSpinner';

export const dynamic = 'force-dynamic';

// 모바일 최적화된 CSS 애니메이션
const mobileAnimations = `
@keyframes slideInFromRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideInFromLeft {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideInFromBottom {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeInUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes bounce {
  0%, 20%, 53%, 80%, 100% {
    transform: translate3d(0,0,0);
  }
  40%, 43% {
    transform: translate3d(0, -5px, 0);
  }
  70% {
    transform: translate3d(0, -2px, 0);
  }
  90% {
    transform: translate3d(0, -1px, 0);
  }
}

.animate-slideInFromRight {
  animation: slideInFromRight 0.3s ease-out forwards;
}

.animate-slideInFromLeft {
  animation: slideInFromLeft 0.3s ease-out forwards;
}

.animate-slideInFromBottom {
  animation: slideInFromBottom 0.4s ease-out forwards;
}

.animate-fadeInUp {
  animation: fadeInUp 0.3s ease-out forwards;
}

.animate-scaleIn {
  animation: scaleIn 0.2s ease-out forwards;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-bounce {
  animation: bounce 2s infinite;
}

.mobile-card {
  transition: all 0.2s ease-in-out;
}

.mobile-card:active {
  transform: scale(0.98);
  background-color: rgba(0, 0, 0, 0.05);
}

.mobile-button {
  min-height: 44px;
  transition: all 0.2s ease-in-out;
}

.mobile-button:active {
  transform: scale(0.95);
}

.safe-area {
  padding-bottom: env(safe-area-inset-bottom);
}

.glass-mobile {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
`;

// Group 인터페이스에 sgt_code 추가
interface ExtendedGroup extends Group {
  sgt_code?: string;
  sgt_memo?: string;
}

// GroupMember 타입 정의
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

// 새 그룹 폼 타입 정의
interface GroupForm {
  name: string;
  description: string;
}

// 기존 페이지 로직을 포함하는 내부 컴포넌트
function GroupPageContent() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ExtendedGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupMemberCounts, setGroupMemberCounts] = useState<{[key: number]: number}>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newGroup, setNewGroup] = useState<GroupForm>({ name: '', description: '' });
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showGroupActions, setShowGroupActions] = useState(false);
  
  // 모바일 전용 상태
  const [currentView, setCurrentView] = useState<'list' | 'detail'>('list');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const router = useRouter();

  // 사용자 그룹 목록 조회
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const data = await groupService.getMyGroups(1186);
        console.log('[Group Page] 그룹 목록 조회 결과:', data);
        setGroups(data);
        
        if (data.length > 0) {
          setSelectedGroup(data[0]);
        }

        const memberCounts: {[key: number]: number} = {};
        for (const group of data) {
          try {
            const members = await memberService.getGroupMembers(group.sgt_idx.toString());
            memberCounts[group.sgt_idx] = members.length;
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
        const memberData = await memberService.getGroupMembers(selectedGroup.sgt_idx.toString());
        
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
          sgdt_idx: member.sgdt_idx || index + 1,
          sgt_idx: selectedGroup.sgt_idx,
          sgdt_owner_chk: member.sgdt_owner_chk || (index === 0 ? 'Y' : 'N'),
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

  // 그룹 선택 (모바일에서는 상세 화면으로 이동)
  const handleGroupSelect = (group: ExtendedGroup) => {
    setSelectedGroup(group);
    setCurrentView('detail');
    setShowGroupActions(false);
  };

  // 검색 필터링
  const filteredGroups = groups.filter(group => 
    group.sgt_title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (group.sgt_content && group.sgt_content.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (group.sgt_memo && group.sgt_memo.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 모달 관련 함수들
  const handleAddGroup = () => setIsAddModalOpen(true);
  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setNewGroup({ name: '', description: '' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewGroup(prev => ({ ...prev, [name]: value }));
  };

  // 새 그룹 저장
  const handleSaveGroup = async () => {
    if (newGroup.name.trim() === '') return;
    
    setIsCreatingGroup(true);
    
    try {
      const groupData = {
        mt_idx: 1186,
        sgt_title: newGroup.name.trim(),
        sgt_memo: newGroup.description.trim() || null,
        sgt_code: null,
        sgt_show: 'Y' as const
      };
      
      const createdGroup = await groupService.createGroup(groupData);
      const createdGroupExtended = createdGroup as ExtendedGroup;
      const newGroupItem: ExtendedGroup = {
        sgt_idx: createdGroupExtended.sgt_idx,
        sgt_title: createdGroupExtended.sgt_title,
        sgt_content: createdGroupExtended.sgt_memo || createdGroupExtended.sgt_content || '',
        sgt_memo: createdGroupExtended.sgt_memo,
        mt_idx: createdGroupExtended.mt_idx,
        sgt_show: createdGroupExtended.sgt_show,
        sgt_wdate: createdGroupExtended.sgt_wdate,
        sgt_code: createdGroupExtended.sgt_code,
        memberCount: 1
      };
      
      setGroups(prevGroups => [newGroupItem, ...prevGroups]);
      setGroupMemberCounts(prev => ({
        ...prev,
        [createdGroupExtended.sgt_idx]: 1
      }));
      setSelectedGroup(newGroupItem);
      handleCloseModal();
      
    } catch (error) {
      console.error('[Group Page] 그룹 생성 오류:', error);
      alert('그룹 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // 공유 기능 함수들
  const handleShareKakao = () => {
    console.log("Share via Kakao: Not yet implemented. Group ID: ", selectedGroup?.sgt_idx);
    alert('카카오톡 공유 기능은 준비 중입니다.');
  };

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/group/${selectedGroup?.sgt_idx}/join`;
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        alert('초대 링크가 복사되었습니다!');
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
        <div className="text-center px-6">
          <div className="animate-bounce mb-6">
            <HiUserGroup className="w-16 h-16 text-orange-500 mx-auto" />
          </div>
          <LoadingSpinner 
            message="그룹 목록을 불러오는 중입니다..." 
            fullScreen={false}
            type="ripple"
            size="md"
            color="indigo"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{mobileAnimations}</style>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
        
        {/* 앱 헤더 - 홈 페이지 스타일 */}
        <div className="px-4 bg-white/95 backdrop-blur-lg">
          <div className="flex items-center justify-between h-12">
            {currentView === 'list' ? (
              <div className="flex items-center">
                <img 
                  src="/images/smap_logo.webp" 
                  alt="SMAP 로고" 
                  className="h-10"
                />
                <span className="ml-1 text-lg font-normal text-gray-900">장소</span>
              </div>
            ) : (
              <div></div>
            )}
            {currentView === 'list' && (
              <button
                onClick={handleAddGroup}
                className="px-2.5 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-md shadow-sm flex items-center space-x-1.5 hover:from-orange-600 hover:to-orange-700 transition-all duration-200"
              >
                <FaPlus className="w-3 h-3" />
                <span className="text-sm font-normal">새 그룹</span>
              </button>
            )}
            {currentView === 'detail' && selectedGroup && (
              <div className="flex items-center space-x-2 ml-auto">
                <button 
                  onClick={() => setCurrentView('list')}
                  className="px-2 py-2 rounded-full bg-orange-100 hover:bg-orange-200 transition-all duration-200 absolute left-4"
                >
                  <FaArrowLeft className="w-4 h-4 text-orange-700" />
                </button>
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="px-2 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-all duration-200"
                >
                  <FaUserPlus className="w-3.5 h-3.5" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowGroupActions(!showGroupActions)}
                    className="px-2 py-2 bg-orange-100 rounded-md hover:bg-orange-200 transition-all duration-200"
                  >
                    <HiEllipsisVertical className="w-3.5 h-3.5 text-orange-700" />
                  </button>
                  {showGroupActions && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-orange-200 py-2 z-50 animate-scaleIn">
                      <button className="w-full px-4 py-3 text-left hover:bg-orange-50 flex items-center text-orange-700">
                        <FaEdit className="w-4 h-4 mr-3" />
                        그룹 수정
                      </button>
                      <button className="w-full px-4 py-3 text-left hover:bg-orange-50 flex items-center text-orange-700">
                        <FaEye className="w-4 h-4 mr-3" />
                        그룹 정보
                      </button>
                      <hr className="my-1" />
                      <button className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center text-red-600">
                        <FaTrash className="w-4 h-4 mr-3" />
                        그룹 삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="pb-safe">
          {currentView === 'list' ? (
            /* 그룹 목록 화면 */
            <div className="animate-slideInFromLeft">
              {/* 검색 섹션 */}
              <div className="px-4 py-4">
                <div className={`relative transition-all duration-300 ${isSearchFocused ? 'transform scale-105' : ''}`}>
                  <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-orange-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="그룹 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-orange-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder-orange-400 text-base shadow-sm"
                  />
                </div>
              </div>

              {/* 통계 카드 */}
              <div className="px-4 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-100 text-sm">총 그룹</p>
                        <p className="text-2xl font-bold">{groups.length}개</p>
                      </div>
                      <FaLayerGroup className="w-8 h-8 text-orange-200" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm">총 멤버</p>
                        <p className="text-2xl font-bold">{Object.values(groupMemberCounts).reduce((a, b) => a + b, 0)}명</p>
                      </div>
                      <FaUsers className="w-8 h-8 text-green-200" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 그룹 목록 */}
              <div className="px-4 space-y-3">
                {filteredGroups.length > 0 ? (
                  filteredGroups.map((group, index) => {
                    const memberCount = groupMemberCounts[group.sgt_idx] || 0;
                    
                    return (
                      <div
                        key={group.sgt_idx}
                        onClick={() => handleGroupSelect(group as ExtendedGroup)}
                        className="mobile-card bg-white rounded-2xl p-4 shadow-sm border border-orange-100 animate-fadeInUp hover:shadow-md transition-shadow"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center flex-1 mr-3">
                            <div className="p-3 bg-gradient-to-r from-orange-100 to-orange-200 rounded-xl mr-4">
                              <HiUserGroup className="w-6 h-6 text-orange-700" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-lg text-orange-900 mb-1">
                                {group.sgt_title}
                              </h3>
                              <p className="text-orange-600 text-sm line-clamp-2 mb-2">
                                {group.sgt_memo || group.sgt_content || '그룹 설명이 없습니다'}
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-orange-500">
                                <span className="flex items-center">
                                  <FaUsers className="w-3 h-3 mr-1" />
                                  {memberCount}명
                                </span>
                                <span>
                                  {new Date(group.sgt_wdate).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-center space-y-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <FaArrowLeft className="w-4 h-4 text-orange-400 transform rotate-180" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <div className="p-6 bg-orange-100 rounded-full w-fit mx-auto mb-4">
                      <FaSearch className="w-8 h-8 text-orange-400" />
                    </div>
                    <p className="text-orange-500 text-lg font-medium">검색 결과가 없습니다</p>
                    <p className="text-orange-400 text-sm mt-1">다른 키워드로 검색해보세요</p>
                  </div>
                )}
              </div>
            </div>
          ) : selectedGroup ? (
            /* 그룹 상세 화면 */
            <div className="animate-slideInFromRight">
              {/* 그룹 헤더 카드 */}
              <div className="mx-4 mt-4 mb-6">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center flex-1">
                      <div className="p-3 bg-white/20 rounded-xl mr-4">
                        <HiUserGroup className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-bold mb-1">{selectedGroup.sgt_title}</h2>
                        <p className="text-orange-100 text-sm">
                          {selectedGroup.sgt_memo || selectedGroup.sgt_content || '그룹 설명이 없습니다'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-orange-200">
                    <span>코드: {selectedGroup.sgt_code || 'N/A'}</span>
                    <span>{new Date(selectedGroup.sgt_wdate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* 통계 카드들 */}
              <div className="px-4 mb-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-3 text-white text-center shadow-md">
                    <FaUsers className="w-6 h-6 text-orange-200 mx-auto mb-1" />
                    <p className="text-lg font-bold">{groupMembers.length}</p>
                    <p className="text-orange-100 text-xs">멤버</p>
                  </div>
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-3 text-white text-center shadow-md">
                    <FaCalendarAlt className="w-6 h-6 text-blue-200 mx-auto mb-1" />
                    <p className="text-lg font-bold">3</p>
                    <p className="text-blue-100 text-xs">일정</p>
                  </div>
                  <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl p-3 text-white text-center shadow-md">
                    <FaMapMarkerAlt className="w-6 h-6 text-red-200 mx-auto mb-1" />
                    <p className="text-lg font-bold">7</p>
                    <p className="text-red-100 text-xs">장소</p>
                  </div>
                </div>
              </div>

              {/* 그룹 멤버 섹션 */}
              <div className="px-4">
                <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
                  <div className="p-4 border-b border-orange-100 bg-orange-50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-orange-900 flex items-center">
                        <FaUsers className="w-5 h-5 mr-2 text-orange-700" />
                        그룹 멤버
                        <span className="ml-2 px-2 py-1 bg-orange-200 text-orange-800 text-xs rounded-full">
                          {groupMembers.length}명
                        </span>
                      </h3>
                      <button
                        onClick={() => setIsShareModalOpen(true)}
                        className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm flex items-center space-x-1 hover:bg-green-600"
                      >
                        <MdGroupAdd className="w-4 h-4" />
                        <span>초대</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-4">
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
                      <div className="space-y-3">
                        {groupMembers.length > 0 ? (
                          groupMembers.map((member, index) => (
                            <div 
                              key={member.mt_idx} 
                              className="flex items-center p-3 bg-orange-50 rounded-xl mobile-card hover:bg-orange-100"
                              style={{ animationDelay: `${index * 0.05}s` }}
                            >
                              <div className="relative mr-3">
                                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                                  <FaUsers className="w-6 h-6 text-white" />
                                </div>
                                {member.sgdt_owner_chk === 'Y' && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                                    <FaCrown className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-orange-900">
                                    {member.mt_nickname || member.mt_name || '이름 없음'}
                                  </h4>
                                  {member.sgdt_owner_chk === 'Y' && (
                                    <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
                                      그룹장
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-orange-600 mt-1">
                                  {member.sgdt_owner_chk === 'Y' ? '그룹 관리자' : 
                                   member.sgdt_leader_chk === 'Y' ? '리더' : '멤버'}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <div className="p-4 bg-orange-100 rounded-full w-fit mx-auto mb-3">
                              <FaUsers className="w-6 h-6 text-orange-400" />
                            </div>
                            <p className="text-orange-500 font-medium">그룹원이 없습니다</p>
                            <p className="text-orange-400 text-sm mt-1">새로운 멤버를 초대해보세요</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 그룹 미선택 상태 */
            <div className="flex flex-col items-center justify-center h-96 px-6 text-center">
              <div className="p-8 bg-gradient-to-r from-orange-100 to-orange-200 rounded-full mb-6 animate-bounce">
                <HiUserGroup className="w-16 h-16 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-orange-900 mb-2">그룹을 선택해주세요</h3>
              <p className="text-orange-600 mb-6">관리하고 싶은 그룹을 선택하세요</p>
              <button
                onClick={() => setCurrentView('list')}
                className="mobile-button px-6 py-3 bg-gradient-to-r from-orange-700 to-orange-800 text-white rounded-xl hover:from-orange-800 hover:to-orange-900"
              >
                그룹 목록 보기
              </button>
            </div>
          )}
        </div>

        {/* 새 그룹 추가 모달 */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50">
            <div 
              className="bg-white rounded-t-3xl w-full max-w-md mx-auto animate-slideInFromBottom safe-area"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {/* 모달 핸들 */}
                <div className="w-12 h-1 bg-orange-300 rounded-full mx-auto mb-6"></div>
                
                <div className="text-center mb-6">
                  <HiUserGroup className="w-12 h-12 text-orange-700 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-orange-900">새 그룹 만들기</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-orange-700 mb-2">
                      그룹명 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={newGroup.name}
                      onChange={handleInputChange}
                      placeholder="예: 친구들과 함께하는 여행"
                      className="w-full px-4 py-4 border border-orange-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base"
                      maxLength={50}
                    />
                    <p className="text-xs text-orange-500 mt-1">{newGroup.name.length}/50</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-orange-700 mb-2">
                      그룹 설명
                    </label>
                    <textarea
                      name="description"
                      value={newGroup.description}
                      onChange={handleInputChange}
                      placeholder="그룹에 대한 간단한 설명을 입력해주세요"
                      rows={3}
                      className="w-full px-4 py-4 border border-orange-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none text-base"
                      maxLength={200}
                    />
                    <p className="text-xs text-orange-500 mt-1">{newGroup.description.length}/200</p>
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-8">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isCreatingGroup}
                    className="flex-1 mobile-button py-4 border border-orange-300 rounded-2xl text-orange-700 font-medium disabled:opacity-50 hover:bg-orange-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGroup}
                    disabled={newGroup.name.trim() === '' || isCreatingGroup}
                    className="flex-1 mobile-button py-4 bg-gradient-to-r from-orange-700 to-orange-800 text-white rounded-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center hover:from-orange-800 hover:to-orange-900"
                  >
                    {isCreatingGroup ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        생성 중...
                      </>
                    ) : (
                      '그룹 만들기'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 공유 모달 */}
        {isShareModalOpen && selectedGroup && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50">
            <div 
              className="bg-white rounded-t-3xl w-full max-w-md mx-auto animate-slideInFromBottom safe-area"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {/* 모달 핸들 */}
                <div className="w-12 h-1 bg-orange-300 rounded-full mx-auto mb-6"></div>
                
                <div className="text-center mb-6">
                  <FaShare className="w-12 h-12 text-orange-600 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-orange-900">그룹 초대하기</h3>
                  <p className="text-orange-600 mt-1">{selectedGroup.sgt_title}</p>
                </div>
                
                <div className="space-y-3">
                  <button 
                    onClick={handleShareKakao} 
                    className="w-full mobile-button flex items-center p-4 rounded-2xl bg-[#FEE500] hover:bg-[#FEDD00] text-[#3C1E1E]"
                  >
                    <RiKakaoTalkFill className="w-6 h-6 mr-4" />
                    <span className="font-medium">카카오톡으로 공유</span>
                  </button>
                  
                  <button 
                    onClick={handleCopyLink} 
                    className="w-full mobile-button flex items-center p-4 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <FiCopy className="w-6 h-6 mr-4" />
                    <span className="font-medium">초대 링크 복사</span>
                  </button>
                  
                  <button 
                    onClick={handleShareSms} 
                    className="w-full mobile-button flex items-center p-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white"
                  >
                    <MdOutlineMessage className="w-6 h-6 mr-4" />
                    <span className="font-medium">문자로 공유</span>
                  </button>
                  
                  <button
                    onClick={() => setIsShareModalOpen(false)}
                    className="w-full mobile-button py-4 mt-6 text-orange-600 font-medium hover:text-orange-800"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// 페이지를 Suspense로 감싸는 기본 export 함수
export default function GroupPageWithSuspense() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
        <div className="text-center px-6">
          <HiUserGroup className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-pulse" />
          <p className="text-orange-600 font-medium">로딩 중...</p>
        </div>
      </div>
    }> 
      <GroupPageContent />
    </Suspense>
  );
} 