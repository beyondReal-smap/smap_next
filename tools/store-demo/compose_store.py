#!/usr/bin/env python3
"""데모 모드로 찍은 앱 화면을 스토어 소개 이미지로 만든다.

사용:
  python3 tools/store-demo/compose_store.py <캡처 폴더> <android|ios|ipad|android-tablet> <출력 폴더>

- 캡처 폴더에는 1_home 2_group 3_schedule 4_place 5_log 6_notice .png 가 있어야 한다.
- android: 1080x1920(9:16) 6장 — 픽셀 모양 휴대폰 전체가 보이게 + 대표 그래픽 1024x500
- ios:     1320x2868(6.9인치) 6장 + 제품 페이지 헤더 3840x1646 + 검색 결과 3840x2560
- ipad:    2064x2752(13인치 iPad) 6장 — 아이패드 시뮬레이터 캡처
- android-tablet: 1440x2560(9:16) 6장 — Play 태블릿 스크린샷, 태블릿 에뮬레이터 세로 캡처
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


def phone(shot: Image.Image, width: int, android: bool = False) -> Image.Image:
    """화면을 검은 테두리 휴대폰 모양에 넣는다.

    android: 픽셀 계열 모양 — 테두리가 얇고 모서리가 덜 둥글며, 화면 위 가운데에 펀치홀 카메라가 있다.
    (iOS 모양 그대로 쓰면 안드로이드 사용자에게 아이폰처럼 보인다)
    """
    bezel = round(width * (0.022 if android else 0.028))
    inner_w = width - bezel * 2
    inner = shot.convert("RGB").resize((inner_w, round(shot.height * inner_w / shot.width)), Image.LANCZOS)
    radius = round(width * (0.08 if android else 0.11))
    body = Image.new("RGBA", (width, inner.height + bezel * 2), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle((0, 0, body.width - 1, body.height - 1), radius, fill=(14, 15, 20, 255))
    body.alpha_composite(rounded(inner, radius - bezel), (bezel, bezel))
    if android:
        # 캡처에는 카메라 구멍이 없다. 상태 표시줄(시계 높이) 가운데에 그린다.
        r = inner_w * 0.017
        cx, cy = width / 2, bezel + inner.height * 0.026
        ImageDraw.Draw(body).ellipse((cx - r, cy - r, cx + r, cy + r), fill=(14, 15, 20, 255))
    return body


def tablet(shot: Image.Image, width: int) -> Image.Image:
    """화면을 태블릿 모양에 넣는다 — 노치·펀치홀 없이 고른 두께 테두리, 휴대폰보다 덜 둥근 모서리.

    휴대폰 프레임을 그대로 키우면 큰 아이폰처럼 보여서 태블릿용을 따로 둔다.
    """
    bezel = round(width * TABLET_BEZEL)
    inner_w = width - bezel * 2
    inner = shot.convert("RGB").resize((inner_w, round(shot.height * inner_w / shot.width)), Image.LANCZOS)
    radius = round(width * TABLET_RADIUS)
    body = Image.new("RGBA", (width, inner.height + bezel * 2), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle((0, 0, body.width - 1, body.height - 1), radius, fill=(14, 15, 20, 255))
    body.alpha_composite(rounded(inner, radius - bezel), (bezel, bezel))
    return body


TABLET_BEZEL = 0.03
TABLET_RADIUS = 0.05


def clean_ipad_grip(shot: Image.Image) -> Image.Image:
    """iPad 시뮬레이터 캡처 오른쪽 아래의 창 크기 조절 손잡이(회색 호)를 지운다.

    손잡이는 탭 바 바탕 위에 있으므로 바로 왼쪽의 같은 높이 바탕을 복사해 덮는다.
    탭 바의 "활동 로그" 글자는 손잡이보다 왼쪽(폭의 약 92% 이내)에 있어 겹치지 않는다.
    """
    w, h = shot.size
    size = round(w * 0.03)  # 2064 기준 62px
    out = shot.convert("RGB")
    patch = out.crop((w - size * 2 - 4, h - size - 4, w - size - 4, h - 4))
    out.paste(patch, (w - size - 4, h - size - 4))
    return out


def fit_font(draw: ImageDraw.ImageDraw, text: str, weight: str, size: int, max_w: int) -> ImageFont.FreeTypeFont:
    while size > 10:
        f = font(weight, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return font(weight, size)


def slide(shot_path: Path, title: str, sub: str, colors: tuple[str, str], w: int, h: int,
          android: bool = False, is_tablet: bool = False) -> Image.Image:
    canvas = gradient(w, h, *colors)
    d = ImageDraw.Draw(canvas)
    margin = round(w * 0.08)
    tf = fit_font(d, title, "heavy", round(w * 0.082), w - margin * 2)
    sf = fit_font(d, sub, "medium", round(w * 0.042), w - margin * 2)
    ty = round(h * (0.05 if android or is_tablet else 0.075))
    sy = ty + tf.size * 1.45
    d.text((w / 2, ty), title, font=tf, fill="white", anchor="ma")
    d.text((w / 2, sy), sub, font=sf, fill=(255, 255, 255, 215), anchor="ma")

    shot = Image.open(shot_path)
    if is_tablet:
        # 태블릿 화면은 3:4·10:16 으로 뭉툭해서 폭 기준으로 잡으면 아래 탭 바가 잘린다 → 높이에서 폭을 역산
        if not android:
            shot = clean_ipad_grip(shot)
        top = round(sy + sf.size + h * 0.04)
        avail = h - top - round(h * 0.035)
        per_width = (1 - 2 * TABLET_BEZEL) * shot.height / shot.width + 2 * TABLET_BEZEL
        ph = tablet(shot, min(round(w * 0.84), int(avail / per_width)))
    elif android:
        # Play 는 9:16 인데 요즘 안드로이드 화면은 9:20 이라 폭을 76% 로 두면 아래 탭 바가 잘린다.
        # 제목 바로 아래부터 바닥 여백까지 휴대폰 전체가 들어가게 폭을 높이에서 역산한다.
        top = round(sy + sf.size + h * 0.035)
        avail = h - top - round(h * 0.03)
        bezel_ratio = 0.022
        per_width = (1 - 2 * bezel_ratio) * shot.height / shot.width + 2 * bezel_ratio  # 폭 1당 휴대폰 높이
        ph = phone(shot, min(round(w * 0.76), int(avail / per_width)), android=True)
    else:
        ph = phone(shot, round(w * 0.76))
        top = round(h * 0.235)
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        ((w - ph.width) // 2, top + 30, (w + ph.width) // 2, top + ph.height + 30),
        round(ph.width * (TABLET_RADIUS if is_tablet else 0.08 if android else 0.11)),
        fill=(0, 0, 0, 110))
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(w * 0.03)))
    canvas.alpha_composite(ph, ((w - ph.width) // 2, top))
    return canvas.convert("RGB")


def arrival_card(width: int) -> Image.Image:
    """안드로이드 알림 모양의 도착 알림 카드(대표 그래픽에서 앱의 핵심 기능을 한 장으로 보여 준다)."""
    s = width / 340  # 폭 340 기준 크기
    h = round(96 * s)
    card = Image.new("RGBA", (width, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle((0, 0, width - 1, h - 1), round(22 * s), fill=(255, 255, 255, 250))
    icon = Image.open(ICON / "1024.png").convert("RGBA").resize((round(40 * s),) * 2, Image.LANCZOS)
    card.alpha_composite(rounded(icon, round(11 * s)), (round(14 * s), round(16 * s)))
    x = round(66 * s)
    d.text((x, round(15 * s)), "도착했어 · 방금", font=font("medium", round(13 * s)), fill=(110, 116, 130))
    d.text((x, round(36 * s)), "민지님이 학원에 도착했어요", font=font("bold", round(18 * s)), fill=(17, 24, 39))
    d.text((x, round(63 * s)), "공덕 수학학원 · 오후 3:17", font=font("medium", round(14 * s)), fill=(75, 85, 99))
    return card


def feature_graphic(home_shot: Path, log_shot: Path) -> Image.Image:
    """Play 대표 그래픽 1024x500 — 스토어 페이지 맨 위에 크게 걸리는 이미지.

    앱 이름·아이콘은 스토어가 바로 아래에 따로 보여 주므로 여기서는 "무엇을 해 주는 앱인지"를 크게 보여 준다.
    기기·화면 크기에 따라 가장자리가 잘릴 수 있어 글자는 가장자리에서 떨어뜨린다.
    """
    w, h = 1024, 500
    canvas = gradient(w, h, "#000C6E", "#2236E6")
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((600, 40, 1000, 560), fill=(120, 150, 255, 90))
    canvas = Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(50)))
    d = ImageDraw.Draw(canvas)

    # 왼쪽: 브랜드 줄 → 큰 문구 → 기능 요약
    icon = Image.open(ICON / "1024.png").convert("RGBA").resize((56, 56), Image.LANCZOS)
    canvas.alpha_composite(rounded(icon, 14), (72, 92))
    d.text((140, 120), "도착했어", font=font("heavy", 30), fill="white", anchor="lm")
    head = font("heavy", 56)
    d.text((72, 182), "가족이 도착하면", font=head, fill="white")
    d.text((72, 254), "먼저 알려 드려요", font=head, fill="white")
    d.text((72, 352), "위치 공유 · 도착 알림 · 이동 기록", font=font("semibold", 24), fill=(255, 255, 255, 220))

    # 오른쪽: 활동 로그(뒤) + 홈(앞) 휴대폰, 아래는 잘려도 된다(화면 위쪽이 핵심)
    for shot, pw, x, y in ((log_shot, 226, 800, 78), (home_shot, 250, 616, 44)):
        ph = phone(Image.open(shot), pw, android=True)
        shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((x, y + 16, x + pw, y + ph.height + 16), round(pw * 0.08),
                                                 fill=(0, 0, 20, 120))
        canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(16)))
        canvas.alpha_composite(ph, (x, y))

    # 도착 알림 카드가 휴대폰 앞에 떠 있게
    card = arrival_card(330)
    cx, cy = 560, 300
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((cx, cy + 10, cx + card.width, cy + card.height + 10), 22,
                                             fill=(0, 0, 30, 110))
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(14)))
    canvas.alpha_composite(card, (cx, cy))
    return canvas.convert("RGB")


def hero(shots: list[Path], w: int, h: int, title: str | None, sub: str | None) -> Image.Image:
    """App Store 제품 페이지 헤더·검색 결과 자산. 방향별로 가운데 기준으로 잘리므로 핵심 요소를 가운데에 둔다.

    shots: [왼쪽, 가운데, 오른쪽] 화면. title 이 없으면 글자 없이 휴대폰만(헤더 — 앱 이름은 스토어가 덮어 표시).
    """
    canvas = gradient(w, h, "#000C6E", "#2236E6")
    # 가운데 휴대폰 뒤 은은한 빛
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((w * 0.32, h * 0.18, w * 0.68, h * 1.15), fill=(120, 150, 255, 90))
    canvas = Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(w * 0.04)))

    top = round(h * 0.075)
    if title:
        d = ImageDraw.Draw(canvas)
        tf = fit_font(d, title, "heavy", round(h * 0.062), round(w * 0.8))
        d.text((w / 2, top), title, font=tf, fill="white", anchor="ma")
        top += round(tf.size * 1.35)
        if sub:
            sf = fit_font(d, sub, "medium", round(h * 0.03), round(w * 0.8))
            d.text((w / 2, top), sub, font=sf, fill=(255, 255, 255, 215), anchor="ma")
            top += round(sf.size * 1.4)
        top += round(h * 0.03)
    else:
        top = round(h * 0.09)

    # 가운데 휴대폰이 남은 높이의 대부분을 쓰고 아래는 잘려도 된다(화면 위쪽이 핵심)
    center_w = round((h - top) * 0.52)
    side_w = round(center_w * 0.86)
    gap = round(center_w * 0.18)
    layout = [  # (화면, 폭, 가운데 x, 위쪽 y)
        (shots[0], side_w, w / 2 - center_w / 2 - gap - side_w / 2, top + round(h * 0.07)),
        (shots[2], side_w, w / 2 + center_w / 2 + gap + side_w / 2, top + round(h * 0.07)),
        (shots[1], center_w, w / 2, top),
    ]
    for shot, pw, cx, y in layout:
        ph = phone(Image.open(shot), pw)
        x = round(cx - ph.width / 2)
        shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((x, y + 40, x + ph.width, y + ph.height + 40), round(pw * 0.11),
                                                 fill=(0, 0, 20, 120))
        canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(pw * 0.06)))
        canvas.alpha_composite(ph, (x, y))
    return canvas.convert("RGB")


def main() -> None:
    sizes = {"android": (1080, 1920), "ios": (1320, 2868), "ipad": (2064, 2752), "android-tablet": (1440, 2560)}
    if len(sys.argv) != 4 or sys.argv[2] not in sizes:
        sys.exit(__doc__)
    src, platform, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    w, h = sizes[platform]
    is_tablet = platform in ("ipad", "android-tablet")
    for i, (name, title, sub, colors) in enumerate(SLIDES, 1):
        path = src / f"{name}.png"
        if not path.exists():
            sys.exit(f"캡처 없음: {path}")
        slide(path, title, sub, colors, w, h, android=platform.startswith("android"), is_tablet=is_tablet).save(
            out / f"{platform.replace('-', '_')}_{i:02d}_{name[2:]}.png", optimize=True)
    if is_tablet:
        pass  # 대표 그래픽·헤더는 휴대폰용을 같이 쓴다
    elif platform == "android":
        feature_graphic(src / "1_home.png", src / "5_log.png").save(out / "android_feature_1024x500.png", optimize=True)
    else:
        trio = [src / "6_notice.png", src / "1_home.png", src / "5_log.png"]
        hero(trio, 3840, 1646, None, None).save(out / "ios_header_3840x1646.png", optimize=True)
        hero(trio, 3840, 2560, "도착하면 먼저 알려 드려요", "가족 위치 공유 · 도착 알림 · 이동 기록").save(
            out / "ios_search_3840x2560.png", optimize=True)
    print(f"{platform}: {out}")


if __name__ == "__main__":
    main()
