"""OpenAI Images API(gpt-image-2.5-sunburst)로 앱 아이콘 후보를 만든다.

키는 환경변수 OPENAI_API_KEY 에서만 읽는다(파일에 쓰지 않는다). 2026-11-17 에는 키가 있는 서버(ssh aws)의
임시 폴더에서 실행하고 결과 PNG 만 내려받았다:
  scp tools/brand/generate_icon_openai.py aws:/tmp/smap_icon/ && ssh aws 'cd /tmp/smap_icon && python3 generate_icon_openai.py 2'
채택: A_glass_pin_check_1 → tools/brand/app_icon_source.png. 이후 make_icons.py 로 모든 크기를 만든다.
"""
import base64, json, os, sys, urllib.request, concurrent.futures as cf

MODEL = "gpt-image-2.5-sunburst"
COMMON = """Use case: app icon (iOS App Store + Google Play), final production artwork.
App: a family location-sharing app named "I've arrived" — family members get a gentle notification when someone arrives home, at school or at an after-school academy. Feeling: safe, warm, reassuring, modern, premium.
Canvas: full-bleed square that fills the entire canvas edge to edge. The OS applies its own rounded mask, so: NO rounded corners, NO device or app-tile frame, NO border, NO outer drop shadow, NO mockup, NO text, letters, numbers or logos anywhere.
Color: brand navy blue (#0113A3) as the dominant background color, with a smooth luminous gradient toward a brighter royal blue (#3B5BFF); white as the main symbol color; at most ONE small warm accent color if the concept calls for it.
Readability: one bold, simple, centered symbol with a strong silhouette that stays recognizable at 29x29 px; symbol occupies about 55-62% of the canvas width; generous even padding; no thin lines, no tiny details, no clutter.
Rendering quality: top-tier App Store icon craftsmanship — crisp geometric shapes, precise curves, refined soft lighting with subtle highlights and gentle inner depth, clean anti-aliased edges. Not cartoonish, not photorealistic, no noise, no watermark."""

CONCEPTS = {
    "A_glass_pin_check": "Symbol: a single map location pin made of soft frosted-glass white material with a subtle luminous inner glow; inside its round head a bold, friendly check mark carved out so the navy background shows through. The pin is perfectly symmetric and slightly plump, the tip sharp. A very soft ground glow under the pin tip suggests 'landed / arrived'.",
    "B_two_pins_check": "Symbol: two white location pins of slightly different sizes (a parent and a child) leaning toward each other so that the negative space between their pointed tips forms a clear check mark shape. Clever, minimal, geometric logo-like mark with soft depth. No other elements.",
    "C_home_light": "Symbol: a white location pin whose round head contains a simple house front with an open doorway; warm golden light (#FFB84D) glows from the doorway as the single accent color, conveying 'I'm home, safe'. Calm night-like navy background with a soft gradient. Minimal and iconic.",
    "D_bubble_pin": "Symbol: a white rounded chat speech bubble (friendly message) with a small tail at the lower left; inside it a navy location pin whose head contains a tiny white check mark, as if the message says 'I've arrived'. A tiny warm coral notification dot (#FF6B5B) at the bubble's upper right corner as the single accent. Balanced, centered, iconic.",
}

def generate(key, name, prompt, n):
    body = {"model": MODEL, "prompt": COMMON + "\n" + prompt, "size": "1024x1024", "quality": "high", "n": n}
    req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        return f"{name}: HTTP {e.code} {e.read().decode()[:300]}"
    out = []
    for i, item in enumerate(data.get("data", []), 1):
        path = f"{name}_{i}.png"
        with open(path, "wb") as f:
            f.write(base64.b64decode(item["b64_json"]))
        out.append(path)
    return f"{name}: {out}"

if __name__ == "__main__":
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("OPENAI_API_KEY 없음")
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    with cf.ThreadPoolExecutor(4) as ex:
        for res in ex.map(lambda kv: generate(key, kv[0], kv[1], n), CONCEPTS.items()):
            print(res, flush=True)
