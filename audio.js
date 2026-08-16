const PATHS = {
  click: "./assets/audio/click.ogg",
  cash: "./assets/audio/cash.ogg",
  pop: "./assets/audio/pop.ogg",
};

export class NightMarketAudio {
  constructor() {
    this.enabled = true;
    this.started = false;
    this.music = new Audio("./assets/audio/night-market-loop.ogg");
    this.music.loop = true;
    this.music.volume = 0.22;
    this.effects = Object.fromEntries(
      Object.entries(PATHS).map(([name, path]) => {
        const audio = new Audio(path);
        audio.volume = name === "cash" ? 0.55 : 0.38;
        return [name, audio];
      }),
    );
  }

  async start() {
    this.started = true;
    if (!this.enabled) return;
    try {
      await this.music.play();
    } catch {
      // A later explicit button press can retry when autoplay is unavailable.
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.music.pause();
    } else if (this.started) {
      void this.start();
    }
  }

  play(name) {
    if (!this.enabled || !this.effects[name]) return;
    const effect = this.effects[name];
    effect.currentTime = 0;
    void effect.play().catch(() => {});
  }
}
