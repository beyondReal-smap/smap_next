# 하위 호환을 위한 facade — 모든 설정은 app.core.config.Settings 에 통합됨
from app.core.config import settings

Config = settings  # backward compatibility alias
