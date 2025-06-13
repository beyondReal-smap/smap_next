# UI 컴포넌트 가이드

이 디렉토리에는 프로젝트 전체에서 사용할 수 있는 통일된 UI 컴포넌트들이 포함되어 있습니다.

## 모달 컴포넌트

### 1. Modal (기본 모달)

가장 기본적인 모달 컴포넌트입니다. 다양한 옵션을 제공하여 유연하게 사용할 수 있습니다.

```tsx
import { Modal } from '@/components/ui';

<Modal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="모달 제목"
  size="md"
  position="center"
>
  <div className="p-6">
    모달 내용
  </div>
</Modal>
```

#### Props

- `isOpen`: boolean - 모달 표시 여부
- `onClose`: () => void - 모달 닫기 함수
- `children`: ReactNode - 모달 내용
- `title?`: string - 모달 제목 (선택사항)
- `size?`: 'sm' | 'md' | 'lg' | 'xl' | 'full' - 모달 크기 (기본값: 'md')
- `position?`: 'center' | 'bottom' | 'top' - 모달 위치 (기본값: 'center')
- `showCloseButton?`: boolean - X 버튼 표시 여부 (기본값: true)
- `closeOnOverlayClick?`: boolean - 오버레이 클릭 시 닫기 (기본값: true)
- `closeOnEscape?`: boolean - ESC 키로 닫기 (기본값: true)
- `zIndex?`: number - z-index 값 (기본값: 50)

### 2. ConfirmModal (확인/취소 모달)

사용자의 확인이 필요한 작업에 사용하는 모달입니다.

```tsx
import { ConfirmModal } from '@/components/ui';

<ConfirmModal
  isOpen={isConfirmOpen}
  onClose={() => setIsConfirmOpen(false)}
  message="정말 삭제하시겠습니까?"
  description="이 작업은 되돌릴 수 없습니다."
  confirmText="삭제"
  cancelText="취소"
  onConfirm={handleDelete}
  type="error"
  isLoading={isDeleting}
/>
```

#### Props

- 기본 Modal props 포함
- `message`: string - 확인 메시지
- `description?`: string - 상세 설명 (선택사항)
- `confirmText?`: string - 확인 버튼 텍스트 (기본값: '확인')
- `cancelText?`: string - 취소 버튼 텍스트 (기본값: '취소')
- `onConfirm`: () => void - 확인 버튼 클릭 핸들러
- `onCancel?`: () => void - 취소 버튼 클릭 핸들러 (선택사항)
- `type?`: 'info' | 'warning' | 'success' | 'error' - 모달 타입 (기본값: 'info')
- `isLoading?`: boolean - 로딩 상태 (기본값: false)

### 3. AlertModal (알림 모달)

단순한 알림이나 정보 전달에 사용하는 모달입니다.

```tsx
import { AlertModal } from '@/components/ui';

<AlertModal
  isOpen={isAlertOpen}
  onClose={() => setIsAlertOpen(false)}
  message="저장 완료"
  description="변경사항이 성공적으로 저장되었습니다."
  buttonText="확인"
  type="success"
/>
```

#### Props

- 기본 Modal props 포함
- `message`: string - 알림 메시지
- `description?`: string - 상세 설명 (선택사항)
- `buttonText?`: string - 버튼 텍스트 (기본값: '확인')
- `onConfirm?`: () => void - 버튼 클릭 핸들러 (선택사항)
- `type?`: 'info' | 'warning' | 'success' | 'error' - 모달 타입 (기본값: 'info')

## 모달 타입별 색상

각 타입별로 다른 색상과 아이콘이 적용됩니다:

- **info**: 파란색, 정보 아이콘
- **warning**: 노란색, 경고 아이콘
- **success**: 초록색, 체크 아이콘
- **error**: 빨간색, X 아이콘

## 사용 예시

### 기본 모달

```tsx
const [isOpen, setIsOpen] = useState(false);

return (
  <>
    <button onClick={() => setIsOpen(true)}>
      모달 열기
    </button>
    
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="설정"
      size="lg"
    >
      <div className="p-6">
        <p>설정 내용이 여기에 들어갑니다.</p>
      </div>
    </Modal>
  </>
);
```

### 삭제 확인 모달

```tsx
const [isDeleteOpen, setIsDeleteOpen] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);

const handleDelete = async () => {
  setIsDeleting(true);
  try {
    await deleteItem();
    setIsDeleteOpen(false);
  } catch (error) {
    console.error('삭제 실패:', error);
  } finally {
    setIsDeleting(false);
  }
};

return (
  <>
    <button onClick={() => setIsDeleteOpen(true)}>
      삭제
    </button>
    
    <ConfirmModal
      isOpen={isDeleteOpen}
      onClose={() => setIsDeleteOpen(false)}
      message="정말 삭제하시겠습니까?"
      description="삭제된 데이터는 복구할 수 없습니다."
      confirmText="삭제"
      cancelText="취소"
      onConfirm={handleDelete}
      type="error"
      isLoading={isDeleting}
    />
  </>
);
```

### 성공 알림 모달

```tsx
const [isSuccessOpen, setIsSuccessOpen] = useState(false);

const handleSave = async () => {
  try {
    await saveData();
    setIsSuccessOpen(true);
  } catch (error) {
    console.error('저장 실패:', error);
  }
};

return (
  <>
    <button onClick={handleSave}>
      저장
    </button>
    
    <AlertModal
      isOpen={isSuccessOpen}
      onClose={() => setIsSuccessOpen(false)}
      message="저장 완료"
      description="변경사항이 성공적으로 저장되었습니다."
      type="success"
      onConfirm={() => {
        setIsSuccessOpen(false);
        // 추가 작업 수행
      }}
    />
  </>
);
```

## 애니메이션

모든 모달 컴포넌트는 Framer Motion을 사용하여 부드러운 애니메이션을 제공합니다:

- **오버레이**: 페이드 인/아웃
- **중앙 모달**: 스케일 + 페이드 + 약간의 Y 이동
- **하단 모달**: 아래에서 위로 슬라이드
- **상단 모달**: 위에서 아래로 슬라이드

## 접근성

- ESC 키로 모달 닫기 지원
- 포커스 트랩 (모달 내부에서만 탭 이동)
- 스크린 리더 지원을 위한 적절한 ARIA 속성
- 키보드 네비게이션 지원

## 스타일 커스터마이징

필요에 따라 `className`, `overlayClassName`, `contentClassName` props를 사용하여 스타일을 커스터마이징할 수 있습니다:

```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  className="border-2 border-blue-500"
  overlayClassName="bg-blue-900/30"
  contentClassName="p-8"
>
  커스텀 스타일 모달
</Modal>
``` 