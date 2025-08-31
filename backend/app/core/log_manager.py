import os
import logging
import logging.handlers
from datetime import datetime, timedelta
from pathlib import Path
import shutil
import gzip
from typing import Optional
import threading
import time

class LogManager:
    """로그 파일 관리자 - 로테이션, 압축, 정리 기능 제공"""
    
    def __init__(self, log_dir: str = ".", max_size_mb: int = 100, max_files: int = 10):
        self.log_dir = Path(log_dir)
        self.max_size_bytes = max_size_mb * 1024 * 1024  # MB를 바이트로 변환
        self.max_files = max_files
        self.log_files = [
            "app.log",
            "push_msg.log"
        ]
        
        # 로그 디렉토리 생성
        self.log_dir.mkdir(exist_ok=True)
        
        # 로그 설정
        self._setup_logging()
        
    def _setup_logging(self):
        """로깅 설정 구성"""
        # 기존 핸들러 제거
        for handler in logging.root.handlers[:]:
            logging.root.removeHandler(handler)
            
        # 로그 포맷 설정
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # 파일 핸들러 설정 (로테이션 포함)
        for log_file in self.log_files:
            file_path = self.log_dir / log_file
            handler = logging.handlers.RotatingFileHandler(
                file_path,
                maxBytes=self.max_size_bytes,
                backupCount=self.max_files,
                encoding='utf-8'
            )
            handler.setFormatter(formatter)
            logging.getLogger().addHandler(handler)
            
        # 콘솔 핸들러 설정
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logging.getLogger().addHandler(console_handler)
        
        # 로그 레벨 설정
        logging.getLogger().setLevel(logging.INFO)
        
    def rotate_logs(self):
        """로그 파일 로테이션 수행"""
        try:
            for log_file in self.log_files:
                file_path = self.log_dir / log_file
                if file_path.exists() and file_path.stat().st_size > self.max_size_bytes:
                    self._rotate_single_log(file_path)
                    
        except Exception as e:
            print(f"로그 로테이션 중 오류 발생: {e}")
            
    def _rotate_single_log(self, file_path: Path):
        """단일 로그 파일 로테이션"""
        try:
            # 백업 파일명 생성 (타임스탬프 포함)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"{file_path.stem}_{timestamp}.log"
            backup_path = file_path.parent / backup_name
            
            # 기존 백업 파일들 확인
            existing_backups = sorted(
                [f for f in file_path.parent.glob(f"{file_path.stem}_*.log")],
                key=lambda x: x.stat().st_mtime,
                reverse=True
            )
            
            # 최대 백업 파일 수 초과시 오래된 파일 삭제
            if len(existing_backups) >= self.max_files:
                for old_backup in existing_backups[self.max_files:]:
                    old_backup.unlink()
                    print(f"오래된 로그 백업 파일 삭제: {old_backup}")
            
            # 현재 로그 파일을 백업으로 이동
            shutil.move(str(file_path), str(backup_path))
            
            # 빈 로그 파일 생성
            file_path.touch()
            
            print(f"로그 파일 로테이션 완료: {file_path} -> {backup_path}")
            
        except Exception as e:
            print(f"로그 파일 로테이션 실패 {file_path}: {e}")
            
    def compress_old_logs(self, days_old: int = 7):
        """오래된 로그 파일들을 gzip으로 압축"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days_old)
            
            for log_file in self.log_files:
                file_path = self.log_dir / log_file
                if file_path.exists():
                    # 백업 파일들 찾기
                    backup_pattern = f"{file_path.stem}_*.log"
                    for backup_file in file_path.parent.glob(backup_pattern):
                        if backup_file.stat().st_mtime < cutoff_date.timestamp():
                            # 이미 압축된 파일은 건너뛰기
                            if not backup_file.name.endswith('.gz'):
                                self._compress_file(backup_file)
                                
        except Exception as e:
            print(f"로그 압축 중 오류 발생: {e}")
            
    def _compress_file(self, file_path: Path):
        """파일을 gzip으로 압축"""
        try:
            gz_path = file_path.with_suffix('.log.gz')
            
            with open(file_path, 'rb') as f_in:
                with gzip.open(gz_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
                    
            # 원본 파일 삭제
            file_path.unlink()
            print(f"로그 파일 압축 완료: {file_path} -> {gz_path}")
            
        except Exception as e:
            print(f"파일 압축 실패 {file_path}: {e}")
            
    def cleanup_old_compressed_logs(self, days_old: int = 30):
        """오래된 압축된 로그 파일들 정리"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days_old)
            
            for log_file in self.log_files:
                # 압축된 백업 파일들 찾기
                gz_pattern = f"{log_file.replace('.log', '')}_*.log.gz"
                for gz_file in self.log_dir.glob(gz_pattern):
                    if gz_file.stat().st_mtime < cutoff_date.timestamp():
                        gz_file.unlink()
                        print(f"오래된 압축 로그 파일 삭제: {gz_file}")
                        
        except Exception as e:
            print(f"압축 로그 정리 중 오류 발생: {e}")
            
    def get_log_stats(self) -> dict:
        """로그 파일 통계 정보 반환"""
        stats = {}
        
        try:
            for log_file in self.log_files:
                file_path = self.log_dir / log_file
                if file_path.exists():
                    size_bytes = file_path.stat().st_size
                    size_mb = size_bytes / (1024 * 1024)
                    stats[log_file] = {
                        "size_bytes": size_bytes,
                        "size_mb": round(size_mb, 2),
                        "last_modified": datetime.fromtimestamp(file_path.stat().st_mtime)
                    }
                else:
                    stats[log_file] = {"exists": False}
                    
            # 백업 파일들 통계
            backup_stats = {}
            for log_file in self.log_files:
                base_name = log_file.replace('.log', '')
                backup_files = list(self.log_dir.glob(f"{base_name}_*.log*"))
                backup_stats[log_file] = {
                    "backup_count": len(backup_files),
                    "total_size_mb": sum(f.stat().st_size for f in backup_files) / (1024 * 1024)
                }
                
            stats["backups"] = backup_stats
            
        except Exception as e:
            stats["error"] = str(e)
            
        return stats
        
    def start_auto_cleanup(self, interval_hours: int = 24):
        """자동 정리 스레드 시작"""
        def cleanup_worker():
            while True:
                try:
                    print(f"자동 로그 정리 시작: {datetime.now()}")
                    
                    # 로그 로테이션
                    self.rotate_logs()
                    
                    # 오래된 로그 압축
                    self.compress_old_logs(days_old=7)
                    
                    # 오래된 압축 로그 정리
                    self.cleanup_old_compressed_logs(days_old=30)
                    
                    print(f"자동 로그 정리 완료: {datetime.now()}")
                    
                except Exception as e:
                    print(f"자동 로그 정리 중 오류: {e}")
                    
                # 지정된 간격만큼 대기
                time.sleep(interval_hours * 3600)
                
        # 백그라운드 스레드로 실행
        cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
        cleanup_thread.start()
        print(f"자동 로그 정리 스레드 시작 (간격: {interval_hours}시간)")
        
        return cleanup_thread

# 전역 인스턴스
log_manager = LogManager()

def get_log_manager() -> LogManager:
    """로그 매니저 인스턴스 반환"""
    return log_manager
