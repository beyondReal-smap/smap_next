'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import groupService, { Group } from '@/services/groupService';
import memberService from '@/services/memberService';
import { useAuth } from '@/contexts/AuthContext';

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
  
  // 특정 그룹의 멤버 수 조회
  getGroupMemberCount: (groupId: number) => Promise<number>;
}

// Context 생성
const UserContext = createContext<UserContextType | undefined>(undefined);

// Provider 컴포넌트
export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [isUserDataLoading, setIsUserDataLoading] = useState(true);
  const [userDataError, setUserDataError] = useState<string | null>(null);

  // AuthContext 사용
  const { user, isLoggedIn, loading: authLoading } = useAuth();

  // 사용자 데이터 새로고침 함수
  const refreshUserData = async () => {
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

      console.log('[UserContext] 로그인된 사용자 정보로 데이터 로딩:', user.mt_idx, user.mt_name);
      
      // AuthContext에서 받은 사용자 정보 설정
      let userInfoData: UserInfo = {
        mt_idx: user.mt_idx,
        name: user.mt_name || '사용자',
        email: user.mt_email || undefined,
        phone: user.mt_hp || undefined,
        profile_image: user.mt_file1 || undefined
      };

      // 사용자 정보가 부족한 경우 (예: email이나 phone이 없는 경우) 추가 API 호출
      if (!user.mt_email || !user.mt_hp) {
        try {
          console.log('[UserContext] 추가 사용자 정보 조회 시도');
          const response = await fetch('/api/members/me');
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              console.log('[UserContext] 추가 사용자 정보 조회 성공:', result.data);
              userInfoData = {
                mt_idx: result.data.mt_idx,
                name: result.data.mt_name || user.mt_name || '사용자',
                email: result.data.mt_email || user.mt_email || undefined,
                phone: result.data.mt_hp || user.mt_hp || undefined,
                profile_image: result.data.mt_file1 || user.mt_file1 || undefined
              };
            }
          }
        } catch (apiError) {
          console.warn('[UserContext] 추가 사용자 정보 조회 실패, AuthContext 정보 사용:', apiError);
        }
      }

      setUserInfo(userInfoData);

      // 사용자 그룹 목록 조회 (AuthContext에 이미 있지만 최신 상태로 다시 조회)
      const groups = await groupService.getCurrentUserGroups();
      setUserGroups(groups);

      console.log('[UserContext] 사용자 데이터 로딩 완료:', {
        userId: user.mt_idx,
        userName: userInfoData.name,
        groupCount: groups.length
      });

    } catch (error) {
      console.error('[UserContext] 사용자 데이터 로딩 실패:', error);
      setUserDataError(error instanceof Error ? error.message : '데이터 로딩 중 오류가 발생했습니다.');
    } finally {
      setIsUserDataLoading(false);
    }
  };

  // 특정 그룹의 멤버 수 조회
  const getGroupMemberCount = async (groupId: number): Promise<number> => {
    try {
      const members = await memberService.getGroupMembers(groupId.toString());
      return members.length;
    } catch (error) {
      console.error(`[UserContext] 그룹 ${groupId} 멤버 수 조회 실패:`, error);
      return 0;
    }
  };

  // AuthContext 상태 변경 시 데이터 새로고침
  useEffect(() => {
    // AuthContext 로딩이 완료된 후 실행
    if (!authLoading) {
      refreshUserData();
    }
  }, [authLoading, isLoggedIn, user?.mt_idx]); // user.mt_idx 변경 시에도 새로고침

  const value: UserContextType = {
    userInfo,
    setUserInfo,
    userGroups,
    setUserGroups,
    isUserDataLoading,
    setIsUserDataLoading,
    userDataError,
    setUserDataError,
    refreshUserData,
    getGroupMemberCount
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