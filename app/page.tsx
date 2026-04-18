'use client';

import React, { useState, useEffect, useMemo } from 'react';

// ==========================================
// 設定：スプレッドシートID & GAS API URL
// ==========================================
const SHEET_ID = '10Q_OLEbIRfyEO_Mp0KoVVi9DzyH2-Jqe7rk4EEgENIc';
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxFlLwj36Qs2uxx4mygs8Ds-SKOYSX8tx-hkkemuClOvtXI6a_XjClCd2frUm7rM5BF/exec';

// ==========================================
// データ取得ヘルパー（Google Sheets -> JSON変換）※マスターDB用
// ==========================================
async function fetchSheetData(sheetName: string) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
  const res = await fetch(url);
  const text = await res.text();
  const jsonString = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/);
  if (!jsonString) return [];
  
  const data = JSON.parse(jsonString[1]);
  const headers = data.table.cols.map((c: any) => c.label);
  
  return data.table.rows.map((row: any) => {
    let obj: any = {};
    row.c.forEach((cell: any, i: number) => {
      obj[headers[i]] = cell ? cell.v : null;
    });
    return obj;
  });
}

// ==========================================
// メインコンポーネント
// ==========================================
export default function UniteDraftApp() {
  const [db, setDb] = useState<any[]>([]);
  const [matrix, setMatrix] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [blueTeam, setBlueTeam] = useState<string[]>([]);
  const [redTeam, setRedTeam] = useState<string[]>([]);
  const [bans, setBans] = useState<string[]>([]);
  const [myPool, setMyPool] = useState<string[]>([]);

  // 💡 修正箇所：GAS APIからのデータ取得処理を統合
  useEffect(() => {
    async function loadData() {
      try {
        // マスターDBはスプレッドシートから、相性マトリクスはGAS APIから並行取得
        const [masterData, matrixResponse] = await Promise.all([
          fetchSheetData('ポケモンDB_マスター'),
          fetch(GAS_API_URL, { redirect: "follow" }) // GAS APIを叩く
        ]);

        if (!matrixResponse.ok) throw new Error("APIからの相性データ取得に失敗しました");
        const matrixData = await matrixResponse.json();

        setDb(masterData);
        setMatrix(matrixData.error ? [] : matrixData); // エラーが含まれていれば空配列にする

      } catch (error) {
        console.error("データ読み込みエラー:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 💡 修正箇所：GAS APIのデータ構造（最初からJSONオブジェクト）に合わせたスコア計算
  const recommendations = useMemo(() => {
    if (!db.length || !matrix.length) return [];

    const scored = db.map(pokemon => {
      const name = pokemon['名前(JP)'];
      let score = 50; 
      let reasons: string[] = [];

      // 得意キャラボーナス
      if (myPool.includes(name)) {
        score += 100;
        reasons.push('⭐ 習熟度高(持ちキャラ)');
      }

      // 敵チームに対するカウンター評価（APIからのデータ構造に合わせて変更）
      redTeam.forEach(enemy => {
        // APIから取得したデータはキーが 'name' になっている
        const enemyMatrix = matrix.find(m => m.name === enemy);
        
        // すでにJSONパース済みなので、直接 .counters にアクセス可能
        if (enemyMatrix && enemyMatrix.counters) {
          const match = enemyMatrix.counters.find((c: any) => c.name === name);
          if (match) {
            if (match.rank === 'S') {
              score += 40;
              reasons.push(`🔥 ${enemy}のSランクカウンター`);
            }
            if (match.rank === 'A') {
              score += 20;
              reasons.push(`👍 ${enemy}に有利`);
            }
          }
        }
      });

      // 味方チームとのロール重複ペナルティ
      const myTags = pokemon['タグ'] || "";
      let isRoleDuplicated = false;
      blueTeam.forEach(ally => {
        const allyData = db.find(d => d['名前(JP)'] === ally);
        if (allyData) {
          const allyMainRole = (allyData['タグ'] || "").split(',')[0];
          if (myTags.includes(allyMainRole)) {
            isRoleDuplicated = true;
          }
        }
      });
      
      if (isRoleDuplicated) {
        score -= 30;
        reasons.push('⚠️ ロール重複');
      }

      // 既にピック・BANされているキャラは除外
      if (blueTeam.includes(name) || redTeam.includes(name) || bans.includes(name)) {
        score = -999; 
      }

      return { ...pokemon, score, reasons };
    });

    return scored.filter(p => p.score > -900).sort((a, b) => b.score - a.score).slice(0, 5);
  }, [db, matrix, blueTeam, redTeam, bans, myPool]);

  // 以降のUI操作・レンダリングロジックは変更なし
  const handlePickBlue = (name: string) => {
    if (blueTeam.length < 5) setBlueTeam([...blueTeam, name]);
  };
  const handlePickRed = (name: string) => {
    if (redTeam.length < 5) setRedTeam([...redTeam, name]);
  };
  const handleBan = (name: string) => {
    if (bans.length < 4) setBans([...bans, name]);
  };
  const togglePool = (name: string) => {
    if (myPool.includes(name)) setMyPool(myPool.filter(n => n !== name));
    else setMyPool([...myPool, name]);
  };
  const resetDraft = () => {
    setBlueTeam([]); setRedTeam([]); setBans([]);
  };

  if (loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">データを読み込んでいます...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 font-sans max-w-2xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-wider text-blue-400">DRAFT ANALYZER</h1>
          <p className="text-xs text-slate-400 mt-1">スプレッドシート完全同期型・高速計算AI</p>
        </div>
        <button onClick={resetDraft} className="bg-slate-700 px-3 py-1 rounded text-xs font-bold hover:bg-slate-600 transition">リセット</button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-slate-800 rounded-xl p-3 border-l-4 border-blue-500 shadow-lg">
          <p className="text-xs font-bold text-blue-400 mb-2">BLUE TEAM (味方)</p>
          <div className="flex flex-wrap gap-1">
            {blueTeam.map(p => <span key={p} className="bg-blue-900/50 text-blue-100 text-[10px] px-2 py-1 rounded border border-blue-700/50">{p}</span>)}
            {blueTeam.length === 0 && <span className="text-xs text-slate-500">Pick waiting...</span>}
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-xl p-3 border-r-4 border-red-500 shadow-lg">
          <p className="text-xs font-bold text-red-400 mb-2 text-right">RED TEAM (敵)</p>
          <div className="flex flex-wrap gap-1 justify-end">
            {redTeam.map(p => <span key={p} className="bg-red-900/50 text-red-100 text-[10px] px-2 py-1 rounded border border-red-700/50">{p}</span>)}
            {redTeam.length === 0 && <span className="text-xs text-slate-500">Pick waiting...</span>}
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-2 mb-6 flex items-center gap-2">
        <span className="text-xs font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded">BAN</span>
        <div className="flex gap-1">
          {bans.map(p => <span key={p} className="text-[10px] line-through text-slate-500">{p}</span>)}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2">
          <span>⚡</span> AI RECOMMENDED PICKS
        </h2>
        <div className="space-y-2">
          {recommendations.map((rec, i) => (
            <div key={rec['名前(JP)']} className={`bg-slate-800 p-3 rounded-lg border flex justify-between items-center ${i === 0 ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'border-slate-700'}`}>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-lg">{rec['名前(JP)']}</span>
                  <span className="text-[10px] text-slate-400">{rec['攻撃タイプ']}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {rec.reasons.map((r, idx) => (
                    <span key={idx} className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-300">{r}</span>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => handlePickBlue(rec['名前(JP)'])} 
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold text-xs shadow-lg transition"
              >
                PICK
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 rounded-t-2xl p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.3)] h-80 overflow-y-auto">
        <h3 className="text-xs font-bold text-slate-400 mb-3 text-center">タップして陣営に追加 / 上部をタップで持ちキャラ登録</h3>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {db.map(p => {
            const name = p['名前(JP)'];
            const isPicked = blueTeam.includes(name) || redTeam.includes(name) || bans.includes(name);
            const isMyPool = myPool.includes(name);
            
            if (isPicked) return null;
            
            return (
              <div key={name} className="flex flex-col gap-1">
                <button 
                  onClick={() => togglePool(name)}
                  className={`text-[9px] rounded-t py-0.5 border-b border-slate-800 transition ${isMyPool ? 'bg-green-600/80 text-white' : 'bg-slate-700 text-slate-400'}`}
                >
                  {isMyPool ? '★得意' : '練習中'}
                </button>
                <div className="flex gap-[1px]">
                  <button onClick={() => handlePickBlue(name)} className="flex-1 bg-blue-900/50 hover:bg-blue-600 p-2 text-[10px] font-bold rounded-bl transition">青</button>
                  <button onClick={() => handleBan(name)} className="flex-1 bg-slate-700 hover:bg-slate-500 p-2 text-[10px] font-bold transition">B</button>
                  <button onClick={() => handlePickRed(name)} className="flex-1 bg-red-900/50 hover:bg-red-600 p-2 text-[10px] font-bold rounded-br transition">赤</button>
                </div>
                <div className="text-center text-[10px] mt-1 truncate">{name}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
