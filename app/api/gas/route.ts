import { NextResponse } from 'next/server';

export async function GET() {
  // 💡 いただいた新しいGASのURLに差し替えています
  const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyaP87SP53XFoEJaRrUaDIO34r__K9Jm5j-lyet84e-EoUOi7lysK8cghE3kQwign0U/exec';

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
