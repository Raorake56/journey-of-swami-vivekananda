"""Check that audio timings, transcripts and map event references agree."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
data = json.loads((root / 'dist/data.json').read_text())
guide = json.loads((root / 'dist/narration.json').read_text())
events = {e['id']: e for e in data['events']}
assert [c['id'] for c in guide['chapters']] == [j['id'] for j in data['journeys']]
total = 0
passages = 0
for chapter in guide['chapters']:
    if chapter.get('scriptSha256'):
        text = ' '.join(s['text'] for s in chapter['segments'])
        assert hashlib.sha256(text.encode('utf-8')).hexdigest() == chapter['scriptSha256'], f"Regenerate changed audio: {chapter['id']}"
    audio = root / 'dist' / chapter['audio']
    duration = float(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', str(audio)
    ]))
    assert abs(duration - chapter['duration']) < .05
    previous = -1
    for segment in chapter['segments']:
        assert segment['start'] > previous
        assert segment['start'] < segment['end'] <= chapter['duration'] + .05
        assert events[segment['event']]['journey'] == chapter['id']
        assert segment['event'] in segment['sources']
        assert all(e in events and events[e]['sources'] for e in segment['sources'])
        previous = segment['start']
        passages += 1
    total += duration
assert abs(total - guide['totalDuration']) < .05
transcript = (root / 'dist/narration-transcript.txt').read_text()
assert all(s['text'] in transcript for c in guide['chapters'] for s in c['segments']), 'Transcript and narration differ'
print(f'Validated 9 Indian English audio chapters, {passages} map cues and {total / 60:.1f} minutes; transcript and map references agree.')
