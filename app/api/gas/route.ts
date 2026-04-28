import { NextResponse } from 'next/server';

export async function GET() {
  // 最新のGASのURL
  const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwLBfHBOM17IcpuDlgwjr28oA7ZYctnZadnmZLguvHpwutI7W2eT2bit0NCvRe2iF0s/exec';

  try {
    const res = await fetch(GAS_API_URL, { 
      redirect: 'follow',
      cache: 'no-store'
    });
    
    if (!res.ok) {
      throw new Error(`GAS API Error: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
