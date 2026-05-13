import { NextRequest, NextResponse } from 'next/server';

const PYTHON_URL = process.env.PYTHON_API_INTERNAL_URL ?? 'http://localhost:8000';

async function proxy(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join('/');
  const target = `${PYTHON_URL}/${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const body = req.method !== 'GET' ? await req.text() : undefined;

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
  });

  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
