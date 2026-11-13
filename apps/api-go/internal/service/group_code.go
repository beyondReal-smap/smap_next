package service

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

// 새 그룹 초대 코드: CSPRNG 10자. smap_group_t.sgt_code 컬럼이 10자(String(10))라 더 늘릴 수 없다.
// 알파벳은 앱 입력 필터(대문자 A-Z + 숫자 0-9)에 맞고 혼동되기 쉬운 문자(0 O 1 I)를 뺀 32자 → 약 50비트.
// (기존 코드는 "G"+MD5 16진 5자 ≈ 20비트였다. 기존 그룹의 코드는 바꾸지 않는다.)
const (
	groupCodeLen      = 10
	groupCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
)

func newGroupCode() (string, error) {
	max := big.NewInt(int64(len(groupCodeAlphabet)))
	b := make([]byte, groupCodeLen)
	for i := range b {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", fmt.Errorf("group code: %w", err)
		}
		b[i] = groupCodeAlphabet[n.Int64()]
	}
	return string(b), nil
}

// validGroupCodeFormat: 소유자가 코드를 직접 바꿀 때(PUT /groups/:id의 sgt_code) 허용하는 형식 —
// 컬럼 폭에 맞는 정확히 10자의 대문자/숫자. 짧은 코드로 바꿔 추측 가능하게 만드는 것을 막는다.
func validGroupCodeFormat(code string) bool {
	if len(code) != groupCodeLen {
		return false
	}
	for i := 0; i < len(code); i++ {
		c := code[i]
		if !(c >= 'A' && c <= 'Z') && !(c >= '0' && c <= '9') {
			return false
		}
	}
	return true
}
