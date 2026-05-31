// Package dto는 외부 노출용 요청/응답 구조체를 담는다 (DB 모델과 분리).
package dto

// VersionCheckResponse는 Python `/app/version-check` 응답과 키/타입이 100% 동일하다.
// 키 순서까지 Python dict 정의 순서를 따른다.
type VersionCheckResponse struct {
	Platform            string `json:"platform"`
	CurrentVersion      string `json:"current_version"`
	MinSupportedVersion string `json:"min_supported_version"`
	UpdateRequired      bool   `json:"update_required"`
	// 정책상 update_required와 동일하지만, 분리 대비 키만 분리(Python 주석과 동일).
	ForceUpdate bool `json:"force_update"`
}
