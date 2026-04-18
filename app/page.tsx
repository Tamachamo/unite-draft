'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';

// ==========================================
// メインコンポーネント
// ==========================================
export default function UniteDraftApp() {
  const [db, setDb] = useState<any[]>([]);
  const [matrix, setMatrix] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorLog, setErrorLog] = useState<string | null>(null);

  // ドラフトのステータス
  const [blueTeam, setBlueTeam] = useState<string[]>([]);
  const [redTeam, setRedTeam] = useState<string[]>([]);
  const [bans, setBans] = useState<string[]>([]);
  const [myPool, setMyPool] = useState<string[]>([]);

  // アクションモード
  const [selectionMode, setSelectionMode] = useState<'blue' | 'red' | 'ban'>('blue');

  // 初回データ読み込み
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setErrorLog(null);
        
        const res = await fetch('/api/gas');
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "サーバーエラーが発生しました");
        if (data.error) throw new Error(data.error);
        if (!data.db || data.db.length === 0) throw new Error("ポケモンDBが空です。GAS側でマスター生成を実行してください。");

        setDb(data.db);
        setMatrix(data.matrix || []);
        
      } catch (error: any) {
        console.error("データ読み込みエラー:", error);
        setErrorLog(error.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // ヘルパー関数
  const getPokemonData = (name: string) => db.find(p => p['名前(JP)'] === name);

  // リアルタイムAIスコアリング計算
  const recommendations = useMemo(() => {
    if (!db.length) return [];

    const scored = db.map(pokemon => {
      const name = pokemon['名前(JP)'];
      let score = 50; 
      let reasons: string[] = [];

      // 1. 環境メタ（Tier）の評価
      const tier = pokemon['ティア'] || "";
      if (tier.includes("EX")) { score += 40; reasons.push('👑 EXティア'); }
      else if (tier.includes("S")) { score += 30; reasons.push('📈 Sティア'); }
      else if (tier.includes("A")) { score += 20; reasons.push('✨ Aティア'); }

      // 2. 持ちキャラボーナス
      if (myPool.includes(name)) {
        score += 80;
        reasons.push('⭐ 持ちキャラ');
      }

      // 3. 敵チームへのカウンター評価
      redTeam.forEach(enemy => {
        const enemyMatrix = matrix.find(m => m.name === enemy);
        if (enemyMatrix && enemyMatrix.counters) {
          const match = enemyMatrix.counters.find((c: any) => c.name === name);
          if (match) {
            if (match.rank === 'S') { score += 40; reasons.push(`🔥 ${enemy}に激刺さり`); }
            if (match.rank === 'A') { score += 20; reasons.push(`👍 ${enemy}に有利`); }
          }
        }
      });

      // 4. 味方とのロール重複ペナルティ
      const myRole = (pokemon['タグ'] || "").split(',')[0];
      let isRoleDuplicated = false;
      blueTeam.forEach(ally => {
        const allyData = getPokemonData(ally);
        if (allyData && (allyData['タグ'] || "").includes(myRole)) {
          isRoleDuplicated = true;
        }
      });
      if (isRoleDuplicated) {
        score -= 30;
        reasons.push('⚠️ ロール重複');
      }

      // 5. すでにピック・BANされたキャラは除外
      if (blueTeam.includes(name) || redTeam.includes(name) || bans.includes(name)) {
        score = -999; 
      }

      return { ...pokemon, score, reasons };
    });

    return scored.filter(p => p.score > -900).sort((a, b) => b.score - a.score).slice(0, 5);
  }, [db, matrix, blueTeam, redTeam, bans, myPool]);

  // アクションハンドラ
  const handleCharacterClick = (name: string) => {
    if (selectionMode === 'blue' && blueTeam.length < 5) setBlueTeam([...blueTeam, name]);
    if (selectionMode === 'red' && redTeam.length < 5) setRedTeam([...redTeam, name]);
    if (selectionMode === 'ban' && bans.length < 4) setBans([...bans, name]);
  };

  const removeCharacter = (name: string, team: 'blue' | 'red' | 'ban') => {
    if (team === 'blue') setBlueTeam(blueTeam.filter(n => n !== name));
    if (team === 'red') setRedTeam(redTeam.filter(n => n !== name));
    if (team === 'ban') setBans(bans.filter(n => n !== name));
  };

  const togglePool = (name: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    myPool.includes(name) ? setMyPool(myPool.filter(n => n !== name)) : setMyPool([...myPool, name]);
  };

  const resetDraft = () => { setBlueTeam([]); setRedTeam([]); setBans([]); setSelectionMode('blue'); };

  // ローディング＆エラー画面
  if (loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">データを同期中...</div>;
  if (errorLog) return (
    <div className="min-h-screen bg-slate-900 text-red-400 flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-bold mb-4">🚨 データの取得に失敗しました</h2>
      <p className="bg-slate-800 p-4 rounded text-sm mb-4">{errorLog}</p>
      <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded">再読み込み</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 font-sans max-w-2xl mx-auto flex flex-col">
      {/* ヘッダーエリア */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-2xl font-black tracking-wider text-blue-400">DRAFT ANALYZER</h1>
        </div>
        <button onClick={resetDraft} className="bg-slate-700 px-3 py-1 rounded text-xs font-bold hover:bg-slate-600 transition">リセット</button>
      </div>

      {/* ピック状況エリア */}
      <div className="grid grid-cols-2 gap-3 mb-4 sticky top-[10px] z-20">
        <div className={`rounded-xl p-3 border-l-4 shadow-xl transition-colors min-h-[100px] bg-slate-950/80 backdrop-blur-sm ${selectionMode === 'blue' ? 'border-blue-400' : 'border-blue-800/50'}`}>
          <p className="text-xs font-bold text-blue-400 mb-2">BLUE TEAM (味方)</p>
          <div className="grid grid-cols-5 gap-1.5">
            {blueTeam.map(p => {
              const data = getPokemonData(p);
              return (
                <button key={p} onClick={() => removeCharacter(p, 'blue')} className="relative aspect-square bg-slate-900 rounded-lg border border-blue-500 overflow-hidden hover:border-red-500 transition group">
                  {data?.['アイコンURL'] && (
                    <Image src={data['アイコンURL']} alt={p} fill sizes="50vw" className="object-cover group-hover:opacity-30" unoptimized />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-red-400 text-[8px] font-black">X</div>
                </button>
              )
            })}
          </div>
        </div>
        
        <div className={`rounded-xl p-3 border-r-4 shadow-xl transition-colors text-right min-h-[100px] bg-slate-950/80 backdrop-blur-sm ${selectionMode === 'red' ? 'border-red-400' : 'border-red-800/50'}`}>
          <p className="text-xs font-bold text-red-400 mb-2">RED TEAM (敵)</p>
          <div className="grid grid-cols-5 gap-1.5 justify-items-end">
            {redTeam.map(p => {
              const data = getPokemonData(p);
              return (
                <button key={p} onClick={() => removeCharacter(p, 'red')} className="relative aspect-square bg-slate-900 rounded-lg border border-red-500 overflow-hidden hover:border-red-500 transition group">
                  {data?.['アイコンURL'] && (
                    <Image src={data['アイコンURL']} alt={p} fill sizes="50vw" className="object-cover group-hover:opacity-30" unoptimized />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-red-400 text-[8px] font-black">X</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* BANエリア */}
      <div className={`rounded-lg p-2 mb-6 flex items-center gap-2 min-h-[52px] transition-colors sticky top-[125px] z-20 backdrop-blur-sm ${selectionMode === 'ban' ? 'bg-slate-700/90 border border-slate-400' : 'bg-slate-800/50'}`}>
        <span className="text-xs font-bold text-slate-300 bg-slate-900 px-2 py-1 rounded">BAN</span>
        <div className="flex gap-1 flex-wrap">
          {bans.map(p => {
            const data = getPokemonData(p);
            return (
              <button key={p} onClick={() => removeCharacter(p, 'ban')} className="relative w-8 h-8 aspect-square bg-slate-900 rounded border border-slate-600 overflow-hidden group">
                {data?.['アイコンURL'] && (
                  <Image src={data['アイコンURL']} alt={p} fill sizes="50vw" className="object-cover group-hover:opacity-30 opacity-50 grayscale" unoptimized />
                )}
                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-red-400 text-[8px] font-black">X</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* AIレコメンドエリア */}
      <div className="mb-6 flex-shrink-0 relative z-10">
        <h2 className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2">
          <span>⚡</span> AI RECOMMENDED PICKS
        </h2>
        <div className="space-y-2">
          {recommendations.length > 0 ? recommendations.map((rec, i) => {
            const iconUrl = rec['アイコンURL'];
            return (
              <div key={rec['名前(JP)']} className={`bg-slate-800 p-3 rounded-lg border flex gap-3 items-center ${i === 0 ? 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 'border-slate-700'}`}>
                {iconUrl && (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-600 flex-shrink-0">
                    <Image src={iconUrl} alt={rec['名前(JP)']} fill sizes="100vw" className="object-cover" unoptimized />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-lg">{rec['名前(JP)']}</span>
                    <span className="text-[10px] text-slate-400">{rec['攻撃タイプ']}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {rec.reasons.map((r, idx) => (
                      <span key={idx} className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-300 border border-slate-700">{r}</span>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={() => setBlueTeam([...blueTeam, rec['名前(JP)']])} 
                  disabled={blueTeam.length >= 5}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 px-4 py-3 rounded-lg font-bold text-xs shadow-lg transition"
                >
                  PICK
                </button>
              </div>
            )
          }) : (
            <div className="text-slate-500 text-sm py-4 text-center bg-slate-800 rounded-lg border border-slate-700 opacity-50">オススメ対象がいません</div>
          )}
        </div>
      </div>

      {/* モード切り替えタブ */}
      <div className="flex gap-1 mb-2 bg-slate-950 p-1.5 rounded-t-xl sticky top-[185px] z-10 border border-slate-700 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <button onClick={() => setSelectionMode('blue')} className={`flex-1 py-2.5 text-xs font-bold rounded transition ${selectionMode === 'blue' ? 'bg-blue-600 text-white shadow-inner' : 'bg-slate-800 text-slate-400'}`}>🟦 味方ピック</button>
        <button onClick={() => setSelectionMode('ban')} className={`flex-1 py-2.5 text-xs font-bold rounded transition ${selectionMode === 'ban' ? 'bg-slate-600 text-white shadow-inner' : 'bg-slate-800 text-slate-400'}`}>🚫 BANピック</button>
        <button onClick={() => setSelectionMode('red')} className={`flex-1 py-2.5 text-xs font-bold rounded transition ${selectionMode === 'red' ? 'bg-red-600 text-white shadow-inner' : 'bg-slate-800 text-slate-400'}`}>🟥 敵ピック</button>
      </div>

      {/* キャラクタープール */}
      <div className="bg-slate-800 rounded-b-2xl p-3 shadow-inner flex-1 overflow-y-auto min-h-[400px]">
        <h3 className="text-[10px] font-bold text-slate-500 mb-3 text-center">タップで陣営に追加 / 「★」をタップで持ちキャラ登録</h3>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {db.map(p => {
            const name = p['名前(JP)'];
            const iconUrl = p['アイコンURL'];
            const isPicked = blueTeam.includes(name) || redTeam.includes(name) || bans.includes(name);
            const isMyPool = myPool.includes(name);
            
            if (isPicked || !name) return null; 
            
            return (
              <button 
                key={name}
                onClick={() => handleCharacterClick(name)}
                className={`relative aspect-[3/4] rounded-lg border transition transform hover:scale-105 active:scale-95 group overflow-hidden ${
                  selectionMode === 'blue' ? 'border-blue-900/50 hover:border-blue-400' : 
                  selectionMode === 'red' ? 'border-red-900/50 hover:border-red-400' : 
                  'border-slate-700 hover:border-slate-400'
                }`}
              >
                {iconUrl && (
                  <Image src={iconUrl} alt={name} fill sizes="50vw" className="object-cover opacity-60 group-hover:opacity-100 transition" unoptimized />
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-1.5 pt-4">
                  <span className="text-[11px] font-black text-center leading-tight block text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                    {name}
                  </span>
                </div>
                
                <div 
                  onClick={(e) => togglePool(name, e)}
                  className={`absolute top-0 left-0 text-[10px] transition p-1 rounded-br-lg ${isMyPool ? 'bg-yellow-500 text-black opacity-100' : 'bg-slate-900/80 text-yellow-500 opacity-30 hover:opacity-100'}`}
                >
                  {isMyPool ? '★' : '☆'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
