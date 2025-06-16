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

  // AuthContext와 DataCache 사용
  const { user, isLoggedIn, loading: authLoading, isPreloadingComplete } = useAuth();
  const { getUserProfile, getUserGroups } = useDataCache();

  // 사용자 데이터 새로고침 함수 (캐시된 데이터만 사용)
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

      console.log('[UserContext] 캐시된 데이터로 사용자 정보 로딩:', user.mt_idx, user.mt_name);
      
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

      // 캐시된 사용자 그룹 목록 사용 (GroupInfo를 Group으로 변환)
      const cachedGroups = getUserGroups();
      if (cachedGroups && cachedGroups.length > 0) {
        console.log('[UserContext] 캐시된 그룹 데이터 사용:', cachedGroups.length, '개');
        // GroupInfo를 Group 타입으로 변환
        const convertedGroups: Group[] = cachedGroups.map(group => ({
          sgt_idx: group.sgt_idx,
          sgt_title: group.sgt_title,
          sgt_content: group.sgt_intro || '',
          sgt_memo: '',
          mt_idx: user.mt_idx, // 현재 사용자 ID
          sgt_show: 'Y',
          sgt_wdate: new Date().toISOString(),
          member_count: group.member_count
        }));
        setUserGroups(convertedGroups);
      } else {
        console.log('[UserContext] 캐시된 그룹 데이터 없음, API 직접 호출 시도');
        
        // 캐시된 데이터가 없으면 직접 API 호출 (fallback)
        try {
          const response = await fetch('/api/groups', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              console.log('[UserContext] ⚡ API 직접 호출로 그룹 데이터 획득:', data.data.length, '개');
              setUserGroups(data.data);
            } else {
              console.log('[UserContext] API 응답에 그룹 데이터 없음');
              setUserGroups([]);
            }
          } else {
            console.warn('[UserContext] 그룹 API 직접 호출 실패:', response.status);
            setUserGroups([]);
          }
        } catch (apiError) {
          console.warn('[UserContext] 그룹 API 직접 호출 예외:', apiError);
          setUserGroups([]);
        }
      }

      console.log('[UserContext] 사용자 데이터 로딩 완료:', {
        userId: user.mt_idx,
        userName: userInfoData.name,
        groupCount: cachedGroups?.length || 0
      });

    } catch (error) {
      console.error('[UserContext] 사용자 데이터 로딩 실패:', error);
      setUserDataError(error instanceof Error ? error.message : '데이터 로딩 중 오류가 발생했습니다.');
    } finally {
      setIsUserDataLoading(false);
    }
  }, [isLoggedIn, user, getUserProfile, getUserGroups]);

  // AuthContext 프리로딩 완료 후 데이터 새로고침
  useEffect(() => {
    // AuthContext 로딩이 완료되고 사용자 정보가 있으면 즉시 실행
    if (!authLoading && isLoggedIn && user) {
      console.log('[UserContext] 🚀 AuthContext 사용자 정보 확인, 즉시 데이터 로딩 시작:', user.mt_idx);
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

  // 사용자 변경 시 초기화 상태 리셋
  useEffect(() => {
    if (user?.mt_idx) {
      console.log('[UserContext] 사용자 변경 감지, 초기화 상태 리셋:', user.mt_idx);
      setIsInitialized(false);
      setSelectedGroupId(null);
    }
  }, [user?.mt_idx]);

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
    refreshUserData
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