'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode, useState, useCallback } from 'react';
import { AuthState, AuthAction, UserProfile, GroupWithMembers, LoginRequest } from '@/types/auth';
import authService from '@/services/authService';
// import { getSession } from 'next-auth/react'; // 임시 비활성화
import { useDataCache } from '@/contexts/DataCacheContext';
import dataPreloadService from '@/services/dataPreloadService';

// 전역 상태로 중복 실행 방지
let globalPreloadingState = {
  isPreloading: false,
  completedUsers: new Set<number>(),
  lastPreloadTime: 0
};

// 초기 상태
const initialState: AuthState = {
  isLoggedIn: false,
  user: null,
  selectedGroup: null,
  loading: true,
  error: null,
  isPreloadingComplete: false,
};

// Reducer 함수
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null,
      };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isLoggedIn: true,
        user: action.payload,
        loading: false,
        error: null,
      };

    case 'LOGIN_FAILURE':
      return {
        ...state,
        isLoggedIn: false,
        user: null,
        loading: false,
        error: action.payload,
      };

    case 'LOGOUT':
      return {
        ...initialState,
        loading: false,
      };

    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };

    case 'SELECT_GROUP':
      return {
        ...state,
        selectedGroup: action.payload,
      };

    case 'UPDATE_GROUPS':
      return {
        ...state,
        user: state.user ? {
          ...state.user,
          groups: action.payload,
          ownedGroups: action.payload.filter(group => group.myRole.isOwner),
          joinedGroups: action.payload.filter(group => !group.myRole.isOwner),
        } : null,
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'SET_PRELOADING_COMPLETE':
      return {
        ...state,
        isPreloadingComplete: action.payload,
      };

    default:
      return state;
  }
};

// Context 생성
interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updateData: Partial<UserProfile>) => Promise<void>;
  selectGroup: (group: GroupWithMembers | null) => void;
  refreshUserData: () => Promise<void>;
  refreshGroups: () => Promise<void>;
  setError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider 컴포넌트
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const [preloadingUsers, setPreloadingUsers] = useState<Set<number>>(new Set()); // 프리로딩 중인 사용자 ID 추적
  
  // DataCache 사용
  const {
    setUserProfile,
    setUserGroups,
    setGroupMembers,
    setScheduleData,
    setLocationData,
    setGroupPlaces,
    setDailyLocationCounts,
    clearAllCache,
    getUserProfile,
    getUserGroups
  } = useDataCache();

  // 데이터 프리로딩 함수 (중복 실행 방지 강화)
  const preloadUserData = useCallback(async (userId: number, source: string = 'unknown') => {
    const now = Date.now();
    
    // 🔥 강화된 중복 실행 방지 로직
    if (globalPreloadingState.isPreloading) {
      console.log(`[AUTH] 프리로딩 이미 진행 중이므로 건너뛰기 (${source}):`, userId);
      return;
    }
    
    if (globalPreloadingState.completedUsers.has(userId)) {
      const timeSinceLastPreload = now - globalPreloadingState.lastPreloadTime;
      if (timeSinceLastPreload < 10000) { // 10초 내 중복 방지
        console.log(`[AUTH] 최근 프리로딩 완료된 사용자이므로 건너뛰기 (${source}):`, userId, `(${timeSinceLastPreload}ms 전)`);
        dispatch({ type: 'SET_PRELOADING_COMPLETE', payload: true });
        return;
      }
    }

    globalPreloadingState.isPreloading = true;
    console.log(`[AUTH] 🚀 데이터 프리로딩 시작 (${source}):`, userId);

    try {
      const results = await dataPreloadService.preloadAllData({
        userId,
        onProgress: (step: string, progress: number) => {
          console.log(`[AUTH] 프리로딩 진행 (${source}): ${step} (${progress}%)`);
        }
      });

      // 캐시에 데이터 저장
      if (results.userProfile) {
        setUserProfile(results.userProfile.data);
        console.log(`[AUTH] ✅ 사용자 프로필 캐시 저장 완료 (${source})`);
      }

      if (results.userGroups && results.userGroups.length > 0) {
        setUserGroups(results.userGroups);
        console.log(`[AUTH] ✅ 사용자 그룹 캐시 저장 완료 (${source}):`, results.userGroups.length);

        // 각 그룹의 데이터 캐시 저장
        Object.keys(results.groupMembers).forEach(groupId => {
          const members = results.groupMembers[groupId];
          if (members) {
            setGroupMembers(parseInt(groupId), members);
            console.log(`[AUTH] ✅ 그룹 ${groupId} 멤버 캐시 저장 완료 (${source}):`, members.length);
          }
        });

        Object.keys(results.monthlySchedules).forEach(groupId => {
          const schedules = results.monthlySchedules[groupId];
          if (schedules) {
            const today = new Date().toISOString().split('T')[0];
            setScheduleData(parseInt(groupId), today, schedules);
            console.log(`[AUTH] ✅ 그룹 ${groupId} 스케줄 캐시 저장 완료 (${source})`);
          }
        });

        Object.keys(results.groupPlaces).forEach(groupId => {
          const places = results.groupPlaces[groupId];
          if (places) {
            setGroupPlaces(parseInt(groupId), places);
            console.log(`[AUTH] ✅ 그룹 ${groupId} 장소 캐시 저장 완료 (${source}):`, places.length);
          }
        });

        Object.keys(results.todayLocationData).forEach(groupId => {
          const locationData = results.todayLocationData[groupId];
          if (locationData) {
            const today = new Date().toISOString().split('T')[0];
            setLocationData(parseInt(groupId), today, userId.toString(), locationData);
            console.log(`[AUTH] ✅ 그룹 ${groupId} 오늘 위치 데이터 캐시 저장 완료 (${source})`);
          }
        });

        Object.keys(results.dailyLocationCounts).forEach(groupId => {
          const counts = results.dailyLocationCounts[groupId];
          if (counts) {
            setDailyLocationCounts(parseInt(groupId), counts);
            console.log(`[AUTH] ✅ 그룹 ${groupId} 일별 카운트 캐시 저장 완료 (${source})`);
          }
        });
      }

      // 프리로딩 완료 상태 업데이트
      globalPreloadingState.completedUsers.add(userId);
      globalPreloadingState.lastPreloadTime = now;
      dispatch({ type: 'SET_PRELOADING_COMPLETE', payload: true });
      
      console.log(`[AUTH] 🎉 모든 데이터 프리로딩 및 캐시 저장 완료! (${source})`);
    } catch (error) {
      console.error(`[AUTH] 데이터 프리로딩 실패 (${source}):`, error);
    } finally {
      globalPreloadingState.isPreloading = false;
    }
  }, [setUserProfile, setUserGroups, setGroupMembers, setScheduleData, setGroupPlaces, setLocationData, setDailyLocationCounts]);

  // 초기 인증 상태 확인
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('[AUTH CONTEXT] 초기 인증 상태 확인 시작');
        
        // 1. NextAuth 세션 먼저 확인 (최신 상태) - 임시 비활성화
        console.log('[AUTH CONTEXT] NextAuth 세션 확인 (비활성화됨)');
        // const session = await getSession();
        const session = null;
        
        if (false && session?.backendData?.member) { // 임시 비활성화
          console.log('[AUTH CONTEXT] NextAuth 세션에서 사용자 데이터 발견:', session.backendData.member.mt_name, 'ID:', session.backendData.member.mt_idx);
          
          // 탈퇴한 사용자인지 확인 (mt_level이 1이면 탈퇴한 사용자)
          if (session.backendData.member.mt_level === 1) {
            console.log('[AUTH CONTEXT] 탈퇴한 사용자 세션 감지, 세션 정리:', session.backendData.member.mt_idx);
            
            // NextAuth 세션 정리
            try {
              const { signOut } = await import('next-auth/react');
              await signOut({ redirect: false });
              console.log('[AUTH CONTEXT] 탈퇴한 사용자 세션 정리 완료');
            } catch (error) {
              console.log('[AUTH CONTEXT] 세션 정리 오류:', error);
            }
            
            // 기존 데이터 정리
            authService.clearAuthData();
            dispatch({ type: 'SET_LOADING', payload: false });
            return;
          }
          
          // 기존 authService 데이터와 비교하여 다른 사용자면 초기화
          const existingUserData = authService.getUserData();
          if (existingUserData && existingUserData.mt_idx !== session.backendData.member.mt_idx) {
            console.log('[AUTH CONTEXT] 다른 사용자 감지, 기존 데이터 초기화:', existingUserData.mt_idx, '->', session.backendData.member.mt_idx);
            authService.clearAuthData(); // 기존 데이터 완전 삭제
          }
          
          // NextAuth 세션의 데이터를 authService에 저장
          const userData = session.backendData.member;
          const token = session.backendData.token || '';
          
          console.log('[AUTH CONTEXT] 토큰 저장:', token ? '토큰 있음' : '토큰 없음');
          
          authService.setUserData(userData);
          authService.setToken(token);
          
          // localStorage에도 직접 저장 (apiClient가 인식할 수 있도록)
          if (typeof window !== 'undefined' && token) {
            localStorage.setItem('auth-token', token);
            console.log('[AUTH CONTEXT] localStorage에 토큰 저장 완료');
          }
          
          dispatch({ type: 'LOGIN_SUCCESS', payload: userData });
          // 최신 데이터로 갱신
          await refreshUserData();
          
          // 🚀 NextAuth 세션 사용자 프리로딩 실행 (백그라운드)
          preloadUserData(userData.mt_idx, 'NextAuth').catch(error => {
            console.error('[AUTH] NextAuth 사용자 프리로딩 실패:', error);
          });
          
          return;
        }

        // 2. NextAuth 세션이 없으면 authService에서 로그인 상태 확인
        const isLoggedInFromService = authService.isLoggedIn();
        console.log('[AUTH CONTEXT] authService.isLoggedIn():', isLoggedInFromService);
        
        if (isLoggedInFromService) {
          const userData = authService.getUserData();
          console.log('[AUTH CONTEXT] authService.getUserData():', userData);
          if (userData) {
            console.log('[AUTH CONTEXT] authService에서 사용자 데이터 발견:', userData.mt_name);
            dispatch({ type: 'LOGIN_SUCCESS', payload: userData });
            // 최신 데이터로 갱신
            await refreshUserData();
            
            // 🚀 authService 사용자 프리로딩 실행 (백그라운드) - NextAuth와 다른 사용자일 때만
            preloadUserData(userData.mt_idx, 'authService').catch(error => {
              console.error('[AUTH] authService 사용자 프리로딩 실패:', error);
            });
            
            return;
          }
        }

        // 3. 둘 다 없으면 로그인되지 않은 상태
        console.log('[AUTH CONTEXT] 로그인 상태 없음');
        dispatch({ type: 'SET_LOADING', payload: false });
        
      } catch (error) {
        console.error('[AUTH CONTEXT] 초기 인증 상태 확인 실패:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  // 로그인
  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      dispatch({ type: 'LOGIN_START' });
      const response = await authService.login(credentials);
      
      if (response.success && response.data) {
        // authService.login()에서 이미 getUserProfile()이 호출되고 사용자 데이터가 저장됨
        // 저장된 사용자 데이터를 가져와서 사용
        const userProfile = authService.getUserData();
        
        if (userProfile) {
          dispatch({ type: 'LOGIN_SUCCESS', payload: userProfile });
          
          // 🚀 로그인 성공 시 백그라운드에서 데이터 프리로딩 실행
          preloadUserData(userProfile.mt_idx, 'login').catch(error => {
            console.error('[AUTH] 로그인 후 프리로딩 실패:', error);
            // 프리로딩 실패는 로그인 성공에 영향을 주지 않음
          });
        } else {
          // authService에서 사용자 데이터 저장이 실패한 경우, 다시 시도
          console.warn('[AUTH] authService에서 사용자 데이터를 찾을 수 없음, 재시도');
          const userProfile = await authService.getUserProfile(response.data.member.mt_idx);
          dispatch({ type: 'LOGIN_SUCCESS', payload: userProfile });
          
          // 🚀 로그인 성공 시 백그라운드에서 데이터 프리로딩 실행
          preloadUserData(userProfile.mt_idx, 'login-retry').catch(error => {
            console.error('[AUTH] 로그인 후 프리로딩 실패:', error);
            // 프리로딩 실패는 로그인 성공에 영향을 주지 않음
          });
        }
      } else {
        throw new Error(response.message || '로그인에 실패했습니다.');
      }
    } catch (error: any) {
      const errorMessage = error.message || '로그인에 실패했습니다.';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // 로그아웃
  const logout = async (): Promise<void> => {
    try {
      console.log('[AUTH] 로그아웃 시작');
      
      // 1. authService 로그아웃 (localStorage, 쿠키 정리)
      await authService.logout();
      
      // 2. NextAuth 세션 정리
      try {
        const { signOut } = await import('next-auth/react');
        await signOut({ redirect: false });
        console.log('[AUTH] NextAuth 세션 정리 완료');
      } catch (error) {
        console.log('[AUTH] NextAuth 세션 정리 오류:', error);
      }
      
      // 3. 모든 캐시 삭제
      clearAllCache();
      console.log('[AUTH] 로그아웃 시 모든 캐시 삭제 완료');
      
      // 4. 상태 초기화
      dispatch({ type: 'LOGOUT' });
      
      // 전역 상태 초기화
      globalPreloadingState.completedUsers.clear();
      globalPreloadingState.lastPreloadTime = 0;
      globalPreloadingState.isPreloading = false;
      
      console.log('[AUTH] 로그아웃 완료');
    } catch (error) {
      console.error('[AUTH CONTEXT] 로그아웃 실패:', error);
      
      // 로그아웃은 에러가 발생해도 상태를 초기화
      try {
        const { signOut } = await import('next-auth/react');
        await signOut({ redirect: false });
      } catch (signOutError) {
        console.log('[AUTH] NextAuth 세션 정리 오류 (에러 처리):', signOutError);
      }
      
      clearAllCache(); // 에러 시에도 캐시는 삭제
      dispatch({ type: 'LOGOUT' });
    }
  };

  // 사용자 정보 업데이트
  const updateUser = async (updateData: Partial<UserProfile>): Promise<void> => {
    if (!state.user) {
      throw new Error('로그인된 사용자가 없습니다.');
    }

    try {
      const updatedUser = await authService.updateUserProfile(state.user.mt_idx, updateData);
      dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    } catch (error: any) {
      const errorMessage = error.message || '사용자 정보 업데이트에 실패했습니다.';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  };

  // 그룹 선택
  const selectGroup = (group: GroupWithMembers | null): void => {
    dispatch({ type: 'SELECT_GROUP', payload: group });
  };

  // 사용자 데이터 새로고침
  const refreshUserData = async (): Promise<void> => {
    if (!state.user) return;

    try {
      const userProfile = await authService.getUserProfile(state.user.mt_idx);
      authService.setUserData(userProfile);
      dispatch({ type: 'LOGIN_SUCCESS', payload: userProfile });
    } catch (error: any) {
      console.error('[AUTH CONTEXT] 사용자 데이터 새로고침 실패:', error);
      dispatch({ type: 'SET_ERROR', payload: '사용자 정보를 새로고침할 수 없습니다.' });
    }
  };

  // 그룹 데이터 새로고침
  const refreshGroups = async (): Promise<void> => {
    if (!state.user) return;

    try {
      const groups = await authService.getUserGroups(state.user.mt_idx);
      dispatch({ type: 'UPDATE_GROUPS', payload: groups });
    } catch (error: any) {
      console.error('[AUTH CONTEXT] 그룹 데이터 새로고침 실패:', error);
      dispatch({ type: 'SET_ERROR', payload: '그룹 정보를 새로고침할 수 없습니다.' });
    }
  };

  // 에러 설정
  const setError = (error: string | null): void => {
    dispatch({ type: 'SET_ERROR', payload: error });
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    updateUser,
    selectGroup,
    refreshUserData,
    refreshGroups,
    setError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth는 AuthProvider 내부에서 사용되어야 합니다.');
  }
  return context;
};

// 편의를 위한 개별 hooks
export const useUser = () => {
  const { user } = useAuth();
  return user;
};

export const useGroups = () => {
  const { user } = useAuth();
  return {
    allGroups: user?.groups || [],
    ownedGroups: user?.ownedGroups || [],
    joinedGroups: user?.joinedGroups || [],
  };
};

export const useSelectedGroup = () => {
  const { selectedGroup, selectGroup } = useAuth();
  return { selectedGroup, selectGroup };
}; 