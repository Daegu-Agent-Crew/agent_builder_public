#!/usr/bin/env python3
"""
youtube-dashboard용 data.json 생성.
team-memory/context/records/ 의 마크다운 파일들을 스캔하여
영상 요약/분석 메타데이터를 추출한다.

Usage: python3 generate-data.py
"""
import json
import os
import re
import glob
from pathlib import Path

BASE = Path(__file__).parent
RECORDS_DIR = Path(os.path.expanduser(
    "~/.openclaw/workspace/team-memory/context/records"
))

def extract_metadata(filepath):
    """마크다운 파일에서 영상 메타데이터 추출"""
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()
    
    result = {
        "filename": filepath.name,
        "title": "",
        "videoUrl": "",
        "channel": "",
        "speaker": "",
        "date": "",
        "summarizer": "",
        "type": "unknown",
        "coreMessage": "",
        "sections": [],
        "source": "",
        "exists": True
    }
    
    # 제목: 첫 번째 # 헤더
    m = re.search(r'^#\s+(.+)$', text, re.MULTILINE)
    if m:
        result["title"] = m.group(1).strip().rstrip('- 영상 요약').rstrip('- 담화 패턴 분석').strip()
    
    # 비디오 URL
    m = re.search(r'https?://youtu\.be/([A-Za-z0-9_-]+)', text)
    if not m:
        m = re.search(r'https?://www\.youtube\.com/watch\?v=([A-Za-z0-9_-]+)', text)
    if m:
        vid = m.group(1)
        result["videoUrl"] = f"https://youtu.be/{vid}"
        result["thumbnail"] = f"https://img.youtube.com/vi/{vid}/mqdefault.jpg"
    
    # 메타데이터 테이블 또는 리스트에서 추출
    # 채널
    m = re.search(r'\*\*채널\*\*[::]\s*(.+)', text)
    if not m:
        m = re.search(r'채널[::]\s*(.+)', text)
    if m:
        result["channel"] = m.group(1).strip().rstrip('|').strip()
    
    # 화자/게스트/인터뷰 대상
    m = re.search(r'\*\*(?:게스트|인터뷰 대상|분석 대상|대화자)\*\*[::]\s*(.+)', text)
    if not m:
        m = re.search(r'\*\*화자\*\*[::]\s*(.+)', text)
    if m:
        result["speaker"] = m.group(1).strip().rstrip('|').strip()
    
    # 날짜
    m = re.search(r'(?:요약|분석)\s*일자[::]\s*(\d{4}-\d{2}-\d{2})', text)
    if not m:
        m = re.search(r'\*\*(?:요약|분석)\s*일자\*\*[::]\s*(\d{4}-\d{2}-\d{2})', text)
    if not m:
        # 파일명에서 날짜 추출
        m_fn = re.match(r'(\d{4}-\d{2}-\d{2})', filepath.name)
        if m_fn:
            result["date"] = m_fn.group(1)
    if m:
        result["date"] = m.group(1)
    
    # 요약자
    m = re.search(r'(?:요약|분석)자[::]\s*(.+)', text)
    if m:
        result["summarizer"] = m.group(1).strip().rstrip('|').strip()
    
    # 핵심 메시지
    m = re.search(r'(?:핵심\s*메시지|핵심 주장)\s*\n\s*[>:]\s*(.+?)(?:\n\n|\n##|\n---)', text, re.DOTALL)
    if m:
        result["coreMessage"] = m.group(1).strip()
    
    # 타입 판별
    title_lower = result["title"].lower()
    if "담화 패턴" in text or "패턴 분석" in text or "발화 패턴" in text:
        result["type"] = "담화 패턴 분석"
    elif "사고 패턴" in text:
        result["type"] = "사고 패턴 분석"
    elif "영상 요약" in text or "요약" in filepath.name:
        result["type"] = "영상 요약"
    elif "참가자 분석" in text or "participant" in filepath.name.lower():
        result["type"] = "참가자 분석"
    else:
        result["type"] = "기타"
    
    # 섹션 제목 추출 (## 헤더)
    sections = re.findall(r'^##\s+(.+)$', text, re.MULTILINE)
    # 필터: 메타데이터 섹션 제외
    skip = {"메타데이터", "핵심 메시지", "주의사항", "변경 이력", "품질 기준"}
    result["sections"] = [s for s in sections if s.strip() not in skip][:8]
    
    # GitHub 소스 링크
    result["source"] = f"https://github.com/Daegu-Agent-Crew/team-memory/blob/main/context/records/{filepath.name}"
    
    return result


def main():
    records = []
    
    if not RECORDS_DIR.exists():
        print(f"⚠️  Records dir not found: {RECORDS_DIR}")
        return
    
    for fpath in sorted(RECORDS_DIR.glob("*.md")):
        try:
            meta = extract_metadata(fpath)
            # 영상 URL이 있는 것만 포함
            if meta["videoUrl"]:
                records.append(meta)
        except Exception as e:
            print(f"  ⚠️  Skip {fpath.name}: {e}")
    
    # 날짜 역순 정렬
    records.sort(key=lambda x: x["date"], reverse=True)
    
    # 통계
    channels = {}
    types = {}
    for r in records:
        ch = r["channel"] or "미상"
        channels[ch] = channels.get(ch, 0) + 1
        types[r["type"]] = types.get(r["type"], 0) + 1
    
    # 월별 카운트
    monthly = {}
    for r in records:
        if r["date"]:
            month = r["date"][:7]
            monthly[month] = monthly.get(month, 0) + 1
    
    data = {
        "meta": {
            "version": 1,
            "generatedAt": "2026-08-11",
            "totalVideos": len(records),
            "totalChannels": len(channels),
            "byType": types,
            "byChannel": channels,
            "byMonth": monthly
        },
        "videos": records
    }
    
    out = BASE / "data.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Generated {out}")
    print(f"   Videos: {len(records)} | Channels: {len(channels)}")
    print(f"   Types: {types}")


if __name__ == "__main__":
    main()
