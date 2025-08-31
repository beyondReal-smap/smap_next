from fastapi import APIRouter, HTTPException
from app.core.log_manager import get_log_manager
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/rotate")
async def rotate_logs():
    """로그 파일 로테이션 수행"""
    try:
        log_manager = get_log_manager()
        log_manager.rotate_logs()
        
        return {
            "success": True,
            "message": "로그 파일 로테이션이 완료되었습니다.",
            "timestamp": str(log_manager.get_log_stats())
        }
    except Exception as e:
        logger.error(f"로그 로테이션 실패: {e}")
        raise HTTPException(status_code=500, detail=f"로그 로테이션 실패: {str(e)}")

@router.post("/compress")
async def compress_logs(days_old: int = 7):
    """오래된 로그 파일 압축"""
    try:
        log_manager = get_log_manager()
        log_manager.compress_old_logs(days_old=days_old)
        
        return {
            "success": True,
            "message": f"{days_old}일 이상 된 로그 파일 압축이 완료되었습니다.",
            "timestamp": str(log_manager.get_log_stats())
        }
    except Exception as e:
        logger.error(f"로그 압축 실패: {e}")
        raise HTTPException(status_code=500, detail=f"로그 압축 실패: {str(e)}")

@router.post("/cleanup")
async def cleanup_logs(days_old: int = 30):
    """오래된 압축 로그 파일 정리"""
    try:
        log_manager = get_log_manager()
        log_manager.cleanup_old_compressed_logs(days_old=days_old)
        
        return {
            "success": True,
            "message": f"{days_old}일 이상 된 압축 로그 파일 정리가 완료되었습니다.",
            "timestamp": str(log_manager.get_log_stats())
        }
    except Exception as e:
        logger.error(f"로그 정리 실패: {e}")
        raise HTTPException(status_code=500, detail=f"로그 정리 실패: {str(e)}")

@router.post("/full-cleanup")
async def full_log_cleanup():
    """전체 로그 정리 작업 수행 (로테이션 + 압축 + 정리)"""
    try:
        log_manager = get_log_manager()
        
        # 로그 로테이션
        log_manager.rotate_logs()
        
        # 오래된 로그 압축
        log_manager.compress_old_logs(days_old=7)
        
        # 오래된 압축 로그 정리
        log_manager.cleanup_old_compressed_logs(days_old=30)
        
        return {
            "success": True,
            "message": "전체 로그 정리 작업이 완료되었습니다.",
            "timestamp": str(log_manager.get_log_stats())
        }
    except Exception as e:
        logger.error(f"전체 로그 정리 실패: {e}")
        raise HTTPException(status_code=500, detail=f"전체 로그 정리 실패: {str(e)}")

@router.get("/stats")
async def get_log_stats():
    """로그 파일 통계 정보 조회"""
    try:
        log_manager = get_log_manager()
        stats = log_manager.get_log_stats()
        
        return {
            "success": True,
            "message": "로그 통계 정보를 조회했습니다.",
            "data": stats
        }
    except Exception as e:
        logger.error(f"로그 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"로그 통계 조회 실패: {str(e)}")

@router.post("/start-auto-cleanup")
async def start_auto_cleanup(interval_hours: int = 24):
    """자동 로그 정리 스레드 시작"""
    try:
        log_manager = get_log_manager()
        cleanup_thread = log_manager.start_auto_cleanup(interval_hours=interval_hours)
        
        return {
            "success": True,
            "message": f"자동 로그 정리 스레드가 시작되었습니다. (간격: {interval_hours}시간)",
            "thread_info": {
                "name": cleanup_thread.name,
                "daemon": cleanup_thread.daemon,
                "alive": cleanup_thread.is_alive()
            }
        }
    except Exception as e:
        logger.error(f"자동 로그 정리 시작 실패: {e}")
        raise HTTPException(status_code=500, detail=f"자동 로그 정리 시작 실패: {str(e)}")

@router.get("/health")
async def log_health_check():
    """로그 시스템 상태 확인"""
    try:
        log_manager = get_log_manager()
        stats = log_manager.get_log_stats()
        
        # 로그 파일 상태 확인
        health_status = "healthy"
        issues = []
        
        for log_file, file_stats in stats.items():
            if log_file != "backups":
                if "size_mb" in file_stats:
                    if file_stats["size_mb"] > 50:  # 50MB 이상이면 경고
                        health_status = "warning"
                        issues.append(f"{log_file}: {file_stats['size_mb']}MB (큰 파일)")
                elif "exists" in file_stats and not file_stats["exists"]:
                    health_status = "warning"
                    issues.append(f"{log_file}: 파일이 존재하지 않음")
        
        return {
            "success": True,
            "status": health_status,
            "message": "로그 시스템 상태를 확인했습니다.",
            "data": {
                "health_status": health_status,
                "issues": issues,
                "stats": stats
            }
        }
    except Exception as e:
        logger.error(f"로그 상태 확인 실패: {e}")
        return {
            "success": False,
            "status": "error",
            "message": f"로그 상태 확인 실패: {str(e)}",
            "data": None
        }
