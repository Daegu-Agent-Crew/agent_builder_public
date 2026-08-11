#!/usr/bin/env python3
"""
patterns-index.md 와 분석 기록에서 data.json을 생성한다.
Usage: python3 generate-data.py
"""
import json
import os
import re
import glob
from pathlib import Path

BASE = Path(__file__).parent
TM_CONTEXT = Path(os.path.expanduser("~/.openclaw/workspace/team-memory/context"))
PATTERNS_FILE = TM_CONTEXT / "thinking-method" / "patterns-index.md"
RECORDS_DIR = TM_CONTEXT / "records"

def parse_patterns(md_text):
    """patterns-index.md에서 패턴 목록을 추출"""
    patterns = []
    current_category = None
    cat_map = {
        "인지 패턴": ("cognitive", "C", "#3b82f6"),
        "수사 패턴": ("rhetorical", "R", "#10b981"),
        "가치 패턴": ("value", "V", "#f59e0b"),
        "표현 패턴": ("expressive", "E", "#ef4444"),
    }
    
    lines = md_text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Category header
        if line.startswith("## ") and "패턴" in line:
            for k, v in cat_map.items():
                if k in line:
                    current_category = v
                    break
            i += 1
            continue
        
        # Pattern header: ### C-01: 이름 or ### C-01: 이름 (신규 후보)
        m = re.match(r'^### ([CREV])-(\d+):\s+(.+?)(?:\s*\(.*\))?$', line)
        if m and current_category:
            prefix, num, name = m.group(1), m.group(2), m.group(3).strip()
            code = f"{prefix}-{num}"
            is_new = "신규" in line
            
            # Collect description and frequency until next ### or ##
            desc_lines = []
            freq = 0
            speakers = []
            j = i + 1
            while j < len(lines):
                l = lines[j].strip()
                if l.startswith("### ") or l.startswith("## "):
                    break
                if l.startswith("- 빈도:"):
                    try:
                        freq = int(re.search(r'\d+', l).group())
                    except:
                        pass
                elif l.startswith("- 사례:"):
                    # extract speaker names from 사례 line
                    pass
                elif l and not l.startswith("-") and not l.startswith(">"):
                    desc_lines.append(l)
                j += 1
            
            description = " ".join(desc_lines).strip()
            patterns.append({
                "code": code,
                "name": name,
                "category": current_category[0],
                "categoryName": current_category[1] + " 패턴",
                "prefix": prefix,
                "color": current_category[2],
                "frequency": freq,
                "description": description,
                "isNew": is_new
            })
            i = j
            continue
        i += 1
    
    return patterns

def parse_speakers(md_text):
    """patterns-index.md의 화자별 패턴 지형 요약 테이블에서 화자 정보 추출"""
    speakers = []
    lines = md_text.split("\n")
    in_table = False
    
    for i, line in enumerate(lines):
        if "| 화자 |" in line:
            in_table = True
            continue
        if in_table and line.startswith("|") and "---" not in line:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 5:
                name = parts[1]
                if name and name != "화자":
                    speakers.append({
                        "name": name,
                        "strengths": parts[2] if len(parts) > 2 else "",
                        "weaknesses": parts[3] if len(parts) > 3 else ""
                    })
        elif in_table and not line.startswith("|"):
            in_table = False
            break
    
    return speakers

def parse_analyses():
    """records/ 디렉토리에서 분석 기록 메타데이터 추출"""
    analyses = []
    
    # Known discourse pattern analysis files
    analysis_specs = [
        {
            "id": "boris-cherny-yc",
            "date": "2026-07-30",
            "title": "Boris Cherny — Claude Code 프롬프트 80% 삭제",
            "source": "https://youtu.be/qyPCVqFUyDo",
            "speaker": "보리스 체르니",
            "type": "담화 패턴",
            "file": "2026-07-30-boris-cherny-claude-code-prompt-yc.md"
        },
        {
            "id": "elon-musk-economist",
            "date": "2026-07-31",
            "title": "일론 머스크 — The Economist 인터뷰",
            "source": "https://youtu.be/M0N-Hxgqi7I",
            "speaker": "일론 머스크",
            "type": "담화 패턴",
            "file": "2026-07-31-elon-musk-economist-interview.md"
        },
        {
            "id": "physical-ai-debate",
            "date": "2026-07-15",
            "title": "피지컬 AI 토론 — 박종훈·천홍석·김호정",
            "source": "https://youtu.be/69k4XtQKuvM",
            "speaker": "다자 (사회자·박종훈·천홍석·김호정)",
            "type": "담화 패턴",
            "file": "2026-07-15-physical-ai-discourse-pattern-analysis.md"
        },
        {
            "id": "ep108-photonics",
            "date": "2026-08-09",
            "title": "EP108 실리콘 포토닉스 — 노정석·박준우·김태환",
            "source": "",
            "speaker": "노정석·박준우·김태환",
            "type": "담화 패턴",
            "file": "2026-08-09-ep108-silicon-photonics-discourse-analysis.md",
            "scores": {
                "노정석": 4.2,
                "박준우": 4.2,
                "김태환": 4.8
            }
        },
        {
            "id": "ep103-choi-seungjun",
            "date": "2026-07-13",
            "title": "EP103 최승준 — 사고 패턴 분석",
            "source": "https://youtu.be/PYpRfmwo92E",
            "speaker": "최승준",
            "type": "사고 패턴",
            "file": "2026-07-13-ep103-choi-seungjun-analysis.md"
        },
        {
            "id": "deepseek-sukhyun",
            "date": "2026-07-12",
            "title": "석현 대표 — DeepSeek 진실 + AI 사업기획",
            "source": "https://youtu.be/JjoGi_sAa5M",
            "speaker": "고석현",
            "type": "영상 요약",
            "file": "2026-07-12-deepseek-go-suk-hyun-analysis.md"
        }
    ]
    
    for spec in analysis_specs:
        fpath = RECORDS_DIR / spec["file"]
        if fpath.exists():
            spec["exists"] = True
        else:
            spec["exists"] = False
        analyses.append(spec)
    
    # Sort by date descending
    analyses.sort(key=lambda x: x["date"], reverse=True)
    return analyses

def main():
    # Read patterns index
    with open(PATTERNS_FILE, "r", encoding="utf-8") as f:
        md = f.read()
    
    patterns = parse_patterns(md)
    speakers_raw = parse_speakers(md)
    analyses = parse_analyses()
    
    # Compute stats
    total_freq = sum(p["frequency"] for p in patterns)
    by_category = {}
    for p in patterns:
        cat = p["category"]
        by_category[cat] = by_category.get(cat, 0) + 1
    
    data = {
        "meta": {
            "version": 1,
            "generatedAt": "2026-08-11",
            "totalPatterns": len(patterns),
            "totalFrequency": total_freq,
            "totalAnalyses": len(analyses),
            "totalSpeakers": len(speakers_raw),
            "byCategory": by_category
        },
        "categories": [
            {"id": "cognitive", "name": "인지 패턴", "prefix": "C", "color": "#3b82f6", "icon": "🧠"},
            {"id": "rhetorical", "name": "수사 패턴", "prefix": "R", "color": "#10b981", "icon": "🎭"},
            {"id": "value", "name": "가치 패턴", "prefix": "V", "color": "#f59e0b", "icon": "⚖️"},
            {"id": "expressive", "name": "표현 패턴", "prefix": "E", "color": "#ef4444", "icon": "✨"}
        ],
        "patterns": patterns,
        "speakers": speakers_raw,
        "analyses": analyses
    }
    
    out = BASE / "data.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Generated {out}")
    print(f"   Patterns: {len(patterns)} | Speakers: {len(speakers_raw)} | Analyses: {len(analyses)}")
    print(f"   Total frequency: {total_freq}")

if __name__ == "__main__":
    main()
