'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaUsers, 
  FaLayerGroup, 
  FaUserPlus, 
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
  HiEllipsisVertical,
  HiOutlineChevronLeft
} from 'react-icons/hi2';
import { RiKakaoTalkFill } from 'react-icons/ri';
import { FiLink, FiX, FiCopy, FiSettings, FiPlus } from 'react-icons/fi';
import { MdOutlineMessage, MdGroupAdd } from 'react-icons/md';
import { BsThreeDots } from 'react-icons/bs';
import groupService, { Group, GroupStats } from '@/services/groupService';
import memberService from '@/services/memberService';
import scheduleService from '@/services/scheduleService';
import locationService from '@/services/locationService';

export const dynamic = 'force-dynamic';

// 플로팅 버튼 스타일
const floatingButtonStyles = `
.floating-button {
  position: fixed;
  bottom: 80px;
  right: 20px;
  z-index: 40;
  background: #4f46e5;
  box-shadow: 0 8px 25px rgba(79, 70, 229, 0.3);
  transition: all 0.2s ease;
  touch-action: manipulation;
  user-select: none;
}

.floating-button:hover {
  transform: scale(1.1);
  box-shadow: 0 12px 35px rgba(79, 70, 229, 0.4);
}

.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
`;

// 백엔드 이미지 저장 경로의 기본 URL
const BACKEND_STORAGE_BASE_URL = 'https://118.67.130.71:8000/storage/';

// 기본 이미지 생성 함수
const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const imageNumber = (index % 4) + 1;
  if (gender === 1) {
    return `/images/male_${imageNumber}.png`;
  } else if (gender === 2) {
    return `/images/female_${imageNumber}.png`;
  }
  return `/images/avatar${(index % 3) + 1}.png`;
};

// SSL 인증서 오류가 있는 URL인지 확인하는 함수
const isUnsafeImageUrl = (url: string | null): boolean => {
  if (!url) return true;
  
  // 알려진 문제가 있는 서버 URL들
  const unsafeHosts = [
    '118.67.130.71:8000',
    // 필요시 다른 문제가 있는 호스트들을 추가
  ];
  
  return unsafeHosts.some(host => url.includes(host));
};

// 안전한 이미지 URL을 반환하는 함수
const getSafeImageUrl = (photoUrl: string | null, gender: number | null | undefined, index: number): string => {
  if (isUnsafeImageUrl(photoUrl)) {
    return getDefaultImage(gender, index);
  }
  return photoUrl || getDefaultImage(gender, index);
};

// Framer Motion 애니메이션 variants
const pageVariants = {
  initial: { 
    opacity: 0, 
    x: 100 
  },
  in: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  },
  out: { 
    opacity: 0, 
    x: -100,
    transition: {
      duration: 0.6,
      ease: [0.55, 0.06, 0.68, 0.19]
    }
  }
};

const modalVariants = {
  hidden: { 
    opacity: 0, 
    y: 100,
    scale: 0.9
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  },
  exit: { 
    opacity: 0, 
    y: 100,
    scale: 0.9,
    transition: {
      duration: 0.2,
      ease: [0.55, 0.06, 0.68, 0.19]
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  })
};

const floatingButtonVariants = {
  initial: { scale: 0, rotate: -180 },
  animate: { 
    scale: 1, 
    rotate: 0,
    transition: {
      delay: 0.5,
      type: "spring",
      stiffness: 260,
      damping: 20
    }
  },
  hover: { 
    scale: 1.1,
    transition: { duration: 0.2 }
  },
  tap: { scale: 0.9 }
};

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
  photo?: string | null;
  original_index: number;
  
  // 새로 추가된 위치 정보
  mlt_lat?: number | null;
  mlt_long?: number | null;
  mlt_speed?: number | null;
  mlt_battery?: number | null;
  mlt_gps_time?: string | null;
}

// 새 그룹 폼 타입 정의
interface GroupForm {
  name: string;
  description: string;
}

// 메인 컴포넌트
function GroupPageContent() {
  const router = useRouter();
  
  // 상태 관리
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ExtendedGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupMemberCounts, setGroupMemberCounts] = useState<{[key: number]: number}>({});
  const [groupStats, setGroupStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isMemberManageModalOpen, setIsMemberManageModalOpen] = useState(false);
  
  // 폼 상태
  const [newGroup, setNewGroup] = useState<GroupForm>({ name: '', description: '' });
  const [editGroup, setEditGroup] = useState<GroupForm>({ name: '', description: '' });
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // UI 상태
  const [currentView, setCurrentView] = useState<'list' | 'detail'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showGroupActions, setShowGroupActions] = useState(false);
  
  // 로딩 상태
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);

  // 그룹 목록 조회
  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await groupService.getCurrentUserGroups();
      setGroups(data);

      const memberCounts: {[key: number]: number} = {};
      for (const group of data) {
        try {
          const members = await memberService.getGroupMembers(group.sgt_idx.toString());
          memberCounts[group.sgt_idx] = members.length;
        } catch (error) {
          console.error(`그룹 ${group.sgt_idx} 멤버 수 조회 오류:`, error);
          memberCounts[group.sgt_idx] = 0;
        }
      }
      setGroupMemberCounts(memberCounts);
    } catch (error) {
      console.error('그룹 목록 조회 오류:', error);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  // 그룹 멤버 조회
  const fetchGroupMembers = async (group: ExtendedGroup) => {
    try {
      setMembersLoading(true);
      setGroupMembers([]);
      setGroupStats(null);
      
      const memberData = await memberService.getGroupMembers(group.sgt_idx.toString());
      
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
        sgt_idx: group.sgt_idx,
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
        mlt_lat: member.mlt_lat,
        mlt_long: member.mlt_long,
        mlt_speed: member.mlt_speed,
        mlt_battery: member.mlt_battery,
        mlt_gps_time: member.mlt_gps_time,
      }));
      
      setGroupMembers(transformedMembers);
      setGroupMemberCounts(prev => ({
        ...prev,
        [group.sgt_idx]: transformedMembers.length
      }));
    } catch (error) {
      console.error('그룹 멤버 조회 오류:', error);
      setGroupMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  // 그룹 통계 조회
  const fetchGroupStats = async (group: ExtendedGroup, members: GroupMember[]) => {
    try {
      setStatsLoading(true);
      
      const memberCount = members.length;
      let weeklySchedules = 0;
      let totalLocations = 0;
      
      // 올바른 스케줄 API 호출
      try {
        const allGroupSchedules = await scheduleService.getGroupSchedules(group.sgt_idx);
        if (allGroupSchedules.success && allGroupSchedules.data?.schedules) {
          weeklySchedules = allGroupSchedules.data.schedules.length;
        }
      } catch (error) {
        console.error('그룹 스케줄 조회 오류:', error);
        weeklySchedules = 0; // 오류 시 기본값
      }
      
      // 위치 정보는 오류가 발생해도 계속 진행
      for (const member of members) {
        try {
          const memberLocations = await locationService.getOtherMembersLocations(member.mt_idx.toString());
          totalLocations += memberLocations.length;
        } catch (error) {
          console.error(`멤버 ${member.mt_name} 위치 조회 오류:`, error);
          // 오류가 발생해도 계속 진행
        }
      }
      
      const statsData = {
        group_id: group.sgt_idx,
        group_title: group.sgt_title,
        member_count: memberCount,
        weekly_schedules: weeklySchedules,
        total_locations: totalLocations,
        stats_period: {
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date().toISOString(),
          days: 7
        },
        member_stats: []
      };
      
      setGroupStats(statsData);
    } catch (error) {
      console.error('그룹 통계 조회 오류:', error);
      // 오류가 발생해도 기본 통계 데이터 설정
      const basicStatsData = {
        group_id: group.sgt_idx,
        group_title: group.sgt_title,
        member_count: members.length,
        weekly_schedules: 0,
        total_locations: 0,
        stats_period: {
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date().toISOString(),
          days: 7
        },
        member_stats: []
      };
      setGroupStats(basicStatsData);
    } finally {
      setStatsLoading(false);
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    fetchGroups();
  }, []);

  // 선택된 그룹의 멤버 및 통계 조회
  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMembers(selectedGroup);
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (selectedGroup && groupMembers.length > 0 && !membersLoading) {
      fetchGroupStats(selectedGroup, groupMembers);
    }
  }, [selectedGroup, groupMembers, membersLoading]);

  // 이벤트 핸들러들
  const handleGroupSelect = (group: ExtendedGroup) => {
    setSelectedGroup(group);
    setCurrentView('detail');
    setShowGroupActions(false);
  };

  const handleBackToList = () => {
    setCurrentView('list');
  };

  const handleBackNavigation = () => {
    router.back();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // 새 그룹 생성
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
      const newGroupItem: ExtendedGroup = {
        sgt_idx: createdGroup.sgt_idx,
        sgt_title: createdGroup.sgt_title,
        sgt_content: createdGroup.sgt_memo || '',
        sgt_memo: createdGroup.sgt_memo,
        mt_idx: createdGroup.mt_idx,
        sgt_show: createdGroup.sgt_show,
        sgt_wdate: createdGroup.sgt_wdate,
        memberCount: 1
      };
      
      setGroups(prev => [newGroupItem, ...prev]);
      setGroupMemberCounts(prev => ({
        ...prev,
        [createdGroup.sgt_idx]: 1
      }));
      setSelectedGroup(newGroupItem);
      setIsAddModalOpen(false);
      setNewGroup({ name: '', description: '' });
      
      setSuccessMessage('새 그룹이 성공적으로 생성되었습니다.');
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error('그룹 생성 오류:', error);
      alert('그룹 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // 그룹 수정
  const handleUpdateGroup = async () => {
    if (!selectedGroup || editGroup.name.trim() === '') return;
    
    setIsUpdatingGroup(true);
    try {
      const updateData = {
        sgt_title: editGroup.name.trim(),
        sgt_memo: editGroup.description.trim() || null
      };
      
      const updatedGroup = await groupService.updateGroup(selectedGroup.sgt_idx, updateData);
      
      const updatedGroupExtended: ExtendedGroup = {
        ...selectedGroup,
        sgt_title: updatedGroup.sgt_title,
        sgt_memo: updatedGroup.sgt_memo,
        sgt_content: updatedGroup.sgt_memo || updatedGroup.sgt_content || ''
      };
      
      setSelectedGroup(updatedGroupExtended);
      setGroups(prev => 
        prev.map(group => 
          group.sgt_idx === selectedGroup.sgt_idx 
            ? updatedGroupExtended 
            : group
        )
      );
      
      setIsEditModalOpen(false);
      setEditGroup({ name: '', description: '' });
      
      setSuccessMessage('그룹이 성공적으로 수정되었습니다.');
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error('그룹 수정 오류:', error);
      alert('그룹 수정 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  // 그룹 삭제
  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    
    setIsDeleting(true);
    try {
      await groupService.deleteGroup(selectedGroup.sgt_idx);
      await fetchGroups();
      
      setSelectedGroup(null);
      setGroupMembers([]);
      setShowGroupActions(false);
      setIsDeleteModalOpen(false);
      setCurrentView('list');
      
      setSuccessMessage('그룹이 목록에서 숨겨졌습니다.');
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error('그룹 삭제 오류:', error);
      alert('그룹 삭제 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 공유 기능
  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/group/${selectedGroup?.sgt_idx}/join`;
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        setIsShareModalOpen(false);
        setSuccessMessage('초대 링크가 복사되었습니다!');
        setIsSuccessModalOpen(true);
      })
      .catch(err => {
        console.error('링크 복사 실패:', err);
        alert('링크 복사에 실패했습니다.');
      });
  };

  // 멤버 관리
  const handleMemberClick = (member: GroupMember) => {
    if (!isCurrentUserGroupOwner()) return;
    if (member.sgdt_owner_chk === 'Y') return;
    
    setSelectedMember(member);
    setIsMemberManageModalOpen(true);
  };

  const isCurrentUserGroupOwner = () => {
    if (!selectedGroup || !groupMembers.length) return false;
    const currentUserId = 1186;
    const currentUserMember = groupMembers.find(member => member.mt_idx === currentUserId);
    return currentUserMember?.sgdt_owner_chk === 'Y';
  };

  const handleChangeMemberRole = async (newRole: 'member' | 'leader') => {
    if (!selectedMember || !selectedGroup) return;
    
    setIsUpdatingMember(true);
    try {
      const result = await memberService.updateMemberRole(
        selectedGroup.sgt_idx,
        selectedMember.mt_idx,
        newRole === 'leader'
      );
      
      setGroupMembers(prev => 
        prev.map(member => 
          member.mt_idx === selectedMember.mt_idx 
            ? { ...member, sgdt_leader_chk: newRole === 'leader' ? 'Y' : 'N' }
            : member
        )
      );
      
      setIsMemberManageModalOpen(false);
      setSelectedMember(null);
      setSuccessMessage(result.message);
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error('멤버 역할 변경 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '역할 변경 중 오류가 발생했습니다.';
      alert(errorMessage);
    } finally {
      setIsUpdatingMember(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember || !selectedGroup) return;
    
    setIsUpdatingMember(true);
    try {
      const result = await memberService.removeMemberFromGroup(
        selectedGroup.sgt_idx,
        selectedMember.mt_idx
      );
      
      setGroupMembers(prev => 
        prev.filter(member => member.mt_idx !== selectedMember.mt_idx)
      );
      
      setIsMemberManageModalOpen(false);
      setSelectedMember(null);
      setSuccessMessage(result.message);
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error('멤버 탈퇴 처리 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '멤버 탈퇴 처리 중 오류가 발생했습니다.';
      alert(errorMessage);
    } finally {
      setIsUpdatingMember(false);
    }
  };

  // 검색 필터링
  const filteredGroups = groups.filter(group => 
    group.sgt_title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (group.sgt_content && group.sgt_content.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (group.sgt_memo && group.sgt_memo.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 성공 모달 자동 닫기
  useEffect(() => {
    if (isSuccessModalOpen) {
      const timer = setTimeout(() => {
        setIsSuccessModalOpen(false);
        setSuccessMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccessModalOpen]);

  return (
    <>
      <style jsx global>{floatingButtonStyles}</style>
      <div className="min-h-screen bg-indigo-50">
        {/* 개선된 헤더 */}
        <motion.header 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed top-0 left-0 right-0 z-20 glass-effect"
        >
          <div className="flex items-center justify-between h-16 px-4">
            {currentView === 'list' ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-3">
                  <motion.div
                    initial={{ rotate: -180, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                    className="p-2 bg-indigo-600 rounded-xl"
                  >
                    <FaUsers className="w-5 h-5 text-white" />
                  </motion.div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">그룹</h1>
                    <p className="text-xs text-gray-500">나의 소중한 그룹을 관리해보세요</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <motion.button 
                  onClick={handleBackToList}
                  className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <HiOutlineChevronLeft className="w-5 h-5 text-gray-700" />
                </motion.button>
                <div className="flex items-center space-x-3">
                  <motion.div
                    initial={{ rotate: -180, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                    className="p-2 bg-indigo-600 rounded-xl"
                  >
                    <FaUsers className="w-5 h-5 text-white" />
                  </motion.div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">그룹 상세</h1>
                    <p className="text-xs text-gray-500">멤버들과 함께하는 즐거운 공간</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              {/* 필요시 추가 버튼들을 여기에 배치 */}
            </div>
          </div>
        </motion.header>

        {/* 메인 컨텐츠 - 애니메이션 제거 */}
        <div className="pb-safe pt-20">
          <AnimatePresence mode="wait">
            {currentView === 'list' ? (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.3 }}
              >
                {/* 검색 섹션 */}
                <div className="px-4 pb-4">
                  <motion.div 
                    className="relative"
                    whileFocus={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="그룹 검색..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => setIsSearchFocused(false)}
                      className="w-full pl-12 pr-4 py-4 bg-white border border-indigo-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-gray-500 placeholder-gray-400 text-base shadow-sm"
                    />
                  </motion.div>
                </div>

                {/* 통계 카드 */}
                <div className="px-4 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <motion.div 
                      className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-4 text-white shadow-lg"
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      custom={0}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-indigo-100 text-sm">총 그룹</p>
                          <p className="text-2xl font-bold">{groups.length}개</p>
                        </div>
                        <FaLayerGroup className="w-8 h-8 text-indigo-200" />
                      </div>
                    </motion.div>
                    <motion.div 
                      className="bg-gradient-to-r from-pink-600 to-pink-700 rounded-2xl p-4 text-white shadow-lg"
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      custom={1}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-pink-100 text-sm">총 멤버</p>
                          <p className="text-2xl font-bold">{Object.values(groupMemberCounts).reduce((a, b) => a + b, 0)}명</p>
                        </div>
                        <FaUsers className="w-8 h-8 text-pink-200" />
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* 그룹 목록 */}
                <div className="px-4 space-y-3">
                  {filteredGroups.length > 0 ? (
                    <motion.div 
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      custom={2}
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <h3 className="text-lg font-medium text-gray-900">내 그룹 목록</h3>
                      </div>
                      <div className="p-4 space-y-3">
                        {filteredGroups.map((group, index) => {
                          const memberCount = groupMemberCounts[group.sgt_idx] || 0;
                          
                          return (
                            <motion.div
                              key={group.sgt_idx}
                              onClick={() => handleGroupSelect(group as ExtendedGroup)}
                              className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-4 cursor-pointer"
                              whileHover={{ 
                                scale: 1.02,
                                backgroundColor: "rgb(224 231 255)"
                              }}
                              whileTap={{ scale: 0.98 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center flex-1 mr-3">
                                  <div className="p-2 bg-white rounded-xl mr-4">
                                    <img 
                                      src={`/images/group${(index % 2) + 1}.webp`}
                                      alt="그룹 아이콘"
                                      className="w-12 h-12 object-cover"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-normal text-lg text-gray-800 mb-1">
                                      {group.sgt_title}
                                    </h4>
                                    <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                                      {group.sgt_memo || group.sgt_content || '그룹 설명이 없습니다'}
                                    </p>
                                    <div className="flex items-center space-x-4 text-xs text-indigo-500">
                                      <span className="flex items-center">
                                        <FaUsers className="w-3 h-3 mr-1" />
                                        {memberCount}명
                                      </span>
                                      <span className="text-blue-500">
                                        {new Date(group.sgt_wdate).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      className="text-center py-12"
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      custom={2}
                    >
                      <div className="p-6 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                        <FaSearch className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-lg font-medium">검색 결과가 없습니다</p>
                      <p className="text-gray-400 text-sm mt-1">다른 키워드로 검색해보세요</p>
                    </motion.div>
                  )}
                </div>

                {/* 플로팅 추가 버튼 */}
                <motion.button
                  onClick={() => setIsAddModalOpen(true)}
                  className="floating-button w-14 h-14 rounded-full flex items-center justify-center text-white"
                  variants={floatingButtonVariants}
                  initial="initial"
                  animate="animate"
                  whileHover="hover"
                  whileTap="tap"
                >
                  <FiPlus className="w-6 h-6 stroke-2" />
                </motion.button>
              </motion.div>
            ) : selectedGroup ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 100 }}
                transition={{ duration: 0.3 }}
              >
                {/* 그룹 헤더 카드 */}
                <div className="mx-4 mt-4 mb-4">
                  <motion.div 
                    className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative"
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    {/* 그룹 액션 메뉴 버튼 */}
                    <div className="absolute top-4 right-4">
                      <motion.button
                        onClick={() => setShowGroupActions(!showGroupActions)}
                        className="p-2 bg-white/20 rounded-full hover:bg-white/30"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <HiEllipsisVertical className="w-4 h-4 text-white" />
                      </motion.button>
                      <AnimatePresence>
                        {showGroupActions && (
                          <>
                            <div 
                              className="fixed inset-0 z-[55]" 
                              onClick={() => setShowGroupActions(false)}
                            />
                            <motion.div 
                              className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-[60]"
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              transition={{ duration: 0.15 }}
                            >
                              <button 
                                onClick={() => {
                                  setEditGroup({
                                    name: selectedGroup.sgt_title,
                                    description: selectedGroup.sgt_memo || selectedGroup.sgt_content || ''
                                  });
                                  setIsEditModalOpen(true);
                                  setShowGroupActions(false);
                                }}
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
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center flex-1 pr-12">
                        <div className="p-2 bg-white rounded-xl mr-4">
                          <img 
                            src={`/images/group${((groups.findIndex(g => g.sgt_idx === selectedGroup.sgt_idx) % 2) + 1)}.webp`}
                            alt="그룹 아이콘"
                            className="w-12 h-12 object-cover"
                          />
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
                  </motion.div>
                </div>

                {/* 통계 카드들 */}
                <div className="px-4 mb-4">
                  <div className="grid grid-cols-3 gap-3">
                    <motion.div 
                      className="bg-gradient-to-r from-red-300 to-red-300 rounded-xl p-3 text-white text-center shadow-md"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <FaUsers className="w-6 h-6 text-red-800 mx-auto mb-1" />
                      {membersLoading ? (
                        <div className="flex items-center justify-center py-2">
                          <div className="text-center">
                            <div className="w-4 h-4 border-2 border-red-800 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                            <div className="text-xs text-red-800">로딩중...</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-lg font-bold">
                          {groupStats?.member_count ?? groupMembers.length ?? 0}
                        </div>
                      )}
                      <p className="text-red-800 text-xs">멤버</p>
                    </motion.div>
                    <motion.div 
                      className="bg-gradient-to-r from-yellow-300 to-yellow-300 rounded-xl p-3 text-white text-center shadow-md"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <FaCalendarAlt className="w-6 h-6 text-yellow-800 mx-auto mb-1" />
                      {statsLoading ? (
                        <div className="flex items-center justify-center py-2">
                          <div className="text-center">
                            <div className="w-4 h-4 border-2 border-yellow-800 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                            <div className="text-xs text-yellow-800">로딩중...</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-lg font-bold">
                          {groupStats?.weekly_schedules ?? 0}
                        </div>
                      )}
                      <p className="text-yellow-800 text-xs">주간 일정</p>
                    </motion.div>
                    <motion.div 
                      className="bg-gradient-to-r from-blue-300 to-blue-300 rounded-xl p-3 text-white text-center shadow-md"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <FaMapMarkerAlt className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                      {statsLoading ? (
                        <div className="flex items-center justify-center py-2">
                          <div className="text-center">
                            <div className="w-4 h-4 border-2 border-blue-800 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                            <div className="text-xs text-blue-800">로딩중...</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-lg font-bold">
                          {groupStats?.total_locations ?? 0}
                        </div>
                      )}
                      <p className="text-blue-800 text-xs">총 위치</p>
                    </motion.div>
                  </div>
                </div>

                {/* 그룹 멤버 섹션 */}
                <div className="px-4">
                  <motion.div 
                    className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden"
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="p-4 border-b border-indigo-100">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-normal text-gray-900">그룹 멤버</h3>
                        <motion.button
                          onClick={() => setIsShareModalOpen(true)}
                          className="px-3 py-2 bg-pink-500 text-white rounded-lg text-sm flex items-center space-x-1"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <MdGroupAdd className="w-4 h-4" />
                          <span>초대</span>
                        </motion.button>
                      </div>
                    </div>
                    
                    <div className="p-4">
                      {membersLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-center">
                            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <p className="text-sm text-gray-600">그룹원을 불러오는 중...</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {groupMembers.length > 0 ? (
                            groupMembers.map((member, index) => (
                              <motion.div 
                                key={member.mt_idx} 
                                onClick={() => handleMemberClick(member)}
                                className={`flex items-center p-3 bg-indigo-50 rounded-xl ${
                                  isCurrentUserGroupOwner() && member.sgdt_owner_chk !== 'Y' 
                                    ? 'cursor-pointer hover:bg-indigo-100 hover:shadow-md' 
                                    : ''
                                }`}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.6 + index * 0.1 }}
                                whileHover={isCurrentUserGroupOwner() && member.sgdt_owner_chk !== 'Y' ? { scale: 1.02 } : {}}
                                whileTap={isCurrentUserGroupOwner() && member.sgdt_owner_chk !== 'Y' ? { scale: 0.98 } : {}}
                              >
                                <div className="relative mr-3">
                                  <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center border-3 border-indigo-200">
                                    <img
                                      src={getSafeImageUrl(member.photo || null, member.mt_gender, member.original_index)}
                                      alt={member.mt_name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src = getDefaultImage(member.mt_gender, member.original_index);
                                      }}
                                    />
                                  </div>
                                  {member.sgdt_owner_chk === 'Y' && (
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg">
                                      <FaCrown className="w-2.5 h-2.5 text-white" />
                                    </div>
                                  )}
                                  {member.sgdt_owner_chk !== 'Y' && member.sgdt_leader_chk === 'Y' && (
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center shadow-lg">
                                      <FaCrown className="w-2.5 h-2.5 text-white" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-normal text-gray-900">
                                      {member.mt_nickname || member.mt_name || '이름 없음'}
                                    </h4>
                                    <div className="flex items-center space-x-2">
                                      {member.sgdt_owner_chk === 'Y' && (
                                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
                                          그룹장
                                        </span>
                                      )}
                                      {isCurrentUserGroupOwner() && member.sgdt_owner_chk !== 'Y' && (
                                        <FaCog className="w-4 h-4 text-gray-400" />
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-sm text-indigo-600 mt-1">
                                    {member.sgdt_owner_chk === 'Y' ? '그룹 관리자' : 
                                     member.sgdt_leader_chk === 'Y' ? '리더' : '멤버'}
                                  </p>
                                </div>
                              </motion.div>
                            ))
                          ) : (
                            <div className="text-center py-8">
                              <div className="p-4 bg-indigo-100 rounded-full w-fit mx-auto mb-3">
                                <FaUsers className="w-6 h-6 text-indigo-400" />
                              </div>
                              <p className="text-gray-500 font-medium">그룹원이 없습니다</p>
                              <p className="text-gray-400 text-sm mt-1">새로운 멤버를 초대해보세요</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* 모달들 */}
        <AnimatePresence>
          {/* 새 그룹 추가 모달 */}
          {isAddModalOpen && (
            <motion.div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
            >
              <motion.div 
                className="bg-white rounded-3xl w-full max-w-md mx-auto"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 pb-8">
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
                        value={newGroup.name}
                        onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
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
                        value={newGroup.description}
                        onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="그룹에 대한 간단한 설명을 입력해주세요"
                        rows={3}
                        className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-base"
                        maxLength={100}
                      />
                      <p className="text-xs text-gray-500 mt-1">{newGroup.description.length}/100</p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3 mt-8">
                    <motion.button
                      onClick={() => setIsAddModalOpen(false)}
                      disabled={isCreatingGroup}
                      className="flex-1 py-4 border border-gray-300 rounded-2xl text-gray-700 font-medium disabled:opacity-50"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      취소
                    </motion.button>
                    <motion.button
                      onClick={handleSaveGroup}
                      disabled={newGroup.name.trim() === '' || isCreatingGroup}
                      className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isCreatingGroup ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          생성 중...
                        </>
                      ) : (
                        '그룹 만들기'
                      )}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* 공유 모달 */}
          {isShareModalOpen && selectedGroup && (
            <motion.div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShareModalOpen(false)}
            >
              <motion.div 
                className="bg-white rounded-3xl w-full max-w-md mx-auto"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 pb-8">
                  <div className="text-center mb-6">
                    <FaShare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-gray-900">그룹 초대하기</h3>
                    <p className="text-gray-600 mt-1">{selectedGroup.sgt_title}</p>
                  </div>
                  
                  <div className="space-y-3">
                    <motion.button 
                      onClick={() => alert('카카오톡 공유 기능은 준비 중입니다.')} 
                      className="w-full flex items-center justify-center p-4 rounded-2xl bg-[#FEE500] text-[#3C1E1E]"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <RiKakaoTalkFill className="w-6 h-6 mr-4" />
                      <span className="font-medium">카카오톡으로 공유</span>
                    </motion.button>
                    
                    <motion.button 
                      onClick={handleCopyLink} 
                      className="w-full flex items-center justify-center p-4 rounded-2xl bg-blue-400 text-white"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <FiCopy className="w-6 h-6 mr-4" />
                      <span className="font-medium">초대 링크 복사</span>
                    </motion.button>
                    
                    <motion.button 
                      onClick={() => alert('문자 공유 기능은 준비 중입니다.')} 
                      className="w-full flex items-center justify-center p-4 rounded-2xl bg-red-400 text-white"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <MdOutlineMessage className="w-6 h-6 mr-4" />
                      <span className="font-medium">문자로 공유</span>
                    </motion.button>
                    
                    <motion.button
                      onClick={() => setIsShareModalOpen(false)}
                      className="w-full py-4 mt-6 text-gray-600 font-medium"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      닫기
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* 그룹 수정 모달 */}
          {isEditModalOpen && selectedGroup && (
            <motion.div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
            >
              <motion.div 
                className="bg-white rounded-3xl w-full max-w-md mx-auto"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 pb-8">
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
                        value={editGroup.name}
                        onChange={(e) => setEditGroup(prev => ({ ...prev, name: e.target.value }))}
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
                        value={editGroup.description}
                        onChange={(e) => setEditGroup(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="그룹에 대한 간단한 설명을 입력해주세요"
                        rows={3}
                        className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-base"
                        maxLength={100}
                      />
                      <p className="text-xs text-gray-500 mt-1">{editGroup.description.length}/100</p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3 mt-8">
                    <motion.button
                      onClick={() => setIsEditModalOpen(false)}
                      disabled={isUpdatingGroup}
                      className="flex-1 py-4 border border-gray-300 rounded-2xl text-gray-700 font-medium disabled:opacity-50"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      취소
                    </motion.button>
                    <motion.button
                      onClick={handleUpdateGroup}
                      disabled={editGroup.name.trim() === '' || isUpdatingGroup}
                      className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isUpdatingGroup ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          수정 중...
                        </>
                      ) : (
                        '수정 완료'
                      )}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* 그룹 삭제 확인 모달 */}
          {isDeleteModalOpen && selectedGroup && (
            <motion.div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              <motion.div 
                className="bg-white rounded-3xl w-full max-w-md mx-auto"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 pb-8">
                  <div className="text-center mb-6">
                    <FaTrash className="w-12 h-12 text-red-500 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-gray-900">그룹 삭제</h3>
                    <p className="text-gray-600 mt-2 mb-4">
                      <span className="font-medium text-red-600">"{selectedGroup.sgt_title}"</span> 그룹을 정말 삭제하시겠습니까?
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <motion.button
                      onClick={handleDeleteGroup}
                      disabled={isDeleting}
                      className="w-full py-4 bg-red-500 text-white rounded-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isDeleting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          삭제 중...
                        </>
                      ) : (
                        '그룹 삭제'
                      )}
                    </motion.button>
                    
                    <motion.button
                      onClick={() => setIsDeleteModalOpen(false)}
                      disabled={isDeleting}
                      className="w-full py-4 border border-gray-300 rounded-2xl text-gray-700 font-medium disabled:opacity-50"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      취소
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* 멤버 관리 모달 */}
          {isMemberManageModalOpen && selectedMember && (
            <motion.div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMemberManageModalOpen(false)}
            >
              <motion.div 
                className="bg-white rounded-3xl w-full max-w-md mx-auto"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 pb-8">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <img
                        src={getSafeImageUrl(selectedMember.photo || null, selectedMember.mt_gender, selectedMember.original_index)}
                        alt={selectedMember.mt_name}
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          e.currentTarget.src = getDefaultImage(selectedMember.mt_gender, selectedMember.original_index);
                        }}
                      />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedMember.mt_nickname || selectedMember.mt_name}</h3>
                    <p className="text-gray-600">
                      현재: {selectedMember.sgdt_leader_chk === 'Y' ? '리더' : '멤버'}
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {selectedMember.sgdt_leader_chk === 'Y' ? (
                      <motion.button 
                        onClick={() => handleChangeMemberRole('member')}
                        disabled={isUpdatingMember}
                        className="w-full flex items-center justify-center p-4 rounded-2xl bg-blue-500 text-white disabled:opacity-50"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {isUpdatingMember ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        ) : (
                          <FaUsers className="w-5 h-5 mr-2" />
                        )}
                        <span>멤버로 변경</span>
                      </motion.button>
                    ) : (
                      <motion.button 
                        onClick={() => handleChangeMemberRole('leader')}
                        disabled={isUpdatingMember}
                        className="w-full flex items-center justify-center p-4 rounded-2xl bg-gradient-to-r from-gray-400 to-gray-500 text-white disabled:opacity-50"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {isUpdatingMember ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        ) : (
                          <FaCrown className="w-5 h-5 mr-2" />
                        )}
                        <span>리더로 승격</span>
                      </motion.button>
                    )}
                    
                    <motion.button 
                      onClick={handleRemoveMember}
                      disabled={isUpdatingMember}
                      className="w-full flex items-center justify-center p-4 rounded-2xl bg-red-500 text-white disabled:opacity-50"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isUpdatingMember ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      ) : (
                        <FaTrash className="w-5 h-5 mr-2" />
                      )}
                      <span>그룹에서 탈퇴</span>
                    </motion.button>
                    
                    <motion.button
                      onClick={() => setIsMemberManageModalOpen(false)}
                      disabled={isUpdatingMember}
                      className="w-full py-4 text-gray-600 font-medium disabled:opacity-50"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      취소
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* 성공 알림 모달 */}
          {isSuccessModalOpen && (
            <motion.div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div 
                className="bg-white rounded-3xl w-full max-w-md mx-auto"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="p-6 pb-8">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FaCheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">완료</h3>
                    <p className="text-gray-600 mb-4">{successMessage}</p>
                    
                    <div className="w-full bg-gray-200 rounded-full h-1 mb-2">
                      <motion.div 
                        className="bg-green-500 h-1 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 3 }}
                      />
                    </div>
                    <p className="text-xs text-gray-400">3초 후 자동으로 닫힙니다</p>
                  </div>
                  
                  <motion.button
                    onClick={() => {
                      setIsSuccessModalOpen(false);
                      setSuccessMessage('');
                    }}
                    className="w-full py-4 bg-green-500 text-white rounded-2xl font-medium flex items-center justify-center"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    확인
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// Suspense로 감싸는 기본 export 함수
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