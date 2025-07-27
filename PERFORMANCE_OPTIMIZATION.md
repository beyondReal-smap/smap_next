# SMAP 성능 최적화 가이드

## 🚀 성능 최적화 완료 사항

### 1. CLS (Cumulative Layout Shift) 개선 - 목표: 0.1 이하

#### 주요 수정사항:
- **고정 크기 컨테이너**: 모든 이미지와 컴포넌트에 고정 크기 적용
- **폰트 최적화**: `font-display: swap` 및 폴백 폰트 설정
- **스켈레톤 로딩**: 콘텐츠 로딩 전 고정 크기 스켈레톤 표시
- **헤더/네비게이션 고정**: 명시적 높이 설정으로 레이아웃 시프트 방지

#### 적용된 CSS 클래스:
```css
.prevent-layout-shift { contain: layout style paint; }
.avatar-container { width: 48px; height: 48px; flex-shrink: 0; }
.header-fixed { height: 64px !important; min-height: 64px !important; }
.navigation-fixed { height: 80px !important; min-height: 80px !important; }
```

### 2. LCP (Largest Contentful Paint) 개선 - 목표: 2.5초 이하

#### 주요 수정사항:
- **이미지 최적화**: WebP/AVIF 포맷 사용, 적절한 크기 조정
- **폰트 프리로드**: 중요 폰트 파일 사전 로딩
- **Critical CSS**: 중요 스타일을 인라인으로 배치
- **리소스 힌트**: DNS prefetch, preconnect 추가

#### 적용된 최적화:
```html
<link rel="preload" href="/fonts/LINESeedKR-Rg.woff2" as="font" type="font/woff2" crossOrigin="" />
<link rel="dns-prefetch" href="//nextstep.smap.site" />
<link rel="preconnect" href="https://nextstep.smap.site" />
```

### 3. 이미지 최적화

#### OptimizedImage 컴포넌트 개선:
- **Aspect Ratio 지원**: CLS 방지를 위한 가로세로 비율 설정
- **Progressive Loading**: 블러 → 실제 이미지 점진적 로딩
- **Error Handling**: 로딩 실패 시 적절한 폴백 표시
- **Lazy Loading**: 화면에 보일 때만 로딩

#### 사용 예시:
```tsx
<OptimizedImage
  src="/image.jpg"
  alt="설명"
  width={300}
  height={200}
  aspectRatio={1.5}
  priority={true} // LCP 이미지인 경우
  className="prevent-layout-shift"
/>
```

### 4. 코드 분할 및 번들 최적화

#### Next.js 설정 개선:
- **패키지 최적화**: `optimizePackageImports` 설정
- **CSS 최적화**: `optimizeCss: true`
- **프로덕션 최적화**: console.log 제거, 압축 최적화

### 5. 폰트 최적화

#### 폰트 로딩 전략:
- **font-display: swap**: 폴백 폰트 즉시 표시
- **Preload**: 중요 폰트 파일 사전 로딩
- **Fallback Chain**: 시스템 폰트로 안전한 폴백

## 📊 성능 측정 도구

### 1. Vercel Speed Insights
- **실제 사용자 데이터** 기반 성능 측정
- **Core Web Vitals** 모니터링
- **지역별/기기별** 성능 분석

### 2. Lighthouse 측정
```bash
# 로컬 성능 측정
npm run lighthouse

# 또는 Chrome DevTools에서 Lighthouse 탭 사용
```

### 3. 성능 모니터링 컴포넌트
```tsx
import { PerformanceOptimizer } from '@/components/LoadingOptimizer'

<PerformanceOptimizer>
  <YourComponent />
</PerformanceOptimizer>
```

## 🎯 성능 개선 결과 목표

### Before → After 예상 결과:
- **CLS**: 2.0 → 0.1 이하 ✅
- **LCP**: 3.66s → 2.5s 이하 ✅
- **FCP**: 2.06s → 1.8s 이하 ✅
- **INP**: 56ms → 200ms 이하 ✅

## 🛠️ 개발자 가이드

### 1. 새 컴포넌트 개발 시 주의사항:

#### 이미지 사용:
```tsx
// ❌ 잘못된 예시
<img src="/image.jpg" alt="설명" />

// ✅ 올바른 예시
<OptimizedImage 
  src="/image.jpg" 
  alt="설명" 
  width={300} 
  height={200}
  aspectRatio={1.5}
  className="prevent-layout-shift"
/>
```

#### 레이아웃 고정:
```tsx
// ❌ 잘못된 예시
<div className="flex items-center">
  <img src="/avatar.jpg" className="rounded-full" />
  <div>사용자 정보</div>
</div>

// ✅ 올바른 예시
<div className="flex items-center list-item">
  <div className="avatar-container">
    <OptimizedImage src="/avatar.jpg" aspectRatio={1} />
  </div>
  <div>사용자 정보</div>
</div>
```

### 2. 스켈레톤 로딩 적용:
```tsx
import { ListSkeleton } from '@/components/LoadingOptimizer'

function UserList() {
  if (loading) return <ListSkeleton count={5} />
  
  return (
    <div className="prevent-layout-shift">
      {users.map(user => <UserItem key={user.id} user={user} />)}
    </div>
  )
}
```

### 3. 지연 로딩 적용:
```tsx
import { withLazyLoading } from '@/components/LoadingOptimizer'

const HeavyComponent = withLazyLoading(
  () => import('./HeavyComponent'),
  () => <div className="skeleton h-32 bg-gray-200 rounded" />
)
```

## 🔍 성능 모니터링

### 1. 지속적인 모니터링:
- **Vercel Speed Insights**: 실제 사용자 성능 데이터
- **Lighthouse CI**: 빌드 시 성능 체크
- **Core Web Vitals**: Google Search Console

### 2. 성능 예산 설정:
- **LCP < 2.5초**
- **FID < 100ms**
- **CLS < 0.1**
- **번들 크기 < 250KB (gzipped)**

## 📈 지속적인 개선

### 1. 정기 성능 점검:
- **주간**: Vercel Speed Insights 확인
- **월간**: Lighthouse 점수 분석
- **분기**: 성능 최적화 리뷰

### 2. 추가 최적화 계획:
- **Service Worker**: 캐싱 전략 개선
- **CDN**: 이미지 및 정적 자원 CDN 적용
- **HTTP/3**: 차세대 프로토콜 적용 검토

---

이 가이드를 따라 개발하면 **Core Web Vitals**에서 우수한 성능을 달성할 수 있습니다. 🚀 