'use client';

import { useState, useEffect, Suspense, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import Image from 'next/image';
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
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import authService from '@/services/authService';
import { hapticFeedback } from '@/utils/haptic';
import IOSCompatibleSpinner from '@/components/common/IOSCompatibleSpinner';

// Dynamic imports for performance optimization
const Modal = dynamicImport(() => import('@/components/ui/Modal'), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-32" />
});
const AnimatedHeader = dynamicImport(() => import('../../components/common/AnimatedHeader'), {
  loading: () => <div className="h-14 bg-white/95 backdrop-blur-sm" />
});

export const dynamic = 'force-dynamic';

// 플로팅 버튼 스타일
const floatingButtonStyles = `
.floating-button {
  position: fixed;
  bottom: 20px;
  right: 16px;
  z-index: 40;
  background: #0113A3;
  box-shadow: 0 8px 25px rgba(1, 19, 163, 0.3);
  transition: all 0.2s ease;
  touch-action: manipulation;
  user-select: none;
}

.floating-button:hover {
  transform: scale(1.1);
  box-shadow: 0 12px 35px rgba(1, 19, 163, 0.4);
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

// 검색 컴포넌트 메모이제이션
const SearchSection = memo<{
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
}>(({ searchQuery, onSearchChange, onFocus, onBlur }) => (
  <div className="px-4 pb-4 mt-5">
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
        onChange={onSearchChange}
        onFocus={onFocus}
        onBlur={onBlur}
        className="w-full pl-4 pr-4 py-4 bg-white border rounded-2xl focus:outline-none focus:ring-2 focus:border-gray-500 placeholder-gray-400 text-base shadow-sm"
        style={{ 
          borderColor: 'rgba(1, 19, 163, 0.2)',
          '--tw-ring-color': '#0113A3'
        } as React.CSSProperties}
      />
    </motion.div>
  </div>
));

// 통계 카드 컴포넌트 메모이제이션
const StatsCards = memo<{
  groupsCount: number;
  totalMembers: number;
}>(({ groupsCount, totalMembers }) => (
  <div className="px-4 mb-4">
    <div className="grid grid-cols-2 gap-3">
      <motion.div 
        className="rounded-2xl p-4 text-white shadow-lg"
        style={{ background: 'linear-gradient(to right, #0113A3, #001a8a)' }}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">총 그룹</p>
            <p className="text-2xl font-bold">{groupsCount}개</p>
          </div>
          <FaLayerGroup className="w-8 h-8 text-blue-200" />
        </div>
      </motion.div>
      <motion.div 
        className="bg-gradient-to-r from-pink-600 to-pink-700 rounded-2xl p-4 text-white shadow-lg"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-pink-100 text-sm">총 멤버</p>
            <p className="text-2xl font-bold">{totalMembers}명</p>
          </div>
          <FaUsers className="w-8 h-8 text-pink-200" />
        </div>
      </motion.div>
    </div>
  </div>
));

// 그룹 카드 컴포넌트 메모이제이션
const GroupCard = memo<{
  group: ExtendedGroup;
  index: number;
  memberCount: number;
  onSelect: (group: ExtendedGroup) => void;
}>(({ group, index, memberCount, onSelect }) => (
  <motion.div
    key={group.sgt_idx}
    onClick={() => onSelect(group)}
    className="rounded-xl p-4 cursor-pointer"
    style={{ background: 'linear-gradient(to right, rgba(240, 249, 255, 0.8), rgba(219, 234, 254, 0.8))' }}
    variants={groupCardVariants}
    initial="hidden"
    animate="visible"
    whileHover="hover"
    whileTap="tap"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center flex-1 mr-3">
        <div className="p-2 bg-white rounded-xl mr-4">
          <Image 
            src={`/images/group${(index % 2) + 1}.webp`}
            alt="그룹 아이콘"
            width={48}
            height={48}
            className="w-12 h-12 object-cover rounded-lg"
            priority={index < 2}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
          />
        </div>
        <div className="flex-1">
          <h4 className="font-normal text-lg text-gray-800 mb-1">
            {group.sgt_title}
          </h4>
          <p className="text-gray-600 text-sm line-clamp-2 mb-2">
            {group.sgt_memo || group.sgt_content || '그룹 설명이 없습니다'}
          </p>
          <div className="flex items-center space-x-4 text-xs" style={{ color: '#0113A3' }}>
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
));

// SSL 인증서 오류가 있는 URL인지 확인하는 함수
// 안전한 이미지 URL을 반환하는 함수 - location/home과 동일한 로직
const getSafeImageUrl = (photoUrl: string | null, gender: number | null | undefined, index: number): string => {
  // 실제 사진이 있으면 사용하고, 없으면 기본 이미지 사용
  return photoUrl ?? getDefaultImage(gender, index);
};

// Framer Motion 애니메이션 variants - schedule/page.tsx 스타일로 변경
const pageVariants = {
  initial: { 
    opacity: 0, 
    y: 20 
  },
  in: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.6
    }
  },
  out: { 
    opacity: 0, 
    y: -20,
    transition: {
      duration: 0.4
    }
  }
};



const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5
    }
  }
};

const floatingButtonVariants = {
  initial: { y: 100, opacity: 0, scale: 0.8 },
  animate: { 
    y: -80, 
    opacity: 1, 
    scale: 1,
    transition: {
      delay: 0.2,
      type: "spring" as const,
      stiffness: 120,
      damping: 25,
      duration: 1.0
    }
  },
  hover: { 
    scale: 1.1,
    y: -2,
    transition: { duration: 0.2 }
  },
  tap: { scale: 0.9 }
};

// 그룹 목록 컨테이너 애니메이션 - schedule 스타일로 변경
const groupListContainerVariants = {
  hidden: { 
    opacity: 0,
    y: 20
  },
  visible: { 
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

// 개별 그룹 카드 애니메이션 - schedule 스타일로 변경
const groupCardVariants = {
  hidden: { 
    opacity: 0, 
    y: 20
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.5
    }
  },
  hover: {
    scale: 1.02,
    y: -4,
    transition: {
      duration: 0.2
    }
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.1
    }
  }
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

// 모달 애니메이션 variants
const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 50
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3
    }
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 50,
    transition: {
      duration: 0.2
    }
  }
};

// 메인 컴포넌트
function GroupPageContent() {
  const router = useRouter();
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const { 
    getUserProfile, 
    getUserGroups, 
    getGroupMembers, 
    getLocationData,
    getDailyLocationCounts,
    isCacheValid,
    loadFromLocalStorage
  } = useDataCache();
  
  // 상태 관리
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ExtendedGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupMemberCounts, setGroupMemberCounts] = useState<{[key: number]: number}>({});
  const [groupStats, setGroupStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isMemberManageModalOpen, setIsMemberManageModalOpen] = useState(false);
  
  // 폼 상태
  const [newGroup, setNewGroup] = useState<GroupForm>({ name: '', description: '' });
  const [editGroup, setEditGroup] = useState<GroupForm>({ name: '', description: '' });
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  
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
    }
  };

  // 그룹 멤버 조회
  const fetchGroupMembers = async (group: ExtendedGroup) => {
    try {
      setMembersLoading(true);
      setGroupMembers([]);
      setGroupStats(null);
      
      const memberData = await memberService.getGroupMembers(group.sgt_idx.toString());
      
      const transformedMembers: GroupMember[] = (memberData && Array.isArray(memberData)) ? memberData.map((member: any, index: number) => ({
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
      })) : [];
      
      setGroupMembers(transformedMembers);
      setGroupMemberCounts(prev => ({
        ...prev,
        [group.sgt_idx]: transformedMembers.length
      }));
    } catch (error) {
      console.error('그룹 멤버 조회 오류:', error);
      setGroupMembers([]);
      
      // 오류 발생 시에도 최소한의 기본 멤버 데이터 생성 (그룹 소유자 본인)
      if (user) {
        const defaultMember: GroupMember = {
          mt_idx: user.mt_idx,
          mt_type: user.mt_type || 1,
          mt_level: user.mt_level || 2,
          mt_status: user.mt_status || 1,
          mt_id: user.mt_id || '',
          mt_name: user.mt_name || '나',
          mt_nickname: user.mt_nickname || user.mt_name || '나',
          mt_hp: user.mt_hp || '',
          mt_email: user.mt_email || '',
          mt_birth: user.mt_birth,
          mt_gender: user.mt_gender || 1,
          mt_file1: user.mt_file1 || '',
          mt_lat: parseFloat(user.mt_lat?.toString() || '37.5642'),
          mt_long: parseFloat(user.mt_long?.toString() || '127.0016'),
          mt_sido: user.mt_sido || '',
          mt_gu: user.mt_gu || '',
          mt_dong: user.mt_dong || '',
          mt_onboarding: user.mt_onboarding,
          mt_push1: user.mt_push1,
          mt_plan_check: user.mt_plan_check,
          mt_plan_date: user.mt_plan_date,
          mt_weather_pop: user.mt_weather_pop,
          mt_weather_sky: user.mt_weather_sky || 1,
          mt_weather_tmn: user.mt_weather_tmn || 15,
          mt_weather_tmx: user.mt_weather_tmx || 25,
          mt_weather_date: user.mt_weather_date || new Date().toISOString(),
          mt_ldate: user.mt_ldate || new Date().toISOString(),
          mt_adate: user.mt_adate || new Date().toISOString(),
          sgdt_idx: 1,
          sgt_idx: group.sgt_idx,
          sgdt_owner_chk: 'Y',
          sgdt_leader_chk: 'N',
          sgdt_discharge: 'N',
          sgdt_group_chk: 'Y',
          sgdt_exit: 'N',
          sgdt_show: 'Y',
          sgdt_push_chk: 'Y',
          sgdt_wdate: new Date().toISOString(),
          sgdt_udate: new Date().toISOString(),
          sgdt_ddate: undefined,
          sgdt_xdate: undefined,
          sgdt_adate: new Date().toISOString(),
          photo: user.mt_file1 ? (user.mt_file1.startsWith('http') ? user.mt_file1 : `${BACKEND_STORAGE_BASE_URL}${user.mt_file1}`) : null,
          original_index: 0,
          mlt_lat: null,
          mlt_long: null,
          mlt_speed: null,
          mlt_battery: null,
          mlt_gps_time: null,
        };
        
        console.log('[GROUP] 오류 발생으로 기본 멤버 데이터 생성:', defaultMember.mt_name);
        setGroupMembers([defaultMember]);
        setGroupMemberCounts(prev => ({
          ...prev,
          [group.sgt_idx]: 1
        }));
      }
    } finally {
      setMembersLoading(false);
      // 멤버 데이터 로딩 완료 햅틱 피드백
      hapticFeedback.dataLoadComplete();
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
      // 통계 데이터 로딩 완료 햅틱 피드백
      hapticFeedback.dataLoadComplete();
    }
  };

  // 인증 상태 확인 및 초기 데이터 로드
  useEffect(() => {
    const initializeAuth = async () => {
      // 인증 로딩 중이면 대기
      if (authLoading) {
        console.log('[GROUP] 인증 로딩 중...');
        return;
      }

      console.log('[GROUP] 인증 상태 확인:', { isLoggedIn, user: user?.mt_idx });

      // 추가 인증 상태 확인 (localStorage 직접 확인)
      const hasToken = authService.getToken();
      const hasUserData = authService.getUserData();
      
      console.log('[GROUP] 인증 데이터 상세 확인:', {
        authContextLoggedIn: isLoggedIn,
        hasToken: !!hasToken,
        hasUserData: !!hasUserData,
        contextUser: user?.mt_idx,
        localUser: hasUserData?.mt_idx
      });

      // AuthContext와 localStorage 모두에서 인증 정보가 없을 때만 리다이렉트
      if (!isLoggedIn && !hasToken && !hasUserData) {
        console.log('[GROUP] 완전히 로그인되지 않음 - signin 페이지로 리다이렉트');
        router.push('/signin');
        return;
      }
      
      // AuthContext는 로그인 안됐지만 localStorage에 데이터가 있다면 동기화 대기
      if (!isLoggedIn && (hasToken || hasUserData)) {
        console.log('[GROUP] AuthContext 동기화 필요 - 잠시 대기 후 다시 확인');
        // 동기화를 위해 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 동기화 후 다시 확인
        console.log('[GROUP] 동기화 대기 완료, 다시 상태 확인');
        return; // 다음 렌더링에서 다시 확인
      }

      // 사용자 정보가 있는 경우 그룹 데이터 로드 (AuthContext 또는 localStorage에서)
      const currentUser = user || hasUserData;
      if (currentUser) {
        console.log('[GROUP] 사용자 정보 확인됨, 그룹 데이터 로드:', currentUser.mt_idx);
        fetchGroups();
      }
    };

    initializeAuth();
  }, [authLoading, isLoggedIn, user, router]);

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
  const handleGroupSelect = useCallback((group: ExtendedGroup) => {
    setSelectedGroup(group);
    setCurrentView('detail');
    setShowGroupActions(false);
  }, []);

  const handleBackToList = () => {
    setCurrentView('list');
  };

  const handleBackNavigation = () => {
    router.back();
  };

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  // 새 그룹 생성
  const handleSaveGroup = async () => {
    if (newGroup.name.trim() === '') return;
    
    setIsCreatingGroup(true);
    try {
      const groupData = {
        mt_idx: user?.mt_idx || 0,
        sgt_title: newGroup.name.trim(),
        sgt_memo: newGroup.description.trim() || null,
        sgt_code: null,
        sgt_show: 'Y' as const
      };
      
      const createdGroup = await groupService.createGroup(groupData);
      
      // 그룹 생성 후 최신 그룹 목록을 다시 조회하여 코드 등 모든 정보를 업데이트
      await fetchGroups();
      
      // 생성된 그룹을 선택된 그룹으로 설정 (최신 정보 포함)
      const updatedGroups = await groupService.getCurrentUserGroups();
      const freshGroup = (updatedGroups && Array.isArray(updatedGroups)) ? updatedGroups.find(g => g.sgt_idx === createdGroup.sgt_idx) : null;
      
      if (freshGroup) {
        const newGroupItem: ExtendedGroup = {
          ...freshGroup,
          sgt_code: (freshGroup as any).sgt_code || null,
          sgt_memo: freshGroup.sgt_content || '',
          memberCount: 1
        };
        setSelectedGroup(newGroupItem);
      }
      
      setGroupMemberCounts(prev => ({
        ...prev,
        [createdGroup.sgt_idx]: 1
      }));
      setIsAddModalOpen(false);
      setNewGroup({ name: '', description: '' });
      
      showToastModal('success', '그룹 생성 완료', '새 그룹이 성공적으로 생성되었습니다.');
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
        (prev && Array.isArray(prev)) ? prev.map(group => 
          group.sgt_idx === selectedGroup.sgt_idx 
            ? updatedGroupExtended 
            : group
        ) : []
      );
      
      setIsEditModalOpen(false);
      setEditGroup({ name: '', description: '' });
      
      showToastModal('success', '그룹 수정 완료', '그룹이 성공적으로 수정되었습니다.');
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
      
      showToastModal('success', '그룹 삭제 완료', '그룹이 삭제되었습니다.');
    } catch (error) {
      console.error('그룹 삭제 오류:', error);
      alert('그룹 삭제 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 공유 기능
  // 플랫폼 감지 함수들
  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  };

  const isAndroid = () => {
    return /Android/.test(navigator.userAgent);
  };

  const isMobile = () => {
    return isIOS() || isAndroid();
  };

  const supportsWebShare = () => {
    return 'share' in navigator;
  };

  // 카카오톡 공유 함수
  const handleKakaoShare = () => {
    if (!selectedGroup) return;
    
    const inviteLink = `${window.location.origin}/group/${selectedGroup.sgt_idx}/join`;
    const message = `[SMAP] ${selectedGroup.sgt_title} 그룹에 초대되었습니다!\n\n아래 링크를 클릭하여 참여해보세요:\n${inviteLink}`;
    
    if (isMobile()) {
      if (isIOS()) {
        // iOS: 카카오톡 앱 스키마 사용
        const kakaoUrl = `kakaolink://send?msg=${encodeURIComponent(message)}`;
        window.location.href = kakaoUrl;
        
        // 카카오톡이 설치되어 있지 않은 경우 앱스토어로 이동
        setTimeout(() => {
          if (document.hidden) return; // 이미 앱이 열린 경우
          const appStoreUrl = 'https://apps.apple.com/kr/app/kakaotalk/id362057947';
          if (confirm('카카오톡이 설치되어 있지 않습니다. 앱스토어로 이동하시겠습니까?')) {
            window.open(appStoreUrl, '_blank');
          }
        }, 1000);
      } else if (isAndroid()) {
        // Android: 인텐트 사용
        const intentUrl = `intent://send?msg=${encodeURIComponent(message)}#Intent;package=com.kakao.talk;scheme=kakaolink;launchFlags=0x10000000;end`;
        window.location.href = intentUrl;
        
        // 카카오톡이 설치되어 있지 않은 경우 플레이스토어로 이동
        setTimeout(() => {
          if (document.hidden) return; // 이미 앱이 열린 경우
          const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.kakao.talk';
          if (confirm('카카오톡이 설치되어 있지 않습니다. 플레이스토어로 이동하시겠습니까?')) {
            window.open(playStoreUrl, '_blank');
          }
        }, 1000);
      }
    } else {
      // 데스크탑: 웹 카카오톡 또는 클립보드 복사
      if (navigator.clipboard) {
        navigator.clipboard.writeText(message).then(() => {
          alert('카카오톡 공유 메시지가 클립보드에 복사되었습니다.\n카카오톡에서 붙여넣기하여 공유해주세요.');
        });
      } else {
        // 클립보드 API를 지원하지 않는 경우
        const textArea = document.createElement('textarea');
        textArea.value = message;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('카카오톡 공유 메시지가 클립보드에 복사되었습니다.\n카카오톡에서 붙여넣기하여 공유해주세요.');
      }
    }
    
    setIsShareModalOpen(false);
    showToastModal('success', '카카오톡 공유', '카카오톡으로 초대 메시지를 전송합니다.');
  };

  // 초대 링크 복사 함수
  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/group/${selectedGroup?.sgt_idx}/join`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteLink)
        .then(() => {
          setIsShareModalOpen(false);
          showToastModal('success', '링크 복사 완료', '초대 링크가 복사되었습니다!');
        })
        .catch(err => {
          console.error('링크 복사 실패:', err);
          // 폴백 방법 사용
          fallbackCopyText(inviteLink);
        });
    } else {
      // 클립보드 API를 지원하지 않는 경우 폴백 방법 사용
      fallbackCopyText(inviteLink);
    }
  };

  // 폴백 복사 함수
  const fallbackCopyText = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      setIsShareModalOpen(false);
      showToastModal('success', '링크 복사 완료', '초대 링크가 복사되었습니다!');
    } catch (err) {
      console.error('폴백 복사 실패:', err);
      alert('링크 복사에 실패했습니다. 수동으로 복사해주세요:\n' + text);
    } finally {
      document.body.removeChild(textArea);
    }
  };

  // 문자(SMS) 공유 함수
  const handleSMSShare = () => {
    if (!selectedGroup) return;
    
    const inviteLink = `${window.location.origin}/group/${selectedGroup.sgt_idx}/join`;
    const message = `[SMAP] ${selectedGroup.sgt_title} 그룹에 초대되었습니다! 링크: ${inviteLink}`;
    
    if (isMobile()) {
      if (isIOS()) {
        // iOS: SMS 앱 스키마
        const smsUrl = `sms:&body=${encodeURIComponent(message)}`;
        window.location.href = smsUrl;
      } else if (isAndroid()) {
        // Android: SMS 인텐트
        const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
        window.location.href = smsUrl;
      }
    } else {
      // 데스크탑: 메시지를 클립보드에 복사
      if (navigator.clipboard) {
        navigator.clipboard.writeText(message).then(() => {
          alert('문자 메시지가 클립보드에 복사되었습니다.\n문자 앱에서 붙여넣기하여 전송해주세요.');
        });
      } else {
        fallbackCopyText(message);
      }
    }
    
    setIsShareModalOpen(false);
    showToastModal('success', '문자 공유', '문자 앱으로 초대 메시지를 전송합니다.');
  };

  // Web Share API를 사용한 네이티브 공유 함수
  const handleNativeShare = async () => {
    if (!selectedGroup || !supportsWebShare()) return;
    
    const inviteLink = `${window.location.origin}/group/${selectedGroup.sgt_idx}/join`;
    
    try {
      await navigator.share({
        title: `${selectedGroup.sgt_title} 그룹 초대`,
        text: `[SMAP] ${selectedGroup.sgt_title} 그룹에 초대되었습니다! 함께 참여해보세요.`,
        url: inviteLink
      });
      
      setIsShareModalOpen(false);
      showToastModal('success', '공유 완료', '그룹 초대 링크가 공유되었습니다.');
    } catch (error) {
      console.error('네이티브 공유 실패:', error);
      // 사용자가 공유를 취소한 경우는 오류로 처리하지 않음
      if ((error as Error).name !== 'AbortError') {
        showToastModal('error', '공유 실패', '공유 중 오류가 발생했습니다.');
      }
    }
  };

  // 멤버 관리
  const handleMemberClick = (member: GroupMember) => {
    if (!isCurrentUserGroupOwner()) return;
    if (member.sgdt_owner_chk === 'Y') return;
    
    setSelectedMember(member);
    setIsMemberManageModalOpen(true);
  };

  const isCurrentUserGroupOwner = () => {
    if (!selectedGroup || !groupMembers.length || !user) return false;
    const currentUserId = user.mt_idx;
    const currentUserMember = (groupMembers && Array.isArray(groupMembers)) ? groupMembers.find(member => member.mt_idx === currentUserId) : null;
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
        (prev && Array.isArray(prev)) ? prev.map(member => 
          member.mt_idx === selectedMember.mt_idx 
            ? { ...member, sgdt_leader_chk: newRole === 'leader' ? 'Y' : 'N' }
            : member
        ) : []
      );
      
      setIsMemberManageModalOpen(false);
      setSelectedMember(null);
      showToastModal('success', '역할 변경 완료', result.message);
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
        (prev && Array.isArray(prev)) ? prev.filter(member => member.mt_idx !== selectedMember.mt_idx) : []
      );
      
      setIsMemberManageModalOpen(false);
      setSelectedMember(null);
      showToastModal('success', '멤버 탈퇴 완료', result.message);
    } catch (error) {
      console.error('멤버 탈퇴 처리 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '멤버 탈퇴 처리 중 오류가 발생했습니다.';
      alert(errorMessage);
    } finally {
      setIsUpdatingMember(false);
    }
  };

  // 검색 필터링 (useMemo로 최적화)
  const filteredGroups = useMemo(() => {
    if (!groups || !Array.isArray(groups)) return [];
    
    if (!searchQuery.trim()) return groups;
    
    const query = searchQuery.toLowerCase();
    return groups.filter(group => 
      group.sgt_title.toLowerCase().includes(query) || 
      (group.sgt_content && group.sgt_content.toLowerCase().includes(query)) ||
      (group.sgt_memo && group.sgt_memo.toLowerCase().includes(query))
    );
  }, [groups, searchQuery]);

  // 토스트 모달 상태
  const [toastModal, setToastModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'loading';
    title: string;
    message: string;
    progress: number;
    autoClose: boolean;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    progress: 0,
    autoClose: true
  });

  // 토스트 모달 함수들
  const showToastModal = (
    type: 'success' | 'error' | 'loading',
    title: string,
    message: string,
    autoClose: boolean = true,
    duration: number = 3000
  ) => {
    setToastModal({
      isOpen: true,
      type,
      title,
      message,
      progress: 0,
      autoClose
    });

    if (autoClose && type !== 'loading') {
      // 프로그레스 바 애니메이션
      let progress = 0;
      const interval = setInterval(() => {
        progress += (100 / duration) * 50; // 50ms마다 업데이트
        if (progress >= 100) {
          clearInterval(interval);
          setToastModal(prev => ({ ...prev, isOpen: false }));
        } else {
          setToastModal(prev => ({ ...prev, progress }));
        }
      }, 50);
    }
  };

  const hideToastModal = () => {
    setToastModal(prev => ({ ...prev, isOpen: false }));
  };

  // 🆕 캐시 데이터 확인 로그
  useEffect(() => {
    console.log('👥 [GROUP] 캐시 데이터 확인 시작');
    
    // 사용자 프로필 캐시 확인
    const userProfile = getUserProfile();
    console.log('👥 [GROUP] 사용자 프로필 캐시:', {
      exists: !!userProfile,
      data: userProfile ? {
        name: userProfile.mt_name,
        id: userProfile.mt_idx,
        email: userProfile.mt_email
      } : null,
      isValid: isCacheValid('userProfile')
    });
    
    // 사용자 그룹 캐시 확인
    const userGroupsCache = getUserGroups();
    console.log('👥 [GROUP] 사용자 그룹 캐시:', {
      exists: !!userGroupsCache,
      count: userGroupsCache?.length || 0,
      groups: userGroupsCache?.map(g => ({ id: g.sgt_idx, name: g.sgt_title })) || [],
      isValid: isCacheValid('userGroups')
    });
    
    // 각 그룹의 멤버 캐시 확인
    if (userGroupsCache && userGroupsCache.length > 0) {
      userGroupsCache.forEach(group => {
        const groupMembers = getGroupMembers(group.sgt_idx);
        console.log(`👥 [GROUP] 그룹 ${group.sgt_title} 멤버 캐시:`, {
          groupId: group.sgt_idx,
          groupName: group.sgt_title,
          exists: !!groupMembers,
          count: groupMembers?.length || 0,
          members: groupMembers?.map(m => ({ id: m.mt_idx, name: m.mt_name })) || [],
          isValid: isCacheValid('groupMembers', group.sgt_idx)
        });
        
        // 위치 데이터 캐시 확인
        const today = new Date().toISOString().split('T')[0];
        const locationData = getLocationData(group.sgt_idx, today);
        console.log(`👥 [GROUP] 그룹 ${group.sgt_title} 위치 데이터 캐시:`, {
          groupId: group.sgt_idx,
          date: today,
          exists: !!locationData,
          dataCount: locationData ? Object.keys(locationData).length : 0,
          isValid: isCacheValid('locationData', group.sgt_idx)
        });
        
        // 일별 카운트 캐시 확인
        const dailyCounts = getDailyLocationCounts(group.sgt_idx);
        console.log(`👥 [GROUP] 그룹 ${group.sgt_title} 일별 카운트 캐시:`, {
          groupId: group.sgt_idx,
          exists: !!dailyCounts,
          dataCount: dailyCounts ? Object.keys(dailyCounts).length : 0,
          isValid: isCacheValid('dailyLocationCounts', group.sgt_idx)
        });
      });
    }
    
    // localStorage에서 직접 확인
    try {
      const localStorageKeys = Object.keys(localStorage).filter(key => key.startsWith('smap_cache_'));
      console.log('👥 [GROUP] localStorage 캐시 키들:', {
        totalKeys: localStorageKeys.length,
        keys: localStorageKeys.map(key => key.replace('smap_cache_', ''))
      });
      
      // 각 캐시 키의 데이터 확인
      localStorageKeys.forEach(key => {
        const data = loadFromLocalStorage(key.replace('smap_cache_', ''));
        console.log(`👥 [GROUP] localStorage ${key}:`, {
          exists: !!data,
          dataType: typeof data,
          isArray: Array.isArray(data),
          length: Array.isArray(data) ? data.length : 'N/A'
        });
      });
    } catch (error) {
      console.warn('👥 [GROUP] localStorage 접근 실패:', error);
    }
    
    console.log('👥 [GROUP] 캐시 데이터 확인 완료');
  }, [getUserProfile, getUserGroups, getGroupMembers, getLocationData, getDailyLocationCounts, isCacheValid, loadFromLocalStorage]);

  return (
    <>
      <style jsx global>{floatingButtonStyles}</style>
      <div className="min-h-screen relative" style={{ background: 'linear-gradient(to bottom right, #f0f9ff, #fdf4ff)' }}>
        


        {/* 통일된 헤더 애니메이션 */}
        <AnimatedHeader 
            variant="simple"
            className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <div className="flex items-center justify-between h-14 px-4">
              <AnimatePresence mode="wait">
                {currentView === 'list' ? (
                  <motion.div 
                    key="list-header"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center space-x-3"
                  >
                    <div className="flex items-center space-x-3">
                      <div>
                        <h1 className="text-lg font-bold text-gray-900">그룹</h1>
                        <p className="text-xs text-gray-500">나의 소중한 그룹을 관리해보세요</p>
                      </div>
                    </div>
                  </motion.div>
                                 ) : (
                   <motion.div 
                     key="detail-header"
                     initial={{ opacity: 0, x: -20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: 20 }}
                     transition={{ delay: 0.4, duration: 0.5 }}
                     className="flex items-center space-x-3"
                   >
                     <motion.button 
                       onClick={handleBackToList}
                       className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
                       whileHover={{ scale: 1.05 }}
                       whileTap={{ scale: 0.95 }}
                       initial={{ opacity: 0, scale: 0.8 }}
                       animate={{ opacity: 1, scale: 1 }}
                       transition={{ delay: 0.5, duration: 0.4 }}
                     >
                       <HiOutlineChevronLeft className="w-5 h-5 text-gray-700" />
                     </motion.button>
                     <motion.div 
                       className="flex items-center space-x-3"
                       initial={{ opacity: 0, y: -10 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: 0.6, duration: 0.4 }}
                     >
                       <div>
                         <h1 className="text-lg font-bold text-gray-900">그룹 상세</h1>
                         <p className="text-xs text-gray-500">멤버들과 함께하는 즐거운 공간</p>
                       </div>
                     </motion.div>
                   </motion.div>
                 )}
              </AnimatePresence>
              
              <div className="flex items-center space-x-2">
                {/* 필요시 추가 버튼들을 여기에 배치 */}
              </div>
            </div>
          </AnimatedHeader>

        {/* 메인 컨텐츠 */}
          <div className="pb-safe-nav pt-16 flex flex-col" style={{ 
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)',
            height: 'calc(100vh - env(safe-area-inset-top, 0px) - 56px - env(safe-area-inset-bottom, 0px))',
            maxHeight: 'calc(100vh - env(safe-area-inset-top, 0px) - 56px - env(safe-area-inset-bottom, 0px))',
            overflow: 'hidden'
          }}>
            <AnimatePresence mode="wait">
              {currentView === 'list' ? (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ 
                    duration: 0.6
                  }}
                >
                  {/* 검색 섹션 */}
                  <SearchSection
                    searchQuery={searchQuery}
                    onSearchChange={handleSearchChange}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                  />

                  {/* 통계 카드 */}
                  <StatsCards
                    groupsCount={groups.length}
                    totalMembers={Object.values(groupMemberCounts).reduce((a, b) => a + b, 0)}
                  />

                  {/* 그룹 목록 */}
                  <div className="px-4 space-y-3">
                      <motion.div 
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                        variants={groupListContainerVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        <div className="px-4 py-3 border-b border-gray-100">
                          <h3 className="text-lg font-bold text-gray-900">내 그룹 목록</h3>
                        </div>
                        <div className="p-4 space-y-3">
                          {(filteredGroups && Array.isArray(filteredGroups)) && filteredGroups.map((group, index) => {
                            const memberCount = groupMemberCounts[group.sgt_idx] || 0;
                            
                            return (
                              <GroupCard
                                key={group.sgt_idx}
                                group={group as ExtendedGroup}
                                index={index}
                                memberCount={memberCount}
                                onSelect={handleGroupSelect}
                              />
                            );
                          })}
                        </div>
                      </motion.div>
                  </div>

                </motion.div>
              ) : selectedGroup ? (
                <motion.div
                  key="detail"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ 
                    duration: 0.6
                  }}
                  className="flex flex-col flex-1 min-h-0"
                >
                  {/* 고정 영역: 그룹 헤더 카드 + 통계 카드들 */}
                  <div className="flex-shrink-0">
                    {/* 그룹 헤더 카드 */}
                    <div className="mx-4 mb-4 mt-5">
                    <motion.div 
                      className="rounded-2xl p-6 text-white shadow-lg relative"
                      style={{ background: 'linear-gradient(to right, #0113A3, #001a8a)' }}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1, duration: 0.5 }}
                    >
                      {/* 그룹 액션 메뉴 버튼 */}
                      <div className="absolute top-4 right-4 z-[140]">
                        <motion.button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowGroupActions(!showGroupActions);
                          }}
                          className="p-2 bg-white/20 rounded-full hover:bg-white/30 z-[150]"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <HiEllipsisVertical className="w-4 h-4 text-white" />
                        </motion.button>
                        <AnimatePresence>
                          {showGroupActions && (
                            <>
                              <div 
                                className="fixed inset-0 z-[200]" 
                                onClick={() => setShowGroupActions(false)}
                              />
                              <motion.div 
                                className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[210]"
                                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                transition={{ duration: 0.12 }}
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
                                  className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center text-gray-700 text-sm"
                                >
                                  <FaEdit className="w-3 h-3 mr-2" />
                                  수정
                                </button>
                                <button 
                                  onClick={() => {
                                    setIsDeleteModalOpen(true);
                                    setShowGroupActions(false);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-red-50 flex items-center text-red-600 text-sm"
                                >
                                  <FaTrash className="w-3 h-3 mr-2" />
                                  삭제
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
                              src={`/images/group${(((groups && Array.isArray(groups)) ? groups.findIndex(g => g.sgt_idx === selectedGroup.sgt_idx) : -1) % 2) + 1}.webp`}
                              alt="그룹 아이콘"
                              className="w-12 h-12 object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <h2 className="text-xl font-bold mb-1">{selectedGroup.sgt_title}</h2>
                            <p className="text-blue-100 text-sm">
                              {selectedGroup.sgt_memo || selectedGroup.sgt_content || '그룹 설명이 없습니다'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-blue-200">
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
                        transition={{ delay: 0.2, duration: 0.5 }}
                      >
                        <FaUsers className="w-6 h-6 text-red-800 mx-auto mb-1" />
                        {membersLoading ? (
                          <div className="flex items-center justify-center py-2">
                            <div className="text-center">
                              <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-600 rounded-full unified-animate-spin mx-auto mb-1"></div>
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
                        transition={{ delay: 0.3, duration: 0.5 }}
                      >
                        <FaCalendarAlt className="w-6 h-6 text-yellow-800 mx-auto mb-1" />
                        {statsLoading ? (
                          <div className="flex items-center justify-center py-2">
                            <div className="text-center">
                              <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-600 rounded-full unified-animate-spin mx-auto mb-1"></div>
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
                        transition={{ delay: 0.4, duration: 0.6 }}
                      >
                        <FaMapMarkerAlt className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                        {statsLoading ? (
                          <div className="flex items-center justify-center py-2">
                            <div className="text-center">
                              <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-600 rounded-full unified-animate-spin mx-auto mb-1"></div>
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
                  </div>

                                      {/* 스크롤 영역: 그룹 멤버 섹션 */}
                    <div className="flex-auto min-h-0 overflow-y-auto">
                     <div className="px-4 pb-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    <motion.div 
                      className="bg-white rounded-2xl shadow-sm border overflow-hidden"
                      style={{ borderColor: 'rgba(1, 19, 163, 0.1)' }}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                                              transition={{ delay: 0.5, duration: 0.5 }}
                    >
                      <div className="p-4 border-b" style={{ borderColor: 'rgba(1, 19, 163, 0.1)' }}>
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-normal text-gray-900">그룹 멤버</h3>
                          <motion.button
                            onClick={() => setIsShareModalOpen(true)}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 shadow-md relative overflow-hidden"
                            whileHover={{ 
                              scale: 1.05,
                              backgroundColor: "#16a34a"
                            }}
                            whileTap={{ scale: 0.95 }}
                            animate={{
                              boxShadow: [
                                "0 2px 8px rgba(34, 197, 94, 0.3)",
                                "0 4px 12px rgba(34, 197, 94, 0.5)",
                                "0 2px 8px rgba(34, 197, 94, 0.3)"
                              ]
                            }}
                            transition={{
                              boxShadow: {
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                              }
                            }}
                          >
                            <motion.div
                              className="absolute inset-0 bg-white opacity-20"
                              animate={{
                                x: ["-100%", "100%"]
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                                repeatDelay: 1
                              }}
                            />
                            <MdGroupAdd className="w-4 h-4 relative z-10" />
                            <span className="relative z-10">초대</span>
                          </motion.button>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        {membersLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="text-center">
                              <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-600 rounded-full unified-animate-spin mx-auto mb-2"></div>
                              <p className="text-sm text-gray-600">그룹원을 불러오는 중...</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {groupMembers.length > 0 ? (
                              (groupMembers && Array.isArray(groupMembers)) && groupMembers.map((member, index) => (
                                <motion.div 
                                  key={member.mt_idx} 
                                  onClick={() => handleMemberClick(member)}
                                  className={`flex items-center p-3 rounded-xl ${
                                    isCurrentUserGroupOwner() && member.sgdt_owner_chk !== 'Y' 
                                      ? 'cursor-pointer hover:shadow-md' 
                                      : ''
                                  }`}
                                  style={{ 
                                    backgroundColor: 'rgba(1, 19, 163, 0.05)',
                                    '--hover-bg': 'rgba(1, 19, 163, 0.1)'
                                  } as React.CSSProperties}
                                  initial={{ x: -20, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  transition={{ delay: 0.6 + index * 0.1 }}
                                  whileHover={isCurrentUserGroupOwner() && member.sgdt_owner_chk !== 'Y' ? { scale: 1.02 } : {}}
                                  whileTap={isCurrentUserGroupOwner() && member.sgdt_owner_chk !== 'Y' ? { scale: 0.98 } : {}}
                                >
                                  <div className="relative mr-3">
                                    <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center border-3" style={{ borderColor: 'rgba(1, 19, 163, 0.2)' }}>
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
                                    <p className="text-sm mt-1" style={{ color: '#0113A3' }}>
                                      {member.sgdt_owner_chk === 'Y' ? '그룹 관리자' : 
                                       member.sgdt_leader_chk === 'Y' ? '리더' : '멤버'}
                                    </p>
                                  </div>
                                </motion.div>
                              ))
                            ) : (
                              <div className="text-center py-8">
                                <div className="p-4 rounded-full w-fit mx-auto mb-3" style={{ backgroundColor: 'rgba(1, 19, 163, 0.1)' }}>
                                  <FaUsers className="w-6 h-6" style={{ color: 'rgba(1, 19, 163, 0.6)' }} />
                                </div>
                                <p className="text-gray-500 font-medium">그룹원이 없습니다</p>
                                <p className="text-gray-400 text-sm mt-1 mb-4">새로운 멤버를 초대해보세요</p>
                                <motion.button
                                  onClick={() => setIsShareModalOpen(true)}
                                  className="px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium flex items-center space-x-2 mx-auto shadow-md relative overflow-hidden text-sm"
                                  whileHover={{ 
                                    scale: 1.05,
                                    backgroundColor: "#16a34a"
                                  }}
                                  whileTap={{ scale: 0.95 }}
                                  animate={{
                                    boxShadow: [
                                      "0 2px 8px rgba(34, 197, 94, 0.3)",
                                      "0 4px 15px rgba(34, 197, 94, 0.5)",
                                      "0 2px 8px rgba(34, 197, 94, 0.3)"
                                    ],
                                    y: [0, -1, 0]
                                  }}
                                  transition={{
                                    boxShadow: {
                                      duration: 2.5,
                                      repeat: Infinity,
                                      ease: "easeInOut"
                                    },
                                    y: {
                                      duration: 2.5,
                                      repeat: Infinity,
                                      ease: "easeInOut"
                                    }
                                  }}
                                >
                                  <motion.div
                                    className="absolute inset-0 bg-white opacity-20"
                                    animate={{
                                      x: ["-100%", "100%"]
                                    }}
                                    transition={{
                                      duration: 2.5,
                                      repeat: Infinity,
                                      ease: "easeInOut",
                                      repeatDelay: 1.5
                                    }}
                                  />
                                  <motion.div
                                    animate={{
                                      rotate: [0, 360]
                                    }}
                                    transition={{
                                      duration: 3,
                                      repeat: Infinity,
                                      ease: "linear"
                                    }}
                                    className="relative z-10"
                                  >
                                    <MdGroupAdd className="w-4 h-4" />
                                  </motion.div>
                                  <span className="relative z-10">멤버 초대</span>
                                </motion.button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

        {/* 플로팅 추가 버튼 - 전체 페이지 기준 */}
        {currentView === 'list' && (
          <motion.button
            initial={{ y: 100, opacity: 0, scale: 0.8 }}
            animate={{ 
              y: -80, 
              opacity: 1, 
              scale: 1,
              transition: {
                delay: 0.2,
                type: "spring",
                stiffness: 120,
                damping: 25,
                duration: 1.0
              }
            }}
            whileHover={{ 
              scale: 1.1,
              y: -2,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsAddModalOpen(true)}
            className="floating-button w-14 h-14 rounded-full flex items-center justify-center text-white"
          >
            <FiPlus className="w-6 h-6 stroke-2" />
          </motion.button>
        )}

        {/* 모달들 */}
        <AnimatePresence>
          {/* 새 그룹 추가 모달 */}
          {isAddModalOpen && (
            <motion.div 
              className="add-group-modal fixed inset-0 flex items-end justify-center bg-black/50 backdrop-blur-sm" 
              onClick={() => setIsAddModalOpen(false)}
              style={{ zIndex: 50 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div 
                className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl max-h-[60vh] flex flex-col mb-12"
                onClick={e => e.stopPropagation()}
                onWheel={e => e.stopPropagation()}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* 모달 핸들 - 고정 영역 (드래그 가능) */}
                <motion.div 
                  className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4 flex-shrink-0 cursor-grab active:cursor-grabbing"
                  drag="y"
                  dragElastic={0.1}
                  dragMomentum={false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  onDrag={(event, info) => {
                    // 핸들 드래그 중 바텀시트 전체에 피드백 적용
                    if (info.offset.y > 20) {
                      const target = event.currentTarget as HTMLElement;
                      if (target) {
                        const modalElement = target.closest('.add-group-modal') as HTMLElement;
                        if (modalElement) {
                          modalElement.style.opacity = String(Math.max(0.5, 1 - info.offset.y / 150));
                          modalElement.style.transform = `translateY(${Math.max(0, info.offset.y)}px)`;
                        }
                      }
                    }
                  }}
                  onDragEnd={(event, info) => {
                    // 핸들 드래그 종료 시 바텀시트 닫기 조건 확인
                    const target = event.currentTarget as HTMLElement;
                    if (target) {
                      const modalElement = target.closest('.add-group-modal') as HTMLElement;
                      
                      if (info.offset.y > 50 || info.velocity.y > 200) {
                        // 바텀시트 닫기
                        setIsAddModalOpen(false);
                      } else {
                        // 원래 위치로 복귀
                        if (modalElement) {
                          modalElement.style.opacity = '1';
                          modalElement.style.transform = 'translateY(0px)';
                        }
                      }
                    }
                  }}
                  whileDrag={{ 
                    scale: 1.2,
                    backgroundColor: '#9CA3AF',
                    transition: { duration: 0.1 }
                  }}
                />
                
                {/* 모달 헤더 - 고정 영역 (드래그 가능) */}
                <motion.div 
                  className="px-6 pb-3 border-b border-gray-100 flex-shrink-0 cursor-grab active:cursor-grabbing"
                  drag="y"
                  dragElastic={0.1}
                  dragMomentum={false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  onDrag={(event, info) => {
                    // 헤더 드래그 중 바텀시트 전체에 피드백 적용
                    if (info.offset.y > 20) {
                      const target = event.currentTarget as HTMLElement;
                      if (target) {
                        const modalElement = target.closest('.add-group-modal') as HTMLElement;
                        if (modalElement) {
                          modalElement.style.opacity = String(Math.max(0.5, 1 - info.offset.y / 150));
                          modalElement.style.transform = `translateY(${Math.max(0, info.offset.y)}px)`;
                        }
                      }
                    }
                  }}
                  onDragEnd={(event, info) => {
                    // 헤더 드래그 종료 시 바텀시트 닫기 조건 확인
                    const target = event.currentTarget as HTMLElement;
                    if (target) {
                      const modalElement = target.closest('.add-group-modal') as HTMLElement;
                      
                      if (info.offset.y > 50 || info.velocity.y > 200) {
                        // 바텀시트 닫기
                        setIsAddModalOpen(false);
                      } else {
                        // 원래 위치로 복귀
                        if (modalElement) {
                          modalElement.style.opacity = '1';
                          modalElement.style.transform = 'translateY(0px)';
                        }
                      }
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <FiPlus className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          새 그룹 만들기
                        </h3>
                        <p className="text-xs text-gray-500">함께할 멤버들을 초대해보세요</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsAddModalOpen(false)}
                      className="p-2 hover:bg-gray-100 rounded-full mobile-button transition-colors"
                    >
                      <FiX className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </motion.div>

                {/* 스크롤 가능한 폼 영역 */}
                <div 
                  className="flex-1 overflow-y-auto"
                  onTouchStart={(e) => {
                    // 터치 시작점 기록 (스크롤과 드래그 구분용)
                    const touch = e.touches[0];
                    (e.currentTarget as any).touchStartY = touch.clientY;
                    (e.currentTarget as any).touchStartX = touch.clientX;
                    (e.currentTarget as any).scrollTop = (e.currentTarget as HTMLElement).scrollTop;
                  }}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    const startY = (e.currentTarget as any).touchStartY;
                    const startX = (e.currentTarget as any).touchStartX;
                    const startScrollTop = (e.currentTarget as any).scrollTop;
                    const currentScrollTop = (e.currentTarget as HTMLElement).scrollTop;
                    
                    if (startY && startX) {
                      const deltaY = touch.clientY - startY;
                      const deltaX = touch.clientX - startX;
                      
                      // 수직 스크롤인지 확인 (수직 이동이 수평 이동보다 큰 경우)
                      const isVerticalScroll = Math.abs(deltaY) > Math.abs(deltaX);
                      
                      // 스크롤 가능한 상태인지 확인
                      const element = e.currentTarget as HTMLElement;
                      const canScrollUp = currentScrollTop > 0;
                      const canScrollDown = currentScrollTop < (element.scrollHeight - element.clientHeight);
                      
                      // 수직 스크롤이고 스크롤 가능한 상태라면 스크롤 허용
                      if (isVerticalScroll && (canScrollUp || canScrollDown)) {
                        // 스크롤 영역에서의 정상적인 스크롤 - 이벤트 전파 중지
                        e.stopPropagation();
                      }
                    }
                  }}
                >
                  <div className="px-6 pt-4 pb-12 space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: '#0113A3' }}>
                          그룹명 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newGroup.name}
                          onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="예: 가족, 친구, 직장"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-500 text-sm transition-all duration-200"
                          style={{ '--tw-ring-color': '#0113A3' } as React.CSSProperties}
                          maxLength={50}
                        />
                        <p className="text-xs text-gray-500 mt-1">{newGroup.name.length}/50</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: '#0113A3' }}>
                          그룹 설명
                        </label>
                        <textarea
                          value={newGroup.description}
                          onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="그룹에 대한 간단한 설명을 입력해주세요"
                          rows={2}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-500 resize-none text-sm transition-all duration-200"
                          style={{ '--tw-ring-color': '#0113A3' } as React.CSSProperties}
                          maxLength={100}
                        />
                        <p className="text-xs text-gray-500 mt-1">{newGroup.description.length}/100</p>
                      </div>
                    </div>
                    
                    {/* 그룹 만들기 버튼만 남기고 취소 버튼 제거 */}
                    <div className="pt-2">
                      <motion.button
                        onClick={handleSaveGroup}
                        disabled={newGroup.name.trim() === '' || isCreatingGroup}
                        className="w-full py-4 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm shadow-lg relative overflow-hidden"
                        style={{ background: 'linear-gradient(to right, #0113A3, #001a8a)' }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {isCreatingGroup ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full unified-animate-spin mr-2"></div>
                            생성 중...
                          </>
                        ) : (
                          <>
                            <FiPlus className="w-4 h-4 mr-2" />
                            그룹 만들기
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* 공유 모달 */}
          {isShareModalOpen && !!selectedGroup && (
            <Modal
              key="share-group-modal"
              isOpen={isShareModalOpen && !!selectedGroup}
              onClose={() => setIsShareModalOpen(false)}
              title="그룹 초대하기"
              size="sm"
              className="rounded-2xl max-w-xs"
            >
            <div className="p-4">
              <div className="text-center mb-4">
                <FaShare className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">{selectedGroup?.sgt_title}</p>
              </div>
              
              <div className="space-y-2">
                {/* Web Share API 지원 시 네이티브 공유 버튼 */}
                {supportsWebShare() && (
                  <motion.button 
                    onClick={handleNativeShare} 
                    className="w-full flex items-center justify-center p-3 rounded-lg bg-orange-200 text-orange-800 shadow-sm hover:bg-orange-300 hover:text-orange-900 transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <FaShare className="w-4 h-4 mr-2" />
                    <span className="font-medium text-sm">다른 앱으로 공유</span>
                  </motion.button>
                )}
                
                <motion.button 
                  onClick={handleKakaoShare} 
                  className="w-full flex items-center justify-center p-3 rounded-lg bg-[#FEE500] text-[#3C1E1E] shadow-sm hover:shadow-md transition-shadow"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <RiKakaoTalkFill className="w-4 h-4 mr-2" />
                  <span className="font-medium text-sm">
                    {isMobile() ? '카카오톡으로 공유' : '카카오톡 메시지 복사'}
                  </span>
                </motion.button>
                
                <motion.button 
                  onClick={handleCopyLink} 
                  className="w-full flex items-center justify-center p-3 rounded-lg bg-blue-200 text-blue-800 shadow-sm hover:bg-blue-300 hover:text-blue-900 transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FiCopy className="w-4 h-4 mr-2" />
                  <span className="font-medium text-sm">초대 링크 복사</span>
                </motion.button>
                
                <motion.button 
                  onClick={handleSMSShare} 
                  className="w-full flex items-center justify-center p-3 rounded-lg bg-green-200 text-green-800 shadow-sm hover:bg-green-300 hover:text-green-900 transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <MdOutlineMessage className="w-4 h-4 mr-2" />
                  <span className="font-medium text-sm">
                    {isMobile() ? '문자로 공유' : '문자 메시지 복사'}
                  </span>
                </motion.button>
                
                <motion.button
                  onClick={() => setIsShareModalOpen(false)}
                  className="w-full py-2 mt-3 text-gray-600 font-medium text-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  닫기
                </motion.button>
              </div>
            </div>
            </Modal>
          )}

          {/* 그룹 수정 모달 */}
          {isEditModalOpen && !!selectedGroup && (
            <Modal
              key="edit-group-modal"
              isOpen={isEditModalOpen && !!selectedGroup}
              onClose={() => setIsEditModalOpen(false)}
              title="그룹 수정하기"
              size="sm"
              className="rounded-2xl max-w-xs"
            >
            <div className="p-4">
              <div className="text-center mb-4">
                <FaEdit className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">{selectedGroup?.sgt_title}</p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#0113A3' }}>
                    그룹명 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editGroup.name}
                    onChange={(e) => setEditGroup(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="예: 가족, 친구, 직장"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-gray-500 text-sm"
                    style={{ '--tw-ring-color': '#0113A3' } as React.CSSProperties}
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-500 mt-1">{editGroup.name.length}/50</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#0113A3' }}>
                    그룹 설명
                  </label>
                  <textarea
                    value={editGroup.description}
                    onChange={(e) => setEditGroup(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="그룹에 대한 간단한 설명을 입력해주세요"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-gray-500 resize-none text-sm"
                    style={{ '--tw-ring-color': '#0113A3' } as React.CSSProperties}
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-500 mt-1">{editGroup.description.length}/100</p>
                </div>
              </div>
              
              <div className="flex space-x-2 mt-4">
                <motion.button
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isUpdatingGroup}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium disabled:opacity-50 text-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  취소
                </motion.button>
                <motion.button
                  onClick={handleUpdateGroup}
                  disabled={editGroup.name.trim() === '' || isUpdatingGroup}
                  className="flex-1 py-2 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                  style={{ background: 'linear-gradient(to right, #0113A3, #001a8a)' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isUpdatingGroup ? (
                    <>
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-white rounded-full unified-animate-spin mr-1"></div>
                      수정 중...
                    </>
                  ) : (
                    '수정 완료'
                  )}
                </motion.button>
              </div>
            </div>
            </Modal>
          )}

          {/* 그룹 삭제 확인 모달 */}
          {isDeleteModalOpen && !!selectedGroup && (
            <Modal
              key="delete-group-modal"
              isOpen={isDeleteModalOpen && !!selectedGroup}
              onClose={() => setIsDeleteModalOpen(false)}
              title="그룹 삭제"
              size="sm"
              className="rounded-2xl max-w-xs"
            >
            <div className="p-4">
              <div className="text-center mb-4">
                <FaTrash className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">
                  <span className="font-medium text-red-600">"{selectedGroup?.sgt_title}"</span><br />
                  그룹을 삭제하시겠습니까?
                </p>
              </div>
              
              <div className="flex space-x-2">
                <motion.button
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium disabled:opacity-50 text-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  취소
                </motion.button>
                <motion.button
                  onClick={handleDeleteGroup}
                  disabled={isDeleting}
                  className="flex-1 py-2 bg-red-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isDeleting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-white rounded-full unified-animate-spin mr-1"></div>
                      삭제중
                    </>
                  ) : (
                    '삭제'
                  )}
                </motion.button>
              </div>
            </div>
            </Modal>
          )}

          {/* 멤버 관리 모달 */}
          {isMemberManageModalOpen && !!selectedMember && (
            <Modal
              key="member-manage-modal"
              isOpen={isMemberManageModalOpen && !!selectedMember}
              onClose={() => setIsMemberManageModalOpen(false)}
              title="멤버 관리"
              size="sm"
              className="rounded-2xl max-w-xs"
            >
            <div className="p-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: 'rgba(1, 19, 163, 0.1)' }}>
                  <img
                    src={getSafeImageUrl(selectedMember?.photo || null, selectedMember?.mt_gender, selectedMember?.original_index || 0)}
                    alt={selectedMember?.mt_name}
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      e.currentTarget.src = getDefaultImage(selectedMember?.mt_gender, selectedMember?.original_index || 0);
                    }}
                  />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{selectedMember?.mt_nickname || selectedMember?.mt_name}</h3>
                <p className="text-gray-600 text-sm">
                  현재: {selectedMember?.sgdt_leader_chk === 'Y' ? '리더' : '멤버'}
                </p>
              </div>
              
              <div className="space-y-2">
                {selectedMember?.sgdt_leader_chk === 'Y' ? (
                  <motion.button 
                    onClick={() => handleChangeMemberRole('member')}
                    disabled={isUpdatingMember}
                    className="w-full flex items-center justify-center p-3 rounded-lg bg-blue-500 text-white disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isUpdatingMember ? (
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-white rounded-full unified-animate-spin mr-2"></div>
                    ) : (
                      <FaUsers className="w-4 h-4 mr-2" />
                    )}
                    <span className="text-sm">멤버로 변경</span>
                  </motion.button>
                ) : (
                  <motion.button 
                    onClick={() => handleChangeMemberRole('leader')}
                    disabled={isUpdatingMember}
                    className="w-full flex items-center justify-center p-3 rounded-lg bg-gradient-to-r from-gray-400 to-gray-500 text-white disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isUpdatingMember ? (
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-white rounded-full unified-animate-spin mr-2"></div>
                    ) : (
                      <FaCrown className="w-4 h-4 mr-2" />
                    )}
                    <span className="text-sm">리더로 승격</span>
                  </motion.button>
                )}
                
                <motion.button 
                  onClick={handleRemoveMember}
                  disabled={isUpdatingMember}
                  className="w-full flex items-center justify-center p-3 rounded-lg bg-red-500 text-white disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isUpdatingMember ? (
                    <div className="w-3 h-3 border-2 border-gray-300 border-t-white rounded-full unified-animate-spin mr-2"></div>
                  ) : (
                    <FaTrash className="w-4 h-4 mr-2" />
                  )}
                  <span className="text-sm">그룹에서 탈퇴</span>
                </motion.button>
                
                <motion.button
                  onClick={() => setIsMemberManageModalOpen(false)}
                  disabled={isUpdatingMember}
                  className="w-full py-2 text-gray-600 font-medium disabled:opacity-50 text-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  취소
                </motion.button>
              </div>
            </div>
            </Modal>
          )}

          {/* 컴팩트 토스트 모달 */}
          {toastModal.isOpen && (
            <motion.div 
              className="fixed bottom-20 left-4 z-[130] w-3/4 max-w-sm"
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
                              transition={{ duration: 0.3 }}
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden w-full">
                <div className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      toastModal.type === 'success' ? 'bg-green-100' :
                      toastModal.type === 'error' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      {toastModal.type === 'success' && (
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {toastModal.type === 'error' && (
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      {toastModal.type === 'loading' && (
                        <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full unified-animate-spin"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">{toastModal.title}</h4>
                      <p className="text-xs text-gray-600 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{toastModal.message}</p>
                    </div>
                    {toastModal.autoClose && toastModal.type !== 'loading' && (
                      <button
                        onClick={hideToastModal}
                        className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
                      >
                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* 프로그레스 바 */}
                {toastModal.autoClose && toastModal.type !== 'loading' && (
                  <div className="h-1 bg-gray-100">
                    <motion.div 
                      className={`h-full ${
                        toastModal.type === 'success' ? 'bg-green-500' :
                        toastModal.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                      initial={{ width: '100%' }}
                      animate={{ width: `${100 - (toastModal.progress || 0)}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                )}
              </div>
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
    <Suspense fallback={<IOSCompatibleSpinner message="로딩 중..." fullScreen />}> 
      <GroupPageContent />
    </Suspense>
  );
}