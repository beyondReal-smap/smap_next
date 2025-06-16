# 🚀 UnifiedAuthContext - 통합된 인증 및 사용자 관리

기존의 복잡한 AuthContext와 UserContext를 하나로 통합하고, 더 많은 유용한 데이터를 효율적으로 관리하는 새로운 컨텍스트입니다.

## ✨ 주요 개선사항

### 🔄 기존 문제점
- **AuthContext**와 **UserContext** 분리로 인한 복잡성
- 데이터 동기화 문제
- 중복된 상태 관리
- 성능 최적화 부족
- 제한적인 사용자 정보

### 🎯 새로운 장점  
- **하나의 통합된 컨텍스트**로 모든 사용자 관련 데이터 관리
- **확장된 사용자 정보** (통계, 분석, 설정 등)
- **내장된 성능 모니터링** 및 분석
- **캐시 상태 추적** 및 관리
- **앱 설정 통합 관리**
- **실시간 사용 통계** 및 에러 추적

## 📊 제공하는 데이터

### 👤 확장된 사용자 정보
```typescript
interface ExtendedUserInfo {
  // 기본 정보
  mt_idx: number;
  name: string;
  email?: string;
  phone?: string;
  profile_image?: string;
  
  // 추가 상세 정보
  mt_id?: string;
  mt_level?: number;
  birth_date?: string;
  gender?: string;
  address?: string;
  description?: string;
  
  // 앱 사용 통계
  login_count?: number;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
  
  // 활동 통계
  total_groups?: number;
  owned_groups_count?: number;
  joined_groups_count?: number;
  total_schedules?: number;
  completed_schedules?: number;
  total_locations?: number;
}
```

### 🏷️ 그룹 상세 정보
```typescript
interface GroupDetailInfo extends Group {
  member_count: number;
  my_role: {
    isOwner: boolean;
    isLeader: boolean;
    role_name: string;
    permissions: string[];
  };
  
  // 활동 통계
  active_schedules?: number;
  completed_schedules?: number;
  total_locations?: number;
  last_activity?: string;
  
  // 설정
  notification_enabled?: boolean;
  auto_location_share?: boolean;
  privacy_level: 'public' | 'private' | 'friends';
}
```

### ⚙️ 앱 설정
```typescript
interface AppSettings {
  notifications: {
    schedule_reminders: boolean;
    group_invitations: boolean;
    location_updates: boolean;
    chat_messages: boolean;
    system_updates: boolean;
  };
  
  location: {
    auto_share: boolean;
    share_accuracy: 'high' | 'medium' | 'low';
    background_tracking: boolean;
    battery_optimization: boolean;
  };
  
  privacy: {
    profile_visibility: 'public' | 'friends' | 'private';
    location_history: boolean;
    analytics_sharing: boolean;
    data_retention_days: number;
  };
  
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: 'ko' | 'en';
    map_provider: 'google' | 'apple' | 'naver';
    default_map_zoom: number;
  };
  
  performance: {
    cache_enabled: boolean;
    preload_data: boolean;
    offline_mode: boolean;
    data_saver: boolean;
  };
}
```

### 📈 분석 및 성능 데이터
```typescript
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
}
```

## 🔧 사용법

### 기본 사용법
```tsx
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext';

function MyComponent() {
  const { 
    user, 
    isLoggedIn, 
    loading, 
    login, 
    logout,
    settings,
    analytics 
  } = useUnifiedAuth();

  if (loading) return <div>로딩 중...</div>;
  
  return (
    <div>
      {isLoggedIn ? (
        <div>
          <h1>환영합니다, {user?.name}님!</h1>
          <p>총 {user?.total_groups}개 그룹에 참여 중</p>
          <p>테마: {settings.ui.theme}</p>
        </div>
      ) : (
        <button onClick={() => login(credentials)}>로그인</button>
      )}
    </div>
  );
}
```

### 전용 Hook 사용
```tsx
import { 
  useUser, 
  useGroups, 
  useAppSettings, 
  useAnalytics,
  useCache,
  useDebug 
} from '@/contexts/UnifiedAuthContext';

// 사용자 정보만 필요한 경우
function UserProfile() {
  const { user, updateUser } = useUser();
  
  return (
    <div>
      <img src={user?.profile_image} alt="프로필" />
      <p>{user?.name}</p>
      <p>마지막 로그인: {user?.last_login}</p>
    </div>
  );
}

// 그룹 관련 기능
function GroupList() {
  const { 
    allGroups, 
    ownedGroups, 
    joinedGroups, 
    selectedGroup, 
    selectGroup 
  } = useGroups();
  
  return (
    <div>
      <h2>내가 소유한 그룹 ({ownedGroups.length}개)</h2>
      {ownedGroups.map(group => (
        <div key={group.sgt_idx}>
          {group.sgt_title} ({group.member_count}명)
        </div>
      ))}
    </div>
  );
}

// 설정 관리
function Settings() {
  const { settings, updateSettings } = useAppSettings();
  
  return (
    <div>
      <label>
        <input 
          type="checkbox"
          checked={settings.notifications.schedule_reminders}
          onChange={(e) => updateSettings({
            notifications: {
              ...settings.notifications,
              schedule_reminders: e.target.checked
            }
          })}
        />
        일정 알림 받기
      </label>
    </div>
  );
}

// 분석 데이터 보기
function Analytics() {
  const { analytics, trackFeatureUsage } = useAnalytics();
  
  const handleButtonClick = () => {
    trackFeatureUsage('special_button');
    // 버튼 기능 실행
  };
  
  return (
    <div>
      <h3>앱 사용 통계</h3>
      <p>세션 시작: {analytics.session_start?.toLocaleString()}</p>
      <p>에러 발생 횟수: {analytics.errors_count}</p>
      <p>평균 응답 시간: {analytics.performance_metrics.average_response_time}ms</p>
      
      <h4>페이지 조회수</h4>
      {Object.entries(analytics.page_views).map(([page, count]) => (
        <p key={page}>{page}: {count}회</p>
      ))}
      
      <button onClick={handleButtonClick}>특별 기능</button>
    </div>
  );
}

// 캐시 상태 확인
function CacheStatus() {
  const { cacheStats, clearCache, refreshCache } = useCache();
  
  return (
    <div>
      <h3>캐시 상태</h3>
      <p>사용자 프로필: {cacheStats.userProfile ? '✅' : '❌'}</p>
      <p>사용자 그룹: {cacheStats.userGroups ? '✅' : '❌'}</p>
      
      <button onClick={clearCache}>캐시 삭제</button>
      <button onClick={refreshCache}>캐시 새로고침</button>
    </div>
  );
}

// 디버그 정보
function DebugInfo() {
  const { getDebugInfo, exportUserData } = useDebug();
  
  const handleExport = async () => {
    const data = await exportUserData();
    console.log('사용자 데이터 내보내기:', data);
  };
  
  return (
    <div>
      <pre>{JSON.stringify(getDebugInfo(), null, 2)}</pre>
      <button onClick={handleExport}>데이터 내보내기</button>
    </div>
  );
}
```

## 🔄 마이그레이션 가이드

### 1. Provider 교체
```tsx
// 기존
<AuthProvider>
  <UserProvider>
    <DataCacheProvider>
      <App />
    </DataCacheProvider>
  </UserProvider>
</AuthProvider>

// 새로운 방식
<DataCacheProvider>
  <UnifiedAuthProvider>
    <App />
  </UnifiedAuthProvider>
</DataCacheProvider>
```

### 2. Hook 사용법 변경
```tsx
// 기존
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';

function MyComponent() {
  const { isLoggedIn, user: authUser } = useAuth();
  const { userInfo, userGroups } = useUser();
  
  return <div>{authUser?.mt_name}</div>;
}

// 새로운 방식
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext';

function MyComponent() {
  const { isLoggedIn, user } = useUnifiedAuth();
  
  return <div>{user?.name}</div>;
}
```

### 3. 그룹 관련 데이터
```tsx
// 기존
import { useGroups } from '@/contexts/AuthContext';

function GroupComponent() {
  const { allGroups, ownedGroups } = useGroups();
  
  return <div>{allGroups.length}</div>;
}

// 새로운 방식
import { useGroups } from '@/contexts/UnifiedAuthContext';

function GroupComponent() {
  const { allGroups, ownedGroups } = useGroups();
  
  return <div>{allGroups.length}</div>;
}
```

## 📱 실제 사용 예시

### 페이지별 분석 추가
```tsx
import { useAnalytics } from '@/contexts/UnifiedAuthContext';
import { useEffect } from 'react';

function HomePage() {
  const { trackPageView } = useAnalytics();
  
  useEffect(() => {
    trackPageView('home');
  }, [trackPageView]);
  
  return <div>홈 페이지</div>;
}
```

### 설정 기반 기능 제어
```tsx
import { useAppSettings } from '@/contexts/UnifiedAuthContext';

function LocationComponent() {
  const { settings } = useAppSettings();
  
  if (!settings.location.auto_share) {
    return <div>위치 공유가 비활성화되어 있습니다.</div>;
  }
  
  return <LocationMap accuracy={settings.location.share_accuracy} />;
}
```

### 성능 모니터링
```tsx
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext';

function PerformanceMonitor() {
  const { analytics } = useUnifiedAuth();
  
  // 성능 이슈 감지
  if (analytics.performance_metrics.average_response_time > 1000) {
    console.warn('응답 시간이 느립니다:', analytics.performance_metrics.average_response_time);
  }
  
  return null; // 백그라운드 모니터링
}
```

## 🎉 통합의 장점

1. **단순화된 상태 관리**: 하나의 컨텍스트로 모든 인증/사용자 데이터 처리
2. **풍부한 데이터**: 기본 정보 + 통계 + 설정 + 성능 데이터
3. **자동 성능 측정**: API 호출 시간, 로딩 시간 등 자동 추적
4. **설정 영속성**: 사용자별 설정 자동 저장/로드
5. **실시간 분석**: 페이지 조회, 기능 사용량, 에러 추적
6. **캐시 투명성**: 캐시 상태를 명확히 볼 수 있음
7. **디버깅 편의성**: 모든 상태를 한 곳에서 확인 가능

이제 더 체계적이고 강력한 사용자 관리 시스템을 사용할 수 있습니다! 🚀 