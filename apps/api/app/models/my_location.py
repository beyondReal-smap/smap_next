"""하위 호환을 위한 facade — Location 모델을 사용하세요."""
from app.models.location import Location as MyLocation

__all__ = ["MyLocation"]
