'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode, useState, useCallback } from 'react';
import { AuthState, AuthAction, UserProfile, GroupWithMembers, LoginRequest } from '@/types/auth';
import { Group } from '@/services/groupService';
import authService from '@/services/authService';
import { useDataCache } from '@/contexts/DataCacheContext';
import dataPreloadService from '@/services/dataPreloadService';

// 확장된 사용자 정보 타입
interface ExtendedUserInfo {
  // 기본 정보
  mt_idx: number;
  name: string;
  email?: string;
  phone?: string;
  profile_image?: string;
  
  // 추가 상세 정보
  mt_id?: string; // 로그인 ID
  mt_level?: number; // 사용자 레벨
  mt_show?: string; // 표시 여부
  mt_file1?: string; // 프로필 이미지 URL
  birth_date?: string; // 생년월일
  gender?: string; // 성별
  address?: string; // 주소
  description?: string; // 자기소개
  
  // 앱 사용 통계
  login_count?: number; // 로그인 횟수
  last_login?: string; // 마지막 로그인
  created_at?: string; // 가입일
  updated_at?: string; // 최근 업데이트
  
  // 활동 통계
  total_groups?: number; // 총 그룹 수
  owned_groups_count?: number; // 소유 그룹 수
  joined_groups_count?: number; // 참가 그룹 수
  total_schedules?: number; // 총 일정 수
  completed_schedules?: number; // 완료된 일정 수
  total_locations?: number; // 총 위치 공유 수
}

// 그룹 상세 정보 타입
interface GroupDetailInfo extends Group {
  // 멤버 정보
  member_count: number;
  my_role: {
    isOwner: boolean;
    isLeader: boolean;
    role_name: string;
    permissions: string[];
  };
  
  // 활동 통계
  active_schedules?: number; // 활성 일정 수
  completed_schedules?: number; // 완료된 일정 수
  total_locations?: number; // 총 위치 공유 수
  last_activity?: string; // 마지막 활동일
  
  // 설정
  notification_enabled?: boolean; // 알림 허용
  auto_location_share?: boolean; // 자동 위치 공유
  privacy_level?: 'public' | 'private' | 'friends'; // 프라이버시 레벨
}

// 앱 설정 타입
interface AppSettings {
  // 알림 설정
  notifications: {
    schedule_reminders: boolean;
    group_invitations: boolean;
    location_updates: boolean;
    chat_messages: boolean;
    system_updates: boolean;
  };
  
  // 위치 설정
  location: {
    auto_share: boolean;
    share_accuracy: 'high' | 'medium' | 'low';
    background_tracking: boolean;
    battery_optimization: boolean;
  };
  
  // 프라이버시 설정
  privacy: {
    profile_visibility: 'public' | 'friends' | 'private';
    location_history: boolean;
    analytics_sharing: boolean;
    data_retention_days: number;
  };
  
  // UI 설정
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: 'ko' | 'en';
    map_provider: 'google' | 'apple' | 'naver';
    default_map_zoom: number;
  };
  
  // 성능 설정
  performance: {
    cache_enabled: boolean;
    preload_data: boolean;
    offline_mode: boolean;
    data_saver: boolean;
  };
}

// 통합된 인증 상태 타입
interface UnifiedAuthState {
  // 기본 인증 상태
  isLoggedIn: boolean;
  loading: boolean;
  error: string | null;
  
  // 사용자 정보
  user: ExtendedUserInfo | null;
  originalUserProfile: UserProfile | null; // 원본 API 데이터
  
  // 그룹 정보
  groups: GroupDetailInfo[];
  selectedGroup: GroupDetailInfo | null;
  
  // 앱 설정
  settings: AppSettings;
  
  // 캐시 및 성능
  isPreloadingComplete: boolean;
  lastDataRefresh: Date | null;
  cacheStats: {
    userProfile: boolean;
    userGroups: boolean;
    groupMembers: { [groupId: number]: boolean };
    scheduleData: { [groupId: number]: boolean };
    locationData: { [groupId: number]: boolean };
  };
  
  // 통계 및 분석
  analytics: {
    session_start: Date | null;
    page_views: { [page: string]: number };
    feature_usage: { [feature: string]: number };
    errors_count: number;
    performance_metrics: {
      auth_load_time: number;
      data_load_time: number;
      average_response_time: number;
    };
  };
}

// 액션 타입들
type UnifiedAuthAction = 
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: UserProfile; settings?: Partial<AppSettings> } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<ExtendedUserInfo> }
  | { type: 'UPDATE_GROUPS'; payload: GroupDetailInfo[] }
  | { type: 'SELECT_GROUP'; payload: GroupDetailInfo | null }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PRELOADING_COMPLETE'; payload: boolean }
  | { type: 'UPDATE_CACHE_STATS'; payload: Partial<UnifiedAuthState['cacheStats']> }
  | { type: 'INCREMENT_ANALYTICS'; payload: { type: 'page_view' | 'feature_usage' | 'error'; key: string } }
  | { type: 'UPDATE_PERFORMANCE'; payload: Partial<UnifiedAuthState['analytics']['performance_metrics']> };

// 기본 앱 설정
const defaultSettings: AppSettings = {
  notifications: {
    schedule_reminders: true,
    group_invitations: true,
    location_updates: true,
    chat_messages: true,
    system_updates: true,
  },
  location: {
    auto_share: false,
    share_accuracy: 'medium',
    background_tracking: false,
    battery_optimization: true,
  },
  privacy: {
    profile_visibility: 'friends',
    location_history: true,
    analytics_sharing: true,
    data_retention_days: 30,
  },
  ui: {
    theme: 'auto',
    language: 'ko',
    map_provider: 'google',
    default_map_zoom: 15,
  },
  performance: {
    cache_enabled: true,
    preload_data: true,
    offline_mode: false,
    data_saver: false,
  },
};

// 초기 상태
const initialState: UnifiedAuthState = {
  isLoggedIn: false,
  loading: true,
  error: null,
  user: null,
  originalUserProfile: null,
  groups: [],
  selectedGroup: null,
  settings: defaultSettings,
  isPreloadingComplete: false,
  lastDataRefresh: null,
  cacheStats: {
    userProfile: false,
    userGroups: false,
    groupMembers: {},
    scheduleData: {},
    locationData: {},
  },
  analytics: {
    session_start: null,
    page_views: {},
    feature_usage: {},
    errors_count: 0,
    performance_metrics: {
      auth_load_time: 0,
      data_load_time: 0,
      average_response_time: 0,
    },
  },
};

// 사용자 프로필을 확장된 정보로 변환
const convertToExtendedUserInfo = (user: UserProfile, analytics?: any): ExtendedUserInfo => {
  return {
    mt_idx: user.mt_idx,
    name: user.mt_name || '사용자',
    email: user.mt_email,
    phone: user.mt_hp,
    profile_image: user.mt_file1,
    mt_id: user.mt_id,
    mt_level: user.mt_level,
    mt_file1: user.mt_file1,
    created_at: user.mt_wdate,
    updated_at: user.mt_ldate, // mt_ldate 사용
    total_groups: user.groups?.length || 0,
    owned_groups_count: user.ownedGroups?.length || 0,
    joined_groups_count: user.joinedGroups?.length || 0,
    login_count: analytics?.login_count || 0,
    last_login: analytics?.last_login || new Date().toISOString(),
    // 추가 통계는 별도 API로 가져올 수 있음
  };
};

// 그룹을 상세 정보로 변환
const convertToGroupDetailInfo = (group: Group | GroupWithMembers): GroupDetailInfo => {
  const baseGroup = group as GroupDetailInfo;
  const groupWithMembers = group as GroupWithMembers;
  return {
    ...baseGroup,
    my_role: {
      isOwner: groupWithMembers.myRole?.isOwner || false,
      isLeader: groupWithMembers.myRole?.isLeader || false,
      role_name: groupWithMembers.myRole?.isOwner ? 'owner' : groupWithMembers.myRole?.isLeader ? 'leader' : 'member',
      permissions: groupWithMembers.myRole?.isOwner ? ['all'] : groupWithMembers.myRole?.isLeader ? ['edit', 'invite'] : ['view'],
    },
    member_count: baseGroup.member_count || groupWithMembers.memberCount || 1,
    notification_enabled: true,
    auto_location_share: false,
    privacy_level: 'friends',
  };
};

// Reducer 함수
const unifiedAuthReducer = (state: UnifiedAuthState, action: UnifiedAuthAction): UnifiedAuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null,
        analytics: {
          ...state.analytics,
          session_start: new Date(),
        },
      };

    case 'LOGIN_SUCCESS':
      const extendedUser = convertToExtendedUserInfo(action.payload.user);
      
      return {
        ...state,
        isLoggedIn: true,
        user: extendedUser,
        originalUserProfile: action.payload.user,
        loading: false,
        error: null,
        settings: {
          ...state.settings,
          ...action.payload.settings,
        },
        lastDataRefresh: new Date(),
        analytics: {
          ...state.analytics,
          feature_usage: {
            ...state.analytics.feature_usage,
            login: (state.analytics.feature_usage.login || 0) + 1,
          },
        },
      };

    case 'LOGIN_FAILURE':
      return {
        ...state,
        isLoggedIn: false,
        user: null,
        originalUserProfile: null,
        loading: false,
        error: action.payload,
        analytics: {
          ...state.analytics,
          errors_count: state.analytics.errors_count + 1,
        },
      };

    case 'LOGOUT':
      return {
        ...initialState,
        loading: false,
        settings: state.settings, // 설정은 유지
        analytics: {
          ...initialState.analytics,
          session_start: null,
        },
      };

    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
        lastDataRefresh: new Date(),
      };

    case 'UPDATE_GROUPS':
      const detailedGroups = action.payload.map(convertToGroupDetailInfo);
      return {
        ...state,
        groups: detailedGroups,
        user: state.user ? {
          ...state.user,
          total_groups: detailedGroups.length,
          owned_groups_count: detailedGroups.filter(g => g.my_role.isOwner).length,
          joined_groups_count: detailedGroups.filter(g => !g.my_role.isOwner).length,
        } : null,
        lastDataRefresh: new Date(),
      };

    case 'SELECT_GROUP':
      return {
        ...state,
        selectedGroup: action.payload,
        analytics: {
          ...state.analytics,
          feature_usage: {
            ...state.analytics.feature_usage,
            group_selection: (state.analytics.feature_usage.group_selection || 0) + 1,
          },
        },
      };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
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
        analytics: action.payload ? {
          ...state.analytics,
          errors_count: state.analytics.errors_count + 1,
        } : state.analytics,
      };

    case 'SET_PRELOADING_COMPLETE':
      return {
        ...state,
        isPreloadingComplete: action.payload,
      };

    case 'UPDATE_CACHE_STATS':
      return {
        ...state,
        cacheStats: {
          ...state.cacheStats,
          ...action.payload,
        },
      };

    case 'INCREMENT_ANALYTICS':
      const { type: analyticsType, key } = action.payload;
      if (analyticsType === 'page_view') {
        return {
          ...state,
          analytics: {
            ...state.analytics,
            page_views: {
              ...state.analytics.page_views,
              [key]: (state.analytics.page_views[key] || 0) + 1,
            },
          },
        };
      } else if (analyticsType === 'feature_usage') {
        return {
          ...state,
          analytics: {
            ...state.analytics,
            feature_usage: {
              ...state.analytics.feature_usage,
              [key]: (state.analytics.feature_usage[key] || 0) + 1,
            },
          },
        };
      } else if (analyticsType === 'error') {
        return {
          ...state,
          analytics: {
            ...state.analytics,
            errors_count: state.analytics.errors_count + 1,
          },
        };
      }
      return state;

    case 'UPDATE_PERFORMANCE':
      return {
        ...state,
        analytics: {
          ...state.analytics,
          performance_metrics: {
            ...state.analytics.performance_metrics,
            ...action.payload,
          },
        },
      };

    default:
      return state;
  }
};

// 통합 Context 타입 정의
interface UnifiedAuthContextType extends UnifiedAuthState {
  // 인증 관련
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
  
  // 사용자 정보 관리
  updateUser: (updateData: Partial<ExtendedUserInfo>) => Promise<void>;
  refreshUserData: () => Promise<void>;
  
  // 그룹 관리
  refreshGroups: () => Promise<void>;
  selectGroup: (group: GroupDetailInfo | null) => void;
  updateGroupSettings: (groupId: number, settings: Partial<GroupDetailInfo>) => Promise<void>;
  
  // 설정 관리
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  exportSettings: () => string;
  importSettings: (settingsJson: string) => boolean;
  
  // 분석 및 통계
  trackPageView: (page: string) => void;
  trackFeatureUsage: (feature: string) => void;
  trackError: (error: string) => void;
  getAnalytics: () => UnifiedAuthState['analytics'];
  resetAnalytics: () => void;
  
  // 캐시 관리
  clearCache: () => void;
  refreshCache: () => Promise<void>;
  getCacheStatus: () => UnifiedAuthState['cacheStats'];
  
  // 유틸리티
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  exportUserData: () => Promise<string>;
  getDebugInfo: () => object;
}

// Context 생성
const UnifiedAuthContext = createContext<UnifiedAuthContextType | undefined>(undefined);

// 전역 상태로 중복 실행 방지
let globalPreloadingState = {
  isPreloading: false,
  completedUsers: new Set<number>(),
  lastPreloadTime: 0
};

// Provider 컴포넌트
interface UnifiedAuthProviderProps {
  children: ReactNode;
}

export const UnifiedAuthProvider: React.FC<UnifiedAuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(unifiedAuthReducer, initialState);
  
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

  // 성능 측정 헬퍼
  const measurePerformance = useCallback(async <T,>(
    operation: () => Promise<T>,
    metricName: string
  ): Promise<T> => {
    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      dispatch({
        type: 'UPDATE_PERFORMANCE',
        payload: { [metricName]: duration }
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      dispatch({
        type: 'UPDATE_PERFORMANCE',
        payload: { [metricName]: duration }
      });
      throw error;
    }
  }, []);

  // 데이터 프리로딩 함수
  const preloadUserData = useCallback(async (userId: number, source: string = 'unknown') => {
    const now = Date.now();
    
    if (globalPreloadingState.isPreloading) {
      console.log(`[UNIFIED AUTH] 프리로딩 이미 진행 중이므로 건너뛰기 (${source}):`, userId);
      return;
    }
    
    if (globalPreloadingState.completedUsers.has(userId)) {
      const timeSinceLastPreload = now - globalPreloadingState.lastPreloadTime;
      if (timeSinceLastPreload < 10000) {
        console.log(`[UNIFIED AUTH] 최근 프리로딩 완료된 사용자이므로 건너뛰기 (${source}):`, userId);
        dispatch({ type: 'SET_PRELOADING_COMPLETE', payload: true });
        return;
      }
    }

    globalPreloadingState.isPreloading = true;
    console.log(`[UNIFIED AUTH] 🚀 데이터 프리로딩 시작 (${source}):`, userId);

    try {
      const results = await measurePerformance(async () => {
        return await dataPreloadService.preloadAllData({
          userId,
          onProgress: (step: string, progress: number) => {
            console.log(`[UNIFIED AUTH] 프리로딩 진행 (${source}): ${step} (${progress}%)`);
          }
        });
      }, 'data_load_time');

      // 캐시 상태 업데이트
      const cacheUpdates: Partial<UnifiedAuthState['cacheStats']> = {};
      
      if (results.userProfile) {
        setUserProfile(results.userProfile.data);
        cacheUpdates.userProfile = true;
        console.log(`[UNIFIED AUTH] ✅ 사용자 프로필 캐시 저장 완료 (${source})`);
      }

      if (results.userGroups && results.userGroups.length > 0) {
        setUserGroups(results.userGroups);
        cacheUpdates.userGroups = true;
        console.log(`[UNIFIED AUTH] ✅ 사용자 그룹 캐시 저장 완료 (${source}):`, results.userGroups.length);

        // 각 그룹의 데이터 캐시 저장
        Object.keys(results.groupMembers).forEach(groupId => {
          const members = results.groupMembers[groupId];
          if (members) {
            setGroupMembers(parseInt(groupId), members);
            cacheUpdates.groupMembers = {
              ...cacheUpdates.groupMembers,
              [parseInt(groupId)]: true
            };
          }
        });

        // 스케줄 데이터 캐시 저장 (안전하게 처리)
        Object.keys(results.monthlySchedules).forEach(groupId => {
          const schedules = results.monthlySchedules[groupId];
          if (schedules) {
                          try {
                // setScheduleData 메서드 시그니처에 맞게 호출
                (setScheduleData as any)(parseInt(groupId), schedules);
              } catch (error) {
                console.warn('[UNIFIED AUTH] 스케줄 캐시 저장 실패:', error);
              }
            cacheUpdates.scheduleData = {
              ...cacheUpdates.scheduleData,
              [parseInt(groupId)]: true
            };
          }
        });

        // 위치 데이터 캐시 저장 (안전하게 처리)  
        Object.keys(results.todayLocationData).forEach(groupId => {
          const locations = results.todayLocationData[groupId];
          if (locations) {
            try {
              setLocationData(parseInt(groupId), locations, new Date().toISOString(), new Date().toISOString());
            } catch (error) {
              console.warn('[UNIFIED AUTH] 위치 캐시 저장 실패:', error);
            }
            cacheUpdates.locationData = {
              ...cacheUpdates.locationData,
              [parseInt(groupId)]: true
            };
          }
        });
      }

      dispatch({ type: 'UPDATE_CACHE_STATS', payload: cacheUpdates });
      
      globalPreloadingState.completedUsers.add(userId);
      globalPreloadingState.lastPreloadTime = now;
      dispatch({ type: 'SET_PRELOADING_COMPLETE', payload: true });
      
      console.log(`[UNIFIED AUTH] ✅ 데이터 프리로딩 완료 (${source}):`, userId);

    } catch (error) {
      console.error(`[UNIFIED AUTH] ❌ 프리로딩 실패 (${source}):`, error);
      dispatch({ type: 'SET_ERROR', payload: '데이터 로딩 중 오류가 발생했습니다.' });
    } finally {
      globalPreloadingState.isPreloading = false;
    }
  }, [setUserProfile, setUserGroups, setGroupMembers, setScheduleData, setLocationData, measurePerformance]);

  // 사용자 설정 로드
  const loadUserSettings = async (userId: number): Promise<Partial<AppSettings>> => {
    try {
      const settingsJson = localStorage.getItem(`user_settings_${userId}`);
      if (settingsJson) {
        return JSON.parse(settingsJson);
      }
    } catch (error) {
      console.warn('[UNIFIED AUTH] 사용자 설정 로드 실패:', error);
    }
    return {};
  };

  // 사용자 설정 저장
  const saveUserSettings = async (userId: number, settings: AppSettings): Promise<void> => {
    try {
      localStorage.setItem(`user_settings_${userId}`, JSON.stringify(settings));
    } catch (error) {
      console.warn('[UNIFIED AUTH] 사용자 설정 저장 실패:', error);
    }
  };

  // 초기 인증 상태 확인
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('[UNIFIED AUTH] 초기 인증 상태 확인 시작');
        
        const authStartTime = Date.now();
        
        const isLoggedInFromService = authService.isLoggedIn();
        console.log('[UNIFIED AUTH] authService.isLoggedIn():', isLoggedInFromService);
        
        if (isLoggedInFromService) {
          const userData = authService.getUserData();
          console.log('[UNIFIED AUTH] authService.getUserData():', userData);
          if (userData) {
            console.log('[UNIFIED AUTH] authService에서 사용자 데이터 발견:', userData.mt_name);
            
            // 사용자 설정 로드 시도
            const userSettings = await loadUserSettings(userData.mt_idx);
            
            dispatch({ 
              type: 'LOGIN_SUCCESS', 
              payload: { 
                user: userData,
                settings: userSettings 
              } 
            });
            
            // 성능 측정
            const authLoadTime = Date.now() - authStartTime;
            dispatch({
              type: 'UPDATE_PERFORMANCE',
              payload: { auth_load_time: authLoadTime }
            });
            
            // 최신 데이터로 갱신
            await refreshUserData();
            
            // 프리로딩 실행
            preloadUserData(userData.mt_idx, 'authService').catch(error => {
              console.error('[UNIFIED AUTH] 프리로딩 실패:', error);
            });
            
            return;
          }
        }

        console.log('[UNIFIED AUTH] 로그인 상태 없음');
        dispatch({ type: 'SET_LOADING', payload: false });
        
      } catch (error) {
        console.error('[UNIFIED AUTH] 초기 인증 상태 확인 실패:', error);
        dispatch({ type: 'SET_ERROR', payload: '인증 상태 확인 중 오류가 발생했습니다.' });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  // 로그인
  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      dispatch({ type: 'LOGIN_START' });
      
      const response = await measurePerformance(async () => {
        return await authService.login(credentials);
      }, 'average_response_time');
      
      if (response.success && response.data) {
        const userProfile = await authService.getUserProfile(response.data.member.mt_idx);
        const userSettings = await loadUserSettings(userProfile.mt_idx);
        
        dispatch({ 
          type: 'LOGIN_SUCCESS', 
          payload: { 
            user: userProfile,
            settings: userSettings 
          } 
        });
        
        // 프리로딩 실행
        preloadUserData(userProfile.mt_idx, 'login').catch(error => {
          console.error('[UNIFIED AUTH] 로그인 후 프리로딩 실패:', error);
        });
        
      } else {
        throw new Error(response.message || '로그인에 실패했습니다.');
      }
    } catch (error: any) {
      const errorMessage = error.message || '로그인에 실패했습니다.';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      dispatch({ type: 'INCREMENT_ANALYTICS', payload: { type: 'error', key: 'login_failure' } });
      throw error;
    }
  };

  // 로그아웃
  const logout = async (): Promise<void> => {
    try {
      if (state.user) {
        // 설정 저장
        await saveUserSettings(state.user.mt_idx, state.settings);
        
        // 분석 데이터 저장 (선택적)
        const analyticsData = {
          session_duration: state.analytics.session_start ? 
            Date.now() - state.analytics.session_start.getTime() : 0,
          page_views: state.analytics.page_views,
          feature_usage: state.analytics.feature_usage,
          errors_count: state.analytics.errors_count,
        };
        localStorage.setItem(`analytics_${state.user.mt_idx}`, JSON.stringify(analyticsData));
      }
      
      await authService.logout();
      clearAllCache();
      dispatch({ type: 'LOGOUT' });
      
      // 전역 프리로딩 상태 리셋
      globalPreloadingState = {
        isPreloading: false,
        completedUsers: new Set<number>(),
        lastPreloadTime: 0
      };
      
    } catch (error) {
      console.error('[UNIFIED AUTH] 로그아웃 실패:', error);
      // 로그아웃은 에러가 발생해도 상태를 초기화
      dispatch({ type: 'LOGOUT' });
    }
  };

  // 사용자 정보 업데이트
  const updateUser = async (updateData: Partial<ExtendedUserInfo>): Promise<void> => {
    if (!state.user) {
      throw new Error('로그인된 사용자가 없습니다.');
    }

    try {
      // 기본 프로필 정보만 API로 업데이트
      const apiUpdateData: Partial<UserProfile> = {
        mt_name: updateData.name,
        mt_email: updateData.email,
        mt_hp: updateData.phone,
        mt_file1: updateData.profile_image,
      };
      
      const updatedUser = await authService.updateUserProfile(state.user.mt_idx, apiUpdateData);
      
      // 확장된 정보와 합쳐서 상태 업데이트
      const mergedUpdateData = {
        ...convertToExtendedUserInfo(updatedUser),
        ...updateData,
      };
      
      dispatch({ type: 'UPDATE_USER', payload: mergedUpdateData });
      
      // 캐시 업데이트
      setUserProfile(updatedUser);
      
      dispatch({ type: 'INCREMENT_ANALYTICS', payload: { type: 'feature_usage', key: 'profile_update' } });
      
    } catch (error: any) {
      const errorMessage = error.message || '사용자 정보 업데이트에 실패했습니다.';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      dispatch({ type: 'INCREMENT_ANALYTICS', payload: { type: 'error', key: 'profile_update_failure' } });
      throw error;
    }
  };

  // 사용자 데이터 새로고침
  const refreshUserData = async (): Promise<void> => {
    if (!state.user) return;

    try {
      const userProfile = await measurePerformance(async () => {
        return await authService.getUserProfile(state.user!.mt_idx);
      }, 'average_response_time');
      
      authService.setUserData(userProfile);
      dispatch({ type: 'UPDATE_USER', payload: convertToExtendedUserInfo(userProfile) });
      
      // 캐시 업데이트
      setUserProfile(userProfile);
      dispatch({ type: 'UPDATE_CACHE_STATS', payload: { userProfile: true } });
      
    } catch (error: any) {
      console.error('[UNIFIED AUTH] 사용자 데이터 새로고침 실패:', error);
      dispatch({ type: 'SET_ERROR', payload: '사용자 정보를 새로고침할 수 없습니다.' });
    }
  };

  // 그룹 데이터 새로고침
  const refreshGroups = async (): Promise<void> => {
    if (!state.user) return;

    try {
      const groups = await measurePerformance(async () => {
        return await authService.getUserGroups(state.user!.mt_idx);
      }, 'average_response_time');
      
      const detailedGroups = groups.map(convertToGroupDetailInfo);
      dispatch({ type: 'UPDATE_GROUPS', payload: detailedGroups });
      
      // 캐시 업데이트
      setUserGroups(groups.map(g => ({
        sgt_idx: g.sgt_idx,
        sgt_title: g.sgt_title || '',
        sgt_intro: (g as any).sgt_content || (g as any).sgt_intro || '',
        member_count: (g as any).member_count || 1,
        sgdt_owner_chk: (g as any).sgdt_owner_chk || 'N',
        sgdt_leader_chk: (g as any).sgdt_leader_chk || 'N',
      })));
      
      dispatch({ type: 'UPDATE_CACHE_STATS', payload: { userGroups: true } });
      
    } catch (error: any) {
      console.error('[UNIFIED AUTH] 그룹 데이터 새로고침 실패:', error);
      dispatch({ type: 'SET_ERROR', payload: '그룹 정보를 새로고침할 수 없습니다.' });
    }
  };

  // 인증 상태 새로고침
  const refreshAuthState = async (): Promise<void> => {
    try {
      console.log('[UNIFIED AUTH] 수동 상태 새로고침 시작');
      
      const isLoggedInFromService = authService.isLoggedIn();
      console.log('[UNIFIED AUTH] authService.isLoggedIn():', isLoggedInFromService);
      
      if (isLoggedInFromService) {
        const userData = authService.getUserData();
        console.log('[UNIFIED AUTH] authService.getUserData():', userData);
        if (userData) {
          console.log('[UNIFIED AUTH] 사용자 데이터 발견, 상태 업데이트:', userData.mt_name);
          const userSettings = await loadUserSettings(userData.mt_idx);
          dispatch({ 
            type: 'LOGIN_SUCCESS', 
            payload: { 
              user: userData,
              settings: userSettings 
            } 
          });
          return;
        }
      }
      
      console.log('[UNIFIED AUTH] 로그인 상태 없음');
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error) {
      console.error('[UNIFIED AUTH] 수동 상태 새로고침 실패:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 그룹 선택
  const selectGroup = (group: GroupDetailInfo | null): void => {
    dispatch({ type: 'SELECT_GROUP', payload: group });
  };

  // 그룹 설정 업데이트
  const updateGroupSettings = async (groupId: number, settings: Partial<GroupDetailInfo>): Promise<void> => {
    // 로컬 상태 업데이트
    const updatedGroups = state.groups.map(group => 
      group.sgt_idx === groupId ? { ...group, ...settings } : group
    );
    dispatch({ type: 'UPDATE_GROUPS', payload: updatedGroups });
    
    // 선택된 그룹이면 업데이트
    if (state.selectedGroup?.sgt_idx === groupId) {
      dispatch({ type: 'SELECT_GROUP', payload: { ...state.selectedGroup, ...settings } });
    }
    
    dispatch({ type: 'INCREMENT_ANALYTICS', payload: { type: 'feature_usage', key: 'group_settings_update' } });
  };

  // 설정 관리
  const updateSettings = (settings: Partial<AppSettings>): void => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    
    // 즉시 저장
    if (state.user) {
      const newSettings = { ...state.settings, ...settings };
      saveUserSettings(state.user.mt_idx, newSettings);
    }
    
    dispatch({ type: 'INCREMENT_ANALYTICS', payload: { type: 'feature_usage', key: 'settings_update' } });
  };

  const resetSettings = (): void => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: defaultSettings });
    
    if (state.user) {
      saveUserSettings(state.user.mt_idx, defaultSettings);
    }
  };

  const exportSettings = (): string => {
    return JSON.stringify(state.settings, null, 2);
  };

  const importSettings = (settingsJson: string): boolean => {
    try {
      const settings = JSON.parse(settingsJson);
      dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
      
      if (state.user) {
        saveUserSettings(state.user.mt_idx, settings);
      }
      
      return true;
    } catch (error) {
      console.error('[UNIFIED AUTH] 설정 가져오기 실패:', error);
      return false;
    }
  };

  // 분석 및 통계
  const trackPageView = (page: string): void => {
    dispatch({ type: 'INCREMENT_ANALYTICS', payload: { type: 'page_view', key: page } });
  };

  const trackFeatureUsage = (feature: string): void => {
    dispatch({ type: 'INCREMENT_ANALYTICS', payload: { type: 'feature_usage', key: feature } });
  };

  const trackError = (error: string): void => {
    dispatch({ type: 'INCREMENT_ANALYTICS', payload: { type: 'error', key: error } });
  };

  const getAnalytics = (): UnifiedAuthState['analytics'] => {
    return state.analytics;
  };

  const resetAnalytics = (): void => {
    dispatch({
      type: 'UPDATE_PERFORMANCE',
      payload: {
        auth_load_time: 0,
        data_load_time: 0,
        average_response_time: 0,
      }
    });
  };

  // 캐시 관리
  const clearCache = (): void => {
    clearAllCache();
    dispatch({
      type: 'UPDATE_CACHE_STATS',
      payload: {
        userProfile: false,
        userGroups: false,
        groupMembers: {},
        scheduleData: {},
        locationData: {},
      }
    });
  };

  const refreshCache = async (): Promise<void> => {
    if (!state.user) return;
    
    clearCache();
    await preloadUserData(state.user.mt_idx, 'manual_refresh');
  };

  const getCacheStatus = (): UnifiedAuthState['cacheStats'] => {
    return state.cacheStats;
  };

  // 유틸리티
  const setError = (error: string | null): void => {
    dispatch({ type: 'SET_ERROR', payload: error });
  };

  const setLoading = (loading: boolean): void => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  const exportUserData = async (): Promise<string> => {
    const exportData = {
      user: state.user,
      groups: state.groups,
      settings: state.settings,
      analytics: state.analytics,
      cacheStats: state.cacheStats,
      exportDate: new Date().toISOString(),
    };
    
    return JSON.stringify(exportData, null, 2);
  };

  const getDebugInfo = (): object => {
    return {
      state: {
        isLoggedIn: state.isLoggedIn,
        loading: state.loading,
        error: state.error,
        userId: state.user?.mt_idx,
        userName: state.user?.name,
        groupsCount: state.groups.length,
        selectedGroupId: state.selectedGroup?.sgt_idx,
        isPreloadingComplete: state.isPreloadingComplete,
        lastDataRefresh: state.lastDataRefresh,
      },
      globalState: globalPreloadingState,
      performance: state.analytics.performance_metrics,
      cache: state.cacheStats,
      browser: {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
        localStorage: typeof window !== 'undefined' ? !!window.localStorage : false,
      },
    };
  };

  const contextValue: UnifiedAuthContextType = {
    ...state,
    login,
    logout,
    refreshAuthState,
    updateUser,
    refreshUserData,
    refreshGroups,
    selectGroup,
    updateGroupSettings,
    updateSettings,
    resetSettings,
    exportSettings,
    importSettings,
    trackPageView,
    trackFeatureUsage,
    trackError,
    getAnalytics,
    resetAnalytics,
    clearCache,
    refreshCache,
    getCacheStatus,
    setError,
    setLoading,
    exportUserData,
    getDebugInfo,
  };

  return (
    <UnifiedAuthContext.Provider value={contextValue}>
      {children}
    </UnifiedAuthContext.Provider>
  );
};

// Custom Hooks
export const useUnifiedAuth = (): UnifiedAuthContextType => {
  const context = useContext(UnifiedAuthContext);
  if (context === undefined) {
    throw new Error('useUnifiedAuth는 UnifiedAuthProvider 내부에서 사용되어야 합니다.');
  }
  return context;
};

// 편의를 위한 개별 hooks
export const useUser = () => {
  const { user, updateUser, refreshUserData } = useUnifiedAuth();
  return { user, updateUser, refreshUserData };
};

export const useGroups = () => {
  const { groups, selectedGroup, selectGroup, refreshGroups, updateGroupSettings } = useUnifiedAuth();
  return {
    allGroups: groups,
    ownedGroups: groups.filter(group => group.my_role.isOwner),
    joinedGroups: groups.filter(group => !group.my_role.isOwner),
    selectedGroup,
    selectGroup,
    refreshGroups,
    updateGroupSettings,
  };
};

export const useAppSettings = () => {
  const { settings, updateSettings, resetSettings, exportSettings, importSettings } = useUnifiedAuth();
  return { settings, updateSettings, resetSettings, exportSettings, importSettings };
};

export const useAnalytics = () => {
  const { 
    analytics, 
    trackPageView, 
    trackFeatureUsage, 
    trackError, 
    getAnalytics, 
    resetAnalytics 
  } = useUnifiedAuth();
  return { 
    analytics, 
    trackPageView, 
    trackFeatureUsage, 
    trackError, 
    getAnalytics, 
    resetAnalytics 
  };
};

export const useCache = () => {
  const { cacheStats, clearCache, refreshCache, getCacheStatus } = useUnifiedAuth();
  return { cacheStats, clearCache, refreshCache, getCacheStatus };
};

export const useDebug = () => {
  const { getDebugInfo, exportUserData, error, loading } = useUnifiedAuth();
  return { getDebugInfo, exportUserData, error, loading };
}; 