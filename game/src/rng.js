// Seeded random numbers for Emberhold. The whole simulation runs off one
// mulberry32 stream, so a given seed always plays the same waves: the
// screenshot scenes and the headless tests can replay an exact game.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from a stream. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pick one element of an array from a stream. */
export function randPick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
