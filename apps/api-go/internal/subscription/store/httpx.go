package store

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

// doLimited 는 요청을 보내고 상태 코드와 크기 제한된 본문을 돌려준다.
// 네트워크 오류·타임아웃·본문 초과는 ErrStoreUnavailable.
func (s *Service) doLimited(req *http.Request) (int, []byte, error) {
	ctx, cancel := context.WithTimeout(req.Context(), s.opt.Timeout)
	defer cancel()
	resp, err := s.http.Do(req.WithContext(ctx))
	if err != nil {
		return 0, nil, ErrStoreUnavailable
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, s.opt.MaxBodyBytes+1))
	if err != nil || int64(len(b)) > s.opt.MaxBodyBytes {
		return 0, nil, ErrStoreUnavailable
	}
	return resp.StatusCode, b, nil
}

func decodeBase64Any(v string) ([]byte, error) {
	v = strings.TrimSpace(v)
	for _, enc := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		if b, err := enc.DecodeString(v); err == nil {
			return b, nil
		}
	}
	return nil, errors.New("base64 아님")
}

func parseRSAPrivateKey(pemStr string) (*rsa.PrivateKey, error) {
	blk, _ := pem.Decode([]byte(pemStr))
	if blk == nil {
		return nil, errors.New("store: 서비스 계정 private_key PEM 파싱 실패")
	}
	if k, err := x509.ParsePKCS8PrivateKey(blk.Bytes); err == nil {
		if rk, ok := k.(*rsa.PrivateKey); ok {
			return rk, nil
		}
		return nil, errors.New("store: 서비스 계정 키가 RSA 가 아님")
	}
	if k, err := x509.ParsePKCS1PrivateKey(blk.Bytes); err == nil {
		return k, nil
	}
	return nil, errors.New("store: 서비스 계정 private_key 형식 오류")
}

// jwksCache 는 Google OIDC 서명키(RSA) 캐시다.
//   - 키 조회(네트워크)는 락 밖에서 하고, 동시 요청이 몰려도 조회는 한 번만 한다(진행 중인 조회를 기다린다: singleflight).
//   - kid 미스는 성공한 조회 후 kidCooldown 동안 재조회하지 않는다. 조회 실패도 failCooldown 동안 재시도하지 않고
//     바로 ErrStoreUnavailable 을 돌려준다(공개 엔드포인트가 Google 장애 중 조회를 쌓지 못하게).
type jwksCache struct {
	mu        sync.Mutex
	keys      map[string]*rsa.PublicKey
	fetchedAt time.Time // 마지막 성공 조회 시각
	failedAt  time.Time // 마지막 실패 시각(성공하면 zero)
	inflight  *jwksFlight
}

type jwksFlight struct {
	done chan struct{}
	err  error
}

const (
	jwksTTL      = time.Hour
	kidCooldown  = 30 * time.Second
	failCooldown = 5 * time.Second
	minRSABits   = 2048
)

// lookupKey: 키가 없으면 ErrUnauthorized, 조회 실패는 ErrStoreUnavailable.
func (s *Service) lookupKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	c := &s.oidc
	c.mu.Lock()
	now := s.now()
	fresh := c.keys != nil && now.Sub(c.fetchedAt) < jwksTTL
	if fresh {
		if k, ok := c.keys[kid]; ok {
			c.mu.Unlock()
			return k, nil
		}
		if now.Sub(c.fetchedAt) < kidCooldown {
			c.mu.Unlock()
			return nil, ErrUnauthorized
		}
	}
	if c.inflight == nil && !c.failedAt.IsZero() && now.Sub(c.failedAt) < failCooldown {
		c.mu.Unlock()
		return nil, ErrStoreUnavailable
	}
	flight := c.inflight
	leader := flight == nil
	if leader {
		flight = &jwksFlight{done: make(chan struct{})}
		c.inflight = flight
	}
	c.mu.Unlock()

	if leader {
		// 한 요청의 취소가 다른 대기자의 조회를 깨지 않도록 요청 컨텍스트와 분리하고 상한 시간만 둔다.
		fctx, cancel := context.WithTimeout(context.Background(), s.opt.Timeout)
		keys, err := s.fetchJWKS(fctx)
		cancel()
		c.mu.Lock()
		if err == nil {
			c.keys, c.fetchedAt, c.failedAt = keys, s.now(), time.Time{}
		} else {
			c.failedAt = s.now()
		}
		c.inflight = nil
		flight.err = err
		close(flight.done)
		c.mu.Unlock()
	} else {
		select {
		case <-flight.done:
		case <-ctx.Done():
			return nil, ErrStoreUnavailable
		}
	}
	if flight.err != nil {
		return nil, flight.err
	}
	c.mu.Lock()
	k, ok := c.keys[kid]
	c.mu.Unlock()
	if !ok {
		return nil, ErrUnauthorized
	}
	return k, nil
}

func (s *Service) fetchJWKS(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.opt.GoogleJWKSURL, nil)
	if err != nil {
		return nil, ErrStoreUnavailable
	}
	code, body, err := s.doLimited(req)
	if err != nil || code != http.StatusOK {
		return nil, ErrStoreUnavailable
	}
	var doc struct {
		Keys []struct {
			Kty string `json:"kty"`
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if json.Unmarshal(body, &doc) != nil {
		return nil, ErrStoreUnavailable
	}
	keys := map[string]*rsa.PublicKey{}
	for _, k := range doc.Keys {
		if k.Kty != "RSA" || k.Kid == "" {
			continue
		}
		nb, err1 := base64.RawURLEncoding.DecodeString(k.N)
		eb, err2 := base64.RawURLEncoding.DecodeString(k.E)
		if err1 != nil || err2 != nil {
			continue
		}
		n, e := new(big.Int).SetBytes(nb), new(big.Int).SetBytes(eb)
		if n.BitLen() < minRSABits || !e.IsInt64() || e.Int64() < 3 || e.Int64() > 1<<31-1 {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{N: n, E: int(e.Int64())}
	}
	if len(keys) == 0 {
		return nil, ErrStoreUnavailable
	}
	return keys, nil
}
