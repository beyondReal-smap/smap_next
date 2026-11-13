package jobs

import (
	"fmt"
	"log/slog"
)

// logAdapter는 asynq.Logger 인터페이스를 slog로 라우팅한다.
// asynq의 Logger는 가변 인자(args ...interface{}) 시그니처라, slog 구조화 로깅과
// 맞지 않으므로 fmt.Sprint로 합쳐 message 한 필드로 넘긴다.
// (asynq.Logger 인터페이스: Debug/Info/Warn/Error/Fatal(args ...interface{}))
type logAdapter struct {
	log *slog.Logger
}

// NewLogAdapter는 asynq 서버/스케줄러에 주입할 Logger 어댑터를 만든다.
func NewLogAdapter(log *slog.Logger) *logAdapter {
	if log == nil {
		log = slog.Default()
	}
	return &logAdapter{log: log}
}

func (a *logAdapter) Debug(args ...interface{}) { a.log.Debug(fmt.Sprint(args...)) }
func (a *logAdapter) Info(args ...interface{})  { a.log.Info(fmt.Sprint(args...)) }
func (a *logAdapter) Warn(args ...interface{})  { a.log.Warn(fmt.Sprint(args...)) }
func (a *logAdapter) Error(args ...interface{}) { a.log.Error(fmt.Sprint(args...)) }

// Fatal은 asynq 계약상 프로세스를 종료시켜야 하지만, 골격 단계에서는 Error로
// 로깅만 한다(워커 부팅 중 비정상 종료를 막기 위함). 다음 트랙에서 정책 확정.
func (a *logAdapter) Fatal(args ...interface{}) { a.log.Error(fmt.Sprint(args...)) }
