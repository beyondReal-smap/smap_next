#!/usr/bin/env python3
"""앱 아이콘 원본(app_icon_source.png) 한 장에서 두 앱의 아이콘·스플래시·로그인 로고를 모두 만든다.

사용:
  python3 -I tools/brand/make_icons.py

원본: OpenAI gpt-image-2.5-sunburst 로 만든 1024 정사각 아트워크(generate_icon_openai.py, 2026-11-17 채택).
     남색 그라데이션 바탕 + 반투명 유리 질감 흰 핀 + 머리 안 체크. 앱 이름 "도착했어".

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

# 적응형 아이콘 전경·스플래시에서 핀 높이 = 캔버스의 52% — Android 안전 영역(지름 66/108) 안.
GLYPH_HEIGHT_IN_SAFE = 0.52


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


def main() -> None:
    master = load_master()
    glyph, bg = extract_glyph(master)
    background = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), "RGB")
    mono_src = silhouette(master)

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
        save(master if px == 1024 else master.resize((px, px), Image.LANCZOS), appicon / name)
    for scale, px in (("2x", 578), ("3x", 867)):  # 289pt
        save(place(glyph, px, GLYPH_HEIGHT_IN_SAFE), IOS / f"SplashPins.imageset/splash_pins@{scale}.png")
    logo = rounded(master)
    for name in ("app_no_bg.png", "app_no_bg 1.png", "app_no_bg 2.png"):
        save(logo, IOS / "AppNoBg.imageset" / name)

    print("Android")
    legacy = {"ldpi": 36, "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    adaptive = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
    for dpi, px in legacy.items():
        save(master.resize((px, px), Image.LANCZOS), RES / f"mipmap-{dpi}/ic_launcher.png")
    for dpi, px in adaptive.items():
        save(background.resize((px, px), Image.LANCZOS), RES / f"mipmap-{dpi}/ic_launcher_adaptive_back.png")
        fore = place(glyph, px, GLYPH_HEIGHT_IN_SAFE)
        save(fore, RES / f"mipmap-{dpi}/ic_launcher_adaptive_fore.png")
        # 테마 아이콘(단색): 모양(알파)만 쓰인다 — 불투명 실루엣(silhouette 참고)
        save(place(mono_src, px, GLYPH_HEIGHT_IN_SAFE), RES / f"mipmap-{dpi}/ic_launcher_monochrome.png")
    save(place(glyph, 960, GLYPH_HEIGHT_IN_SAFE), RES / "drawable-xxxhdpi/splash_pins.png")
    save(logo, RES / "drawable/app_no_bg.png")
    save(master.resize((512, 512), Image.LANCZOS), RES / "ic_launcher-web.png")


if __name__ == "__main__":
    main()
