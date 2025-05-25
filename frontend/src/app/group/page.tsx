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
  FaBars,
  FaCheckCircle
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
import groupService, { Group, GroupStats } from '@/services/groupService';
import memberService from '@/services/memberService';
import LoadingSpinner from '../components/common/LoadingSpinner';

export const dynamic = 'force-dynamic';

// 백엔드 이미지 저장 경로의 기본 URL
const BACKEND_STORAGE_BASE_URL = 'https://118.67.130.71:8000/storage/';

// 기본 이미지 생성 함수 (home/page.tsx와 동일)
const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const imageNumber = (index % 4) + 1; // index 기반으로 1~4 숫자 결정
  if (gender === 1) {
    return `/images/male_${imageNumber}.png`;
  } else if (gender === 2) {
    return `/images/female_${imageNumber}.png`;
  }
  // mt_gender가 없거나 1, 2가 아닐 때, avatar 이미지도 index 기반으로 일관성 유지
  return `/images/avatar${(index % 3) + 1}.png`; 
};

// 모바일 최적화된 CSS 애니메이션
const mobileAnimations = `
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

@keyframes slideOutToBottom {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
    opacity: 0;
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

@keyframes scaleIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes progress-bar {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}

.animate-slideInFromBottom {
  animation: slideInFromBottom 0.3s ease-out forwards;
}

.animate-slideOutToBottom {
  animation: slideOutToBottom 0.3s ease-in forwards;
}

.animate-slideInFromLeft {
  animation: slideInFromLeft 0.3s ease-out forwards;
}

.animate-slideInFromRight {
  animation: slideInFromRight 0.3s ease-out forwards;
}

.animate-scaleIn {
  animation: scaleIn 0.2s ease-out forwards;
}

.animate-progress-bar {
  animation: progress-bar 3s linear forwards;
}

.modal-safe-area {
  padding-bottom: env(safe-area-inset-bottom);
}

.mobile-card {
  transition: all 0.2s ease;
  animation: slideInFromBottom 0.3s ease-out forwards;
}

.mobile-button {
  transition: all 0.2s ease;
  touch-action: manipulation;
  user-select: none;
}

.mobile-button:active {
  transform: scale(0.98);
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
  // 추가 필드들
  photo?: string | null; // 프로필 이미지 URL
  original_index: number; // 기본 이미지 선택을 위한 인덱스
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
  
  // 그룹 수정 관련 상태 추가
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupForm>({ name: '', description: '' });
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  
  // 그룹 삭제 확인 모달 상태 추가
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 성공 알림 모달 상태 추가
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // 모바일 전용 상태
  const [currentView, setCurrentView] = useState<'list' | 'detail'>('list');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // 드래그 관련 상태
  const [dragStartY, setDragStartY] = useState(0);
  const [dragCurrentY, setDragCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // 그룹 통계 관련 상태 추가
  const [groupStats, setGroupStats] = useState<GroupStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  const router = useRouter();

  // 그룹 목록 조회 함수
  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await groupService.getCurrentUserGroups();
      console.log('[Group Page] 그룹 목록 조회 결과:', data);
      setGroups(data);
      
      // 선택된 그룹이 없거나 삭제된 경우에만 첫 번째 그룹 선택
      if (data.length > 0 && (!selectedGroup || !data.find(g => g.sgt_idx === selectedGroup.sgt_idx))) {
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

  // 그룹 목록 초기 로드
  useEffect(() => {
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
        
        console.log('[Group Page] 원본 멤버 데이터:', memberData);
        
        // 각 멤버의 sgdt_owner_chk, sgdt_leader_chk 값 확인
        memberData.forEach((member: any, index: number) => {
          console.log(`[멤버 ${index}] ${member.mt_name}:`, {
            sgdt_owner_chk: member.sgdt_owner_chk,
            sgdt_leader_chk: member.sgdt_leader_chk,
            sgdt_idx: member.sgdt_idx,
            mt_idx: member.mt_idx
          });
        });
        
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
          photo: member.mt_file1 ? (member.mt_file1.startsWith('http') ? member.mt_file1 : `${BACKEND_STORAGE_BASE_URL}${member.mt_file1}`) : null,
          original_index: index,
        }));
        
        console.log('[Group Page] 변환된 멤버 데이터:', transformedMembers);
        
        // 변환 후 sgdt_owner_chk, sgdt_leader_chk 값 재확인
        transformedMembers.forEach((member, index) => {
          console.log(`[변환된 멤버 ${index}] ${member.mt_name}:`, {
            sgdt_owner_chk: member.sgdt_owner_chk,
            sgdt_leader_chk: member.sgdt_leader_chk,
            '그룹장 여부': member.sgdt_owner_chk === 'Y'
          });
        });
        
        setGroupMembers(transformedMembers);
        setGroupMemberCounts(prev => ({
          ...prev,
          [selectedGroup.sgt_idx]: transformedMembers.length
        }));
      } catch (error) {
        console.error('[Group Page] 그룹 멤버 조회 오류:', error);
        setGroupMembers([]);
      } finally {
        setMembersLoading(false);
      }
    };

    fetchGroupMembers();
  }, [selectedGroup]);

  // 선택된 그룹의 통계 데이터 조회
  useEffect(() => {
    const fetchGroupStats = async () => {
      if (!selectedGroup) {
        setGroupStats(null);
        return;
      }

      try {
        setStatsLoading(true);
        console.log('[Group Page] 그룹 통계 조회 시작:', selectedGroup.sgt_idx);
        
        const statsData = await groupService.getGroupStats(selectedGroup.sgt_idx);
        setGroupStats(statsData);
        
        console.log('[Group Page] 그룹 통계 조회 완료:', statsData);
      } catch (error) {
        console.error('[Group Page] 그룹 통계 조회 오류:', error);
        setGroupStats(null);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchGroupStats();
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

  // 검색어 변경 핸들러
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIsSearching(true);
    setSearchQuery(value);
    
    // 짧은 딜레이 후 검색 상태 해제 (애니메이션을 위해)
    setTimeout(() => {
      setIsSearching(false);
    }, 100);
  };

  // 모달 관련 함수들
  const handleAddGroup = () => setIsAddModalOpen(true);
  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsAddModalOpen(false);
      setNewGroup({ name: '', description: '' });
      setIsClosing(false);
    }, 300);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewGroup(prev => ({ ...prev, [name]: value }));
  };

  // 그룹 수정 관련 함수들 추가
  const handleEditGroup = () => {
    if (!selectedGroup) return;
    
    setEditGroup({
      name: selectedGroup.sgt_title,
      description: selectedGroup.sgt_memo || selectedGroup.sgt_content || ''
    });
    setIsEditModalOpen(true);
    setShowGroupActions(false);
  };

  const handleCloseEditModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsEditModalOpen(false);
      setEditGroup({ name: '', description: '' });
      setIsClosing(false);
    }, 300);
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditGroup(prev => ({ ...prev, [name]: value }));
  };

  // 삭제 확인 모달 닫기 함수 추가
  const handleCloseDeleteModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsDeleteModalOpen(false);
      setIsDeleting(false);
      setIsClosing(false);
    }, 300);
  };

  // 그룹 업데이트
  const handleUpdateGroup = async () => {
    if (!selectedGroup || editGroup.name.trim() === '') return;
    
    setIsUpdatingGroup(true);
    
    try {
      const updateData = {
        sgt_title: editGroup.name.trim(),
        sgt_memo: editGroup.description.trim() || null
      };
      
      const updatedGroup = await groupService.updateGroup(selectedGroup.sgt_idx, updateData);
      
      // 로컬 상태 업데이트
      const updatedGroupExtended: ExtendedGroup = {
        ...selectedGroup,
        sgt_title: updatedGroup.sgt_title,
        sgt_memo: updatedGroup.sgt_memo,
        sgt_content: updatedGroup.sgt_memo || updatedGroup.sgt_content || ''
      };
      
      setSelectedGroup(updatedGroupExtended);
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.sgt_idx === selectedGroup.sgt_idx 
            ? updatedGroupExtended 
            : group
        )
      );
      
      handleCloseEditModal();
      
      // 성공 메시지
      setSuccessMessage('그룹이 성공적으로 수정되었습니다.');
      setIsSuccessModalOpen(true);
      
    } catch (error) {
      console.error('[Group Page] 그룹 수정 오류:', error);
      alert('그룹 수정 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  // 그룹 삭제 핸들러 추가 (실제로는 sgt_show를 'N'으로 변경)
  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    
    setIsDeleting(true);
    
    try {
      console.log('[Group Page] 그룹 삭제 시작:', selectedGroup.sgt_idx);
      
      // 그룹 삭제 API 호출 (백엔드에서 소프트 삭제 처리)
      await groupService.deleteGroup(selectedGroup.sgt_idx);
      
      // 로컬 상태 조작 대신 그룹 목록을 다시 불러오기
      // 백엔드에서 sgt_show = 'N'으로 변경된 그룹은 자동으로 목록에서 제외됨
      await fetchGroups();
      
      // 선택된 그룹 초기화
      setSelectedGroup(null);
      setGroupMembers([]);
      setShowGroupActions(false);
      
      // 모달 닫기
      setIsDeleteModalOpen(false);
      
      // 목록 뷰로 돌아가기
      setCurrentView('list');
      
      // 성공 메시지
      setSuccessMessage('그룹이 목록에서 숨겨졌습니다.');
      setIsSuccessModalOpen(true);
      
    } catch (error) {
      console.error('[Group Page] 그룹 삭제 오류:', error);
      alert('그룹 삭제 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsDeleting(false);
    }
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
      
      // 성공 메시지
      setSuccessMessage('새 그룹이 성공적으로 생성되었습니다.');
      setIsSuccessModalOpen(true);
      
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
        setIsShareModalOpen(false);
        setSuccessMessage('초대 링크가 복사되었습니다!');
        setIsSuccessModalOpen(true);
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

  const handleCloseShareModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsShareModalOpen(false);
      setIsClosing(false);
    }, 300);
  };

  // 드래그 핸들러 함수들
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY);
    setDragCurrentY(e.touches[0].clientY);
    setIsDragging(true);
    setIsClosing(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setDragCurrentY(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    const deltaY = dragCurrentY - dragStartY;
    
    // 30px 이상 위아래로 움직이면 무조건 실행
    if (Math.abs(deltaY) > 30) {
      if (deltaY > 0) {
        // 아래로 드래그 - 모달 닫기
        if (isAddModalOpen) {
          handleCloseModal();
        }
        if (isShareModalOpen) {
          handleCloseShareModal();
        }
        if (isEditModalOpen) {
          handleCloseEditModal();
        }
      } else {
        // 위로 드래그 - 모달 유지 (원위치로 복귀)
        setIsDragging(false);
      }
    } else {
      // 움직임이 적으면 원위치로 복귀
      setIsDragging(false);
    }
    
    setDragStartY(0);
    setDragCurrentY(0);
  };

  // 성공 모달 자동 닫기
  useEffect(() => {
    if (isSuccessModalOpen) {
      const timer = setTimeout(() => {
        setIsSuccessModalOpen(false);
        setSuccessMessage('');
      }, 3000); // 3초 후 자동 닫기

      return () => clearTimeout(timer);
    }
  }, [isSuccessModalOpen]);

  // 로딩 중일 때
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
        <div className="text-center px-6">
          <div className="animate-bounce mb-6">
            <HiUserGroup className="w-16 h-16 text-gray-500 mx-auto" />
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
        
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
                className="px-2.5 py-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-md shadow-sm flex items-center space-x-1.5 hover:from-indigo-700 hover:to-indigo-700 transition-all duration-200"
              >
                <FaPlus className="w-3 h-3" />
                <span className="text-sm font-normal">새 그룹</span>
              </button>
            )}
            {currentView === 'detail' && selectedGroup && (
              <div className="flex items-center space-x-2 ml-auto">
                <button 
                  onClick={() => setCurrentView('list')}
                  className="px-2 py-2 rounded-full bg-indigo-100 hover:bg-indigo-200 transition-all duration-200 absolute left-4"
                >
                  <FaArrowLeft className="w-4 h-4 text-indigo-700" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="pb-safe">
          {currentView === 'list' ? (
            /* 그룹 목록 화면 */
            <div className="animate-slideInFromLeft" style={{ transform: 'translateY(0)' }}>
              {/* 검색 섹션 */}
              <div className="px-4 py-4">
                <div className={`relative transition-all duration-300 ${isSearchFocused ? 'transform scale-105' : ''}`}>
                  <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="그룹 검색..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 placeholder-gray-400 text-base shadow-sm"
                  />
                </div>
              </div>

              {/* 통계 카드 */}
              <div className="px-4 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-indigo-100 text-sm">총 그룹</p>
                        <p className="text-2xl font-bold">{groups.length}개</p>
                      </div>
                      <FaLayerGroup className="w-8 h-8 text-indigo-200" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-pink-500 to-pink-600 rounded-2xl p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-pink-100 text-sm">총 멤버</p>
                        <p className="text-2xl font-bold">{Object.values(groupMemberCounts).reduce((a, b) => a + b, 0)}명</p>
                      </div>
                      <FaUsers className="w-8 h-8 text-pink-200" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 그룹 목록 */}
              <div className={`px-4 space-y-3 transition-all duration-300 ${isSearching ? 'opacity-70' : 'opacity-100'}`}>
                {filteredGroups.length > 0 ? (
                  filteredGroups.map((group, index) => {
                    const memberCount = groupMemberCounts[group.sgt_idx] || 0;
                    
                    return (
                      <div
                        key={`${group.sgt_idx}-${searchQuery}`}
                        onClick={() => handleGroupSelect(group as ExtendedGroup)}
                        className="mobile-card bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center flex-1 mr-3">
                            <div className="p-3 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl mr-4">
                              <HiUserGroup className="w-6 h-6 text-gray-700" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-normal text-lg text-gray-900 mb-1">
                                {group.sgt_title}
                              </h3>
                              <p className="text-gray-500 text-sm line-clamp-2 mb-2">
                                {group.sgt_memo || group.sgt_content || '그룹 설명이 없습니다'}
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-gray-400">
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
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <div className="p-6 bg-indigo-100 rounded-full w-fit mx-auto mb-4">
                      <FaSearch className="w-8 h-8 text-indigo-400" />
                    </div>
                    <p className="text-indigo-500 text-lg font-medium">검색 결과가 없습니다</p>
                    <p className="text-indigo-400 text-sm mt-1">다른 키워드로 검색해보세요</p>
                  </div>
                )}
              </div>
            </div>
          ) : selectedGroup ? (
            /* 그룹 상세 화면 */
            <div className="animate-slideInFromRight">
              {/* 그룹 헤더 카드 */}
              <div className="mx-4 mt-4 mb-6">
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg relative">
                  {/* 그룹 액션 메뉴 버튼 - 오른쪽 위 */}
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={() => setShowGroupActions(!showGroupActions)}
                      className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-all duration-200"
                    >
                      <HiEllipsisVertical className="w-4 h-4 text-white" />
                    </button>
                    {showGroupActions && (
                      <>
                        {/* 배경 오버레이 - 메뉴 외부 클릭 시 닫기 */}
                        <div 
                          className="fixed inset-0 z-[55]" 
                          onClick={() => setShowGroupActions(false)}
                        ></div>
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-[60] animate-scaleIn">
                          <button 
                            onClick={handleEditGroup}
                            className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center text-gray-700"
                          >
                            <FaEdit className="w-4 h-4 mr-3" />
                            그룹 수정
                          </button>
                          <hr className="my-1" />
                          <button 
                            onClick={() => {
                              setIsDeleteModalOpen(true);
                              setShowGroupActions(false);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center text-red-600"
                          >
                            <FaTrash className="w-4 h-4 mr-3" />
                            그룹 삭제
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center flex-1 pr-12">
                      <div className="p-3 bg-white/20 rounded-xl mr-4">
                        <HiUserGroup className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-bold mb-1">{selectedGroup.sgt_title}</h2>
                        <p className="text-indigo-100 text-sm">
                          {selectedGroup.sgt_memo || selectedGroup.sgt_content || '그룹 설명이 없습니다'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-indigo-200">
                    <span>코드: {selectedGroup.sgt_code || 'N/A'}</span>
                    <span>생성일: {new Date(selectedGroup.sgt_wdate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* 통계 카드들 */}
              <div className="px-4 mb-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gradient-to-r from-red-400 to-red-500 rounded-xl p-3 text-white text-center shadow-md">
                    <FaUsers className="w-6 h-6 text-red-200 mx-auto mb-1" />
                    <p className="text-lg font-bold">
                      {statsLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                      ) : (
                        groupStats?.member_count || groupMembers.length
                      )}
                    </p>
                    <p className="text-red-100 text-xs">멤버</p>
                  </div>
                  <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-xl p-3 text-white text-center shadow-md">
                    <FaCalendarAlt className="w-6 h-6 text-yellow-200 mx-auto mb-1" />
                    <p className="text-lg font-bold">
                      {statsLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                      ) : (
                        groupStats?.weekly_schedules || 0
                      )}
                    </p>
                    <p className="text-yellow-100 text-xs">주간 일정</p>
                  </div>
                  <div className="bg-gradient-to-r from-blue-400 to-blue-500 rounded-xl p-3 text-white text-center shadow-md">
                    <FaMapMarkerAlt className="w-6 h-6 text-blue-200 mx-auto mb-1" />
                    <p className="text-lg font-bold">
                      {statsLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                      ) : (
                        groupStats?.total_locations || 0
                      )}
                    </p>
                    <p className="text-blue-100 text-xs">총 위치</p>
                  </div>
                </div>
              </div>

              {/* 그룹 멤버 섹션 */}
              <div className="px-4">
                <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
                  <div className="p-4 border-b border-indigo-100 bg-indigo-50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-normal text-gray-900 flex items-center">
                        <FaUsers className="w-5 h-5 mr-2 text-indigo-700" />
                        그룹 멤버
                        <span className="ml-2 px-2 py-1 bg-indigo-200 text-gray-800 text-xs rounded-full">
                          {groupMembers.length}명
                        </span>
                      </h3>
                      <button
                        onClick={() => setIsShareModalOpen(true)}
                        className="px-3 py-2 bg-pink-500 text-white rounded-lg text-sm flex items-center space-x-1 hover:bg-pink-600"
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
                              className="flex items-center p-3 bg-indigo-50 rounded-xl mobile-card hover:bg-indigo-100"
                              style={{ animationDelay: `${index * 0.05}s` }}
                            >
                              <div className="relative mr-3">
                                <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center border-3 border-indigo-200">
                                  <img
                                    src={member.photo || getDefaultImage(member.mt_gender, member.original_index)}
                                    alt={member.mt_name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = getDefaultImage(member.mt_gender, member.original_index);
                                    }}
                                  />
                                </div>
                                {member.sgdt_owner_chk === 'Y' && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                                    <FaCrown className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-normal text-gray-900">
                                    {member.mt_nickname || member.mt_name || '이름 없음'}
                                  </h4>
                                  {member.sgdt_owner_chk === 'Y' && (
                                    <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
                                      그룹장
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-indigo-600 mt-1">
                                  {member.sgdt_owner_chk === 'Y' ? '그룹 관리자' : 
                                   member.sgdt_leader_chk === 'Y' ? '리더' : '멤버'}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <div className="p-4 bg-indigo-100 rounded-full w-fit mx-auto mb-3">
                              <FaUsers className="w-6 h-6 text-indigo-400" />
                            </div>
                            <p className="text-indigo-500 font-medium">그룹원이 없습니다</p>
                            <p className="text-indigo-400 text-sm mt-1">새로운 멤버를 초대해보세요</p>
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
              <div className="p-8 bg-gradient-to-r from-indigo-100 to-indigo-200 rounded-full mb-6 animate-bounce">
                <HiUserGroup className="w-16 h-16 text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold text-indigo-900 mb-2">그룹을 선택해주세요</h3>
              <p className="text-indigo-600 mb-6">관리하고 싶은 그룹을 선택하세요</p>
              <button
                onClick={() => setCurrentView('list')}
                className="mobile-button px-6 py-3 bg-gradient-to-r from-indigo-700 to-indigo-800 text-white rounded-xl hover:from-indigo-800 hover:to-indigo-900"
              >
                그룹 목록 보기
              </button>
            </div>
          )}
        </div>

        {/* 새 그룹 추가 모달 */}
        {isAddModalOpen && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCloseModal}
          >
            <div 
              className={`bg-white rounded-3xl w-full max-w-md mx-auto modal-safe-area ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
              style={{
                transform: isDragging 
                  ? `translateY(${Math.max(0, dragCurrentY - dragStartY)}px)` 
                  : 'translateY(0)',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="p-6 pb-8">
                {/* 모달 핸들 제거 */}
                
                <div className="text-center mb-6">
                  <HiUserGroup className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <h3 className="text-xl font-normal text-gray-900">새 그룹 만들기</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-normal text-indigo-700 mb-2">
                      그룹명 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={newGroup.name}
                      onChange={handleInputChange}
                      placeholder="예: 가족, 친구, 직장"
                      className="w-full px-4 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                      maxLength={50}
                    />
                    <p className="text-xs text-gray-500 mt-1">{newGroup.name.length}/50</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-normal text-indigo-700 mb-2">
                      그룹 설명
                    </label>
                    <textarea
                      name="description"
                      value={newGroup.description}
                      onChange={handleInputChange}
                      placeholder="그룹에 대한 간단한 설명을 입력해주세요"
                      rows={3}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-base"
                      maxLength={100}
                    />
                    <p className="text-xs text-gray-500 mt-1">{newGroup.description.length}/100</p>
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-8">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isCreatingGroup}
                    className="flex-1 mobile-button py-4 border border-gray-300 rounded-2xl text-gray-700 font-medium disabled:opacity-50 hover:bg-indigo-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGroup}
                    disabled={newGroup.name.trim() === '' || isCreatingGroup}
                    className="flex-1 mobile-button py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center hover:from-indigo-800 hover:to-indigo-900"
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
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCloseShareModal}
          >
            <div 
              className={`bg-white rounded-3xl w-full max-w-md mx-auto modal-safe-area ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
              style={{
                transform: isDragging 
                  ? `translateY(${Math.max(0, dragCurrentY - dragStartY)}px)` 
                  : 'translateY(0)',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="p-6 pb-8">
                {/* 모달 핸들 제거 */}
                
                <div className="text-center mb-6">
                  <FaShare className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-indigo-900">그룹 초대하기</h3>
                  <p className="text-indigo-600 mt-1">{selectedGroup.sgt_title}</p>
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
                    onClick={handleCloseShareModal}
                    className="w-full mobile-button py-4 mt-6 text-indigo-600 font-medium hover:text-indigo-800"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 그룹 수정 모달 */}
        {isEditModalOpen && selectedGroup && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCloseEditModal}
          >
            <div 
              className={`bg-white rounded-3xl w-full max-w-md mx-auto modal-safe-area ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
              style={{
                transform: isDragging 
                  ? `translateY(${Math.max(0, dragCurrentY - dragStartY)}px)` 
                  : 'translateY(0)',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="p-6 pb-8">
                {/* 모달 핸들 제거 */}
                
                <div className="text-center mb-6">
                  <FaEdit className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <h3 className="text-xl font-normal text-gray-900">그룹 수정하기</h3>
                  <p className="text-gray-600 mt-1">{selectedGroup.sgt_title}</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-normal text-indigo-700 mb-2">
                      그룹명 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={editGroup.name}
                      onChange={handleEditInputChange}
                      placeholder="예: 가족, 친구, 직장"
                      className="w-full px-4 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                      maxLength={50}
                    />
                    <p className="text-xs text-gray-500 mt-1">{editGroup.name.length}/50</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-normal text-indigo-700 mb-2">
                      그룹 설명
                    </label>
                    <textarea
                      name="description"
                      value={editGroup.description}
                      onChange={handleEditInputChange}
                      placeholder="그룹에 대한 간단한 설명을 입력해주세요"
                      rows={3}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-base"
                      maxLength={100}
                    />
                    <p className="text-xs text-gray-500 mt-1">{editGroup.description.length}/100</p>
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-8">
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    disabled={isUpdatingGroup}
                    className="flex-1 mobile-button py-4 border border-gray-300 rounded-2xl text-gray-700 font-medium disabled:opacity-50 hover:bg-indigo-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdateGroup}
                    disabled={editGroup.name.trim() === '' || isUpdatingGroup}
                    className="flex-1 mobile-button py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center hover:from-indigo-800 hover:to-indigo-900"
                  >
                    {isUpdatingGroup ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        수정 중...
                      </>
                    ) : (
                      '수정 완료'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 그룹 삭제 확인 모달 */}
        {isDeleteModalOpen && selectedGroup && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCloseDeleteModal}
          >
            <div 
              className={`bg-white rounded-3xl w-full max-w-md mx-auto modal-safe-area ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
              style={{
                transform: isDragging 
                  ? `translateY(${Math.max(0, dragCurrentY - dragStartY)}px)` 
                  : 'translateY(0)',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="p-6 pb-8">
                {/* 모달 핸들 제거 */}
                
                <div className="text-center mb-6">
                  <FaTrash className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-gray-900">그룹 삭제</h3>
                  <p className="text-gray-600 mt-2 mb-4">
                    <span className="font-medium text-red-600">"{selectedGroup.sgt_title}"</span> 그룹을 정말 삭제하시겠습니까?
                  </p>
                </div>
                
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleDeleteGroup}
                    disabled={isDeleting}
                    className="w-full mobile-button py-4 bg-red-500 text-white rounded-2xl font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        삭제 중...
                      </>
                    ) : (
                      '그룹 삭제'
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleCloseDeleteModal}
                    disabled={isDeleting}
                    className="w-full mobile-button py-4 border border-gray-300 rounded-2xl text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 성공 알림 모달 */}
        {isSuccessModalOpen && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <div 
              className={`bg-white rounded-3xl w-full max-w-md mx-auto modal-safe-area animate-slideInFromBottom`}
            >
              <div className="p-6 pb-8">
                {/* 모달 핸들 제거 */}
                
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaCheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">완료</h3>
                  <p className="text-gray-600 mb-4">{successMessage}</p>
                  
                  {/* 자동 닫기 진행 바 */}
                  <div className="w-full bg-gray-200 rounded-full h-1 mb-2">
                    <div 
                      className="bg-green-500 h-1 rounded-full animate-progress-bar"
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400">3초 후 자동으로 닫힙니다</p>
                </div>
                
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSuccessModalOpen(false);
                      setSuccessMessage('');
                    }}
                    className="w-full mobile-button py-4 bg-green-500 text-white rounded-2xl font-medium hover:bg-green-600 flex items-center justify-center"
                  >
                    확인
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
        <div className="text-center px-6">
          <HiUserGroup className="w-16 h-16 text-indigo-500 mx-auto mb-4 animate-pulse" />
          <p className="text-indigo-600 font-medium">로딩 중...</p>
        </div>
      </div>
    }> 
      <GroupPageContent />
    </Suspense>
  );
}