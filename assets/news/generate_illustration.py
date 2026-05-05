#!/usr/bin/env python3
"""
Codex에서 실행: ChatGPT image 2.0 (gpt-image-1) + 대구루 레퍼런스 이미지로
카드뉴스 일러스트 생성

사용법:
  python3 generate_illustration.py

필요:
  pip install openai pillow
  export OPENAI_API_KEY=sk-...
"""
import os, base64
from pathlib import Path
from openai import OpenAI

client = OpenAI()

# 대구루 레퍼런스 이미지 경로 (캐릭터 시트)
REF_IMAGE = Path(__file__).parent.parent.parent / "assets/daeguru/daeguru_9.png"
OUT_DIR   = Path(__file__).parent / "election2663-day01-report"

# ── 생성할 장면 목록 ─────────────────────────────────
SCENES = [
    dict(
        name="cover_char.png",
        prompt=(
            "Using ONLY the character shown in the reference image (the cute chibi lobster/crayfish mascot), "
            "draw a new illustration: the character is holding a laptop and waving enthusiastically. "
            "Style: soft pastel watercolor, gentle peach and lavender tones, "
            "kawaii minimalist, white background, NO TEXT, clean edges."
        ),
    ),
    dict(
        name="01_char.png",
        prompt=(
            "Using ONLY the character shown in the reference image, "
            "draw: the character sitting focused at a desk with a laptop, "
            "11 small news article cards floating around like a halo. "
            "Style: soft pastel watercolor, light blue and mint tones, "
            "kawaii minimalist, white background, NO TEXT."
        ),
    ),
    dict(
        name="02_char.png",
        prompt=(
            "Using ONLY the character shown in the reference image, "
            "draw: the character standing like a presenter, pointing at a whiteboard "
            "that shows a 9-step flowchart pipeline. Analyst/teacher pose. "
            "Style: soft pastel watercolor, lavender and light purple tones, "
            "kawaii minimalist, white background, NO TEXT."
        ),
    ),
    dict(
        name="03_char.png",
        prompt=(
            "Using ONLY the character shown in the reference image, "
            "draw: the character looking tense and worried, staring at two almost-equal "
            "bar charts (one blue, one red) side by side. Dramatic tension. "
            "Style: soft pastel watercolor, warm coral and peach tones, "
            "kawaii minimalist, white background, NO TEXT."
        ),
    ),
    dict(
        name="04_char.png",
        prompt=(
            "Using ONLY the character shown in the reference image, "
            "draw: the character happily holding a clipboard checklist, checking items with one claw. "
            "Small icons (house, school building, market stall) floating around. "
            "Style: soft pastel watercolor, fresh mint and light green tones, "
            "kawaii minimalist, white background, NO TEXT."
        ),
    ),
]


def generate_with_reference(scene: dict) -> Path:
    out_path = OUT_DIR / scene["name"]

    # 레퍼런스 이미지 읽기
    with open(REF_IMAGE, "rb") as f:
        ref_bytes = f.read()

    # gpt-image-1 edit endpoint: 레퍼런스 이미지를 기반으로 새 장면 생성
    result = client.images.edit(
        model="gpt-image-1",
        image=ref_bytes,
        prompt=scene["prompt"],
        size="1024x1024",
        quality="high",       # standard | high
    )

    # 결과 저장
    img_b64 = result.data[0].b64_json
    img_bytes = base64.b64decode(img_b64)
    out_path.write_bytes(img_bytes)
    print(f"✓ {scene['name']}")
    return out_path


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for scene in SCENES:
        generate_with_reference(scene)
    print("\n완료! compose_cards_v2.py 를 실행하여 카드 완성.")
