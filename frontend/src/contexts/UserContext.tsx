'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Group } from '@/services/groupService';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';

// 사용자 기본 정보 타입
interface UserInfo {
  mt_idx: number;
  name?: string;
  email?: string;
  phone?: string;
  profile_image?: string;
}

// Context 타입 정의
interface UserContextType {
  // 사용자 정보
  userInfo: UserInfo | null;
  setUserInfo: (info: UserInfo | null) => void;
  
  // 그룹 정보
  userGroups: Group[];
  setUserGroups: (groups: Group[]) => void;
  
  // 로딩 상태
  isUserDataLoading: boolean;
  setIsUserDataLoading: (loading: boolean) => void;
  
  // 에러 상태
  userDataError: string | null;
  setUserDataError: (error: string | null) => void;
  
  // 데이터 새로고침 함수
  refreshUserData: () => Promise<void>;
  
  // 그룹 데이터 강제 새로고침 함수
  forceRefreshGroups: () => Promise<Group[]>;
  
  // 선택된 그룹
  selectedGroupId: number | null;
  setSelectedGroupId: (groupId: number | null) => void;
}

// Context 생성
const UserContext = createContext<UserContextType | undefined>(undefined);

// Provider 컴포넌트
export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isUserDataLoading, setIsUserDataLoading] = useState(true);
  const [userDataError, setUserDataError] = useState<string | null>(null);

  // 초기화 완료 상태 추가
  const [isInitialized, setIsInitialized] = useState(false);

  // AuthContext와 DataCache 사용 (빌드 시 안전한 fallback)
  const authContext = useAuth();
  const { user, isLoggedIn, loading: authLoading, isPreloadingComplete } = authContext.state || {
    user: null,
    isLoggedIn: false,
    loading: true,
    isPreloadingComplete: false
  };
  const { getUserProfile, getUserGroups } = useDataCache();

  // 사용자 데이터 새로고침 함수 (실시간 데이터 조회)
  const refreshUserData = useCallback(async () => {
    try {
      setIsUserDataLoading(true);
      setUserDataError(null);

      // 로그인되지 않은 경우 초기화
      if (!isLoggedIn || !user) {
        console.log('[UserContext] 로그인되지 않음 - 데이터 초기화');
        setUserInfo(null);
        setUserGroups([]);
        return;
      }

      console.log('[UserContext] 실시간 데이터 조회 시작:', user.mt_idx, user.mt_name);
      
      // 🔧 사용자 정보 로깅 (모든 사용자)
      console.log('🔧 [UserContext] 사용자 정보 확인:', {
        mt_idx: user.mt_idx,
        email: user.mt_email,
        name: user.mt_name
      });
      
      // AuthContext에서 받은 사용자 정보 설정
      let userInfoData: UserInfo = {
        mt_idx: user.mt_idx,
        name: user.mt_name || '사용자',
        email: user.mt_email || undefined,
        phone: user.mt_hp || undefined,
        profile_image: user.mt_file1 || undefined
      };

      // 캐시된 사용자 프로필 데이터 확인
      const cachedProfile = getUserProfile();
      if (cachedProfile) {
        console.log('[UserContext] 캐시된 프로필 데이터 사용:', cachedProfile.mt_idx);
        userInfoData = {
          mt_idx: cachedProfile.mt_idx,
          name: cachedProfile.mt_name || user.mt_name || '사용자',
          email: cachedProfile.mt_email || user.mt_email || undefined,
          phone: user.mt_hp || undefined, // UserProfile에 mt_hp가 없으므로 user에서 가져옴
          profile_image: cachedProfile.mt_file1 || user.mt_file1 || undefined
        };
      }

      setUserInfo(userInfoData);

      // 🔥 실시간 그룹 데이터 조회 (캐시 사용하지 않음)
      console.log('[UserContext] 실시간 그룹 데이터 조회 시작');
      
      try {
        // groupService를 통해 최신 그룹 데이터 조회
        const groupService = await import('@/services/groupService');
        const groupsData = await groupService.default.getCurrentUserGroups(true); // 캐시 무시
        
        if (groupsData && groupsData.length > 0) {
          console.log('[UserContext] ⚡ 실시간 그룹 데이터 획득:', groupsData.length, '개');
          setUserGroups(groupsData);
          
          // 첫 번째 그룹을 기본 선택으로 설정
          if (!selectedGroupId && groupsData.length > 0) {
            setSelectedGroupId(groupsData[0].sgt_idx);
          }
        } else {
          console.log('[UserContext] 사용자의 그룹이 없음');
          setUserGroups([]);
          setSelectedGroupId(null);
        }
      } catch (error) {
        console.error('[UserContext] 실시간 그룹 데이터 조회 실패:', error);
        setUserGroups([]);
        setSelectedGroupId(null);
      }

      console.log('[UserContext] 사용자 데이터 로딩 완료:', {
        userId: user.mt_idx,
        userName: userInfoData.name,
        groupCount: userGroups.length || 0
      });

    } catch (error) {
      console.error('[UserContext] 사용자 데이터 로딩 실패:', error);
      setUserDataError(error instanceof Error ? error.message : '데이터 로딩 중 오류가 발생했습니다.');
    } finally {
      setIsUserDataLoading(false);
    }
  }, [isLoggedIn, user, getUserProfile, getUserGroups]);

  // 🆕 그룹 데이터 강제 새로고침 함수 (실시간 조회)
  const forceRefreshGroups = useCallback(async () => {
    if (!isLoggedIn || !user) {
      console.log('[UserContext] 그룹 강제 새로고침 - 로그인되지 않음');
      return [];
    }

    console.log('[UserContext] 실시간 그룹 데이터 강제 새로고침 시작');
    
    try {
      // groupService를 통해 최신 그룹 데이터 조회 (캐시 무시)
      const groupService = await import('@/services/groupService');
      const latestGroups = await groupService.default.getCurrentUserGroups(true); // true = 캐시 무시
      
      if (latestGroups && latestGroups.length > 0) {
        console.log('[UserContext] ⚡ 실시간 그룹 데이터 조회 성공:', latestGroups.length, '개');
        
        setUserGroups(latestGroups);
        
        // 첫 번째 그룹을 기본 선택으로 설정 (선택된 그룹이 없는 경우)
        if (!selectedGroupId && latestGroups.length > 0) {
          setSelectedGroupId(latestGroups[0].sgt_idx);
        }
        
        console.log('[UserContext] 실시간 그룹 데이터 새로고침 완료:', latestGroups.map(g => ({
          sgt_idx: g.sgt_idx,
          sgt_title: g.sgt_title,
          member_count: g.member_count
        })));
        
        return latestGroups;
      } else {
        console.log('[UserContext] 실시간 조회 결과: 그룹이 없음');
        setUserGroups([]);
        setSelectedGroupId(null);
        return [];
      }
    } catch (error) {
      console.error('[UserContext] 실시간 그룹 데이터 조회 실패:', error);
      setUserGroups([]);
      setSelectedGroupId(null);
      return [];
    }
  }, [isLoggedIn, user, selectedGroupId]);

  // AuthContext 프리로딩 완료 후 데이터 새로고침
  useEffect(() => {
    // AuthContext 로딩이 완료되고 사용자 정보가 있으면 즉시 실행
    if (!authLoading && isLoggedIn && user) {
      console.log('[UserContext] 🚀 AuthContext 사용자 정보 확인, 즉시 데이터 로딩 시작:', user.mt_idx);
      
      // 개발 모드에서 앱 시작 시 강제로 그룹 데이터 초기화
      if (process.env.NODE_ENV === 'development') {
        console.log('[UserContext] 개발 모드 - 그룹 데이터 강제 초기화');
        setUserGroups([]);
        setSelectedGroupId(null);
      }
      
      refreshUserData();
      return;
    }
    
    // 사용자 정보가 없지만 프리로딩이 완료된 경우 (로그아웃 상태 등)
    if (!authLoading && !isLoggedIn) {
      console.log('[UserContext] AuthContext 로그아웃 상태, 데이터 초기화');
      setUserInfo(null);
      setUserGroups([]);
      setIsUserDataLoading(false);
      return;
    }
    
    // 여전히 로딩 중인 경우
    if (authLoading) {
      console.log('[UserContext] AuthContext 로딩 중, 대기...');
      setIsUserDataLoading(true);
    }
  }, [authLoading, isLoggedIn, user, refreshUserData]);

  // 프리로딩 완료 시 추가 데이터 확인 (백업용)
  useEffect(() => {
    // 프리로딩이 완료되었지만 UserContext 데이터가 없는 경우 재시도
    if (isPreloadingComplete && isLoggedIn && user && !userInfo) {
      console.log('[UserContext] ⚡ 프리로딩 완료 후 백업 데이터 로딩 시도');
      refreshUserData();
    }
  }, [isPreloadingComplete, isLoggedIn, user, userInfo, refreshUserData]);

  // 사용자 변경 시 완전한 데이터 초기화
  useEffect(() => {
    if (user?.mt_idx) {
      console.log('[UserContext] 사용자 변경 감지, 실시간 데이터 초기화:', user.mt_idx);
      
      // 모든 상태 초기화
      setIsInitialized(false);
      setSelectedGroupId(null);
      setUserGroups([]);
      setUserInfo(null);
      setUserDataError(null);
      setIsUserDataLoading(true);
      
      // 새로운 사용자 데이터 로딩 시작
      setTimeout(() => {
        refreshUserData();
      }, 100);
    }
  }, [user?.mt_idx, refreshUserData]);

  // 그룹 데이터 로딩 완료 후 첫 번째 그룹 자동 선택 (한 번만)
  useEffect(() => {
    if (!isInitialized && !isUserDataLoading) {
      if (userGroups.length > 0 && selectedGroupId === null) {
        console.log('[UserContext] 초기화: 첫 번째 그룹 자동 선택:', userGroups[0].sgt_title, 'ID:', userGroups[0].sgt_idx);
        setSelectedGroupId(userGroups[0].sgt_idx);
      } else if (userGroups.length === 0) {
        console.log('[UserContext] 초기화: 그룹이 없는 신규 사용자');
        setSelectedGroupId(null);
      }
      setIsInitialized(true); // 초기화 완료 표시
    }
  }, [isInitialized, isUserDataLoading, userGroups.length]); // selectedGroupId 의존성 제거

  const value: UserContextType = {
    userInfo,
    setUserInfo,
    userGroups,
    setUserGroups,
    selectedGroupId,
    setSelectedGroupId,
    isUserDataLoading,
    setIsUserDataLoading,
    userDataError,
    setUserDataError,
    refreshUserData,
    forceRefreshGroups
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

// Context 사용을 위한 커스텀 훅
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext; 