#!/usr/bin/env python3
"""데모 모드로 찍은 앱 화면을 스토어 소개 이미지로 만든다.

사용:
  python3 tools/store-demo/compose_store.py <캡처 폴더> <android|ios> <출력 폴더>

- 캡처 폴더에는 1_home 2_group 3_schedule 4_place 5_log 6_notice .png 가 있어야 한다.
- android: 1080x1920 6장 + 대표 그래픽 1024x500
- ios:     1320x2868(6.9인치) 6장
- 배경색은 메뉴별 강조색(홈 남색·그룹 청록·일정 주황·내장소 보라·활동 로그 장미)을 따른다.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONT_DIR = ROOT / "Android/app/src/main/res/font"
ICON = ROOT / "iOS/smap/Assets.xcassets/AppIcon.appiconset"

# (캡처 이름, 제목, 부제, 배경 그라데이션 위→아래)
SLIDES = [
    ("1_home", "우리 가족 지금 어디쯤?", "가족 위치를 지도에서 한눈에 확인해요", ("#000C6E", "#2236E6")),
    ("6_notice", "도착하면 먼저 알려 드려요", "학교·학원·집에 도착하면 바로 알림이 와요", ("#0A1A8C", "#5B5BF0")),
    ("5_log", "오늘 하루 이동 경로", "어디를 거쳐 얼마나 머물렀는지 확인해요", ("#7A0E3A", "#DB2777")),
    ("3_schedule", "가족 일정은 함께", "일정을 공유하고 시작 전에 알림을 받아요", ("#8A2C0A", "#EA580C")),
    ("4_place", "자주 가는 장소 등록", "등록한 장소에 도착하면 알려 드려요", ("#3B1385", "#8B5CF6")),
    ("2_group", "초대 코드 하나로 연결", "가족·친구를 그룹으로 초대해요", ("#063F3B", "#14A396")),
]


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / f"suite_{weight}.ttf"), size)


def hex_rgb(h: str) -> tuple[int, int, int]:
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))  # type: ignore[return-value]


def gradient(w: int, h: int, top: str, bottom: str) -> Image.Image:
    a, b = hex_rgb(top), hex_rgb(bottom)
    col = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / (h - 1)
        col.putpixel((0, y), tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)))
    img = col.resize((w, h))
    # 앱 카드처럼 옅은 큰 원 두 개
    deco = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(deco)
    d.ellipse((int(w * 0.45), int(-h * 0.12), int(w * 1.35), int(h * 0.30)), fill=(255, 255, 255, 22))
    d.ellipse((int(-w * 0.35), int(h * 0.55), int(w * 0.55), int(h * 1.05)), fill=(255, 255, 255, 14))
    return Image.alpha_composite(img.convert("RGBA"), deco)


def rounded(img: Image.Image, r: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width - 1, img.height - 1), r, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def phone(shot: Image.Image, width: int) -> Image.Image:
    """화면을 검은 테두리 휴대폰 모양에 넣는다."""
    bezel = round(width * 0.028)
    inner_w = width - bezel * 2
    inner = shot.convert("RGB").resize((inner_w, round(shot.height * inner_w / shot.width)), Image.LANCZOS)
    radius = round(width * 0.11)
    body = Image.new("RGBA", (width, inner.height + bezel * 2), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle((0, 0, body.width - 1, body.height - 1), radius, fill=(14, 15, 20, 255))
    body.alpha_composite(rounded(inner, radius - bezel), (bezel, bezel))
    return body


def fit_font(draw: ImageDraw.ImageDraw, text: str, weight: str, size: int, max_w: int) -> ImageFont.FreeTypeFont:
    while size > 10:
        f = font(weight, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return font(weight, size)


def slide(shot_path: Path, title: str, sub: str, colors: tuple[str, str], w: int, h: int) -> Image.Image:
    canvas = gradient(w, h, *colors)
    d = ImageDraw.Draw(canvas)
    margin = round(w * 0.08)
    tf = fit_font(d, title, "heavy", round(w * 0.082), w - margin * 2)
    sf = fit_font(d, sub, "medium", round(w * 0.042), w - margin * 2)
    ty = round(h * 0.075)
    d.text((w / 2, ty), title, font=tf, fill="white", anchor="ma")
    d.text((w / 2, ty + tf.size * 1.45), sub, font=sf, fill=(255, 255, 255, 215), anchor="ma")

    ph = phone(Image.open(shot_path), round(w * 0.76))
    top = round(h * 0.235)
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        ((w - ph.width) // 2, top + 30, (w + ph.width) // 2, top + ph.height + 30), round(ph.width * 0.11),
        fill=(0, 0, 0, 110))
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(w * 0.03)))
    canvas.alpha_composite(ph, ((w - ph.width) // 2, top))
    return canvas.convert("RGB")


def feature_graphic(home_shot: Path, log_shot: Path) -> Image.Image:
    """Play 대표 그래픽 1024x500."""
    w, h = 1024, 500
    canvas = gradient(w, h, "#000C6E", "#2236E6")
    d = ImageDraw.Draw(canvas)
    icon = Image.open(ICON / "1024.png").convert("RGBA").resize((112, 112), Image.LANCZOS)
    canvas.alpha_composite(rounded(icon, 26), (64, 112))
    d.text((64, 250), "SMAP", font=font("heavy", 64), fill="white")
    d.text((64, 330), "가족 위치 공유 · 도착 알림 · 이동 기록", font=font("semibold", 26), fill=(255, 255, 255, 225))
    for i, shot in enumerate((log_shot, home_shot)):
        ph = phone(Image.open(shot), 250)
        ph = ph.crop((0, 0, ph.width, min(ph.height, 470)))
        canvas.alpha_composite(ph, (560 + i * 200, 60 - i * 30))
    return canvas.convert("RGB")


def main() -> None:
    if len(sys.argv) != 4 or sys.argv[2] not in ("android", "ios"):
        sys.exit(__doc__)
    src, platform, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    w, h = (1080, 1920) if platform == "android" else (1320, 2868)
    for i, (name, title, sub, colors) in enumerate(SLIDES, 1):
        path = src / f"{name}.png"
        if not path.exists():
            sys.exit(f"캡처 없음: {path}")
        slide(path, title, sub, colors, w, h).save(out / f"{platform}_{i:02d}_{name[2:]}.png", optimize=True)
    if platform == "android":
        feature_graphic(src / "1_home.png", src / "5_log.png").save(out / "android_feature_1024x500.png", optimize=True)
    print(f"{platform}: {out}")


if __name__ == "__main__":
    main()
