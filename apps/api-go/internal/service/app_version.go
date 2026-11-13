// Package service는 비즈니스 로직을 담는다 (handler → service → repository 단방향).
package service

import (
	"strconv"
	"strings"

	"github.com/bluemusk/smap_next_go/internal/dto"
)

// AppVersionService는 Python `app/api/v1/endpoints/app_version.py`의 로직을 이식한다.
// DB·외부 의존이 없는 순수 버전 비교 로직.
type AppVersionService struct {
	minAndroid string
	minIOS     string
}

// NewAppVersion은 설정의 최소 지원 버전(Android/iOS)을 주입받는다.
func NewAppVersion(minAndroid, minIOS string) *AppVersionService {
	return &AppVersionService{minAndroid: minAndroid, minIOS: minIOS}
}

// parseVersion은 Python `_parse_version`과 동등하다.
// '3.0.8' 같은 점 구분 버전을 정수 슬라이스로 변환. 비숫자/공백 chunk는
// 숫자만 추출(없으면 0). 빈 입력이면 [0].
func parseVersion(v string) []int {
	parts := make([]int, 0, 4)
	for _, chunk := range strings.Split(v, ".") {
		chunk = strings.TrimSpace(chunk)
		if n, err := strconv.Atoi(chunk); err == nil {
			parts = append(parts, n)
			continue
		}
		// 비숫자 chunk: 포함된 숫자만 추출 (Python: c for c in chunk if c.isdigit()).
		var sb strings.Builder
		for _, c := range chunk {
			if c >= '0' && c <= '9' {
				sb.WriteRune(c)
			}
		}
		digits := sb.String()
		if digits == "" {
			parts = append(parts, 0)
		} else {
			n, _ := strconv.Atoi(digits)
			parts = append(parts, n)
		}
	}
	if len(parts) == 0 {
		return []int{0}
	}
	return parts
}

// compareVersions는 Python 튜플 비교(`<`)와 동등하다.
// 요소별 사전식 비교 후, 공통 prefix가 같으면 짧은 쪽이 작다.
// a<b → -1, a==b → 0, a>b → 1.
func compareVersions(a, b []int) int {
	n := len(a)
	if len(b) < n {
		n = len(b)
	}
	for i := 0; i < n; i++ {
		if a[i] < b[i] {
			return -1
		}
		if a[i] > b[i] {
			return 1
		}
	}
	switch {
	case len(a) < len(b):
		return -1
	case len(a) > len(b):
		return 1
	default:
		return 0
	}
}

// isLower는 Python `_is_lower`와 동등: current < minimum 이면 true.
func isLower(current, minimum string) bool {
	return compareVersions(parseVersion(current), parseVersion(minimum)) < 0
}

// VersionCheck는 Python `version_check` 핸들러 로직과 동등하다.
// platform이 "ios"가 아니면 전부 android로 취급한다.
func (s *AppVersionService) VersionCheck(platform, version string) dto.VersionCheckResponse {
	plat := strings.ToLower(platform)
	minV := s.minAndroid
	if plat == "ios" {
		minV = s.minIOS
	}
	needsUpdate := isLower(version, minV)
	return dto.VersionCheckResponse{
		Platform:            plat,
		CurrentVersion:      version,
		MinSupportedVersion: minV,
		UpdateRequired:      needsUpdate,
		ForceUpdate:         needsUpdate,
	}
}
