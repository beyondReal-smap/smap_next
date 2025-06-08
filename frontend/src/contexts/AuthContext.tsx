'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AuthState, AuthAction, UserProfile, GroupWithMembers, LoginRequest } from '@/types/auth';
import authService from '@/services/authService';
import { getSession } from 'next-auth/react';

// 초기 상태
const initialState: AuthState = {
  isLoggedIn: false,
  user: null,
  selectedGroup: null,
  loading: true,
  error: null,
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

  // 초기 인증 상태 확인
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('[AUTH CONTEXT] 초기 인증 상태 확인 시작');
        
        // 1. NextAuth 세션 먼저 확인 (최신 상태)
        console.log('[AUTH CONTEXT] NextAuth 세션 확인');
        const session = await getSession();
        
        if (session?.backendData?.member) {
          console.log('[AUTH CONTEXT] NextAuth 세션에서 사용자 데이터 발견:', session.backendData.member.mt_name, 'ID:', session.backendData.member.mt_idx);
          
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

    // NextAuth 세션 변경 감지 (비활성화 - 무한 루프 방지)
  // useEffect(() => {
  //   const checkSessionChange = async () => {
  //     try {
  //       const session = await getSession();
        
  //       if (session?.backendData?.member) {
  //         const sessionUserId = session.backendData.member.mt_idx;
  //         const currentUserId = state.user?.mt_idx;
          
  //         // 세션의 사용자와 현재 사용자가 다르면 업데이트
  //         if (currentUserId && sessionUserId !== currentUserId) {
  //           console.log('[AUTH CONTEXT] 세션 사용자 변경 감지:', currentUserId, '->', sessionUserId);
            
  //           // 기존 데이터 초기화
  //           authService.clearAuthData();
            
  //           // 새로운 사용자 데이터 설정
  //           const userData = session.backendData.member;
  //           const token = session.backendData.token || '';
            
  //           console.log('[AUTH CONTEXT] 세션 변경 - 토큰 저장:', token ? '토큰 있음' : '토큰 없음');
            
  //           authService.setUserData(userData);
  //           authService.setToken(token);
            
  //           // localStorage에도 직접 저장 (apiClient가 인식할 수 있도록)
  //           if (typeof window !== 'undefined' && token) {
  //             localStorage.setItem('auth-token', token);
  //             console.log('[AUTH CONTEXT] 세션 변경 - localStorage에 토큰 저장 완료');
  //           }
            
  //           dispatch({ type: 'LOGIN_SUCCESS', payload: userData });
  //           await refreshUserData();
  //         }
  //       }
  //     } catch (error) {
  //       console.error('[AUTH CONTEXT] 세션 변경 확인 실패:', error);
  //     }
  //   };

  //   // 주기적으로 세션 변경 확인 (30초마다로 변경)
  //   const interval = setInterval(checkSessionChange, 30000);
    
  //   return () => clearInterval(interval);
  // }, [state.user?.mt_idx]);

  // 로그인
  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      dispatch({ type: 'LOGIN_START' });
      const response = await authService.login(credentials);
      
      if (response.success && response.data) {
        const userProfile = await authService.getUserProfile(response.data.member.mt_idx);
        dispatch({ type: 'LOGIN_SUCCESS', payload: userProfile });
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
      await authService.logout();
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      console.error('[AUTH CONTEXT] 로그아웃 실패:', error);
      // 로그아웃은 에러가 발생해도 상태를 초기화
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