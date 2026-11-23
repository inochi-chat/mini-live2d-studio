
export function createAnimation({
  render,
  getEnabled,
  onTimeUpdate
}) {
  let raf = null;
  let motionTime = 0;
  let lastTick = 0;

  function tick(timestamp) {
    if (!getEnabled()) {
      stop();
      return;
    }

    if (lastTick) {
      const delta = Math.min(
        (timestamp - lastTick) / 1000,
        0.05
      );

      motionTime += delta;
    }

    lastTick = timestamp;

    onTimeUpdate(motionTime);
    render();

    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (raf !== null) return;

    lastTick = 0;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }

    lastTick = 0;
  }

  return {
    start,
    stop,
    getTime: () => motionTime
  };
}
