// legacy fetch wrapper, kept until the new client lands
export async function legacyFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("request failed");
  return res.json();
}
