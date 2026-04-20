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

  const [blueTeam, setBlueTeam] = useState<string[]>([]);
  const [redTeam, setRedTeam] = useState<string[]>([]);
  const [bans, setBans] = useState<string[]>([]);
  const [myPool, setMyPool] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<'blue' | 'red' | 'ban'>('blue');
  
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // 💡 検索＆絞り込み用のステートを追加
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

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

  const getPokemonData = (name: string) => db.find(p => p['名前(JP)'] === name);

  const recommendations = useMemo(() => {
    if (!db.length) return [];
    const isBanMode = selectionMode === 'ban';

    const scored = db.map((pokemon: any) => {
      const name = pokemon['名前(JP)'];
      let score = 50; 
      let reasons: string[] = [];

      if (blueTeam.includes(name) || redTeam.includes(name) || bans.includes(name)) {
        score = -999; 
        return { ...pokemon, score, reasons };
      }

      if (isBanMode) {
        const tier = pokemon['ティア'] || "";
        if (tier.includes("EX")) { score += 50; reasons.push('🚨 危険(EX)'); }
        else if (tier.includes("S")) { score += 30; reasons.push('⚠️ 要注意(S)'); }

        if (myPool.includes(name)) {
          score -= 50;
          reasons.push('⭐ 得意(非推奨)');
        }

        blueTeam.forEach((ally: string) => {
          const allyMatrix = matrix.find((m: any) => m.name === ally);
          if (allyMatrix && allyMatrix.counters) {
            const match = allyMatrix.counters.find((c: any) => c.name === name);
            if (match) {
              if (match.rank === 'S') { score += 40; reasons.push(`🛡️ ${ally}を守る`); }
              if (match.rank === 'A') { score += 20; reasons.push(`🛡️ ${ally}の弱点`); }
            }
          }
        });

      } else {
        const tier = pokemon['ティア'] || "";
        if (tier.includes("EX")) { score += 40; reasons.push('👑 EXティア'); }
        else if (tier.includes("S")) { score += 30; reasons.push('📈 Sティア'); }
        else if (tier.includes("A")) { score += 20; reasons.push('✨ Aティア'); }

        if (myPool.includes(name)) {
          score += 80;
          reasons.push('⭐ 持ちキャラ');
        }

        redTeam.forEach((enemy: string) => {
          const enemyMatrix = matrix.find((m: any) => m.name === enemy);
          if (enemyMatrix && enemyMatrix.counters) {
            const match = enemyMatrix.counters.find((c: any) => c.name === name);
            if (match) {
              if (match.rank === 'S') { score += 40; reasons.push(`🔥 ${enemy}に激刺さり`); }
              if (match.rank === 'A') { score += 20; reasons.push(`👍 ${enemy}に有利`); }
            }
          }
        });

        const getRealRole = (tagStr: string) => {
          if (!tagStr) return "";
          const tags = tagStr.split(',').map(t => t.trim());
          const validRoles = ['Attacker', 'Defender', 'Speedster', 'Supporter', 'All-Rounder', 'アタック', 'ディフェンス', 'スピード', 'サポート', 'バランス'];
          return tags.find(t => validRoles.includes(t)) || "";
        };
        
        const myRole = getRealRole(pokemon['タグ']);
        let isRoleDuplicated = false;
        if (myRole !== "") {
          blueTeam.forEach((ally: string) => {
            const allyData = getPokemonData(ally);
            if (allyData) {
              const allyRole = getRealRole(allyData['タグ']);
              if (allyRole !== "" && allyRole === myRole) {
                isRoleDuplicated = true;
              }
            }
          });
        }

        if (isRoleDuplicated) {
          score -= 30;
          reasons.push('⚠️ ロール重複');
        }
      }

      return { ...pokemon, score, reasons };
    });

    return scored.filter((p: any) => p.score > -900).sort((a: any, b: any) => b.score - a.score).slice(0, 5);
  }, [db, matrix, blueTeam, redTeam, bans, myPool, selectionMode]);

  // 💡 キャラクタープールの絞り込み処理
  const filteredDb = useMemo(() => {
    return db.filter((p: any) => {
      const name = p['名前(JP)'] || '';
      const tags = p['タグ'] || '';

      // ① 検索ワードの処理（ひらがな・カタカナの表記ゆれを吸収）
      const normalize = (str: string) => str.replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60));
      if (searchTerm && !normalize(name).includes(normalize(searchTerm))) {
        return false;
      }

      // ② ロール（型）の処理
      if (roleFilter !== 'All') {
        const roleMap: Record<string, string[]> = {
          'アタック': ['Attacker', 'アタック'],
          'ディフェンス': ['Defender', 'ディフェンス'],
          'スピード': ['Speedster', 'スピード'],
          'サポート': ['Supporter', 'サポート'],
          'バランス': ['All-Rounder', 'バランス']
        };
        const hasRole = roleMap[roleFilter]?.some(r => tags.includes(r));
        if (!hasRole) return false;
      }

      return true;
    });
  }, [db, searchTerm, roleFilter]);

  const handleCharacterClick = (name: string) => {
    if (selectionMode === 'blue' && blueTeam.length < 5) setBlueTeam([...blueTeam, name]);
    if (selectionMode === 'red' && redTeam.length < 5) setRedTeam([...redTeam, name]);
    if (selectionMode === 'ban' && bans.length < 6) setBans([...bans, name]);
  };

  const removeCharacter = (name: string, team: 'blue' | 'red' | 'ban') => {
    if (team === 'blue') setBlueTeam(blueTeam.filter((n: string) => n !== name));
    if (team === 'red') setRedTeam(redTeam.filter((n: string) => n !== name));
    if (team === 'ban') setBans(bans.filter((n: string) => n !== name));
  };

  const togglePool = (name: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    myPool.includes(name) ? setMyPool(myPool.filter((n: string) => n !== name)) : setMyPool([...myPool, name]);
  };

  const resetDraft = () => { setBlueTeam([]); setRedTeam([]); setBans([]); setSelectionMode('blue'); setSearchTerm(''); setRoleFilter('All'); };

  if (loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">データを同期中...</div>;
  if (errorLog) return (
    <div className="min-h-screen bg-slate-900 text-red-400 flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-bold mb-4">🚨 データの取得に失敗しました</h2>
      <p className="bg-slate-800 p-4 rounded text-sm mb-4">{errorLog}</p>
      <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded">再読み込み</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 font-sans max-w-2xl mx-auto flex flex-col relative">
      
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-600 shadow-2xl flex flex-col max-h-[85vh]">
            <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2 border-b border-slate-700 pb-3">
              <span>❓</span> DRAFT ANALYZER 使い方
            </h2>
            
            <div className="space-y-5 text-sm text-slate-300 overflow-y-auto pr-2 flex-1">
              <div>
                <h3 className="font-bold text-yellow-400 mb-1">🎯 1. 持ちキャラを登録しよう</h3>
                <p className="text-xs leading-relaxed">
                  画面下部のポケモン一覧で、左上の<span className="text-yellow-500 font-bold">「☆」</span>をタップして<span className="text-yellow-500 font-bold">「★」</span>にすると、あなたの得意キャラとして登録されます。<br/>
                  「得意キャラ」を優先してレコメンド（おすすめ）してくれるようになります。
                </p>
              </div>
              
              <div>
                <h3 className="font-bold text-white mb-1">⚔️ 2. ドラフトを進めよう</h3>
                <p className="text-xs leading-relaxed">
                  中央のタブで<span className="bg-blue-600 text-white px-1 rounded">🟦 味方</span> <span className="bg-slate-600 text-white px-1 rounded">🚫 BAN</span> <span className="bg-red-600 text-white px-1 rounded">🟥 敵</span> のモードを切り替え、下のポケモン一覧から該当するキャラをタップして追加していきます。<br/>
                  上部の検索バーやロール絞り込みを使うと素早く探せます。
                </p>
              </div>

              <div>
                <h3 className="font-bold text-yellow-400 mb-1">⚡ 3. レコメンドを活用しよう</h3>
                <p className="text-xs leading-relaxed">
                  ドラフトが進むにつれ、中央におすすめキャラが表示されます。<br/>
                  ・<span className="font-bold text-white">Tier環境（EX/S/A）</span><br/>
                  ・<span className="font-bold text-white">敵へのカウンター相性</span><br/>
                  ・<span className="font-bold text-white">味方とのロール被り回避</span><br/>
                  をすべて自動計算して提案します。「PICK」ボタンを押せば味方に追加できます。
                </p>
              </div>

              <div>
                <h3 className="font-bold text-red-400 mb-1">🗑️ 4. 選択を間違えたら？</h3>
                <p className="text-xs leading-relaxed">
                  画面上部の味方・敵・BANエリアに追加されたポケモンのアイコンをタップすると、選択を取り消すことができます。
                </p>
              </div>
            </div>

            <button 
              onClick={() => setIsHelpOpen(false)} 
              className="mt-5 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-2xl font-black tracking-wider text-blue-400">DRAFT ANALYZER</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsHelpOpen(true)} className="bg-slate-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-600 transition text-slate-200 border border-slate-600 shadow-sm flex items-center gap-1">
            <span>❓</span> 使い方
          </button>
          <button onClick={resetDraft} className="bg-slate-800 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-700 transition text-red-400 border border-red-900/50 shadow-sm">
            リセット
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 sticky top-[10px] z-20">
        <div className={`rounded-xl p-3 border-l-4 shadow-xl transition-colors min-h-[100px] bg-slate-950/80 backdrop-blur-sm ${selectionMode === 'blue' ? 'border-blue-400' : 'border-blue-800/50'}`}>
          <p className="text-xs font-bold text-blue-400 mb-2">BLUE TEAM (味方)</p>
          <div className="grid grid-cols-5 gap-1.5">
            {blueTeam.map((p: string) => {
              const data = getPokemonData(p);
              return (
                <button key={p} onClick={() => removeCharacter(p, 'blue')} className="relative aspect-square bg-slate-900 rounded-lg border border-blue-500 overflow-hidden hover:border-red-500 transition group flex items-center justify-center">
                  {data?.['アイコンURL'] ? (
                    <img src={data['アイコンURL']} alt={p} className="w-full h-full object-cover group-hover:opacity-30" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  ) : <span className="text-[8px] text-slate-500 font-bold">{p}</span>}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-red-400 text-[8px] font-black">X</div>
                </button>
              )
            })}
          </div>
        </div>
        
        <div className={`rounded-xl p-3 border-r-4 shadow-xl transition-colors text-right min-h-[100px] bg-slate-950/80 backdrop-blur-sm ${selectionMode === 'red' ? 'border-red-400' : 'border-red-800/50'}`}>
          <p className="text-xs font-bold text-red-400 mb-2">RED TEAM (敵)</p>
          <div className="grid grid-cols-5 gap-1.5 justify-items-end">
            {redTeam.map((p: string) => {
              const data = getPokemonData(p);
              return (
                <button key={p} onClick={() => removeCharacter(p, 'red')} className="relative aspect-square bg-slate-900 rounded-lg border border-red-500 overflow-hidden hover:border-red-500 transition group flex items-center justify-center">
                  {data?.['アイコンURL'] ? (
                    <img src={data['アイコンURL']} alt={p} className="w-full h-full object-cover group-hover:opacity-30" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  ) : <span className="text-[8px] text-slate-500 font-bold">{p}</span>}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-red-400 text-[8px] font-black">X</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className={`rounded-lg p-2 mb-6 flex items-center gap-2 min-h-[52px] transition-colors sticky top-[125px] z-20 backdrop-blur-sm ${selectionMode === 'ban' ? 'bg-slate-700/90 border border-slate-400' : 'bg-slate-800/50'}`}>
        <span className="text-xs font-bold text-slate-300 bg-slate-900 px-2 py-1 rounded">BAN</span>
        <div className="flex gap-1 flex-wrap">
          {bans.map((p: string) => {
            const data = getPokemonData(p);
            return (
              <button key={p} onClick={() => removeCharacter(p, 'ban')} className="relative w-8 h-8 aspect-square bg-slate-900 rounded border border-slate-600 overflow-hidden group flex items-center justify-center">
                {data?.['アイコンURL'] ? (
                  <img src={data['アイコンURL']} alt={p} className="w-full h-full object-cover opacity-50 grayscale group-hover:opacity-30" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                ) : <span className="text-[8px] text-slate-500 line-through">{p}</span>}
                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-red-400 text-[8px] font-black">X</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-6 flex-shrink-0 relative z-10">
        <h2 className={`text-sm font-bold mb-2 flex items-center gap-2 ${selectionMode === 'ban' ? 'text-red-400' : 'text-yellow-400'}`}>
          <span>⚡</span> {selectionMode === 'ban' ? 'おすすめ BAN' : 'おすすめピック'}
        </h2>
        <div className="space-y-2">
          {recommendations.length > 0 ? recommendations.map((rec: any, i: number) => {
            const iconUrl = rec['アイコンURL'];
            return (
              <div key={rec['名前(JP)']} className={`bg-slate-800 p-3 rounded-lg border flex gap-3 items-center ${i === 0 ? (selectionMode === 'ban' ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)]') : 'border-slate-700'}`}>
                {iconUrl ? (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-600 flex-shrink-0 bg-slate-900">
                    <img src={iconUrl} alt={rec['名前(JP)']} className={`w-full h-full object-cover ${selectionMode === 'ban' ? 'grayscale opacity-70' : ''}`} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg border border-slate-600 flex-shrink-0 bg-slate-900 flex items-center justify-center">
                    <span className="text-[10px] text-slate-500">No Img</span>
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-lg">{rec['名前(JP)']}</span>
                    <span className="text-[10px] text-slate-400">{rec['攻撃タイプ']}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(rec.reasons || []).map((r: string, idx: number) => (
                      <span key={idx} className={`text-[10px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 ${selectionMode === 'ban' && r.includes('🛡️') ? 'text-blue-300' : 'text-slate-300'}`}>{r}</span>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (selectionMode === 'ban') setBans([...bans, rec['名前(JP)']]);
                    else setBlueTeam([...blueTeam, rec['名前(JP)']]);
                  }} 
                  disabled={selectionMode === 'ban' ? bans.length >= 6 : blueTeam.length >= 5}
                  className={`px-4 py-3 rounded-lg font-bold text-xs shadow-lg transition text-white ${
                    selectionMode === 'ban' 
                      ? 'bg-slate-600 hover:bg-slate-500 disabled:bg-slate-800' 
                      : 'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600'
                  }`}
                >
                  {selectionMode === 'ban' ? 'BAN' : 'PICK'}
                </button>
              </div>
            )
          }) : (
            <div className="text-slate-500 text-sm py-4 text-center bg-slate-800 rounded-lg border border-slate-700 opacity-50">オススメ対象がいません</div>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-slate-950 p-1.5 rounded-t-xl sticky top-[185px] z-10 border border-slate-700 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <button onClick={() => setSelectionMode('blue')} className={`flex-1 py-2.5 text-xs font-bold rounded transition ${selectionMode === 'blue' ? 'bg-blue-600 text-white shadow-inner' : 'bg-slate-800 text-slate-400'}`}>🟦 味方</button>
        <button onClick={() => setSelectionMode('ban')} className={`flex-1 py-2.5 text-xs font-bold rounded transition ${selectionMode === 'ban' ? 'bg-slate-600 text-white shadow-inner' : 'bg-slate-800 text-slate-400'}`}>🚫 BAN</button>
        <button onClick={() => setSelectionMode('red')} className={`flex-1 py-2.5 text-xs font-bold rounded transition ${selectionMode === 'red' ? 'bg-red-600 text-white shadow-inner' : 'bg-slate-800 text-slate-400'}`}>🟥 敵</button>
      </div>

      {/* 💡 検索＆絞り込みバーエリア */}
      <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 shadow-inner">
        <input 
          type="text" 
          placeholder="🔍 ポケモン名で検索 (ひらがな可)" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-white mb-2 focus:outline-none focus:border-blue-500 transition placeholder-slate-500"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {['All', 'アタック', 'ディフェンス', 'スピード', 'サポート', 'バランス'].map(role => (
            <button 
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition border ${
                roleFilter === role 
                  ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.3)]' 
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {role === 'All' ? 'すべて' : role}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 rounded-b-2xl p-3 flex-1 overflow-y-auto min-h-[400px]">
        <h3 className="text-[10px] font-bold text-slate-500 mb-3 text-center">タップで追加 / 「★」で得意キャラ登録</h3>
        
        {/* 💡 filteredDbを使用して表示 */}
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {filteredDb.map((p: any) => {
            const name = p['名前(JP)'];
            const iconUrl = p['アイコンURL'];
            const isPicked = blueTeam.includes(name) || redTeam.includes(name) || bans.includes(name);
            const isMyPool = myPool.includes(name);
            
            if (isPicked || !name) return null; 
            
            return (
              <button 
                key={name}
                onClick={() => handleCharacterClick(name)}
                className={`relative aspect-[3/4] rounded-lg border transition transform hover:scale-105 active:scale-95 group overflow-hidden bg-slate-900 ${
                  selectionMode === 'blue' ? 'border-blue-900/50 hover:border-blue-400' : 
                  selectionMode === 'red' ? 'border-red-900/50 hover:border-red-400' : 
                  'border-slate-700 hover:border-slate-400'
                }`}
              >
                {iconUrl ? (
                  <img src={iconUrl} alt={name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center opacity-60"><span className="text-[10px] text-slate-500 font-bold">{name}</span></div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-1.5 pt-4">
                  <span className="text-[11px] font-black text-center leading-tight block text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                    {name}
                  </span>
                </div>
                
                <div 
                  onClick={(e) => togglePool(name, e)}
                  className={`absolute top-0 left-0 text-[10px] transition p-1 rounded-br-lg z-10 ${isMyPool ? 'bg-yellow-500 text-black opacity-100' : 'bg-slate-900/80 text-yellow-500 opacity-30 hover:opacity-100'}`}
                >
                  {isMyPool ? '★' : '☆'}
                </div>
              </button>
            );
          })}
          
          {filteredDb.length === 0 && (
            <div className="col-span-4 sm:col-span-5 text-center py-10 text-slate-500 text-xs font-bold">
              該当するポケモンが見つかりません。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
