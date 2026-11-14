export type Speed = 0 | 1 | 2 | 4;

const STEP = 0.05;

const START_UTC = Date.UTC(1985, 5, 6, 6, 0, 0);

export class GameClock {

  minutes = 0;
  speed: Speed = 0;
  private lastNonZeroSpeed: Speed = 1;
  private acc = 0;

  ticks = 0;

  setSpeed(s: Speed): void {
    if (s !== 0) this.lastNonZeroSpeed = s;
    this.speed = s;
  }

  togglePause(): void {
    this.speed = this.speed === 0 ? this.lastNonZeroSpeed : 0;
  }

  reset(): void {
    this.minutes = 0;
    this.acc = 0;
    this.ticks = 0;
  }

  update(realSeconds: number, onTick?: (gameMinutes: number) => void): void {
    if (this.speed === 0) {
      this.acc = 0;
      return;
    }
    this.acc += Math.min(realSeconds, 0.25);
    let guard = 0;
    while (this.acc >= STEP && guard++ < 40) {
      this.acc -= STEP;
      this.minutes += STEP * this.speed;
      this.ticks++;
      onTick?.(this.minutes);
    }
  }

  get alpha(): number {
    return this.speed === 0 ? 0 : this.acc / STEP;
  }

  get date(): Date {
    return new Date(START_UTC + this.minutes * 60000);
  }

  get label(): string {
    const d = this.date;
    const day = Math.floor(this.minutes / 1440);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `D+${day} ${hh}:${mm}`;
  }

  get stamp(): string {
    const d = this.date;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(
      d.getUTCHours(),
    )}:${p(d.getUTCMinutes())}`;
  }

  get chineseStamp(): string {
    const d = this.date;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日${p(
      d.getUTCHours(),
    )}${p(d.getUTCMinutes())}时`;
  }
}
