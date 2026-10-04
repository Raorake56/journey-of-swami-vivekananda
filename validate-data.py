"""Check chronology integrity without inferring missing historical dates."""
import json
from datetime import date
from pathlib import Path

data = json.loads((Path(__file__).parent / 'dist/data.json').read_text())
events = {e['id']: e for e in data['events']}
journeys = {j['id']: j for j in data['journeys']}
assert len(events) == len(data['events']), 'Duplicate event ID'
assert len({r['id'] for r in data['routes']}) == len(data['routes']), 'Duplicate route'
assert data['events'][0]['exactDate'] == '1863-01-12'
assert data['events'][-1]['exactDate'] == '1902-07-04'
used = set()
for i, e in enumerate(data['events']):
    assert e['order'] == i
    assert e['location'] in data['locations'] and e['journey'] in journeys
    assert 1863 <= e['startYear'] <= e['endYear'] <= 1902
    assert e['sources'] and e['description'] and e['significance']
    assert e['precision'] in {'exact', 'range', 'month', 'year', 'period', 'approximate'}
    if e['precision'] == 'exact':
        assert e['exactDate'] and date.fromisoformat(e['exactDate']).year == e['startYear']
    if e['endDate']:
        assert e['exactDate'] <= e['endDate']
    for r in e['sources']:
        assert r['id'] in data['sources'] and r['url'].startswith('https://')
    if e['quote']:
        assert e['quote']['source'] in data['sources']
    used.add(e['location'])
assert used == set(data['locations']), 'Orphan location'
for l in data['locations'].values():
    assert -90 <= l['lat'] <= 90 and -180 <= l['lng'] <= 180
    assert l['coordinateNote'] and l['present'] and l['country']
for r in data['routes']:
    a, b = events[r['from']], events[r['to']]
    assert a['order'] < b['order'], r['id']
    assert a['location'] != b['location'], r['id']
    assert r['journey'] in journeys and r['status'] in {'documented', 'illustrative'}
    assert r['note'] and r['mode'] and r['sources']
print(f"Validated {len(events)} events, {len(used)} locations and {len(data['routes'])} routes.")
