/**
 * 이미지 처리 관련 유틸리티 함수들
 * member_t.mt_file1 컬럼의 이미지 경로를 안전하게 처리
 */

// 기본 이미지 경로들
const DEFAULT_IMAGES = [
  '/images/avatar1.png',
  '/images/avatar2.png', 
  '/images/avatar3.png',
  '/images/avatar4.png'
];

const MALE_IMAGES = [
  '/images/male_1.png',
  '/images/male_2.png',
  '/images/male_3.png',
  '/images/male_4.png'
];

const FEMALE_IMAGES = [
  '/images/female_1.png',
  '/images/female_2.png',
  '/images/female_3.png',
  '/images/female_4.png'
];

/**
 * 성별과 인덱스에 따른 기본 이미지 반환
 */
export const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const defaultImages = DEFAULT_IMAGES;
  const maleImages = MALE_IMAGES;
  const femaleImages = FEMALE_IMAGES;

  if (gender === 1) {
    return maleImages[index % maleImages.length];
  } else if (gender === 2) {
    return femaleImages[index % femaleImages.length];
  }

  return defaultImages[index % defaultImages.length];
};

/**
 * mt_file1 경로를 안전하게 처리하여 이미지 URL 반환
 * @param mtFile1 - member_t.mt_file1 컬럼 값
 * @param gender - 성별 (1: 남성, 2: 여성)
 * @param index - 멤버 인덱스 (기본 이미지 선택용)
 * @returns 안전한 이미지 URL
 */
export const getSafeImageUrl = (
  mtFile1: string | null | undefined, 
  gender: number | null | undefined, 
  index: number
): string => {
  // mt_file1이 없거나 빈 문자열인 경우 기본 이미지 사용
  if (!mtFile1 || mtFile1.trim() === '') {
    return getDefaultImage(gender, index);
  }

  // 이미 완전한 URL인 경우 (http/https로 시작)
  if (mtFile1.startsWith('http://') || mtFile1.startsWith('https://')) {
    return mtFile1;
  }

  // 상대 경로인 경우 /images/ 경로 추가
  if (mtFile1.startsWith('/')) {
    return mtFile1;
  }

  // 파일명만 있는 경우 /images/ 경로 추가
  return `/images/${mtFile1}`;
};

/**
 * 이미지 로딩 실패 시 fallback 처리
 * @param element - 이미지 엘리먼트
 * @param gender - 성별
 * @param index - 멤버 인덱스
 */
export const handleImageError = (
  element: HTMLImageElement, 
  gender: number | null | undefined, 
  index: number
): void => {
  const fallbackSrc = getDefaultImage(gender, index);
  element.src = fallbackSrc;
  element.onerror = null; // 무한 루프 방지
};

/**
 * 마커용 이미지 URL 생성 (마커는 작은 크기이므로 최적화)
 * @param mtFile1 - member_t.mt_file1 컬럼 값
 * @param gender - 성별
 * @param index - 멤버 인덱스
 * @returns 마커용 이미지 URL
 */
export const getMarkerImageUrl = (
  mtFile1: string | null | undefined,
  gender: number | null | undefined,
  index: number
): string => {
  return getSafeImageUrl(mtFile1, gender, index);
};

/**
 * 프로필용 이미지 URL 생성 (프로필은 큰 크기이므로 고품질)
 * @param mtFile1 - member_t.mt_file1 컬럼 값
 * @param gender - 성별
 * @param index - 멤버 인덱스
 * @returns 프로필용 이미지 URL
 */
export const getProfileImageUrl = (
  mtFile1: string | null | undefined,
  gender: number | null | undefined,
  index: number
): string => {
  return getSafeImageUrl(mtFile1, gender, index);
};
