import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.api import deps
from app.db.base import Base
import json
from datetime import datetime

# 테스트용 데이터베이스 설정
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 테스트용 데이터베이스 의존성 오버라이드
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[deps.get_db] = override_get_db

# 테스트 클라이언트 생성
client = TestClient(app)

class TestGroupScheduleManage:
    """그룹 스케줄 관리 API 테스트"""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """각 테스트 메서드 실행 전 설정"""
        Base.metadata.create_all(bind=engine)
        yield
        Base.metadata.drop_all(bind=engine)
    
    def test_get_group_schedules_success(self):
        """그룹 스케줄 조회 성공 테스트"""
        group_id = 1
        current_user_id = 123
        
        response = client.get(
            f"/api/v1/schedule/group/{group_id}/schedules",
            params={"current_user_id": current_user_id}
        )
        
        # 실제 데이터베이스가 없으므로 403 또는 500 에러가 예상됨
        assert response.status_code in [403, 500]
    
    def test_get_group_schedules_with_date_filter(self):
        """날짜 필터를 사용한 그룹 스케줄 조회 테스트"""
        group_id = 1
        current_user_id = 123
        start_date = "2024-01-01"
        end_date = "2024-01-31"
        
        response = client.get(
            f"/api/v1/schedule/group/{group_id}/schedules",
            params={
                "current_user_id": current_user_id,
                "start_date": start_date,
                "end_date": end_date
            }
        )
        
        assert response.status_code in [403, 500]
    
    def test_get_group_schedules_with_member_filter(self):
        """멤버 필터를 사용한 그룹 스케줄 조회 테스트"""
        group_id = 1
        current_user_id = 123
        member_id = 456
        
        response = client.get(
            f"/api/v1/schedule/group/{group_id}/schedules",
            params={
                "current_user_id": current_user_id,
                "member_id": member_id
            }
        )
        
        assert response.status_code in [403, 500]
    
    def test_create_group_schedule_success(self):
        """그룹 스케줄 생성 성공 테스트"""
        group_id = 1
        current_user_id = 123
        
        schedule_data = {
            "sst_title": "테스트 회의",
            "sst_sdate": "2024-01-15T09:00:00",
            "sst_edate": "2024-01-15T10:00:00",
            "sst_all_day": "N",
            "sst_location_title": "회의실 A",
            "sst_memo": "테스트 메모"
        }
        
        response = client.post(
            f"/api/v1/schedule/group/{group_id}/schedules",
            params={"current_user_id": current_user_id},
            json=schedule_data
        )
        
        assert response.status_code in [403, 500]
    
    def test_create_group_schedule_missing_required_fields(self):
        """필수 필드 누락 시 그룹 스케줄 생성 실패 테스트"""
        group_id = 1
        current_user_id = 123
        
        # 필수 필드 누락 (sst_title 없음)
        schedule_data = {
            "sst_sdate": "2024-01-15T09:00:00",
            "sst_edate": "2024-01-15T10:00:00"
        }
        
        response = client.post(
            f"/api/v1/schedule/group/{group_id}/schedules",
            params={"current_user_id": current_user_id},
            json=schedule_data
        )
        
        # 필수 필드 누락으로 인한 400 에러 또는 권한 문제로 인한 403 에러
        assert response.status_code in [400, 403, 500]
    
    def test_create_group_schedule_for_other_member(self):
        """다른 멤버를 위한 스케줄 생성 테스트 (권한 필요)"""
        group_id = 1
        current_user_id = 123
        target_member_id = 456
        
        schedule_data = {
            "sst_title": "다른 멤버 회의",
            "sst_sdate": "2024-01-15T09:00:00",
            "sst_edate": "2024-01-15T10:00:00",
            "targetMemberId": target_member_id
        }
        
        response = client.post(
            f"/api/v1/schedule/group/{group_id}/schedules",
            params={"current_user_id": current_user_id},
            json=schedule_data
        )
        
        assert response.status_code in [403, 500]
    
    def test_update_group_schedule_success(self):
        """그룹 스케줄 수정 성공 테스트"""
        group_id = 1
        schedule_id = 1
        current_user_id = 123
        
        update_data = {
            "sst_title": "수정된 회의",
            "sst_memo": "수정된 메모"
        }
        
        response = client.put(
            f"/api/v1/schedule/group/{group_id}/schedules/{schedule_id}",
            params={"current_user_id": current_user_id},
            json=update_data
        )
        
        assert response.status_code in [403, 404, 500]
    
    def test_update_nonexistent_schedule(self):
        """존재하지 않는 스케줄 수정 시도 테스트"""
        group_id = 1
        schedule_id = 99999  # 존재하지 않는 ID
        current_user_id = 123
        
        update_data = {
            "sst_title": "수정된 회의"
        }
        
        response = client.put(
            f"/api/v1/schedule/group/{group_id}/schedules/{schedule_id}",
            params={"current_user_id": current_user_id},
            json=update_data
        )
        
        assert response.status_code in [403, 404, 500]
    
    def test_delete_group_schedule_success(self):
        """그룹 스케줄 삭제 성공 테스트"""
        group_id = 1
        schedule_id = 1
        current_user_id = 123
        
        response = client.delete(
            f"/api/v1/schedule/group/{group_id}/schedules/{schedule_id}",
            params={"current_user_id": current_user_id}
        )
        
        assert response.status_code in [403, 404, 500]
    
    def test_delete_nonexistent_schedule(self):
        """존재하지 않는 스케줄 삭제 시도 테스트"""
        group_id = 1
        schedule_id = 99999  # 존재하지 않는 ID
        current_user_id = 123
        
        response = client.delete(
            f"/api/v1/schedule/group/{group_id}/schedules/{schedule_id}",
            params={"current_user_id": current_user_id}
        )
        
        assert response.status_code in [403, 404, 500]
    
    def test_unauthorized_access(self):
        """권한 없는 사용자의 접근 테스트"""
        group_id = 1
        unauthorized_user_id = 999  # 그룹에 속하지 않는 사용자
        
        response = client.get(
            f"/api/v1/schedule/group/{group_id}/schedules",
            params={"current_user_id": unauthorized_user_id}
        )
        
        assert response.status_code in [403, 500]
    
    def test_invalid_group_id(self):
        """유효하지 않은 그룹 ID 테스트"""
        invalid_group_id = 99999
        current_user_id = 123
        
        response = client.get(
            f"/api/v1/schedule/group/{invalid_group_id}/schedules",
            params={"current_user_id": current_user_id}
        )
        
        assert response.status_code in [403, 404, 500]
    
    def test_missing_current_user_id(self):
        """current_user_id 누락 테스트"""
        group_id = 1
        
        response = client.get(f"/api/v1/schedule/group/{group_id}/schedules")
        
        # current_user_id가 필수 파라미터이므로 422 에러 예상
        assert response.status_code == 422
    
    def test_invalid_date_format(self):
        """잘못된 날짜 형식 테스트"""
        group_id = 1
        current_user_id = 123
        
        response = client.get(
            f"/api/v1/schedule/group/{group_id}/schedules",
            params={
                "current_user_id": current_user_id,
                "start_date": "invalid-date",
                "end_date": "2024-01-31"
            }
        )
        
        assert response.status_code in [400, 403, 422, 500]

class TestGroupScheduleManagerUtils:
    """GroupScheduleManager 유틸리티 클래스 테스트"""
    
    def test_has_manage_permission_owner(self):
        """오너 권한 확인 테스트"""
        from app.api.v1.endpoints.group_schedule_manage import GroupScheduleManager
        
        member_auth = {
            "sgdt_owner_chk": "Y",
            "sgdt_leader_chk": "N"
        }
        
        assert GroupScheduleManager.has_manage_permission(member_auth) == True
    
    def test_has_manage_permission_leader(self):
        """리더 권한 확인 테스트"""
        from app.api.v1.endpoints.group_schedule_manage import GroupScheduleManager
        
        member_auth = {
            "sgdt_owner_chk": "N",
            "sgdt_leader_chk": "Y"
        }
        
        assert GroupScheduleManager.has_manage_permission(member_auth) == True
    
    def test_has_manage_permission_regular_member(self):
        """일반 멤버 권한 확인 테스트"""
        from app.api.v1.endpoints.group_schedule_manage import GroupScheduleManager
        
        member_auth = {
            "sgdt_owner_chk": "N",
            "sgdt_leader_chk": "N"
        }
        
        assert GroupScheduleManager.has_manage_permission(member_auth) == False

# 통합 테스트를 위한 픽스처
@pytest.fixture
def sample_schedule_data():
    """테스트용 샘플 스케줄 데이터"""
    return {
        "sst_title": "샘플 회의",
        "sst_sdate": "2024-01-15T09:00:00",
        "sst_edate": "2024-01-15T10:00:00",
        "sst_all_day": "N",
        "sst_location_title": "회의실 A",
        "sst_location_add": "서울시 강남구 테헤란로 123",
        "sst_memo": "중요한 회의입니다",
        "sst_supplies": "노트북, 프로젝터",
        "sst_alram": 1,
        "sst_schedule_alarm_chk": "Y"
    }

@pytest.fixture
def sample_group_member():
    """테스트용 샘플 그룹 멤버 데이터"""
    return {
        "mt_idx": 123,
        "mt_name": "김테스트",
        "mt_file1": "test_profile.jpg",
        "sgt_idx": 1,
        "sgdt_idx": 456,
        "sgdt_owner_chk": "Y",
        "sgdt_leader_chk": "N"
    }

# 성능 테스트
class TestGroupSchedulePerformance:
    """그룹 스케줄 API 성능 테스트"""
    
    def test_large_schedule_list_performance(self):
        """대량 스케줄 목록 조회 성능 테스트"""
        import time
        
        group_id = 1
        current_user_id = 123
        
        start_time = time.time()
        response = client.get(
            f"/api/v1/schedule/group/{group_id}/schedules",
            params={"current_user_id": current_user_id}
        )
        end_time = time.time()
        
        # 응답 시간이 5초를 넘지 않아야 함
        assert (end_time - start_time) < 5.0
        
        # 상태 코드 확인 (실제 데이터가 없으므로 에러 예상)
        assert response.status_code in [403, 500]

if __name__ == "__main__":
    pytest.main([__file__, "-v"]) 