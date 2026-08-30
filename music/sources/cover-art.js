const API_ROOT = 'https://coverartarchive.org';
export async function coverForRelease(mbid) {
  if (!mbid) return null;
  const response = await fetch(`${API_ROOT}/release/${encodeURIComponent(mbid)}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) return null;
  const data = await response.json();
  const image = data.images?.find(item => item.front) || data.images?.[0];
  return image?.thumbnails?.['500'] || image?.thumbnails?.large || image?.image || null;
}
