'use strict';
(() => {
  let guide, chapterIndex = 0, activeSegment = -1, syncing = false, initialising = false;
  const el = id => document.getElementById(id);
  const player = el('audio-player');
  el('open-audio-guide').onclick = () => {
    el('audio-guide').open = true;
    el('audio-guide').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start'});
    el('audio-guide').querySelector('summary').focus({preventScroll:true});
  };
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const chapter = () => guide.chapters[chapterIndex];
  const events = {};
  function status(text) { el('audio-status').textContent = text; }
  function withinSync(fn) { syncing = true; try { return fn(); } finally { syncing = false; } }
  function revealChapter() {
    const ids = new Set(window.atlas.getState().filteredIds);
    if (chapter().segments.every(s => ids.has(s.event))) return;
    withinSync(() => {
      window.atlas.resetFilters(false);
      el('journey').value = chapter().id;
      window.atlas.applyFilters({fit:false});
    });
  }
  function showEvent(id) {
    withinSync(() => {
      window.atlas.pause();
      if (!window.atlas.getState().filteredIds.includes(id)) {
        window.atlas.resetFilters(false);
        el('journey').value = events[id].journey;
        window.atlas.applyFilters({fit:false});
      }
      window.atlas.selectEvent(id);
    });
  }
  function updatePassage(moveMap = false) {
    if (!guide) return;
    const segments = chapter().segments;
    let index = segments.findLastIndex(s => player.currentTime >= s.start);
    if (index < 0) index = 0;
    if (index !== activeSegment) {
      activeSegment = index;
      el('audio-transcript').querySelectorAll('.audio-passage').forEach((row, i) => {
        row.classList.toggle('spoken', i === index);
        const jump = row.querySelector('.audio-cue');
        if (i === index) jump.setAttribute('aria-current', 'true');
        else jump.removeAttribute('aria-current');
      });
      const row = el('audio-transcript').querySelector(`[data-passage="${index}"]`);
      if (row && !player.paused && el('audio-guide').open) {
        const track = el('audio-transcript');
        const top = row.getBoundingClientRect().top - track.getBoundingClientRect().top;
        if (top < 0 || top > track.clientHeight - 80) track.scrollTop += top - 15;
      }
      if (moveMap && el('audio-follow').checked) showEvent(segments[index].event);
    } else if (moveMap && el('audio-follow').checked && window.atlas.getState().selectedId !== segments[index].event) {
      showEvent(segments[index].event);
    }
  }
  function setChapter(index, resume = false) {
    if (!guide || index < 0 || index >= guide.chapters.length) return;
    player.pause();
    chapterIndex = index;
    activeSegment = -1;
    const c = chapter();
    el('audio-chapter').value = c.id;
    player.src = c.audio;
    player.playbackRate = Number(el('audio-rate').value);
    player.setAttribute('aria-label', `Indian English narration: ${c.title}`);
    el('audio-chapter-meta').textContent = `${c.years} · Chapter ${index + 1} of ${guide.chapters.length}`;
    el('audio-duration').textContent = `${clock(c.duration)} · ${clock(guide.totalDuration)} total`;
    el('audio-prev').disabled = index === 0;
    el('audio-next').disabled = index === guide.chapters.length - 1;
    el('audio-transcript-title').textContent = c.title;
    el('audio-transcript').innerHTML = c.segments.map((s, i) => {
      const event = events[s.event];
      return `<div class="audio-passage" data-passage="${i}"><button class="audio-cue" data-cue="${i}" aria-label="Listen from ${clock(s.start)}: ${safe(event.title)}"><span>${clock(s.start)}</span>${safe(event.date)} · ${safe(window.atlas.data.locations[event.location].name)}</button><p>${safe(s.text)}</p><details class="audio-evidence"><summary>Historical events & sources</summary><ul>${s.sources.map(id => `<li><a href="#event=${encodeURIComponent(id)}" data-audio-event="${safe(id)}">${safe(events[id].date)} · ${safe(events[id].title)}</a></li>`).join('')}</ul></details></div>`;
    }).join('');
    el('audio-transcript').scrollTop = 0;
    el('audio-transcript').querySelectorAll('[data-cue]').forEach(button => button.onclick = () => {
      const time = c.segments[Number(button.dataset.cue)].start;
      const seek = () => { player.currentTime = time; updatePassage(true); tryPlay(); };
      if (player.readyState >= 1) seek();
      else { player.addEventListener('loadedmetadata', seek, {once:true}); player.load(); }
    });
    el('audio-transcript').querySelectorAll('[data-audio-event]').forEach(link => link.onclick = event => {
      event.preventDefault(); player.pause(); showEvent(link.dataset.audioEvent);
      document.querySelector('.workspace').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start'});
    });
    updatePassage();
    status(`Ready to listen · ${guide.voice}`);
    if (resume) tryPlay();
  }
  function tryPlay() {
    player.play().catch(() => status('Press play on the audio player to listen.'));
  }
  async function init() {
    if (initialising || !window.atlas) return;
    initialising = true;
    try {
      const response = await fetch('narration.json');
      if (!response.ok) throw new Error('Audio guide unavailable');
      guide = await response.json();
      window.atlas.data.events.forEach(event => events[event.id] = event);
      el('audio-chapter').innerHTML = guide.chapters.map((c, i) => `<option value="${safe(c.id)}">${String(i + 1).padStart(2, '0')} · ${safe(c.title)}</option>`).join('');
      el('audio-chapter').disabled = false;
      el('audio-current').disabled = false;
      el('audio-disclosure').textContent = guide.disclosure;
      el('audio-chapter').onchange = () => setChapter(guide.chapters.findIndex(c => c.id === el('audio-chapter').value));
      el('audio-prev').onclick = () => setChapter(chapterIndex - 1, !player.paused);
      el('audio-next').onclick = () => setChapter(chapterIndex + 1, !player.paused);
      el('audio-rate').onchange = () => { player.playbackRate = Number(el('audio-rate').value); };
      el('audio-follow').onchange = () => { if (el('audio-follow').checked && !player.paused) { revealChapter(); updatePassage(true); } };
      el('audio-current').onclick = () => {
        const event = events[window.atlas.getState().selectedId];
        if (!event) { status('Select an event on the map or timeline first.'); return; }
        setChapter(guide.chapters.findIndex(c => c.id === event.journey));
        el('audio-guide').open = true;
        tryPlay();
      };
      player.addEventListener('play', () => {
        window.atlas.pause();
        if (el('audio-follow').checked) revealChapter();
        updatePassage(true);
        status(`Listening · ${guide.voice}`);
      });
      player.addEventListener('pause', () => { if (guide) status(`Paused · ${chapter().title}`); });
      player.addEventListener('timeupdate', () => updatePassage(!player.paused));
      player.addEventListener('seeked', () => updatePassage(true));
      player.addEventListener('ended', () => {
        if (el('audio-continue').checked && chapterIndex < guide.chapters.length - 1) setChapter(chapterIndex + 1, true);
        else status(chapterIndex === guide.chapters.length - 1 ? 'The audio journey is complete.' : 'Chapter complete. Choose another chapter to continue.');
      });
      player.addEventListener('error', () => status('Audio could not load. Try choosing the chapter again; the transcript remains available.'));
      const manualChange = () => { if (!syncing && !player.paused) { player.pause(); status('Narration paused while you explore. Press play to resume.'); } };
      window.addEventListener('atlas:selection', manualChange);
      window.addEventListener('atlas:filters', manualChange);
      window.addEventListener('atlas:animation', manualChange);
      window.addEventListener('pagehide', () => player.pause());
      window.audioGuide = {selectChapter:id => setChapter(guide.chapters.findIndex(c => c.id === id)), getState:() => ({chapter:chapter().id, segment:activeSegment, paused:player.paused, following:el('audio-follow').checked}), guide};
      setChapter(0);
      if (window.atlas.initialHash === '#audio-guide') el('audio-guide').open = true;
    } catch (error) {
      status('The audio guide could not open. Reload the page to try again.');
      console.error(error);
    }
  }
  window.addEventListener('atlas:ready', init, {once:true});
  if (window.atlas) init();
})();
