# Member Location Log API 가이드

## 개요

`member_location_log_t` 테이블의 위치 로그 데이터를 처리하는 API입니다.

## 엔드포인트

### Base URL
```
http://localhost:8000/api/v1/logs
```

## API 목록

### 1. 위치 로그 목록 조회

**POST** `/member-location-logs`

```json
{
  "act": "get_location_logs",
  "mt_idx": 1,
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "limit": 100,
  "offset": 0
}
```

**응답:**
```json
{
  "result": "Y",
  "data": [
    {
      "mlt_idx": 1,
      "mt_idx": 1,
      "mlt_lat": 37.5665,
      "mlt_long": 126.9780,
      "mlt_accuacy": 5.0,
      "mlt_speed": 1.2,
      "mlt_battery": 85,
      "mlt_fine_location": "Y",
      "mlt_location_chk": "Y",
      "mt_health_work": 1500,
      "mlt_gps_time": "2024-01-01T10:30:00",
      "mlt_wdate": "2024-01-01T10:30:05",
      "stay_lat": null,
      "stay_long": null
    }
  ]
}
```

### 2. 위치 로그 요약 정보 조회

**POST** `/member-location-logs`

```json
{
  "act": "get_location_summary",
  "mt_idx": 1,
  "start_date": "2024-01-01",
  "end_date": "2024-01-01"
}
```

**응답:**
```json
{
  "result": "Y",
  "data": {
    "total_distance": 12.5,
    "total_time": 150,
    "total_steps": 15203,
    "average_speed": 5.0,
    "battery_usage": 15,
    "log_count": 45
  }
}
```

### 3. 위치 경로 및 요약 정보 조회

**POST** `/member-location-logs`

```json
{
  "act": "get_location_path",
  "mt_idx": 1,
  "start_date": "2024-01-01",
  "end_date": "2024-01-01"
}
```

**응답:**
```json
{
  "result": "Y",
  "data": {
    "points": [
      {
        "lat": 37.5665,
        "lng": 126.9780,
        "timestamp": "2024-01-01T10:30:00",
        "accuracy": 5.0,
        "speed": 1.2,
        "battery": 85,
        "steps": 1500
      }
    ],
    "summary": {
      "total_distance": 12.5,
      "total_time": 150,
      "total_steps": 15203,
      "average_speed": 5.0,
      "battery_usage": 15,
      "log_count": 45
    }
  }
}
```

### 4. 위치 로그 생성

**POST** `/member-location-logs`

```json
{
  "act": "create_location_log",
  "mt_idx": 1,
  "mlt_lat": 37.5665,
  "mlt_long": 126.9780,
  "mlt_accuacy": 5.0,
  "mlt_speed": 1.2,
  "mlt_battery": 85,
  "mlt_fine_location": "Y",
  "mlt_location_chk": "Y",
  "mt_health_work": 1500,
  "mlt_gps_time": "2024-01-01T10:30:00"
}
```

### 5. 위치 로그 업데이트

**POST** `/member-location-logs`

```json
{
  "act": "update_location_log",
  "mlt_idx": 1,
  "mlt_lat": 37.5666,
  "mlt_long": 126.9781,
  "mlt_battery": 84
}
```

### 6. 위치 로그 삭제

**POST** `/member-location-logs`

```json
{
  "act": "delete_location_log",
  "mlt_idx": 1
}
```

### 7. 특정 날짜에 로그가 있는 회원 목록 조회

**POST** `/member-location-logs`

```json
{
  "act": "get_members_with_logs",
  "date": "2024-01-01"
}
```

**응답:**
```json
{
  "result": "Y",
  "data": {
    "member_ids": [1, 2, 3, 5, 8]
  }
}
```

### 8. 특정 회원의 특정 날짜 위치 로그 조회 (logs 페이지용)

**POST** `/member-location-logs`

```json
{
  "act": "get_daily_location_logs",
  "mt_idx": 282,
  "date": "2025-06-05",
  "limit": 1000,
  "offset": 0
}
```

**응답:**
```json
{
  "result": "Y",
  "data": [
    {
      "mlt_idx": 1,
      "mt_idx": 282,
      "mlt_lat": 37.5665,
      "mlt_long": 126.9780,
      "mlt_accuacy": 5.0,
      "mlt_speed": 1.2,
      "mlt_battery": 85,
      "mlt_gps_time": "2025-06-05T09:30:00",
      "mt_health_work": 1500
    }
  ]
}
```

### 9. 특정 회원의 특정 날짜 위치 로그 요약 정보 (logs 페이지용)

**POST** `/member-location-logs`

```json
{
  "act": "get_daily_location_summary",
  "mt_idx": 282,
  "date": "2025-06-05"
}
```

**응답:**
```json
{
  "result": "Y",
  "data": {
    "total_distance": 12.5,
    "total_time": 150,
    "total_steps": 8203,
    "average_speed": 5.0,
    "battery_usage": 15,
    "log_count": 45
  }
}
```

### 10. 특정 회원의 특정 날짜 위치 경로 및 요약 정보 (logs 페이지용)

**POST** `/member-location-logs`

```json
{
  "act": "get_daily_location_path",
  "mt_idx": 282,
  "date": "2025-06-05"
}
```

**응답:**
```json
{
  "result": "Y",
  "data": {
    "points": [
      {
        "lat": 37.5665,
        "lng": 126.9780,
        "timestamp": "2025-06-05T09:30:00",
        "accuracy": 5.0,
        "speed": 1.2,
        "battery": 85,
        "steps": 1500,
        "gps_time": "09:30:00"
      }
    ],
    "summary": {
      "total_distance": 12.5,
      "total_time": 150,
      "total_steps": 8203,
      "average_speed": 5.0,
      "battery_usage": 15,
      "log_count": 45
    }
  }
}
```

## REST API 엔드포인트 (선택사항)

### GET 방식 조회

#### 위치 로그 목록 조회
```
GET /member-location-logs/1?start_date=2024-01-01&end_date=2024-01-31&limit=100&offset=0
```

#### 위치 로그 요약 조회
```
GET /member-location-logs/1/summary?start_date=2024-01-01&end_date=2024-01-01
```

#### 위치 경로 조회
```
GET /member-location-logs/1/path?start_date=2024-01-01&end_date=2024-01-01
```

## 데이터 타입

### LocationSummaryResponse
- `total_distance`: 총 이동거리 (km)
- `total_time`: 총 이동시간 (분)
- `total_steps`: 총 걸음수
- `average_speed`: 평균 속도 (km/h)
- `battery_usage`: 배터리 사용량 (%)
- `log_count`: 로그 개수

### LocationPoint
- `lat`: 위도
- `lng`: 경도
- `timestamp`: GPS 시간 (ISO 형식)
- `accuracy`: 위치 정확도 (m)
- `speed`: 속도 (m/s)
- `battery`: 배터리 레벨 (%)
- `steps`: 걸음수

## 에러 처리

모든 API는 다음과 같은 형식으로 에러를 반환합니다:

```json
{
  "detail": "에러 메시지"
}
```

## 주의사항

1. **날짜 형식**: 모든 날짜는 `YYYY-MM-DD` 형식을 사용합니다.
2. **시간대**: GPS 시간은 UTC 기준입니다.
3. **거리 계산**: Haversine 공식을 사용하여 정확한 지구상 거리를 계산합니다.
4. **성능**: 대량의 데이터 조회 시 `limit`과 `offset`을 사용한 페이징을 권장합니다.
5. **파티셔닝**: 테이블이 월별로 파티셔닝되어 있으므로, 특정 월의 데이터 조회가 더 효율적입니다.

## 프론트엔드 연동 예시

```javascript
// 기존 위치 로그 요약 조회
const getLocationSummary = async (memberId, date) => {
  const response = await fetch('/api/v1/logs/member-location-logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      act: 'get_location_summary',
      mt_idx: memberId,
      start_date: date,
      end_date: date
    })
  });
  
  const data = await response.json();
  return data.data;
};

// logs 페이지용 특정 날짜 위치 로그 요약 조회
const getDailyLocationSummary = async (memberId, date) => {
  const response = await fetch('/api/v1/logs/member-location-logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      act: 'get_daily_location_summary',
      mt_idx: memberId,
      date: date  // YYYY-MM-DD 형식
    })
  });
  
  const data = await response.json();
  return data.data;
};

// logs 페이지용 특정 날짜 위치 경로 조회
const getDailyLocationPath = async (memberId, date) => {
  const response = await fetch('/api/v1/logs/member-location-logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      act: 'get_daily_location_path',
      mt_idx: memberId,
      date: date  // YYYY-MM-DD 형식
    })
  });
  
  const data = await response.json();
  return data.data;
};

// logs 페이지용 특정 날짜 위치 로그 목록 조회
const getDailyLocationLogs = async (memberId, date, limit = 1000) => {
  const response = await fetch('/api/v1/logs/member-location-logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      act: 'get_daily_location_logs',
      mt_idx: memberId,
      date: date,  // YYYY-MM-DD 형식
      limit: limit
    })
  });
  
  const data = await response.json();
  return data.data;
};
``` 