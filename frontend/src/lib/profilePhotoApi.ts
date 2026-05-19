import { authFetch, authUpload } from '@/lib/api'

function readDetail(data: Record<string, unknown>, fallback: string): string {
  const d = data.detail
  if (typeof d === 'string' && d) return d
  const parts: string[] = []
  for (const v of Object.values(data)) {
    if (Array.isArray(v) && v.length > 0) parts.push(String(v[0]))
    else if (typeof v === 'string' && v) parts.push(v)
  }
  return parts.join(' ') || fallback
}

export async function uploadProfilePhoto(
  file: File,
): Promise<{ ok: true; profile_photo_url: string } | { ok: false; detail: string }> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    return { ok: false, detail: 'Photo must be JPEG, PNG, or WebP.' }
  }
  const maxBytes = 2 * 1024 * 1024
  if (file.size > maxBytes) {
    return { ok: false, detail: 'Photo must be 2 MB or smaller.' }
  }
  const fd = new FormData()
  fd.append('file', file)
  let res: Response
  try {
    res = await authUpload('/api/v1/auth/profile-photo/', fd)
  } catch {
    return { ok: false, detail: 'Not signed in or upload failed to start.' }
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    return { ok: false, detail: readDetail(data, 'Upload failed.') }
  }
  return {
    ok: true,
    profile_photo_url: typeof data.profile_photo_url === 'string' ? data.profile_photo_url : '',
  }
}

export async function removeProfilePhoto(): Promise<
  { ok: true } | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/auth/profile-photo/', { method: 'DELETE' })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    return { ok: false, detail: readDetail(data, 'Could not remove photo.') }
  }
  return { ok: true }
}
