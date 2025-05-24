# 인증 및 전역 상태 관리 (AuthContext)

SMAP 애플리케이션의 사용자 인증과 그룹 정보를 전역적으로 관리하기 위한 Context API 기반 상태 관리입니다.

## 구조

```
src/
├── types/
│   └── auth.ts              # 인증 관련 타입 정의
├── services/
│   └── authService.ts       # 인증 API 서비스
├── contexts/
│   └── AuthContext.tsx      # 전역 상태 관리 Context
└── app/
    └── ClientLayout.tsx     # AuthProvider 적용
```

## 주요 기능

### 1. 사용자 인증
- 로그인/로그아웃
- 토큰 관리 (localStorage)
- 자동 로그인 상태 유지
- 토큰 갱신

### 2. 사용자 정보 관리
- 기본 프로필 정보 (`member_t`)
- 그룹 정보 (`smap_group_t`, `smap_group_detail_t`)
- 실시간 데이터 동기화

### 3. 그룹 관리
- 사용자가 속한 모든 그룹 조회
- 그룹별 역할 관리 (오너, 리더)
- 그룹 선택 상태 관리

## 사용법

### 기본 사용 (로그인/로그아웃)

```tsx
import { useAuth } from '@/contexts/AuthContext';

function LoginComponent() {
  const { login, logout, isLoggedIn, loading, error, user } = useAuth();

  const handleLogin = async () => {
    try {
      await login({
        mt_id: '01012345678',
        mt_pwd: 'password123'
      });
      console.log('로그인 성공!');
    } catch (error) {
      console.error('로그인 실패:', error.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    console.log('로그아웃 완료');
  };

  if (loading) return <div>로딩 중...</div>;

  return (
    <div>
      {isLoggedIn ? (
        <div>
          <p>환영합니다, {user?.mt_name}님!</p>
          <button onClick={handleLogout}>로그아웃</button>
        </div>
      ) : (
        <button onClick={handleLogin}>로그인</button>
      )}
      {error && <p>오류: {error}</p>}
    </div>
  );
}
```

### 사용자 정보 사용

```tsx
import { useUser } from '@/contexts/AuthContext';

function ProfileComponent() {
  const user = useUser();

  if (!user) return <div>로그인이 필요합니다.</div>;

  return (
    <div>
      <h2>{user.mt_name}님의 프로필</h2>
      <p>이메일: {user.mt_email}</p>
      <p>전화번호: {user.mt_hp}</p>
      <p>가입일: {user.mt_wdate}</p>
      <p>소속 그룹 수: {user.groups.length}개</p>
    </div>
  );
}
```

### 그룹 정보 사용

```tsx
import { useGroups, useSelectedGroup } from '@/contexts/AuthContext';

function GroupComponent() {
  const { allGroups, ownedGroups, joinedGroups } = useGroups();
  const { selectedGroup, selectGroup } = useSelectedGroup();

  return (
    <div>
      <h2>내 그룹 목록</h2>
      
      <h3>내가 만든 그룹 ({ownedGroups.length}개)</h3>
      {ownedGroups.map(group => (
        <div key={group.sgt_idx}>
          <button onClick={() => selectGroup(group)}>
            {group.sgt_title} ({group.memberCount}명)
          </button>
        </div>
      ))}

      <h3>참여 중인 그룹 ({joinedGroups.length}개)</h3>
      {joinedGroups.map(group => (
        <div key={group.sgt_idx}>
          <button onClick={() => selectGroup(group)}>
            {group.sgt_title} 
            {group.myRole.isLeader && ' (리더)'}
          </button>
        </div>
      ))}

      {selectedGroup && (
        <div>
          <h3>선택된 그룹: {selectedGroup.sgt_title}</h3>
          <p>멤버 수: {selectedGroup.memberCount}명</p>
          <p>내 역할: 
            {selectedGroup.myRole.isOwner ? '오너' : 
             selectedGroup.myRole.isLeader ? '리더' : '멤버'}
          </p>
        </div>
      )}
    </div>
  );
}
```

### 사용자 정보 업데이트

```tsx
import { useAuth } from '@/contexts/AuthContext';

function UpdateProfileComponent() {
  const { updateUser, user } = useAuth();

  const handleUpdateProfile = async () => {
    try {
      await updateUser({
        mt_nickname: '새로운 닉네임',
        mt_email: 'new@email.com'
      });
      console.log('프로필 업데이트 성공!');
    } catch (error) {
      console.error('업데이트 실패:', error.message);
    }
  };

  return (
    <button onClick={handleUpdateProfile}>
      프로필 업데이트
    </button>
  );
}
```

### 데이터 새로고침

```tsx
import { useAuth } from '@/contexts/AuthContext';

function RefreshComponent() {
  const { refreshUserData, refreshGroups } = useAuth();

  const handleRefreshAll = async () => {
    await refreshUserData(); // 사용자 정보 + 그룹 정보 모두 새로고침
  };

  const handleRefreshGroups = async () => {
    await refreshGroups(); // 그룹 정보만 새로고침
  };

  return (
    <div>
      <button onClick={handleRefreshAll}>전체 새로고침</button>
      <button onClick={handleRefreshGroups}>그룹 새로고침</button>
    </div>
  );
}
```

## 페이지별 활용 예시

### Home 페이지
- 사용자 기본 정보 표시
- 최근 활동 그룹 표시
- 날씨 정보 (위치 기반)

### Group 페이지
- 그룹 목록 및 관리
- 그룹 선택 상태 관리
- 권한별 기능 제어

### Location 페이지
- 선택된 그룹의 멤버 위치 표시
- 그룹 권한 확인

### Schedule 페이지
- 선택된 그룹의 일정 관리
- 일정 생성/수정 권한 확인

### Logs 페이지
- 사용자별 활동 로그
- 그룹별 활동 필터링

## 데이터베이스 연동

Context는 다음 테이블들의 데이터를 통합 관리합니다:

### member_t
- 사용자 기본 정보
- 로그인 상태 관리
- 위치 정보

### smap_group_t
- 그룹 기본 정보
- 그룹 오너 정보

### smap_group_detail_t
- 그룹 멤버십 정보
- 역할 및 권한 정보
- 알림 설정

## 로컬 스토리지

인증 정보는 다음 키로 로컬 스토리지에 저장됩니다:

- `smap_auth_token`: JWT 토큰
- `smap_user_data`: 사용자 전체 프로필 데이터

## 에러 처리

- 네트워크 오류 시 로컬 데이터 사용
- 토큰 만료 시 자동 갱신 시도
- 인증 실패 시 로그인 페이지로 리다이렉트

## 성능 최적화

- 데이터 캐싱으로 불필요한 API 호출 최소화
- 필요한 데이터만 선택적 새로고침
- 메모이제이션을 통한 리렌더링 최적화 