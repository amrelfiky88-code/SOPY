// The phone's position for evidence, best effort: { lat, lng }, or {} when
// it won't say (no permission, location off, no fix in time).
//
// getCurrentPosition's own timeout doesn't run while the permission
// question is on screen, so someone who left it unanswered waited forever:
// Submit kept spinning and photos never saved. An overall timer settles it.
export function bestEffortPosition({ wait = 8000, timeout = 4000 } = {}) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve({});
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
    const timer = setTimeout(() => finish({}), wait);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => finish({}),
        { timeout, maximumAge: 60_000 }
      );
    } catch {
      finish({});
    }
  });
}
