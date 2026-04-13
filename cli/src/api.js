const BASE_URL = process.env.LINKEDPUSH_URL || 'https://linkedpush.seonavigatorplus.com'
const SESSION = process.env.LINKEDPUSH_SESSION || ''

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra }
  if (SESSION) h['Cookie'] = `session=${SESSION}`
  return h
}

export async function get(path, params = {}) {
  const url = new URL(path, BASE_URL)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  }
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  return res.json()
}

export async function post(path, body = {}) {
  const res = await fetch(new URL(path, BASE_URL), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

export async function put(path, body = {}) {
  const res = await fetch(new URL(path, BASE_URL), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json()
}

export async function del(path) {
  const res = await fetch(new URL(path, BASE_URL), {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : { ok: true }
}

export async function upload(path, filePath) {
  const fs = await import('node:fs')
  const nodePath = await import('node:path')
  const fileBuffer = fs.readFileSync(filePath)
  const fileName = nodePath.basename(filePath)
  const ext = nodePath.extname(filePath).toLowerCase()
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' }
  const mime = mimeMap[ext] || 'application/octet-stream'

  const boundary = '----LinkedPushCLI' + Date.now()
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])

  const h = { 'Content-Type': `multipart/form-data; boundary=${boundary}` }
  if (SESSION) h['Cookie'] = `session=${SESSION}`

  const res = await fetch(new URL(path, BASE_URL), {
    method: 'POST',
    headers: h,
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json()
}

export async function login(params = {}) {
  const url = new URL('/api/auth/login', BASE_URL)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status}: Login failed`)
  return res.json()
}

export async function loginDev() {
  const res = await fetch(new URL('/api/auth/dev-login', BASE_URL), { redirect: 'manual' })
  const cookie = res.headers.get('set-cookie')
  const session = cookie?.match(/session=([^;]+)/)?.[1]
  return { session, redirect: res.headers.get('location') }
}

export async function me() {
  return get('/api/auth/me')
}
