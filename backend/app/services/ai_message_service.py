import json
import logging
import os
import re
import sqlite3
import time
from pathlib import Path
from threading import Lock
from typing import Dict, Optional

import redis
from openai import OpenAI

logger = logging.getLogger(__name__)


class AIMessageService:
    CACHE_VERSION = "v1"
    DEFAULT_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60
    DEFAULT_FAILURE_CACHE_TTL_SECONDS = 24 * 60 * 60
    EVENT_PROMPTS = {
        "schedule_place_entry": "A group member arrived at the location for a scheduled event.",
        "schedule_place_exit": "A group member departed from the location for a scheduled event.",
        "schedule_start": "A scheduled event will start in 30 minutes.",
    }

    def __init__(self):
        self.model = os.getenv("OPENAI_MODEL", "gpt-5.2-chat-latest")
        self.cache_ttl_seconds = int(
            os.getenv(
                "AI_MESSAGE_CACHE_TTL_SECONDS",
                str(self.DEFAULT_CACHE_TTL_SECONDS),
            )
        )
        self.failure_cache_ttl_seconds = int(
            os.getenv(
                "AI_MESSAGE_FAILURE_CACHE_TTL_SECONDS",
                str(self.DEFAULT_FAILURE_CACHE_TTL_SECONDS),
            )
        )
        self.backend_dir = Path(__file__).resolve().parents[2]
        self.cache_path = Path(
            os.getenv(
                "AI_MESSAGE_CACHE_PATH",
                str(self.backend_dir / "storage" / "ai_message_cache.sqlite3"),
            )
        )
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)

        self._cache_lock = Lock()
        self._memory_cache: Dict[str, Dict] = {}
        self._redis_client = self._build_redis_client()
        self._client: Optional[OpenAI] = None

        self._init_sqlite()

    def render_message(
        self,
        event_type: str,
        lang: str,
        variables: Dict[str, str],
        fallback_template: Dict[str, str],
    ) -> tuple[str, str]:
        normalized_lang = self._normalize_lang(lang)
        template = self._get_cached_template(event_type, normalized_lang)

        if template is None:
            template = self._generate_template(
                event_type=event_type,
                lang=normalized_lang,
                placeholders=sorted(variables.keys()),
            )
            if template is not None:
                self._store_template(event_type, normalized_lang, template)
            else:
                self._store_template(
                    event_type,
                    normalized_lang,
                    fallback_template,
                    ttl_seconds=self.failure_cache_ttl_seconds,
                )
                template = fallback_template

        template = template or fallback_template
        safe_variables = {key: str(value) for key, value in variables.items()}
        return (
            template["title"].format(**safe_variables),
            template["content"].format(**safe_variables),
        )

    def _normalize_lang(self, lang: Optional[str]) -> str:
        value = (lang or "ko").strip().lower()
        if value.startswith("en"):
            return "en"
        return "ko"

    def _cache_key(self, event_type: str, lang: str) -> str:
        return f"ai-message:{self.CACHE_VERSION}:{self.model}:{event_type}:{lang}"

    def _build_redis_client(self):
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            return None

        try:
            client = redis.Redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=0.3,
                socket_timeout=0.5,
            )
            client.ping()
            logger.info("AI message cache using Redis")
            return client
        except Exception as exc:
            logger.warning(f"Redis cache unavailable, falling back to sqlite cache: {exc}")
            return None

    def _init_sqlite(self) -> None:
        with sqlite3.connect(self.cache_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_message_cache (
                    cache_key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    expires_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
                """
            )
            conn.commit()

    def _get_cached_template(self, event_type: str, lang: str) -> Optional[Dict[str, str]]:
        cache_key = self._cache_key(event_type, lang)
        now = int(time.time())

        cached = self._memory_cache.get(cache_key)
        if cached and cached["expires_at"] > now:
            return cached["value"]

        if self._redis_client:
            try:
                raw_value = self._redis_client.get(cache_key)
                if raw_value:
                    value = json.loads(raw_value)
                    self._memory_cache[cache_key] = {
                        "value": value,
                        "expires_at": now + self.cache_ttl_seconds,
                    }
                    return value
            except Exception as exc:
                logger.warning(f"Redis cache read failed for {cache_key}: {exc}")

        with self._cache_lock:
            with sqlite3.connect(self.cache_path) as conn:
                row = conn.execute(
                    """
                    SELECT value, expires_at
                    FROM ai_message_cache
                    WHERE cache_key = ?
                    """,
                    (cache_key,),
                ).fetchone()

        if not row:
            return None

        raw_value, expires_at = row
        if expires_at <= now:
            self._delete_sqlite_entry(cache_key)
            return None

        value = json.loads(raw_value)
        self._memory_cache[cache_key] = {
            "value": value,
            "expires_at": expires_at,
        }
        return value

    def _store_template(
        self,
        event_type: str,
        lang: str,
        template: Dict[str, str],
        ttl_seconds: Optional[int] = None,
    ) -> None:
        cache_key = self._cache_key(event_type, lang)
        now = int(time.time())
        ttl = ttl_seconds or self.cache_ttl_seconds
        expires_at = now + ttl
        serialized = json.dumps(template, ensure_ascii=False)

        self._memory_cache[cache_key] = {
            "value": template,
            "expires_at": expires_at,
        }

        if self._redis_client:
            try:
                self._redis_client.setex(cache_key, ttl, serialized)
            except Exception as exc:
                logger.warning(f"Redis cache write failed for {cache_key}: {exc}")

        with self._cache_lock:
            with sqlite3.connect(self.cache_path) as conn:
                conn.execute(
                    """
                    INSERT INTO ai_message_cache (cache_key, value, expires_at, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(cache_key) DO UPDATE SET
                        value = excluded.value,
                        expires_at = excluded.expires_at,
                        updated_at = excluded.updated_at
                    """,
                    (cache_key, serialized, expires_at, now),
                )
                conn.commit()

    def _delete_sqlite_entry(self, cache_key: str) -> None:
        with self._cache_lock:
            with sqlite3.connect(self.cache_path) as conn:
                conn.execute("DELETE FROM ai_message_cache WHERE cache_key = ?", (cache_key,))
                conn.commit()

    def _generate_template(
        self,
        event_type: str,
        lang: str,
        placeholders: list[str],
    ) -> Optional[Dict[str, str]]:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or event_type not in self.EVENT_PROMPTS:
            return None

        try:
            client = self._client or OpenAI(api_key=api_key, timeout=10.0)
            self._client = client
            placeholder_tokens = ", ".join(f"{{{name}}}" for name in placeholders)
            system_prompt = (
                "You write concise mobile push notification templates. "
                "Return strict JSON with keys title and content only."
            )
            user_prompt = (
                f"Language: {lang}\n"
                f"Event: {self.EVENT_PROMPTS[event_type]}\n"
                f"Required placeholders: {placeholder_tokens}\n"
                "Constraints:\n"
                "- Keep placeholders exactly as provided.\n"
                "- Title should be short and natural.\n"
                "- Content should be friendly and concise.\n"
                "- Do not include markdown or extra explanation.\n"
                "Example output: {\"title\":\"...\",\"content\":\"...\"}"
            )

            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=180,
            )
            raw_text = response.choices[0].message.content or ""
            return self._parse_template(raw_text, placeholders)
        except Exception as exc:
            logger.warning(f"OpenAI template generation failed for {event_type}:{lang}: {exc}")
            return None

    def _parse_template(
        self,
        raw_text: str,
        placeholders: list[str],
    ) -> Optional[Dict[str, str]]:
        if not raw_text:
            return None

        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if not match:
            return None

        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None

        title = str(parsed.get("title", "")).strip()
        content = str(parsed.get("content", "")).strip()
        if not title or not content:
            return None

        for placeholder in placeholders:
            token = "{" + placeholder + "}"
            if token not in title and token not in content:
                return None

        return {"title": title, "content": content}


ai_message_service = AIMessageService()
