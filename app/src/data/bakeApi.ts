import type { BakeRequest, BakeStatus, ZoneEntry } from '../core/zones';

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function loadZones(): Promise<ZoneEntry[]> {
  const data = await jsonFetch<{ zones: ZoneEntry[] }>('/api/zones', { cache: 'no-store' });
  return Array.isArray(data.zones) ? data.zones : [];
}

export async function bakeStatus(): Promise<BakeStatus | null> {
  try {
    return await jsonFetch<BakeStatus>('/api/bake', { cache: 'no-store' });
  } catch {
    return null;
  }
}

export async function startBake(body: BakeRequest): Promise<BakeStatus> {
  await jsonFetch<{ id: number }>('/api/bake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const st = await bakeStatus();
  if (!st) throw new Error('无法读取烘焙状态');
  return st;
}

export async function cancelBake(): Promise<void> {
  await jsonFetch<{ ok: boolean }>('/api/bake/cancel', { method: 'POST' });
}
