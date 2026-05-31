package db

import (
	"context"
	"fmt"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"github.com/bluemusk/smap_next_go/internal/config"
)

// Open은 GORM MySQL 연결을 생성한다.
// 풀 사이즈는 Python(DB_POOL_SIZE)과 동일 기본값을 사용한다.
func Open(cfg *config.Config) (*gorm.DB, error) {
	gdb, err := gorm.Open(mysql.Open(cfg.MySQLDSN()), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("gorm open: %w", err)
	}
	sqlDB, err := gdb.DB()
	if err != nil {
		return nil, fmt.Errorf("gorm sql db: %w", err)
	}
	sqlDB.SetMaxOpenConns(cfg.DBPoolSize + cfg.DBMaxOverflow)
	sqlDB.SetMaxIdleConns(cfg.DBPoolSize)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.DBPoolRecycle) * time.Second)
	sqlDB.SetConnMaxIdleTime(time.Duration(cfg.DBPoolTimeout) * time.Second)

	// 부팅 시점에 1회 PING으로 연결 검증. 실패 시 부팅 중단.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("mysql ping: %w", err)
	}
	return gdb, nil
}

// PoolStats는 Python `/health/db-pool` 응답과 매칭되는 풀 상태 스냅샷.
type PoolStats struct {
	PoolSize             int `json:"pool_size"`
	CheckedIn            int `json:"checked_in"`
	CheckedOut           int `json:"checked_out"`
	Overflow             int `json:"overflow"`
	TotalConnections     int `json:"total_connections"`
	AvailableConnections int `json:"available_connections"`
	InUseConnections     int `json:"in_use_connections"`
}

func Stats(gdb *gorm.DB) (PoolStats, error) {
	sqlDB, err := gdb.DB()
	if err != nil {
		return PoolStats{}, err
	}
	s := sqlDB.Stats()
	return PoolStats{
		PoolSize:             s.MaxOpenConnections,
		CheckedIn:            s.Idle,
		CheckedOut:           s.InUse,
		Overflow:             0, // GORM/database/sql은 overflow 개념 없음 → 0 고정
		TotalConnections:     s.OpenConnections,
		AvailableConnections: s.Idle,
		InUseConnections:     s.InUse,
	}, nil
}
