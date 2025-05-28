# 그룹 스케줄 관리 API 가이드

## 개요
이 API는 로그인한 멤버의 그룹 스케줄을 관리하는 기능을 제공합니다. 권한에 따라 조회, 생성, 수정, 삭제 기능이 제한됩니다.

## 권한 시스템
- **그룹 오너/리더** (`sgdt_owner_chk = 'Y'` 또는 `sgdt_leader_chk = 'Y'`): 모든 멤버의 스케줄 CRUD 가능
- **일반 멤버**: 자신의 스케줄만 CRUD 가능, 다른 멤버 스케줄은 조회만 가능

## API 엔드포인트

### 1. 그룹 스케줄 조회 (GET)
**URL:** `/api/schedule/group-manage`

**Query Parameters:**
- `groupId` (required): 그룹 ID
- `startDate` (optional): 시작 날짜 (YYYY-MM-DD)
- `endDate` (optional): 종료 날짜 (YYYY-MM-DD)
- `memberId` (optional): 특정 멤버 ID

**Response:**
```json
{
  "success": true,
  "data": {
    "schedules": [
      {
        "sst_idx": 1,
        "mt_idx": 123,
        "sst_title": "회의",
        "sst_sdate": "2024-01-15 09:00:00",
        "sst_edate": "2024-01-15 10:00:00",
        "sst_all_day": "N",
        "sst_location_title": "회의실 A",
        "sst_location_add": "서울시 강남구...",
        "sst_memo": "프로젝트 진행 상황 논의",
        "member_name": "김철수",
        "member_photo": "profile.jpg",
        "id": "1",
        "title": "회의",
        "date": "2024-01-15 09:00:00",
        "location": "회의실 A",
        "memberId": "123"
      }
    ],
    "groupMembers": [
      {
        "mt_idx": 123,
        "mt_name": "김철수",
        "mt_file1": "profile.jpg",
        "sgdt_idx": 456,
        "sgdt_owner_chk": "Y",
        "sgdt_leader_chk": "N"
      }
    ],
    "userPermission": {
      "canManage": true,
      "isOwner": true,
      "isLeader": false
    }
  }
}
```

### 2. 스케줄 생성 (POST)
**URL:** `/api/schedule/group-manage`

**Request Body:**
```json
{
  "groupId": 1,
  "targetMemberId": 123,
  "sst_title": "새 회의",
  "sst_sdate": "2024-01-15 09:00:00",
  "sst_edate": "2024-01-15 10:00:00",
  "sst_all_day": "N",
  "sst_location_title": "회의실 B",
  "sst_location_add": "서울시 강남구...",
  "sst_memo": "신규 프로젝트 킥오프",
  "sst_alram": 1,
  "sst_schedule_alarm_chk": "Y"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sst_idx": 302633,
    "message": "Schedule created successfully"
  }
}
```

### 3. 스케줄 수정 (PUT)
**URL:** `/api/schedule/group-manage`

**Request Body:**
```json
{
  "sst_idx": 302633,
  "groupId": 1,
  "sst_title": "수정된 회의",
  "sst_sdate": "2024-01-15 10:00:00",
  "sst_edate": "2024-01-15 11:00:00",
  "sst_all_day": "N",
  "sst_location_title": "회의실 C",
  "sst_memo": "시간 변경됨"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Schedule updated successfully"
  }
}
```

### 4. 스케줄 삭제 (DELETE)
**URL:** `/api/schedule/group-manage`

**Query Parameters:**
- `sst_idx` (required): 스케줄 ID
- `groupId` (required): 그룹 ID

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Schedule deleted successfully"
  }
}
```

## 프론트엔드 서비스 사용법

### 1. 서비스 Import
```typescript
import scheduleService, { 
  Schedule, 
  GroupMember, 
  UserPermission,
  CreateScheduleRequest,
  UpdateScheduleRequest 
} from '@/services/scheduleService';
```

### 2. 그룹 스케줄 조회
```typescript
const response = await scheduleService.getGroupSchedules(groupId);
if (response.success) {
  const { schedules, groupMembers, userPermission } = response.data;
  // 스케줄 데이터 처리
}
```

### 3. 특정 날짜 스케줄 조회
```typescript
const response = await scheduleService.getGroupSchedulesByDate(groupId, '2024-01-15');
```

### 4. 스케줄 생성
```typescript
const createData: CreateScheduleRequest = {
  groupId: 1,
  targetMemberId: 123, // 선택사항 (오너/리더만)
  sst_title: "새 회의",
  sst_sdate: "2024-01-15 09:00:00",
  sst_edate: "2024-01-15 10:00:00",
  sst_all_day: "N"
};

const response = await scheduleService.createSchedule(createData);
```

### 5. 스케줄 수정
```typescript
const updateData: UpdateScheduleRequest = {
  sst_idx: 302633,
  groupId: 1,
  sst_title: "수정된 회의",
  sst_sdate: "2024-01-15 10:00:00",
  sst_edate: "2024-01-15 11:00:00"
};

const response = await scheduleService.updateSchedule(updateData);
```

### 6. 스케줄 삭제
```typescript
const response = await scheduleService.deleteSchedule(scheduleId, groupId);
```

### 7. 권한 확인
```typescript
const canEdit = scheduleService.canManageSchedule(
  userPermission, 
  scheduleOwnerId, 
  currentUserId
);
```

## 데이터베이스 스키마

### smap_schedule_t 테이블
주요 필드:
- `sst_idx`: 스케줄 ID (Primary Key)
- `mt_idx`: 멤버 ID
- `sst_title`: 스케줄 제목
- `sst_sdate`: 시작 일시
- `sst_edate`: 종료 일시
- `sst_all_day`: 하루종일 여부 ('Y'/'N')
- `sgt_idx`: 그룹 ID
- `sgdt_idx`: 그룹 상세 ID
- `sst_location_title`: 위치명
- `sst_location_add`: 위치 주소
- `sst_memo`: 메모
- `sst_show`: 노출 여부 ('Y'/'N')

### 관련 테이블
- `member_t`: 멤버 정보
- `smap_group_t`: 그룹 정보
- `smap_group_detail_t`: 그룹 멤버 상세 정보 (권한 포함)

## 에러 처리

### 일반적인 에러 응답
```json
{
  "success": false,
  "error": "Error message"
}
```

### 주요 에러 코드
- `401`: 인증 실패
- `403`: 권한 없음
- `404`: 스케줄 또는 그룹을 찾을 수 없음
- `400`: 잘못된 요청 (필수 필드 누락 등)
- `500`: 서버 내부 오류

## 사용 예시

### React 컴포넌트에서 사용
```typescript
import React, { useState, useEffect } from 'react';
import scheduleService from '@/services/scheduleService';

function GroupScheduleManager({ groupId }: { groupId: number }) {
  const [schedules, setSchedules] = useState([]);
  const [userPermission, setUserPermission] = useState(null);

  useEffect(() => {
    loadSchedules();
  }, [groupId]);

  const loadSchedules = async () => {
    const response = await scheduleService.getGroupSchedules(groupId);
    if (response.success) {
      setSchedules(response.data.schedules);
      setUserPermission(response.data.userPermission);
    }
  };

  const handleCreateSchedule = async (scheduleData) => {
    const response = await scheduleService.createSchedule({
      ...scheduleData,
      groupId
    });
    
    if (response.success) {
      await loadSchedules(); // 목록 새로고침
      alert('스케줄이 생성되었습니다.');
    } else {
      alert(response.error);
    }
  };

  return (
    <div>
      {/* 스케줄 목록 및 관리 UI */}
    </div>
  );
}
```

## 주의사항

1. **권한 확인**: 모든 CUD 작업 전에 사용자 권한을 확인해야 합니다.
2. **날짜 형식**: 날짜는 'YYYY-MM-DD HH:mm:ss' 형식을 사용합니다.
3. **시간 유효성**: 종료 시간은 시작 시간보다 늦어야 합니다.
4. **그룹 멤버십**: 사용자는 해당 그룹의 멤버여야 합니다.
5. **Soft Delete**: 삭제는 `sst_show = 'N'`으로 처리됩니다.

## 추가 기능

### 시간 유효성 검사
```typescript
const validation = scheduleService.validateScheduleTime(startTime, endTime);
if (!validation.isValid) {
  alert(validation.error);
  return;
}
```

### 날짜 포맷팅
```typescript
const formattedDate = scheduleService.formatDate(new Date());
``` 