# 🚀 Fixie 프록시 즉시 설정 가이드

## ✅ Fixie 프록시 정보

```
Proxy URL: http://fixie:ofWiJprsxRI92iE@criterium.usefixie.com:80

고정 IP 주소:
- 52.5.155.132
- 52.87.82.133
```

---

## 📋 설정 체크리스트

### ✅ 1단계: 알리고 SMS 서비스에 IP 등록

1. 알리고 관리자 페이지 접속: https://smartsms.aligo.in/
2. 로그인 (계정: smap2023)
3. **IP 화이트리스트 설정** 메뉴로 이동
4. 다음 2개의 IP 주소를 등록:
   ```
   52.5.155.132
   52.87.82.133
   ```

### ✅ 2단계: Vercel 백엔드 환경 변수 설정

**Vercel 대시보드 → Backend 프로젝트 → Settings → Environment Variables**

다음 환경 변수를 추가 (모든 환경: Production, Preview, Development):

```bash
FIXIE_URL=http://fixie:ofWiJprsxRI92iE@criterium.usefixie.com:80
```

**⚠️ 주의**: 기존 알리고 설정은 그대로 유지:
```bash
ALIGO_USER_ID=smap2023
ALIGO_KEY=6uvw7alcd1v1u6dx5thv31lzic8mxfrt
ALIGO_SENDER=070-8065-2207
```

### ✅ 3단계: 로컬 개발 환경 설정 (선택사항)

**backend/.env** 파일에 추가:

```bash
# Fixie 프록시 설정
FIXIE_URL=http://fixie:ofWiJprsxRI92iE@criterium.usefixie.com:80

# 알리고 SMS API 설정
ALIGO_USER_ID=smap2023
ALIGO_KEY=6uvw7alcd1v1u6dx5thv31lzic8mxfrt
ALIGO_SENDER=070-8065-2207
```

### ✅ 4단계: 백엔드 재배포

환경 변수 설정 후 백엔드를 재배포:

```bash
# Vercel CLI 사용
cd backend
vercel --prod

# 또는 Vercel 대시보드에서 "Redeploy" 버튼 클릭
```

---

## 🧪 테스트 방법

### 1. API 직접 테스트

```bash
# 인증번호 발송 테스트
curl -X POST https://api3.smap.site/api/v1/sms/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "01012345678"}'

# 예상 응답
{
  "success": true,
  "code": "123456"
}
```

### 2. 프론트엔드에서 테스트

1. 회원가입 페이지 접속
2. 휴대폰 번호 입력
3. "인증번호 발송" 버튼 클릭
4. SMS 수신 확인

### 3. 로그 확인

Vercel 대시보드 → Backend 프로젝트 → Logs에서 다음 메시지 확인:

```
🔒 Fixie 프록시 사용: criterium.usefixie.com:80
📱 SMS 발송 시도: 010***
🔒 프록시를 통해 SMS 발송
✅ SMS 발송 성공: 010***
```

---

## 🔍 문제 해결

### ❌ 문제: SMS 발송 실패 - IP 인증 오류

**원인**: 알리고에 IP가 등록되지 않음

**해결**:
1. 알리고 관리자 페이지에서 IP 화이트리스트 확인
2. 다음 IP가 등록되어 있는지 확인:
   - 52.5.155.132
   - 52.87.82.133
3. 등록 후 5-10분 대기 (반영 시간)

### ❌ 문제: 환경 변수를 찾을 수 없음

**원인**: Vercel 환경 변수 미설정 또는 재배포 안 함

**해결**:
1. Vercel 대시보드에서 환경 변수 확인
2. `FIXIE_URL` 변수가 있는지 확인
3. 백엔드 재배포

### ❌ 문제: 프록시 연결 실패

**원인**: Fixie URL이 잘못되었거나 Fixie 서비스 문제

**해결**:
1. Fixie URL 확인: `http://fixie:ofWiJprsxRI92iE@criterium.usefixie.com:80`
2. Fixie 대시보드에서 서비스 상태 확인
3. Fixie 무료 플랜 한도 확인 (월 500 요청)

---

## 📊 작동 흐름

```
사용자 (회원가입)
    ↓
프론트엔드 (Vercel) - sendVerificationCode()
    ↓
백엔드 API (Vercel) - POST /api/v1/sms/send-verification-code
    ↓
SMSService (Fixie 프록시 사용)
    ↓
Fixie 프록시 (고정 IP: 52.5.155.132, 52.87.82.133)
    ↓
알리고 SMS API (IP 화이트리스트 확인)
    ↓
사용자 휴대폰 (SMS 수신)
```

---

## 💰 Fixie 요금 정보

현재 사용 중인 플랜 확인: https://usefixie.com/dashboard

- **무료 플랜**: 월 500 요청
- **Starter**: 월 $5 - 5,000 요청
- **Business**: 월 $50 - 50,000 요청

**권장**: SMS 발송량에 따라 플랜 업그레이드

---

## 📞 지원 연락처

- **Fixie 지원**: support@usefixie.com
- **알리고 고객센터**: 1661-5179
- **Fixie 대시보드**: https://usefixie.com/dashboard

---

## ⚠️ 보안 주의사항

1. **Fixie URL 노출 금지**: 
   - GitHub에 커밋하지 말 것
   - 환경 변수로만 관리
   - `.env` 파일은 `.gitignore`에 포함

2. **IP 변경 모니터링**:
   - Fixie IP가 변경될 경우 알리고에 재등록 필요
   - 정기적으로 Fixie 대시보드 확인

3. **API 키 보안**:
   - 알리고 API 키도 환경 변수로 관리
   - 주기적으로 키 변경 권장

---

## ✅ 설정 완료 확인

모든 설정이 완료되면 다음을 확인하세요:

- [ ] 알리고에 Fixie IP 2개 등록 완료
- [ ] Vercel 백엔드에 `FIXIE_URL` 환경 변수 설정
- [ ] 백엔드 재배포 완료
- [ ] 테스트 SMS 발송 성공
- [ ] 로그에서 "🔒 Fixie 프록시 사용" 메시지 확인

모두 체크되면 설정 완료! 🎉

