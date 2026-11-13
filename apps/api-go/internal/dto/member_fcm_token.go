package dto

// MemberFCMTokenResponse는 Python MemberFCMTokenResponse 스키마이다(register/check-and-update 등 공용).
type MemberFCMTokenResponse struct {
	Success      bool    `json:"success"`
	Message      string  `json:"message"`
	MtIdx        int     `json:"mt_idx"`
	HasToken     bool    `json:"has_token"`
	TokenPreview *string `json:"token_preview"`
}

// MemberFCMTokenStatusResponse는 Python MemberFCMTokenStatusResponse 스키마이다(/status/{mt_idx}).
type MemberFCMTokenStatusResponse struct {
	MtIdx             int     `json:"mt_idx"`
	HasToken          bool    `json:"has_token"`
	TokenPreview      *string `json:"token_preview"`
	MtLevel           *int    `json:"mt_level"`
	MtStatus          *int    `json:"mt_status"`
	LastUpdated       *string `json:"last_updated"`
	TokenUpdatedAt    *string `json:"token_updated_at"`
	TokenExpiryDate   *string `json:"token_expiry_date"`
	IsTokenExpired    bool    `json:"is_token_expired"`
	IsTokenNearExpiry bool    `json:"is_token_near_expiry"`
}
