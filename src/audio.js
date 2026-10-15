// Local File objects become object URLs; no bytes are sent to a server.
export function validateAudioFile(file) {
  if (!file || !Number.isFinite(file.size) || file.size <= 0) throw new Error('这个文件是空的，请重新选择一段音乐。');
  const audioType = /^audio\//i.test(file.type || '');
  const audioName = /\.(mp3|m4a|wav|ogg|aac|flac|opus|aiff?|webm)$/i.test(file.name || '');
  if (!audioType && !audioName) throw new Error('请选择音频文件，例如 MP3、M4A、WAV 或 OGG。');
  return file;
}

// A paused clock for dancing without music. It resumes instead of drifting
// while disabled; media playback uses audio.currentTime directly.
export function createSilentClock(now = () => performance.now()) {
  let elapsed = 0, started = null;
  return {
    time() { return elapsed + (started === null ? 0 : (now() - started) / 1000); },
    start() { if (started === null) started = now(); },
    pause() { if (started !== null) { elapsed += (now() - started) / 1000; started = null; } },
    reset() { elapsed = 0; if (started !== null) started = now(); }
  };
}
