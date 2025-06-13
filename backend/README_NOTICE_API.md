# 공지사항 API 문서

## 개요
공지사항 관리를 위한 RESTful API입니다. 공지사항의 생성, 조회, 수정, 삭제 및 검색 기능을 제공합니다.

## 데이터베이스 테이블 구조

### notice_t 테이블
```sql
CREATE TABLE `notice_t` (
  `nt_idx` int(11) NOT NULL AUTO_INCREMENT,
  `mt_idx` int(11) DEFAULT NULL COMMENT '관리자idx',
  `nt_title` varchar(200) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL COMMENT '제목',
  `nt_file1` varchar(50) DEFAULT NULL COMMENT '첨부파일',
  `nt_content` mediumtext CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL COMMENT '내용',
  `nt_show` enum('Y','N') CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT 'Y' COMMENT '노출여부 Y:노출, N:노출안함',
  `nt_hit` int(11) DEFAULT NULL COMMENT '조회수',
  `nt_wdate` datetime DEFAULT NULL COMMENT '등록일시',
  `nt_uwdate` datetime DEFAULT NULL COMMENT '수정일시',
  PRIMARY KEY (`nt_idx`) USING BTREE,
  KEY `nt_title` (`nt_title`),
  KEY `nt_show` (`nt_show`)
) ENGINE=MyISAM AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='공지사항 테이블';
```

## API 엔드포인트

### 1. 공지사항 목록 조회 (페이지네이션)
```
GET /api/v1/notices/
```

**쿼리 파라미터:**
- `page` (int, optional): 페이지 번호 (기본값: 1)
- `size` (int, optional): 페이지 크기 (기본값: 20, 최대: 100)
- `show_only` (bool, optional): 노출된 공지사항만 조회 (기본값: true)

**응답 예시:**
```json
{
  "notices": [
    {
      "nt_idx": 1,
      "nt_title": "공지사항 제목",
      "nt_content": "공지사항 내용...",
      "nt_hit": 10,
      "nt_wdate": "2024-01-01T00:00:00"
    }
  ],
  "total": 50,
  "page": 1,
  "size": 20,
  "total_pages": 3
}
```

### 2. 공지사항 검색
```
GET /api/v1/notices/search
```

**쿼리 파라미터:**
- `keyword` (str, required): 검색 키워드
- `skip` (int, optional): 건너뛸 개수 (기본값: 0)
- `limit` (int, optional): 조회할 개수 (기본값: 20, 최대: 100)
- `show_only` (bool, optional): 노출된 공지사항만 조회 (기본값: true)

**응답 예시:**
```json
[
  {
    "nt_idx": 1,
    "nt_title": "검색된 공지사항",
    "nt_content": "검색 키워드가 포함된 내용...",
    "nt_hit": 5,
    "nt_wdate": "2024-01-01T00:00:00"
  }
]
```

### 3. 공지사항 상세 조회
```
GET /api/v1/notices/{notice_id}
```

**경로 파라미터:**
- `notice_id` (int, required): 공지사항 ID

**쿼리 파라미터:**
- `increment_hit` (bool, optional): 조회수 증가 여부 (기본값: true)

**응답 예시:**
```json
{
  "nt_idx": 1,
  "nt_title": "공지사항 제목",
  "nt_content": "공지사항 상세 내용...",
  "nt_file1": "attachment.pdf",
  "nt_hit": 11,
  "nt_wdate": "2024-01-01T00:00:00",
  "nt_uwdate": "2024-01-01T00:00:00"
}
```

### 4. 공지사항 생성 (관리자 전용)
```
POST /api/v1/notices/
```

**요청 본문:**
```json
{
  "mt_idx": 1,
  "nt_title": "새 공지사항 제목",
  "nt_content": "새 공지사항 내용",
  "nt_file1": "attachment.pdf",
  "nt_show": "Y"
}
```

**응답 예시:**
```json
{
  "nt_idx": 2,
  "nt_title": "새 공지사항 제목",
  "nt_content": "새 공지사항 내용",
  "nt_file1": "attachment.pdf",
  "nt_hit": 0,
  "nt_wdate": "2024-01-01T00:00:00",
  "nt_uwdate": "2024-01-01T00:00:00"
}
```

### 5. 공지사항 수정 (관리자 전용)
```
PUT /api/v1/notices/{notice_id}
```

**경로 파라미터:**
- `notice_id` (int, required): 수정할 공지사항 ID

**요청 본문:**
```json
{
  "nt_title": "수정된 제목",
  "nt_content": "수정된 내용",
  "nt_show": "Y"
}
```

### 6. 공지사항 삭제 (관리자 전용)
```
DELETE /api/v1/notices/{notice_id}
```

**경로 파라미터:**
- `notice_id` (int, required): 삭제할 공지사항 ID

**응답 예시:**
```json
{
  "message": "공지사항이 삭제되었습니다."
}
```

### 7. 공지사항 숨김 처리 (관리자 전용)
```
PATCH /api/v1/notices/{notice_id}/hide
```

**경로 파라미터:**
- `notice_id` (int, required): 숨길 공지사항 ID

### 8. 공지사항 노출 처리 (관리자 전용)
```
PATCH /api/v1/notices/{notice_id}/show
```

**경로 파라미터:**
- `notice_id` (int, required): 노출할 공지사항 ID

## 데이터 모델

### NoticeResponse
```python
{
  "nt_idx": int,           # 공지사항 ID
  "nt_title": str,         # 제목
  "nt_content": str,       # 내용
  "nt_file1": str | None,  # 첨부파일
  "nt_hit": int,           # 조회수
  "nt_wdate": datetime,    # 등록일시
  "nt_uwdate": datetime    # 수정일시
}
```

### NoticeListResponse
```python
{
  "nt_idx": int,           # 공지사항 ID
  "nt_title": str,         # 제목
  "nt_content": str,       # 내용 (요약)
  "nt_hit": int,           # 조회수
  "nt_wdate": datetime     # 등록일시
}
```

### NoticeCreate
```python
{
  "mt_idx": int | None,    # 관리자 ID
  "nt_title": str,         # 제목 (필수)
  "nt_content": str,       # 내용 (필수)
  "nt_file1": str | None,  # 첨부파일
  "nt_show": "Y" | "N"     # 노출여부
}
```

### NoticeUpdate
```python
{
  "nt_title": str | None,  # 제목
  "nt_content": str | None,# 내용
  "nt_file1": str | None,  # 첨부파일
  "nt_show": "Y" | "N"     # 노출여부
}
```

## 에러 응답

### 404 Not Found
```json
{
  "detail": "공지사항을 찾을 수 없습니다."
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "nt_title"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

## 사용 예시

### Python (requests)
```python
import requests

# 공지사항 목록 조회
response = requests.get("http://localhost:8000/api/v1/notices/")
notices = response.json()

# 공지사항 상세 조회
response = requests.get("http://localhost:8000/api/v1/notices/1")
notice = response.json()

# 공지사항 검색
response = requests.get("http://localhost:8000/api/v1/notices/search?keyword=중요")
search_results = response.json()

# 공지사항 생성 (관리자)
notice_data = {
    "mt_idx": 1,
    "nt_title": "새 공지사항",
    "nt_content": "공지사항 내용입니다."
}
response = requests.post("http://localhost:8000/api/v1/notices/", json=notice_data)
new_notice = response.json()
```

### JavaScript (fetch)
```javascript
// 공지사항 목록 조회
const response = await fetch('/api/v1/notices/');
const notices = await response.json();

// 공지사항 상세 조회
const noticeResponse = await fetch('/api/v1/notices/1');
const notice = await noticeResponse.json();

// 공지사항 검색
const searchResponse = await fetch('/api/v1/notices/search?keyword=중요');
const searchResults = await searchResponse.json();

// 공지사항 생성 (관리자)
const createResponse = await fetch('/api/v1/notices/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mt_idx: 1,
    nt_title: '새 공지사항',
    nt_content: '공지사항 내용입니다.'
  })
});
const newNotice = await createResponse.json();
```

## 주요 기능

1. **페이지네이션**: 대량의 공지사항을 효율적으로 조회
2. **검색 기능**: 제목과 내용에서 키워드 검색
3. **조회수 관리**: 공지사항 조회 시 자동으로 조회수 증가
4. **노출 관리**: 공지사항의 노출/숨김 상태 관리
5. **관리자 기능**: 공지사항 생성, 수정, 삭제 권한 관리
6. **첨부파일 지원**: 공지사항에 첨부파일 연결 가능

## 보안 고려사항

1. **관리자 권한**: 생성, 수정, 삭제 기능은 관리자 권한 확인 필요
2. **입력 검증**: 모든 입력 데이터에 대한 유효성 검사
3. **SQL 인젝션 방지**: SQLAlchemy ORM 사용으로 안전한 쿼리 실행
4. **XSS 방지**: 사용자 입력 데이터 적절한 이스케이프 처리

## 성능 최적화

1. **인덱스 활용**: 제목과 노출여부 필드에 인덱스 설정
2. **페이지네이션**: 대량 데이터 조회 시 메모리 효율성
3. **조건부 조회수 증가**: 필요한 경우에만 조회수 증가
4. **캐싱**: 자주 조회되는 공지사항에 대한 캐싱 고려 