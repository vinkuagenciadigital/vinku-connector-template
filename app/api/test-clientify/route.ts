import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
  const { key } = await req.json()
  const res = await fetch('https://api.clientify.net/v1/contacts/?limit=1', { headers: { 'Authorization': `Token ${key}` } })
  const data = await res.text()
  return NextResponse.json({ ok: res.ok, status: res.status, data: data.slice(0,500) })
}
