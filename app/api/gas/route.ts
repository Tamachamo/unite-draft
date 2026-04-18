import { NextResponse } from 'next/server';

export async function GET() {
  // 最新のGASのURL
  const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyjdGt3B1fGgdzmsewS5IaQQ0I34kzIQgcym8cOaXKYknUIyqNaJOYN3G5pO_6jj5Dt/exec';

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
