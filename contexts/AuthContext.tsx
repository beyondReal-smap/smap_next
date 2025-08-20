'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode, useState, useCallback } from 'react';
import { AuthState, AuthAction, UserProfile, GroupWithMembers, LoginRequest } from '../frontend/src/types/auth';
import authService from '../frontend/src/services/authService';
import { useDataCache } from '../frontend/src/contexts/DataCacheContext';
import dataPreloadService from '../frontend/src/services/dataPreloadService';
import { comprehensivePreloadData } from '../frontend/src/services/dataPreloadService';
import groupService from '../frontend/src/services/groupService';
import navigationManager from '../frontend/src/utils/navigationManager';
import locationTrackingService from '../frontend/src/services/locationTrackingService';
import { fcmTokenService } from '../frontend/src/services/fcmTokenService';

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
const AuthContext = createContext<{
  state: AuthState;
  dispatch: React.Dispatch<AuthAction>;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => void;
  selectGroup: (group: GroupWithMembers | null) => void;
  updateGroups: (groups: GroupWithMembers[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPreloadingComplete: (complete: boolean) => void;
} | null>(null);

// Provider 컴포넌트
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { preloadUserData } = useDataCache();

  // 로그인
  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      console.log('[AUTH] 로그인 시도:', credentials.mt_id);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const response = await authService.login(credentials);
      console.log('[AUTH] 로그인 성공:', response.data?.member?.mt_name);

      if (response.data?.member) {
        dispatch({ type: 'LOGIN_SUCCESS', payload: response.data.member });
        
        // 위치 추적 서비스에 사용자 로그인 알림
        locationTrackingService.onUserLogin();
        
        // FCM 토큰 체크 및 업데이트 (백그라운드에서 실행)
        setTimeout(() => {
          console.log('[AUTH] 🔔 로그인 후 FCM 토큰 체크/업데이트 시작');
          if (response.data?.member?.mt_idx) {
            fcmTokenService.initializeAndCheckUpdateToken(response.data.member.mt_idx)
              .then((result: { success: boolean; token?: string; error?: string; message?: string }) => {
                if (result.success) {
                  console.log('[AUTH] ✅ FCM 토큰 체크/업데이트 완료:', result.message);
                } else {
                  console.warn('[AUTH] ⚠️ FCM 토큰 체크/업데이트 실패:', result.error);
                }
              })
              .catch((error: any) => {
                console.error('[AUTH] ❌ FCM 토큰 체크/업데이트 중 오류:', error);
              });
          } else {
            console.warn('[AUTH] ⚠️ FCM 토큰 체크/업데이트 스킵: mt_idx 없음');
          }
        }, 1000);

        // 즉시 로딩 완료 처리
        dispatch({ type: 'SET_LOADING', payload: false });
        
        // 백그라운드에서 최소한의 데이터만 프리로딩
        setTimeout(() => {
          console.log('[AUTH] 🚀 백그라운드 최소 데이터 프리로딩 시작');
          
          groupService.getCurrentUserGroups()
            .then((groups: any[]) => {
              if (groups && groups.length > 0) {
                dispatch({ type: 'UPDATE_GROUPS', payload: groups as GroupWithMembers[] });
                console.log('[AUTH] ✅ 백그라운드 그룹 데이터 로딩 완료');
              }
            })
            .catch((error: any) => {
              console.warn('[AUTH] ⚠️ 백그라운드 그룹 데이터 로딩 실패:', error);
            });
        }, 500);
      }

    } catch (error: any) {
      console.error('[AUTH] 로그인 실패:', error);
      
      const errorMessage = error.response?.data?.message || error.message || '로그인에 실패했습니다.';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 로그아웃
  const logout = async (): Promise<void> => {
    try {
      console.log('[AUTH] 로그아웃 시작');
      
      await authService.logout();
      dispatch({ type: 'LOGOUT' });
      
      console.log('[AUTH] 로그아웃 완료');
    } catch (error) {
      console.error('[AUTH] 로그아웃 실패:', error);
      // 로그아웃 실패해도 상태는 초기화
      dispatch({ type: 'LOGOUT' });
    }
  };

  // 사용자 정보 업데이트
  const updateUser = (updates: Partial<UserProfile>) => {
    dispatch({ type: 'UPDATE_USER', payload: updates });
  };

  // 그룹 선택
  const selectGroup = (group: GroupWithMembers | null) => {
    dispatch({ type: 'SELECT_GROUP', payload: group });
  };

  // 그룹 목록 업데이트
  const updateGroups = (groups: GroupWithMembers[]) => {
    dispatch({ type: 'UPDATE_GROUPS', payload: groups });
  };

  // 로딩 상태 설정
  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  // 에러 상태 설정
  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  };

  // 프리로딩 완료 상태 설정
  const setPreloadingComplete = (complete: boolean) => {
    dispatch({ type: 'SET_PRELOADING_COMPLETE', payload: complete });
  };

  const value = {
    state,
    dispatch,
    login,
    logout,
    updateUser,
    selectGroup,
    updateGroups,
    setLoading,
    setError,
    setPreloadingComplete,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
