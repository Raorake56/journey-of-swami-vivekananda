"""Regenerate the bundled guide with edge-tts and ffprobe installed.

The site plays the finished MP3 files; no speech service is called by visitors.
Word-boundary timestamps connect the spoken paragraphs to historical events.
"""
import asyncio
import argparse
import hashlib
import html
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import tempfile

import edge_tts
import edge_tts.communicate

# Use the execution environment's trusted certificate store.
edge_tts.communicate._SSL_CTX = ssl.create_default_context()
ROOT = Path(__file__).resolve().parent
SCRIPT = ROOT / "dist/narration.json"
guide = json.loads(SCRIPT.read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("chapters", nargs="*", help="Regenerate only the named chapter IDs; omit for all chapters.")
args = parser.parse_args()
unknown = set(args.chapters) - {c["id"] for c in guide["chapters"]}
if unknown:
    parser.error(f"Unknown chapters: {', '.join(sorted(unknown))}")
output = ROOT / "dist/assets/audio"
output.mkdir(parents=True, exist_ok=True)
gate = asyncio.Semaphore(3)

async def generate(chapter):
    async with gate:
        text = " ".join(s["text"] for s in chapter["segments"])
        positions, pos = [], 0
        for segment in chapter["segments"]:
            positions.append(pos)
            pos += len(segment["text"]) + 1
        boundaries = []
        with tempfile.TemporaryDirectory(prefix="atlas-narration-") as temp:
            audio_path = Path(temp) / "chapter.mp3"
            stream = edge_tts.Communicate(
                text, guide["voiceId"], rate="-8%", boundary="WordBoundary",
                connect_timeout=15, receive_timeout=60,
            )
            with audio_path.open("wb") as audio:
                async for chunk in stream.stream():
                    if chunk["type"] == "audio":
                        audio.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        boundaries.append(chunk)
            cursor, cues = 0, [None] * len(positions)
            for boundary in boundaries:
                word = html.unescape(boundary["text"])
                found = text.find(word, cursor)
                if found < 0:
                    found = text.lower().find(word.lower(), cursor)
                if found < 0:
                    continue
                for i, start in enumerate(positions):
                    end = positions[i + 1] if i + 1 < len(positions) else len(text)
                    if start <= found < end and cues[i] is None:
                        cues[i] = round(boundary["offset"] / 10_000_000, 3)
                cursor = found + len(word)
            if any(cue is None for cue in cues):
                raise ValueError(f"Missing paragraph timing in {chapter['id']}: {cues}")
            duration = float(subprocess.check_output([
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)
            ]))
            if audio_path.stat().st_size < 10000 or duration < 30:
                raise ValueError(f"Incomplete narration: {chapter['id']}")
            for i, segment in enumerate(chapter["segments"]):
                segment["start"] = 0 if i == 0 else cues[i]
                segment["end"] = cues[i + 1] if i + 1 < len(cues) else round(duration, 3)
            chapter["audio"] = f"assets/audio/{chapter['id']}.mp3"
            chapter["duration"] = round(duration, 3)
            chapter["scriptSha256"] = hashlib.sha256(text.encode("utf-8")).hexdigest()
            shutil.copyfile(audio_path, output / f"{chapter['id']}.mp3")
            print(f"Generated {chapter['id']}: {duration:.1f}s, {len(cues)} map cues", flush=True)

async def main():
    await asyncio.gather(*(generate(chapter) for chapter in guide["chapters"] if not args.chapters or chapter["id"] in args.chapters))
    guide["totalDuration"] = round(sum(c["duration"] for c in guide["chapters"]), 3)
    replacement = SCRIPT.with_suffix(".new.json")
    replacement.write_text(json.dumps(guide, ensure_ascii=False, indent=2) + "\n")
    os.replace(replacement, SCRIPT)
    lines = [guide["title"], guide["disclosure"], "", "Dates and route cautions follow the sourced atlas. Each passage names its related historical event IDs.", ""]
    for chapter in guide["chapters"]:
        lines.extend([f"{chapter['title']} ({chapter['years']})", ""])
        for segment in chapter["segments"]:
            seconds = int(segment["start"])
            lines.extend([f"[{seconds // 60}:{seconds % 60:02}] {segment['text']}", f"Historical event IDs: {', '.join(segment['sources'])}", ""])
    (ROOT / "dist/narration-transcript.txt").write_text("\n".join(lines), encoding="utf-8")
    print(f"Audio guide ready: {guide['totalDuration'] / 60:.1f} minutes", flush=True)

asyncio.run(main())
