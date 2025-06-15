# 햅틱 피드백 사용 가이드

iOS 앱에서 사용자 경험을 향상시키기 위한 햅틱 피드백 구현 가이드입니다.

## 햅틱 피드백 종류

### 1. Impact Feedback (충격 피드백)
- **Light**: 가벼운 터치, 일반적인 버튼 클릭
- **Medium**: 중간 강도, 중요한 액션
- **Heavy**: 강한 충격, 경고나 중요한 이벤트

### 2. Notification Feedback (알림 피드백)
- **Success**: 성공적인 작업 완료
- **Warning**: 경고 상황
- **Error**: 오류 발생

### 3. Selection Feedback (선택 피드백)
- **Selection**: 탭 전환, 선택 변경

## 사용법

### 기본 훅 사용
```tsx
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

function MyComponent() {
  const { haptic, isIOS } = useHapticFeedback()

  const handleClick = () => {
    haptic.light() // 가벼운 햅틱
  }

  return (
    <button onClick={handleClick}>
      클릭하세요
    </button>
  )
}
```

### Button 컴포넌트 사용
```tsx
import { Button } from '@/components/ui/Button'

function MyPage() {
  return (
    <div>
      {/* 자동 햅틱 (variant에 따라) */}
      <Button variant="success">저장</Button>
      
      {/* 수동 햅틱 지정 */}
      <Button hapticType="heavy">삭제</Button>
    </div>
  )
}
```

### Toast와 함께 사용
```tsx
import { useToast } from '@/hooks/useToast'

function MyComponent() {
  const { success, error } = useToast()

  const handleSave = async () => {
    try {
      // API 호출
      success('저장되었습니다!') // 성공 햅틱 자동 실행
    } catch (err) {
      error('저장에 실패했습니다.') // 에러 햅틱 자동 실행
    }
  }
}
```

## 햅틱 사용 가이드라인

### 언제 사용할까요?

#### Light Haptic
- 일반 버튼 클릭
- 리스트 아이템 선택
- 키보드 입력
- 스위치 토글

#### Medium Haptic
- 중요한 버튼 (저장, 전송)
- 모달 열기/닫기
- 카메라 촬영
- 새로고침

#### Heavy Haptic
- 삭제 버튼
- 경고 확인
- 중요한 설정 변경
- 결제 완료

#### Success Haptic
- 성공적인 저장
- 로그인 성공
- 결제 완료
- 파일 업로드 완료

#### Warning Haptic
- 입력 검증 실패
- 네트워크 연결 문제
- 배터리 부족 경고

#### Error Haptic
- 로그인 실패
- API 오류
- 파일 업로드 실패
- 치명적인 오류

#### Selection Haptic
- 탭 바 전환
- 세그먼트 컨트롤 변경
- 드롭다운 선택
- 슬라이더 값 변경

### 주의사항

1. **과도한 사용 금지**: 모든 상호작용에 햅틱을 추가하지 마세요
2. **컨텍스트 고려**: 상황에 맞는 적절한 햅틱을 선택하세요
3. **iOS 전용**: Android에서는 자동으로 무시됩니다
4. **배터리 고려**: 과도한 햅틱은 배터리를 소모합니다
5. **접근성**: 햅틱은 보조 기능이며 주요 피드백이 되어서는 안 됩니다

## 구현 세부사항

### iOS Native (Swift)
```swift
// MainView.swift에 구현됨
private func triggerLightHaptic() {
    let impactFeedback = UIImpactFeedbackGenerator(style: .light)
    impactFeedback.impactOccurred()
}
```

### JavaScript Bridge
```javascript
// iOS 브릿지를 통한 호출
window.webkit.messageHandlers.smapIos.postMessage({
    type: 'haptic',
    param: 'light'
});
```

### React Hook
```typescript
// useHapticFeedback.ts
const sendHapticMessage = (type: string) => {
  if (isIOS && (window as any).webkit?.messageHandlers?.smapIos) {
    (window as any).webkit.messageHandlers.smapIos.postMessage({
      type: 'haptic',
      param: type
    });
  }
};
```

## 테스트

1. iOS 디바이스에서 앱 실행
2. 각 햅틱 타입별로 동작 확인
3. 소리 꺼짐 모드에서도 햅틱 동작 확인
4. 배터리 절약 모드에서의 동작 확인

햅틱 피드백으로 더 나은 사용자 경험을 만들어보세요! 🎯 