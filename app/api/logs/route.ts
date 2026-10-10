import { NextResponse } from 'next/server'
export async function GET(){
  const logs = (global as any).memoryLogs || []
  return NextResponse.json({ logs })
}
