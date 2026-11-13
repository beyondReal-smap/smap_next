# /schedule 도메인 Go 점진 전환 (Strangler Fig)

Python(api3, 9000) 병행 유지하면서 `/api/v1/schedule/*` 7종만 Go(9200)로 보낸다.
롤백은 nginx location 한 블록 제거 + reload.

> ⚠️ 아래 명령은 **운영 변경**(systemd 등록 / nginx reload)이다. 대표님 승인 후 실행한다.
> 현재 9200은 임시 `nohup ./bin/api` 프로세스가 점유 중이므로, systemd 등록 전에 종료해야 한다.

## 전환 대상 (전부 이식·검증 완료)
- `GET  /api/v1/schedule/test-all-columns`
- `GET  /api/v1/schedule/owner-groups/all-schedules`
- `GET  /api/v1/schedule/group/{group_id}/schedules`
- `GET  /api/v1/schedule/debug/schedule/{schedule_id}`
- `POST /api/v1/schedule/group/{group_id}/schedules`
- `PUT  /api/v1/schedule/group/{group_id}/schedules/{schedule_id}`
- `DELETE /api/v1/schedule/group/{group_id}/schedules/{schedule_id}`

## 1) Go 바이너리 최신화
```bash
cd /data/wwwroot/smap_next/backend-go
/data/wwwroot/.tools/go1.26.2/bin/go build -o ./bin/api ./cmd/api
```

## 2) systemd 서비스 등록 (임시 프로세스 종료 → 등록 → 기동)
```bash
# (a) 임시 nohup 프로세스 종료(포트 9200 해제)
fuser -k 9200/tcp || true

# (b) 유닛 설치 + 기동
cp /data/wwwroot/smap_next/backend-go/deploy/smap-go-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now smap-go-api.service
systemctl status smap-go-api.service --no-pager

# (c) 헬스 확인(로컬)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9200/health   # 200 기대
```

## 3) nginx 라우팅 추가
`deploy/nginx-api3-schedule.conf` 의 location 블록을 `/etc/nginx/sites-available/api3.smap.site`
의 443 server 블록 안에 붙여넣은 뒤:
```bash
nginx -t                       # 문법 검증(필수)
systemctl reload nginx         # 무중단 reload
```

## 4) 검증 (전환 직후)
```bash
# /schedule(단수)가 Go로 가는지 — Go는 응답 헤더/동작이 동일해야 함
curl -s "https://api3.smap.site/api/v1/schedule/test-all-columns?current_user_id=1186" | head -c 200
# /schedules(복수)는 여전히 Python(9000)인지 — 영향 없어야 함
curl -s -o /dev/null -w "%{http_code}\n" "https://api3.smap.site/api/v1/schedules/?limit=1"
# 9200 직접 vs 게이트웨이 경유 동등성
diff <(curl -s "http://127.0.0.1:9200/api/v1/schedule/debug/schedule/222216") \
     <(curl -s "https://api3.smap.site/api/v1/schedule/debug/schedule/222216")
```

## 5) 롤백 (즉시)
```bash
# api3.smap.site 에서 location /api/v1/schedule/ 블록 제거 후
nginx -t && systemctl reload nginx
# (Go 서비스는 켜둬도 무해 — 트래픽만 Python으로 복귀)
```

## 알아둘 점 / 잔여 리스크
- **FCM**: Go에 firebase 자격증명 미설정 → 일정 생성/수정/삭제 푸시는 실발송 안 됨(Python도 원본 버그로 0건이라 실발송 회귀 없음). 단 Go는 `push_log_t`에 status=3(실패) 1건씩 기록(Python 0건) = 대표님이 선택한 의도된 divergence. 실발송까지 원하면 `../backend/.env`에 `FIREBASE_CREDENTIALS_JSON`(또는 `_PATH`) 추가 필요.
- **검증 범위**: byte/DB 동등은 그룹 641 / 사용자 1186 시나리오로 수행. 충실 이식이라 로직은 일반적이나, 전환 후 다른 그룹 트래픽도 한 번 모니터링 권장.
- **에러 응답 문자열**: DB 제약 위반(예: sst_alram 'N' 1366) 500의 detail 문자열은 드라이버 차이로 상이(상태 코드 500은 동일).
- **api4.smap.site**: 본 점진 전환에서는 사용하지 않음(sites-available의 api4 파일은 별도 방식 잔재).
