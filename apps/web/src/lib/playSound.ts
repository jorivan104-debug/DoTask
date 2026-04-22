const cache = new Map<string, HTMLAudioElement>();

export function playSound(path: string) {
  let audio = cache.get(path);
  if (!audio) {
    audio = new Audio(path);
    cache.set(path, audio);
  }
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
