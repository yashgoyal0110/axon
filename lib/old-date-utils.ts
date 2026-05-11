export function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ago(d: Date) {
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
