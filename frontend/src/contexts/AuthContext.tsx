'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode, useState, useCallback } from 'react';
import { AuthState, AuthAction, UserProfile, GroupWithMembers, LoginRequest } from '@/types/auth';
import authService from '@/services/authService';
// import { getSession } from 'next-auth/react'; // 임시 비활성화
import { useDataCache } from '@/contexts/DataCacheContext';
import dataPreloadService from '@/services/dataPreloadService';
import { comprehensivePreloadData } from '@/services/dataPreloadService';
import groupService from '@/services/groupService';
import navigationManager from '@/utils/navigationManager';
import locationTrackingService from '@/services/locationTrackingService';
// FCM 관련 서비스 제거됨 - 네이티브에서 FCM 토큰 관리

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
      try {
        // 그룹 데이터 안전성 검증 및 로깅
        const validGroups = action.payload?.filter(group => group && group.myRole) || [];

        if (validGroups.length !== action.payload?.length) {
          console.warn('[AUTH CONTEXT] 일부 그룹 데이터에 myRole이 없음:', {
            total: action.payload?.length || 0,
            valid: validGroups.length,
            invalid: (action.payload?.length || 0) - validGroups.length
          });
        }

        return {
          ...state,
          user: state.user ? {
            ...state.user,
            groups: validGroups,
            ownedGroups: validGroups.filter(group => group.myRole.isOwner === true),
            joinedGroups: validGroups.filter(group => group.myRole.isOwner === false),
          } : null,
        };
      } catch (error) {
        console.error('[AUTH CONTEXT] UPDATE_GROUPS 처리 중 오류:', error);
        // 오류 발생 시 빈 그룹 배열로 처리
        return {
          ...state,
          user: state.user ? {
            ...state.user,
            groups: [],
            ownedGroups: [],
            joinedGroups: [],
          } : null,
        };
      }

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
  refreshAuthState: () => Promise<void>; // 수동으로 AuthContext 상태 새로고침
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
    getUserGroups,
    saveComprehensiveData
  } = useDataCache();

  // 데이터 프리로딩 함수 (중복 실행 방지 강화)
  const preloadUserData = useCallback(async (userId: number, source: string = 'unknown') => {
    const now = Date.now();
    
    // 🔥 강화된 중복 실행 방지 로직
    if (globalPreloadingState.isPreloading) {
      // 로깅 제거 - 과도한 로그 방지
      return;
    }
    
    if (globalPreloadingState.completedUsers.has(userId)) {
      const timeSinceLastPreload = now - globalPreloadingState.lastPreloadTime;
      if (timeSinceLastPreload < 10000) { // 10초 내 중복 방지
        // 로깅 제거 - 과도한 로그 방지
        dispatch({ type: 'SET_PRELOADING_COMPLETE', payload: true });
        return;
      }
    }

    globalPreloadingState.isPreloading = true;
    // 로깅 제거 - 과도한 로그 방지

    // 프리로딩 타임아웃 설정 (10초로 단축 - UX 개선)
    const timeoutId = setTimeout(() => {
      console.warn(`[AUTH] ⏰ 프리로딩 타임아웃 (${source}):`, userId);
      globalPreloadingState.isPreloading = false;
      dispatch({ type: 'SET_PRELOADING_COMPLETE', payload: true });
    }, 10000);

    try {
      const results = await dataPreloadService.preloadAllData({
        userId,
        onProgress: (step: string, progress: number) => {
          // 로깅 제거 - 과도한 로그 방지
        }
      });

      // 타임아웃 취소
      clearTimeout(timeoutId);

      // 캐시에 데이터 저장
      if (results.userProfile) {
        setUserProfile(results.userProfile.data);
        // 로깅 제거 - 과도한 로그 방지
      }

      if (results.userGroups && results.userGroups.length > 0) {
        setUserGroups(results.userGroups);
        // 로깅 제거 - 과도한 로그 방지

        // 각 그룹의 데이터 캐시 저장
        Object.keys(results.groupMembers).forEach(groupId => {
          const members = results.groupMembers[groupId];
          if (members) {
            setGroupMembers(parseInt(groupId), members);
            // 로깅 제거 - 과도한 로그 방지
          }
        });

        Object.keys(results.monthlySchedules).forEach(groupId => {
          const schedules = results.monthlySchedules[groupId];
          if (schedules) {
            const today = new Date().toISOString().split('T')[0];
            setScheduleData(parseInt(groupId), today, schedules);
            // 로깅 제거 - 과도한 로그 방지
          }
        });

        Object.keys(results.groupPlaces).forEach(groupId => {
          const places = results.groupPlaces[groupId];
          if (places) {
            setGroupPlaces(parseInt(groupId), places);
            // 로깅 제거 - 과도한 로그 방지
          }
        });

        Object.keys(results.todayLocationData).forEach(groupId => {
          const locationData = results.todayLocationData[groupId];
          if (locationData) {
            const today = new Date().toISOString().split('T')[0];
            setLocationData(parseInt(groupId), today, userId.toString(), locationData);
            // 로깅 제거 - 과도한 로그 방지
          }
        });

        Object.keys(results.dailyLocationCounts).forEach(groupId => {
          const counts = results.dailyLocationCounts[groupId];
          if (counts) {
            setDailyLocationCounts(parseInt(groupId), counts);
            // 로깅 제거 - 과도한 로그 방지
          }
        });
      }

      // 프리로딩 완료 상태 업데이트
      globalPreloadingState.completedUsers.add(userId);
      globalPreloadingState.lastPreloadTime = now;
      dispatch({ type: 'SET_PRELOADING_COMPLETE', payload: true });
      
      // 로깅 제거 - 과도한 로그 방지
    } catch (error) {
      console.error(`[AUTH] 데이터 프리로딩 실패 (${source}):`, error);
    } finally {
      globalPreloadingState.isPreloading = false;
    }
  }, [setUserProfile, setUserGroups, setGroupMembers, setScheduleData, setGroupPlaces, setLocationData, setDailyLocationCounts]);

  // 초기 인증 상태 확인 (강화된 버전)
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      // 항상 로딩 시작
      dispatch({ type: 'SET_LOADING', payload: true });

      try {
        console.log('[AUTH CONTEXT] 초기 인증 상태 확인 시작');

        // 1. authService를 통해 로그인 상태 종합 검증
        const isLoggedIn = authService.isLoggedIn();

        if (isLoggedIn) {
          console.log('[AUTH CONTEXT] 로그인 상태 유효함');

          // 2. 토큰 유효성 및 갱신 확인
          const tokenValid = await authService.checkAndRefreshToken();

          if (tokenValid) {
            // 3. 최신 사용자 데이터 가져오기
            const updatedUserData = await authService.getCurrentUserProfile();

            if (updatedUserData && isMounted) {
              console.log('[AUTH CONTEXT] 사용자 데이터 최신화 성공:', updatedUserData.mt_name);
              dispatch({ type: 'LOGIN_SUCCESS', payload: updatedUserData });

              // 위치 추적 서비스에 사용자 로그인 알림
              locationTrackingService.onUserLogin();

              // FCM 토큰 처리 (기존 로직 유지)
              setTimeout(async () => {
                try {
                  console.log('[AUTH] 🚨 FCM 토큰 생성 로직 제거됨 - 네이티브에서 관리');
                  console.log('[AUTH] 📱 네이티브에서는 window.updateFCMToken() 함수를 사용하여 FCM 토큰 업데이트를 수행하세요');
                  console.log('[AUTH] FCM 관련 로직 제거됨 - 네이티브에서 관리');
                } catch (e) {
                  console.warn('[AUTH] FCM 처리 중 예외(무시):', e);
                }
              }, 1000);

              // 백그라운드에서 사용자 데이터 프리로딩
              preloadUserData(updatedUserData.mt_idx, 'initial-load').catch(error => {
                console.warn('[AUTH] 초기 프리로딩 실패 (무시):', error);
              });

            } else {
              console.warn('[AUTH CONTEXT] 사용자 데이터 최신화 실패');
              if (isMounted) {
                dispatch({ type: 'LOGOUT' });
              }
            }
          } else {
            console.warn('[AUTH CONTEXT] 토큰 검증 실패');
            if (isMounted) {
              dispatch({ type: 'LOGOUT' });
            }
          }
        } else {
          console.log('[AUTH CONTEXT] 유효한 세션 없음. 로그아웃 상태로 설정.');
          if (isMounted) {
            dispatch({ type: 'LOGOUT' });
          }
        }
      } catch (error) {
        console.error('[AUTH CONTEXT] 초기 인증 상태 확인 중 오류 발생:', error);
        if (isMounted) {
          dispatch({ type: 'LOGOUT' }); // 에러 발생 시 안전하게 로그아웃 처리
        }
      } finally {
        // 데이터 확인이 끝나면 로딩 상태 해제
        if (isMounted) {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      }
    };

    // 즉시 실행하고 5초 후에도 강제로 로딩 상태 해제 (시간 증가)
    initializeAuth();

    const timeout = setTimeout(() => {
      if (isMounted) {
        console.log('[AUTH CONTEXT] 로딩 타임아웃 - 강제로 로딩 상태 해제');
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }, 5000); // 타임아웃 시간을 5초로 증가

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [preloadUserData]); // preloadUserData를 의존성 배열에 추가

  // 로그인
  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      console.log('[AUTH] 로그인 시도:', credentials.mt_id);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // FCM 토큰 업데이트 로직 비활성화 - 네이티브에서 관리
      console.log('[AUTH] 🚫 FCM 토큰 업데이트 로직 비활성화됨 - 네이티브에서 관리');
      
      const augmentedCredentials: LoginRequest = {
        ...credentials
      };

      const response = await authService.login(augmentedCredentials);
      console.log('[AUTH] 로그인 성공:', response.data?.member?.mt_name);

      // 로그인 성공 시 사용자 데이터 저장 및 상태 업데이트
      if (response.data?.member) {
        const userData = response.data.member;

        // 1. AuthContext 상태 업데이트
        dispatch({ type: 'LOGIN_SUCCESS', payload: userData });

        // 2. 위치 추적 서비스에 사용자 로그인 알림
        locationTrackingService.onUserLogin();

        // 3. FCM 토큰 처리 - 비활성화됨
        console.log('[AUTH] 🚫 FCM 토큰 처리 로직 비활성화됨 - 네이티브에서 관리');

        // 4. 로그인 시간 저장 (세션 유지 강화)
        authService.setLoginTime();

        // 5. 즉시 로딩 완료 처리
        dispatch({ type: 'SET_LOADING', payload: false });

        // 6. 백그라운드에서 사용자 데이터 프리로딩 (강화된 버전)
        setTimeout(async () => {
          try {
            console.log('[AUTH] 🚀 백그라운드 사용자 데이터 프리로딩 시작');

            // 최신 사용자 프로필 및 그룹 정보 조회
            const [userProfile, groups] = await Promise.all([
              authService.getCurrentUserProfile(),
              groupService.getCurrentUserGroups().catch(() => [])
            ]);

            if (userProfile) {
              console.log('[AUTH] ✅ 최신 사용자 프로필 로딩 완료');
            }

            if (groups && groups.length > 0) {
              dispatch({ type: 'UPDATE_GROUPS', payload: groups as GroupWithMembers[] });
              console.log('[AUTH] ✅ 백그라운드 그룹 데이터 로딩 완료');
            }

          } catch (error: any) {
            console.warn('[AUTH] ⚠️ 백그라운드 데이터 로딩 실패 (무시):', error);
          }
        }, 500);
      }

    } catch (error: any) {
      console.error('[AUTH] 로그인 실패:', error);
      
      // 🚫 에러 모달이 표시 중이면 AuthContext 에러 처리 중단
      if (typeof window !== 'undefined' && (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
        console.log('[AUTH] 🚫 에러 모달 표시 중 - AuthContext 에러 처리 중단');
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      
      // 🚫 모든 리다이렉트가 차단된 상태라면 AuthContext 에러 처리 중단
      if (typeof window !== 'undefined' && (window as any).__BLOCK_ALL_REDIRECTS__) {
        console.log('[AUTH] 🚫 리다이렉트 차단 상태 - AuthContext 에러 처리 중단');
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      
      const errorMessage = error.response?.data?.message || error.message || '로그인에 실패했습니다.';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 로그아웃
  const logout = async (): Promise<void> => {
    try {
      console.log('[AUTH] 로그아웃 시작');
      
      // 🚫 에러 모달이 표시 중이면 로그아웃 중단
      if (typeof window !== 'undefined' && (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
        console.log('[AUTH] 🚫 에러 모달 표시 중 - 로그아웃 중단');
        return;
      }
      
      // 🚫 구글 로그인 중일 때는 로그아웃 중단
      if (typeof window !== 'undefined' && (window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
        console.log('[AUTH] 🚫 구글 로그인 중 - 로그아웃 중단');
        return;
      }
      
      // 🚫 모든 리다이렉트가 차단된 상태라면 로그아웃 중단
      if (typeof window !== 'undefined' && (window as any).__BLOCK_ALL_REDIRECTS__) {
        console.log('[AUTH] 🚫 리다이렉트 차단 상태 - 로그아웃 중단');
        return;
      }
      
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
      
      // 5. 즉시 signin 페이지로 리다이렉트 (강화된 네비게이션 방지 플래그 확인)
      if (typeof window !== 'undefined') {
        // 🔥 로그아웃 후 에러 상태 완전 정리
        (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__ = false;
        
        // 🚫 에러 모달이 표시 중이면 리다이렉트 방지
        if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
          console.log('[AUTH] 🚫 에러 모달 표시 중 - signin 페이지 리다이렉트 방지');
          return;
        }
        
        // 🚫 구글 로그인 중일 때는 리다이렉트 방지
        if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
          console.log('[AUTH] 구글 로그인 중 - signin 페이지 리다이렉트 방지');
          return;
        }
        
        // 🚫 모든 리다이렉트가 차단된 상태라면 리다이렉트 방지
        if ((window as any).__BLOCK_ALL_REDIRECTS__) {
          console.log('[AUTH] 🚫 리다이렉트 차단 상태 - signin 페이지 리다이렉트 방지');
          return;
        }
        
        console.log('[AUTH] 즉시 signin 페이지로 리다이렉트');
        navigationManager.redirectToSignin();
      }
    } catch (error) {
      console.error('[AUTH CONTEXT] 로그아웃 실패:', error);
      
      // 🚫 에러 모달이 표시 중이면 추가 처리 중단
      if (typeof window !== 'undefined' && (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
        console.log('[AUTH] 🚫 에러 모달 표시 중 - 로그아웃 에러 처리 중단');
        return;
      }
      
      // 로그아웃은 에러가 발생해도 상태를 초기화
      try {
        const { signOut } = await import('next-auth/react');
        await signOut({ redirect: false });
      } catch (signOutError) {
        console.log('[AUTH] NextAuth 세션 정리 오류 (에러 처리):', signOutError);
      }
      
      clearAllCache(); // 에러 시에도 캐시는 삭제
      dispatch({ type: 'LOGOUT' });
      
      // 에러 발생 시에도 signin 페이지로 리다이렉트 (네비게이션 방지 플래그 확인)
      if (typeof window !== 'undefined') {
        // 🚫 에러 모달이 표시 중이면 리다이렉트 방지
        if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
          console.log('[AUTH] 🚫 에러 모달 표시 중 - signin 페이지 리다이렉트 방지 (에러 시)');
          return;
        }
        
        // 🚫 구글 로그인 중일 때는 리다이렉트 방지
        if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
          console.log('[AUTH] 구글 로그인 중 - signin 페이지 리다이렉트 방지 (에러 시)');
          return;
        }
        
        // 🚫 모든 리다이렉트가 차단된 상태라면 리다이렉트 방지
        if ((window as any).__BLOCK_ALL_REDIRECTS__) {
          console.log('[AUTH] 🚫 리다이렉트 차단 상태 - signin 페이지 리다이렉트 방지 (에러 시)');
          return;
        }
        
        console.log('[AUTH] 에러 발생 시에도 signin 페이지로 리다이렉트');
        navigationManager.redirectToSignin();
      }
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
      // 그룹 조회 없이 사용자 기본 정보만 가져오기
      const userProfile = await authService.getUserBasicProfile(state.user.mt_idx);
      authService.setUserData(userProfile);
      dispatch({ type: 'LOGIN_SUCCESS', payload: userProfile });
      
      // 위치 추적 서비스에 사용자 로그인 알림
      locationTrackingService.onUserLogin();
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

  // 수동으로 AuthContext 상태 새로고침 (강화된 버전)
  const refreshAuthState = async (): Promise<void> => {
    try {
      console.log('[AUTH CONTEXT] 수동 상태 새로고침 시작');

      const isLoggedInFromService = authService.isLoggedIn();
      console.log('[AUTH CONTEXT] authService.isLoggedIn():', isLoggedInFromService);

      if (isLoggedInFromService) {
        console.log('[AUTH CONTEXT] 로그인 상태 유효함, 사용자 정보 최신화 시도');

        // 1. 토큰 유효성 검증 및 갱신
        const tokenValid = await authService.checkAndRefreshToken();

        if (tokenValid) {
          // 2. 최신 사용자 데이터 조회
          const updatedUserData = await authService.getCurrentUserProfile();

          if (updatedUserData) {
            console.log('[AUTH CONTEXT] 최신 사용자 데이터 조회 성공:', updatedUserData.mt_name);

            // 3. localStorage에서 그룹 데이터 병합 (기존 로직 유지)
            let enhancedUserData = { ...updatedUserData };
            try {
              if (typeof window !== 'undefined') {
                const storedGroups = localStorage.getItem('user_groups');
                if (storedGroups) {
                  const groups = JSON.parse(storedGroups);
                  if (Array.isArray(groups) && groups.length > 0) {
                    console.log('[AUTH CONTEXT] localStorage에서 그룹 데이터 발견:', groups.length, '개');
                    enhancedUserData = {
                      ...enhancedUserData,
                      groups: groups,
                      ownedGroups: groups.filter(g => g.myRole?.isOwner || g.is_owner),
                      joinedGroups: groups.filter(g => !(g.myRole?.isOwner || g.is_owner))
                    };
                    console.log('[AUTH CONTEXT] 그룹 정보 병합 완료:', {
                      totalGroups: groups.length,
                      ownedGroups: enhancedUserData.ownedGroups?.length || 0,
                      joinedGroups: enhancedUserData.joinedGroups?.length || 0
                    });
                  }
                }
              }
            } catch (error) {
              console.warn('[AUTH CONTEXT] localStorage 그룹 데이터 파싱 실패:', error);
            }

            // 4. 상태 업데이트
            dispatch({ type: 'LOGIN_SUCCESS', payload: enhancedUserData });

            // 5. 위치 추적 서비스에 사용자 로그인 알림
            locationTrackingService.onUserLogin();

            // 6. 백그라운드에서 그룹 데이터 최신화
            setTimeout(async () => {
              try {
                const groups = await groupService.getCurrentUserGroups();
                if (groups && groups.length > 0) {
                  dispatch({ type: 'UPDATE_GROUPS', payload: groups as GroupWithMembers[] });
                  console.log('[AUTH CONTEXT] 그룹 데이터 최신화 완료');
                }
              } catch (error) {
                console.warn('[AUTH CONTEXT] 그룹 데이터 최신화 실패 (무시):', error);
              }
            }, 1000);

            return;
          } else {
            console.warn('[AUTH CONTEXT] 최신 사용자 데이터 조회 실패');
          }
        } else {
          console.warn('[AUTH CONTEXT] 토큰 검증 실패');
        }
      }

      console.log('[AUTH CONTEXT] 로그인 상태 없음');
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error) {
      console.error('[AUTH CONTEXT] 수동 상태 새로고침 실패:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
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
    refreshAuthState,
  };

  // 개발용 디버깅 함수들을 전역에 노출
  if (typeof window !== 'undefined') {
    (window as any).SMAP_DEBUG_AUTH = () => {
      console.log('=== 🚀 SMAP 인증 디버깅 ===');
      authService.debugAuthState();
      console.log('현재 AuthContext 상태:', {
        isLoggedIn: state.isLoggedIn,
        loading: state.loading,
        user: state.user ? `${state.user.mt_name} (${state.user.mt_idx})` : null,
        selectedGroup: state.selectedGroup ? state.selectedGroup.sgt_title : null
      });
      console.log('========================');
    };

    (window as any).SMAP_FORCE_REFRESH_AUTH = async () => {
      console.log('🔄 수동 인증 상태 새로고침 실행...');
      try {
        await refreshAuthState();
        console.log('✅ 수동 인증 상태 새로고침 완료');
      } catch (error) {
        console.error('❌ 수동 인증 상태 새로고침 실패:', error);
      }
    };

    (window as any).SMAP_CHECK_STORAGE = () => {
      console.log('=== 📦 로컬 스토리지 상태 확인 ===');
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('smap_auth_token');
        const userData = localStorage.getItem('smap_user_data');
        const loginTime = localStorage.getItem('smap_login_time');

        console.log('토큰 존재:', !!token);
        console.log('사용자 데이터 존재:', !!userData);
        console.log('로그인 시간 존재:', !!loginTime);

        if (userData) {
          try {
            const user = JSON.parse(userData);
            console.log('사용자 정보:', user.mt_name, `(${user.mt_idx})`);
          } catch (e) {
            console.error('사용자 데이터 파싱 오류:', e);
          }
        }
      }
      console.log('================================');
    };

    (window as any).SMAP_TEST_LOGIN = async () => {
      console.log('=== 🔐 로그인 상태 종합 테스트 ===');
      const isLoggedIn = authService.isLoggedIn();
      console.log('authService.isLoggedIn():', isLoggedIn);

      if (isLoggedIn) {
        const userProfile = await authService.getCurrentUserProfile();
        console.log('getCurrentUserProfile():', userProfile ? '성공' : '실패');
        if (userProfile) {
          console.log('사용자:', userProfile.mt_name, `(${userProfile.mt_idx})`);
        }
      }
      console.log('================================');
    };

    // 사용법 출력
    console.log('🔧 SMAP 디버깅 함수들:');
    console.log('  - SMAP_DEBUG_AUTH(): 현재 인증 상태 확인');
    console.log('  - SMAP_FORCE_REFRESH_AUTH(): 강제 인증 상태 새로고침');
    console.log('  - SMAP_CHECK_STORAGE(): 로컬 스토리지 상태 확인');
    console.log('  - SMAP_TEST_LOGIN(): 로그인 상태 종합 테스트');
  }

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
    // 빌드 시 정적 생성 오류 방지
    if (typeof window === 'undefined') {
      return {
        user: null,
        isLoggedIn: false,
        loading: true,
        error: null,
        selectedGroup: null,
        isPreloadingComplete: false,
        login: async () => {},
        logout: async () => {},
        updateUser: async () => {},
        selectGroup: async () => {},
        refreshUserData: async () => {},
        refreshGroups: async () => {},
        setError: () => {},
        refreshAuthState: async () => {},
      };
    }
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