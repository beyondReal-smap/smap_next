#!/usr/bin/env python3
"""앱 아이콘 원본(app_icon_source.png) 한 장에서 두 앱의 아이콘·스플래시·로그인 로고를 모두 만든다.

사용:
  python3 -I tools/brand/make_icons.py               # 전부
  python3 -I tools/brand/make_icons.py --icons-only  # 앱 아이콘만(스플래시·로그인 로고는 그대로)

원본: OpenAI gpt-image-2.5-sunburst 로 만든 1024 정사각 아트워크(generate_icon_openai.py, 2026-11-17 채택).
     파란 그라데이션 바탕 + 반투명 유리 질감 흰 핀 + 머리 안 체크. 앱 이름 "도착했어".
색: 원본 바탕은 쨍한 파랑(#0113A3→#3B5BFF)이라 앱 화면의 차분한 남색과 겉돌아(2026-11-20 대표님 요청),
    핀을 떼어 낸 뒤 바탕을 앱 남색 그라데이션(NAVY_STOPS)으로 바꾸고 핀도 남색 위에 맞게 다시 칠한다(recolor_navy).

Android 적응형 아이콘 전경·스플래시는 "바탕 없이 핀만" 필요하다. 원본에서 바탕 그라데이션을 2차 곡면으로
추정한 뒤, 각 화소를 "흰 핀 × a + 바탕 × (1−a)" 로 풀어(언블렌딩) 투명도를 되살린다.
유리 질감·체크 구멍(남색)·핀 끝 빛번짐이 반투명으로 남아, 남색 바탕 위에 다시 올리면 원본과 같게 보인다.

만드는 파일:
- iOS  AppIcon.appiconset/*.png(Contents.json 의 모든 크기), SplashPins@2x/@3x, AppNoBg
- Android mipmap-*/ic_launcher.png(통짜), ic_launcher_adaptive_back/fore/monochrome,
          drawable-xxxhdpi/splash_pins.png, drawable/app_no_bg.png, res/ic_launcher-web.png(스토어 512)
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).with_name("app_icon_source.png")
IOS = ROOT / "iOS/smap/Assets.xcassets"
RES = ROOT / "Android/app/src/main/res"

# 스플래시에서 핀 높이 = 캔버스의 52%.
GLYPH_HEIGHT_IN_SAFE = 0.52
# 앱 아이콘의 핀 크기. 원본은 핀이 아이콘 높이의 74% 라 꽉 차 보여, 85% 로 줄여 약 63% 로 둔다(2026-11-19 대표님 요청).
ICON_GLYPH_SCALE = 0.85
# Android 적응형 아이콘 전경의 핀 높이(108dp 캔버스 기준). 보이는 영역(72dp)으로 환산하면 0.42×108/72 ≈ 63% —
# iOS 아이콘(ICON_GLYPH_SCALE 적용)과 같은 크기로 보이게 맞춘다. 안전 영역(지름 66dp) 안.
ADAPTIVE_GLYPH_HEIGHT = 0.42

# 아이콘 바탕 남색 그라데이션 — 앱 홈 강조색(family: deep #26496E · base #345F8C · bright #416996)을 축으로,
# 아이콘에선 깊이가 보이게 양 끝을 조금 더 벌렸다. 원본 바탕의 밝기 순서(왼쪽 아래 어둡게 → 오른쪽 위 밝게)를 그대로 따른다.
NAVY_STOPS = ((0.0, "1D3956"), (0.5, "345F8C"), (1.0, "4F79A5"))
# 핀 다시 칠하기 — 파란 기운을 빼고 남색 위에서 차갑게 보이는 흰색으로.
PIN_TINT = (0.95, 0.975, 1.0)
# 핀 밝기 끌어올림(1 이면 그대로, 작을수록 흰색 쪽)과 불투명도 곡선 지수(클수록 덜 비침).
# 유리 질감이 반투명이라 남색 바탕이 비치면 회색으로 보여, 둘 다 흰 쪽으로 당긴다.
PIN_LIFT = 0.55
PIN_OPACITY_POWER = 1.8


def load_master() -> Image.Image:
    img = Image.open(SOURCE).convert("RGB")
    if img.size != (1024, 1024):
        img = img.resize((1024, 1024), Image.LANCZOS)
    return img


def fit_background(rgb: np.ndarray, keep: np.ndarray) -> np.ndarray:
    """keep(바탕으로 확실한 화소)만으로 채널별 2차 곡면을 맞춰 전체 바탕을 추정한다."""
    h, w, _ = rgb.shape
    yy, xx = np.mgrid[0:h, 0:w]
    x = xx / w - 0.5
    y = yy / h - 0.5
    basis = np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], axis=-1)
    a = basis[keep]
    out = np.empty_like(rgb)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(a, rgb[..., c][keep], rcond=None)
        out[..., c] = basis @ coef
    return out


def extract_glyph(master: Image.Image) -> tuple[Image.Image, np.ndarray]:
    """(핀만 남긴 RGBA, 추정 바탕 RGB 배열) 를 돌려준다."""
    rgb = np.asarray(master, dtype=np.float64)
    r = rgb[..., 0]
    # 바탕은 빨강 채널이 낮다(남색). 핀·빛번짐 둘레를 넉넉히 빼고 나머지를 바탕 표본으로 쓴다.
    bright = r > 110  # 바탕 오른쪽 위 밝은 곳(빨강 ~60)은 빼고 핀(유리 질감 ≥150)만
    ys, xs = np.nonzero(bright)
    pad = 70
    keep = np.ones_like(bright)
    keep[max(ys.min() - pad, 0):ys.max() + pad, max(xs.min() - pad, 0):xs.max() + pad] = False
    bg = fit_background(rgb, keep)

    # 흰색(255)과 바탕 사이에서 섞인 비율 — 바탕과 흰색 차이가 가장 큰 빨강 채널로 계산.
    alpha = np.clip((r - bg[..., 0]) / (255.0 - bg[..., 0]), 0.0, 1.0)
    # 바탕 추정 오차로 핀 밖에 남는 옅은 잔여(사각 테두리처럼 보임)를 없앤다:
    # ① 아주 옅은 값은 잘라 내고 ② 핀 모양을 넉넉히 키운 영역 밖은 부드럽게 0 으로.
    alpha = np.clip((alpha - 0.06) / 0.94, 0.0, 1.0)
    region = Image.fromarray((bright * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(61))
    region = np.asarray(region.filter(ImageFilter.GaussianBlur(14)), dtype=np.float64) / 255.0
    alpha *= region
    safe = np.maximum(alpha, 1e-3)[..., None]
    fg = np.clip((rgb - (1 - alpha[..., None]) * bg) / safe, 0, 255)
    rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA"), bg


def _hex(h: str) -> np.ndarray:
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def recolor_navy(glyph: Image.Image, bg: np.ndarray) -> tuple[Image.Image, Image.Image, np.ndarray]:
    """(남색 바탕 위에 다시 올린 1024 아이콘, 다시 칠한 핀 RGBA, 남색 바탕 배열) 을 돌려준다.
    바탕: 원본 바탕의 밝기를 0~1 로 펴서 NAVY_STOPS 그라데이션으로 옮긴다(빛의 방향은 원본 그대로).
    핀: 밝기만 남겨 PIN_TINT 로 칠하고, 반투명도를 줄여 남색이 덜 비치게 한다. 체크 구멍은 투명이라 새 남색이 보인다."""
    lum = bg @ np.array([0.2126, 0.7152, 0.0722])
    t = np.clip((lum - lum.min()) / (lum.max() - lum.min()), 0.0, 1.0)
    navy = np.empty_like(bg)
    for (t0, c0), (t1, c1) in zip(NAVY_STOPS, NAVY_STOPS[1:]):
        m = (t >= t0) & (t <= t1)
        u = ((t[m] - t0) / (t1 - t0))[:, None]
        navy[m] = _hex(c0) + (_hex(c1) - _hex(c0)) * u

    g = np.asarray(glyph, dtype=np.float64)
    alpha = 1 - (1 - g[..., 3:] / 255.0) ** PIN_OPACITY_POWER
    light = (g[..., :3] @ np.array([0.2126, 0.7152, 0.0722]))[..., None]
    pin = np.clip((255 - (255 - light) * PIN_LIFT) * np.array(PIN_TINT), 0, 255)

    composed = pin * alpha + navy * (1 - alpha)
    master = Image.fromarray(composed.round().astype(np.uint8), "RGB")
    new_glyph = Image.fromarray(np.dstack([pin, alpha * 255]).round().astype(np.uint8), "RGBA")
    return master, new_glyph, navy


def silhouette(master: Image.Image) -> Image.Image:
    """테마(단색) 아이콘용 — 흰 핀 실루엣(불투명), 체크는 뚫림, 빛번짐은 뺀다.
    유리 질감의 반투명 알파를 그대로 쓰면 핀 안이 얼룩져 보여, 원본 밝기(빨강 110~150)로 경계만 부드럽게 잡는다."""
    r = np.asarray(master, dtype=np.float64)[..., 0]
    a = np.clip((r - 110) / 40, 0, 1) * 255
    img = Image.new("RGBA", master.size, (255, 255, 255, 0))
    img.putalpha(Image.fromarray(a.astype(np.uint8)))
    return img


def place(glyph: Image.Image, n: int, height_ratio: float) -> Image.Image:
    """핀을 잘라 n×n 투명 캔버스 가운데에 높이 비율로 놓는다."""
    box = glyph.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    g = glyph.crop(box)
    th = round(n * height_ratio)
    tw = round(g.width * th / g.height)
    g = g.resize((tw, th), Image.LANCZOS)
    out = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    out.alpha_composite(g, ((n - tw) // 2, (n - th) // 2))
    return out


def icon_master(master: Image.Image, bg: np.ndarray, scale: float) -> Image.Image:
    """원본 1024 아이콘에서 핀만 scale 배로 줄인다(핀 중심 고정).
    핀을 떼어 다시 올리면 유리 질감의 밝은 기운이 옅어져, "원본 − 추정 바탕"(핀·후광·빛번짐 전부)을
    통째로 줄여 바탕에 다시 더한다. 바탕은 매끈한 그라데이션이라 줄인 자리 둘레에 이음매가 생기지 않는다."""
    rgb = np.asarray(master, dtype=np.float64)
    n = rgb.shape[0]
    ys, xs = np.nonzero(rgb[..., 0] > 110)  # extract_glyph 와 같은 핀 판정
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    m = round(n * scale)
    ox, oy = round(cx - cx * scale), round(cy - cy * scale)
    out = bg.copy()
    for c in range(3):
        res = Image.fromarray((rgb[..., c] - bg[..., c]).astype(np.float32), "F").resize((m, m), Image.LANCZOS)
        out[oy:oy + m, ox:ox + m, c] += np.asarray(res, dtype=np.float64)
    return Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8), "RGB")


def rounded(img: Image.Image, radius_ratio: float = 0.2237) -> Image.Image:
    n = img.width
    m = Image.new("L", (n * 4, n * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, n * 4 - 1, n * 4 - 1), round(n * 4 * radius_ratio), fill=255)
    out = img.convert("RGBA")
    out.putalpha(m.resize((n, n), Image.LANCZOS))
    return out


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    print("  ", path.relative_to(ROOT), img.size)


def main(icons_only: bool = False) -> None:
    source = load_master()
    glyph, bg = extract_glyph(source)
    master, glyph, bg = recolor_navy(glyph, bg)
    background = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), "RGB")
    mono_src = silhouette(source)  # 단색 아이콘은 모양만 쓰여 원본 밝기로 잡는다
    # 앱 아이콘(iOS 전 크기·Android 통짜·스토어 512)과 로그인 로고(AppNoBg / app_no_bg)는 핀을 줄인 판으로 통일. 스플래시만 원본 그대로.
    icon = icon_master(master, bg, ICON_GLYPH_SCALE)

    print("iOS")
    appicon = IOS / "AppIcon.appiconset"
    sizes: dict[str, int] = {}
    for item in json.loads((appicon / "Contents.json").read_text())["images"]:
        name = item.get("filename")
        if not name:
            continue
        pt = float(item["size"].split("x")[0])
        scale = float(item.get("scale", "1x").rstrip("x"))
        sizes[name] = round(pt * scale)
    for name, px in sorted(sizes.items()):
        save(icon if px == 1024 else icon.resize((px, px), Image.LANCZOS), appicon / name)
    logo = rounded(icon)
    if not icons_only:
        for scale, px in (("2x", 578), ("3x", 867)):  # 289pt
            save(place(glyph, px, GLYPH_HEIGHT_IN_SAFE), IOS / f"SplashPins.imageset/splash_pins@{scale}.png")
        for name in ("app_no_bg.png", "app_no_bg 1.png", "app_no_bg 2.png"):
            save(logo, IOS / "AppNoBg.imageset" / name)

    print("Android")
    legacy = {"ldpi": 36, "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    adaptive = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
    for dpi, px in legacy.items():
        save(icon.resize((px, px), Image.LANCZOS), RES / f"mipmap-{dpi}/ic_launcher.png")
    for dpi, px in adaptive.items():
        save(background.resize((px, px), Image.LANCZOS), RES / f"mipmap-{dpi}/ic_launcher_adaptive_back.png")
        fore = place(glyph, px, ADAPTIVE_GLYPH_HEIGHT)
        save(fore, RES / f"mipmap-{dpi}/ic_launcher_adaptive_fore.png")
        # 테마 아이콘(단색): 모양(알파)만 쓰인다 — 불투명 실루엣(silhouette 참고)
        save(place(mono_src, px, ADAPTIVE_GLYPH_HEIGHT), RES / f"mipmap-{dpi}/ic_launcher_monochrome.png")
    save(icon.resize((512, 512), Image.LANCZOS), RES / "ic_launcher-web.png")
    if not icons_only:
        save(place(glyph, 960, GLYPH_HEIGHT_IN_SAFE), RES / "drawable-xxxhdpi/splash_pins.png")
        save(logo, RES / "drawable/app_no_bg.png")


if __name__ == "__main__":
    import sys

    main(icons_only="--icons-only" in sys.argv[1:])
