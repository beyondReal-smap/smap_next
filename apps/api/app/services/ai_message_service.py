import json
import logging
import os
import re
import time
from threading import Lock
from typing import Dict, List, Optional, Tuple

from openai import OpenAI

logger = logging.getLogger(__name__)


class AIMessageService:
    """푸시 메시지를 내부 vLLM 서버로 매번 새로 생성하는 서비스.

    - 변수 값을 프롬프트에 직접 넣어 완성 문장을 생성하고, 모든 값이
      결과에 그대로 포함됐는지 검증해 변수 누락/왜곡을 차단한다.
      (placeholder 토큰 방식은 gemma가 한국어로 번역해버려 사용하지 않음)
    - 생성 실패 시 catalog 폴백 템플릿을 사용하고, 서버 장애 시에는
      일정 시간(쿨다운) 동안 LLM 호출을 건너뛰어 푸시 배치 지연을 방지한다.
    """

    # ai_assist와 공유하는 내부 vLLM 서버 (도커 게이트웨이 경유 — 호스트 공인 IP 변경과 무관)
    DEFAULT_VLLM_BASE_URL = "http://172.17.0.1:5015/v1"
    EVENT_PROMPTS = {
        "schedule_place_entry": "A group member arrived at the location for a scheduled event.",
        "schedule_place_exit": "A group member departed from the location for a scheduled event.",
        "schedule_start": "A scheduled event will start in 30 minutes.",
        "low_battery": "A user's device battery is low and they should be encouraged to charge soon.",
        "daily_log": "Summarize that today's location records are ready to review in the app.",
        "daily_weather": "Provide a friendly daily weather update that helps someone prepare before going out.",
        "my_location_near": "A saved personal place is nearby and the user may want to stop by.",
        "schedule_movement": "A scheduled destination is still far away and the user should check departure timing.",
        "app_reengagement": "Encourage the user to reopen the app and review today's activity.",
        "my_place_entry": "The user has arrived near their saved place.",
        "my_place_exit": "The user has moved away from their saved place.",
        "engagement_morning": "Send a cheerful morning message to engage the user with the app. If weather variables are provided, weave them in naturally.",
        "engagement_afternoon": "Send a friendly afternoon check-in to reengage the user mid-day. If weather variables are provided, weave them in naturally.",
        "engagement_evening": "Send a warm evening message encouraging the user to review their day in the app. If weather variables are provided, weave them in naturally.",
    }
    VARIABLE_MEANINGS = {
        "name": "the group member's name",
        "title": "the schedule or place title",
        "battery": "the battery percentage number",
        "temp": "the temperature value",
        "weather": "the weather description",
        "humidity": "the humidity percentage",
        "location": "the location name",
    }
    GENERATION_ATTEMPTS = 2
    # PII 필터가 프롬프트/응답에 남긴 마스킹 토큰([조직], [주소] 등) 탐지용
    MASK_TOKEN_RE = re.compile(r"\[[^\[\]]{1,20}\]")
    # 앱 이름을 프롬프트에 보내면 PII 필터가 [조직]으로 마스킹해 결과에 새어 나오므로
    # 프롬프트용 텍스트에서는 중립 표현으로 치환한다 (카탈로그 폴백 원문은 유지)
    APP_NAME_SANITIZERS = (("스맵", "앱"), ("SMAP", "the app"))
    # 호출마다 프롬프트를 다르게 만들어 표현이 수렴하지 않도록 하는 각도 힌트
    VARIATION_ANGLES = (
        "a warm, caring tone",
        "a light and playful tone",
        "a calm, informative tone",
        "an energetic, encouraging tone",
        "a brief, to-the-point tone",
        "a gentle reminder tone",
        "a cheerful companion tone",
        "a thoughtful, considerate tone",
    )

    def __init__(self):
        # vllm(기본) | openai | off
        self.provider = os.getenv("AI_MESSAGE_PROVIDER", "vllm").strip().lower()
        self.vllm_base_url = os.getenv("VLLM_BASE_URL", self.DEFAULT_VLLM_BASE_URL)
        self.vllm_model = os.getenv("VLLM_MODEL", "gemma-4-26B-A4B-it")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-5.2-chat-latest")
        self.request_timeout = float(os.getenv("AI_MESSAGE_TIMEOUT_SECONDS", "8"))
        self.temperature = float(os.getenv("AI_MESSAGE_TEMPERATURE", "1.0"))
        self.failure_cooldown_seconds = float(
            os.getenv("AI_MESSAGE_FAILURE_COOLDOWN_SECONDS", "60")
        )

        self._client: Optional[OpenAI] = None
        self._client_lock = Lock()
        self._failure_until = 0.0

    def render_message(
        self,
        event_type: str,
        lang: str,
        variables: Dict[str, str],
        fallback_template: Optional[Dict[str, str]] = None,
        fallback_templates: Optional[List[Dict[str, str]]] = None,
        variant_index: int = 0,
    ) -> Tuple[str, str]:
        normalized_lang = self._normalize_lang(lang)
        candidate_templates = list(fallback_templates or [])
        if fallback_template:
            candidate_templates.append(fallback_template)
        if not candidate_templates:
            raise ValueError("At least one fallback template is required.")

        safe_variables = {key: str(value) for key, value in (variables or {}).items()}

        generated = self._generate_message(
            event_type=event_type,
            lang=normalized_lang,
            variables=safe_variables,
            style_examples=candidate_templates,
            variant_index=variant_index,
        )
        if generated is not None:
            return generated

        selected_fallback = candidate_templates[variant_index % len(candidate_templates)]
        return (
            selected_fallback["title"].format(**safe_variables),
            selected_fallback["content"].format(**safe_variables),
        )

    def _normalize_lang(self, lang: Optional[str]) -> str:
        value = (lang or "ko").strip().lower()
        if value.startswith("en"):
            return "en"
        return "ko"

    def _build_client(self) -> Optional[OpenAI]:
        if self.provider == "vllm":
            return OpenAI(
                base_url=self.vllm_base_url,
                api_key=os.getenv("VLLM_API_KEY", "EMPTY"),
                timeout=self.request_timeout,
                max_retries=0,
            )
        if self.provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                return None
            return OpenAI(api_key=api_key, timeout=self.request_timeout)
        return None

    def _get_client(self) -> Optional[OpenAI]:
        if self._client is not None:
            return self._client
        with self._client_lock:
            if self._client is None:
                self._client = self._build_client()
            return self._client

    def _generate_message(
        self,
        event_type: str,
        lang: str,
        variables: Dict[str, str],
        style_examples: List[Dict[str, str]],
        variant_index: int = 0,
    ) -> Optional[Tuple[str, str]]:
        if self.provider == "off" or event_type not in self.EVENT_PROMPTS:
            return None
        if time.monotonic() < self._failure_until:
            return None

        client = self._get_client()
        if client is None:
            return None

        model = self.vllm_model if self.provider == "vllm" else self.openai_model

        surrogate_map = self._pii_surrogates(lang)
        gen_variables = dict(variables)
        for key, surrogate in surrogate_map.items():
            if key in gen_variables:
                gen_variables[key] = surrogate

        if gen_variables:
            variable_lines = "\n".join(
                f'  - "{value}" ({self.VARIABLE_MEANINGS.get(key, key)})'
                for key, value in sorted(gen_variables.items())
            )
            required_values = ", ".join(f'"{value}"' for _, value in sorted(gen_variables.items()))
            variable_section = (
                "Facts to include:\n"
                f"{variable_lines}\n"
                f"The message MUST contain these exact strings verbatim: {required_values}. "
                "Never replace them with brackets, pronouns, or translations."
            )
        else:
            variable_section = "Facts to include: (none)"

        # variant_index로 예시를 회전시켜 호출마다 다른 참조가 보이게 한다
        rendered_examples = self._render_examples(style_examples, gen_variables, variant_index)
        angle = self.VARIATION_ANGLES[variant_index % len(self.VARIATION_ANGLES)]
        language_name = "Korean (존댓말)" if lang == "ko" else "English"

        system_prompt = (
            "You write a single concise mobile push notification for "
            "a family/group location sharing app. "
            'Return strict JSON with keys "title" and "content" only.'
        )
        user_prompt = (
            f"Language: {language_name}\n"
            f"Event: {self.EVENT_PROMPTS[event_type]}\n"
            f"{variable_section}\n"
            f"Style examples (tone/length/emoji reference):\n{rendered_examples}\n"
            "Constraints:\n"
            f"- Write a fresh new variation in {angle}. "
            "Do not copy the examples or reuse their opening words.\n"
            "- Title: short and natural, ending with one fitting emoji like the examples.\n"
            "- Content: one friendly, concise sentence.\n"
            "- No markdown, no curly braces, no extra explanation.\n"
            'Example output: {"title":"...","content":"..."}'
        )

        for attempt in range(self.GENERATION_ATTEMPTS):
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=self.temperature,
                    top_p=0.95,
                    max_completion_tokens=180,
                )
                raw_text = response.choices[0].message.content or ""
                message = self._parse_message(raw_text, gen_variables)
                if message is not None:
                    return self._restore_pii(message, variables, surrogate_map)
                logger.warning(
                    f"AI push message invalid for {event_type}:{lang} "
                    f"(attempt {attempt + 1}/{self.GENERATION_ATTEMPTS}): {raw_text[:200]!r}"
                )
            except Exception as exc:
                self._failure_until = time.monotonic() + self.failure_cooldown_seconds
                logger.warning(
                    f"AI push generation failed for {event_type}:{lang} via {self.provider}, "
                    f"falling back to catalog templates for {self.failure_cooldown_seconds:.0f}s: {exc}"
                )
                return None
        return None

    def _pii_surrogates(self, lang: str) -> Dict[str, str]:
        # vLLM 서버 앞단의 PII 필터가 실명(OOO 포함)을 [이름]으로, 조직/지역명을
        # [조직]/[지역] 등으로 문맥 의존적으로 마스킹하므로, 사용자 텍스트 변수는
        # 보내지 않고 필터를 통과하는 대체 토큰으로 생성 후 복원한다
        if lang == "ko":
            return {"name": "[이름]", "title": "[제목]", "location": "[지역]"}
        return {"name": "OOO", "title": "[TITLE]", "location": "[LOCATION]"}

    def _restore_pii(
        self,
        message: Tuple[str, str],
        variables: Dict[str, str],
        surrogate_map: Dict[str, str],
    ) -> Tuple[str, str]:
        title, content = message
        for key, surrogate in surrogate_map.items():
            if key in variables:
                title = title.replace(surrogate, variables[key])
                content = content.replace(surrogate, variables[key])
        return title, content

    def _render_examples(
        self,
        style_examples: List[Dict[str, str]],
        variables: Dict[str, str],
        variant_index: int,
    ) -> str:
        if not style_examples:
            return "(none)"

        offset = variant_index % len(style_examples)
        rotated = style_examples[offset:] + style_examples[:offset]

        rendered: List[str] = []
        for example in rotated[:3]:
            try:
                rendered.append(
                    json.dumps(
                        {
                            "title": self._sanitize_app_name(example["title"].format(**variables)),
                            "content": self._sanitize_app_name(example["content"].format(**variables)),
                        },
                        ensure_ascii=False,
                    )
                )
            except (KeyError, IndexError):
                continue
        return "\n".join(rendered) or "(none)"

    def _sanitize_app_name(self, text: str) -> str:
        for src, dst in self.APP_NAME_SANITIZERS:
            text = text.replace(src, dst)
        return text

    def _parse_message(
        self,
        raw_text: str,
        variables: Dict[str, str],
    ) -> Optional[Tuple[str, str]]:
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

        combined = title + content
        # 남은 중괄호는 미치환 placeholder 흔적이므로 거부
        if "{" in combined or "}" in combined:
            return None

        # 모든 변수 값이 그대로 포함되어야 함 (이름/수치 누락·왜곡 방지)
        for value in variables.values():
            if value not in combined:
                return None

        # PII 필터가 마스킹한 토큰([조직] 등)이 서러게이트 외에 남아 있으면 거부
        # (필터가 프롬프트 속 조직/지역명을 변조하면 모델이 그대로 복사해 옴)
        known_tokens = set(variables.values())
        for token in self.MASK_TOKEN_RE.findall(combined):
            if token not in known_tokens:
                return None

        return title, content


ai_message_service = AIMessageService()
