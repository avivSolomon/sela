import React, { useMemo, useState } from 'react';

/**
 * Sela — Israeli mortgage / real-value module (original addition).
 *
 * A self-contained page that demonstrates the two faces of the "time-value of
 * money" engine on top of Actual Budget:
 *   1. Amortization (Spitzer) per track, where each track has a SINGLE linkage
 *      type: prime / cpi-linked / fixed  (never both).
 *   2. Real value: the inflation-adjusted (present-value) cost of the loan,
 *      using the CPI.
 *
 * All labels are Hebrew and the page renders right-to-left (RTL).
 */

type LinkageType = 'prime' | 'cpi' | 'fixed';

type Track = {
  id: number;
  name: string;
  principal: number; // קרן (₪)
  annualRate: number; // ריבית שנתית בסיסית (%) — לפריים זהו המרווח מעל הפריים
  years: number; // תקופה (שנים)
  linkage: LinkageType;
};

const LINKAGE_LABEL: Record<LinkageType, string> = {
  prime: 'פריים',
  cpi: 'צמוד-מדד',
  fixed: 'קבועה לא צמודה',
};

const ILS = (n: number) =>
  '₪' +
  (Math.round(n)).toLocaleString('he-IL', { maximumFractionDigits: 0 });

// לוח סילוקין (שפיצר): תשלום חודשי קבוע A = P·i / (1 − (1+i)^−n)
function monthlyPayment(principal: number, monthlyRate: number, months: number) {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  return (
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
  );
}

// ריבית שנתית אפקטיבית לפי סוג המסלול
function effectiveAnnualRate(track: Track, prime: number) {
  if (track.linkage === 'prime') return prime + track.annualRate; // פריים + מרווח
  return track.annualRate; // צמוד-מדד / קבועה — הריבית כפי שהוזנה
}

function buildSchedule(track: Track, prime: number) {
  const i = effectiveAnnualRate(track, prime) / 100 / 12;
  const n = Math.round(track.years * 12);
  const A = monthlyPayment(track.principal, i, n);
  const rows: { period: number; payment: number; interest: number; principal: number; balance: number }[] = [];
  let balance = track.principal;
  let totalInterest = 0;
  for (let p = 1; p <= n; p++) {
    const interest = balance * i;
    const principalPaid = A - interest;
    balance = Math.max(0, balance - principalPaid);
    totalInterest += interest;
    rows.push({ period: p, payment: A, interest, principal: principalPaid, balance });
  }
  return { monthly: A, months: n, totalInterest, rows };
}

const teal = '#0f766e';
const dark = '#0b3d38';
const ink = '#12201d';
const soft = '#e7f2f0';
const border = '#d6e8e4';

export function MortgagePage() {
  const [prime, setPrime] = useState(6); // ריבית הפריים (%) — נמשכת מבנק ישראל בפועל
  const [inflation, setInflation] = useState(3); // אינפלציה שנתית להערכת ערך ריאלי (%)
  const [tracks, setTracks] = useState<Track[]>([
    { id: 1, name: 'מסלול פריים', principal: 400000, annualRate: -0.5, years: 25, linkage: 'prime' },
    { id: 2, name: 'קבועה צמודה (ק"צ)', principal: 350000, annualRate: 3.2, years: 25, linkage: 'cpi' },
    { id: 3, name: 'קבועה לא צמודה (קל"צ)', principal: 250000, annualRate: 4.5, years: 20, linkage: 'fixed' },
  ]);

  const results = useMemo(
    () => tracks.map(t => ({ track: t, ...buildSchedule(t, prime) })),
    [tracks, prime],
  );

  const totalPrincipal = tracks.reduce((s, t) => s + t.principal, 0);
  const unifiedMonthly = results.reduce((s, r) => s + r.monthly, 0);
  const totalInterest = results.reduce((s, r) => s + r.totalInterest, 0);

  // עלות ריאלית: ערך נוכחי של זרם התשלומים לפי אינפלציה חודשית
  const monthlyInfl = inflation / 100 / 12;
  const realCost = useMemo(() => {
    let pv = 0;
    for (const r of results) {
      for (const row of r.rows) pv += row.payment / Math.pow(1 + monthlyInfl, row.period);
    }
    return pv;
  }, [results, monthlyInfl]);

  const totalPaid = unifiedMonthly && results.reduce((s, r) => s + r.monthly * r.months, 0);

  const update = (id: number, patch: Partial<Track>) =>
    setTracks(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)));
  const addTrack = () =>
    setTracks(ts => [
      ...ts,
      { id: Math.max(0, ...ts.map(t => t.id)) + 1, name: 'מסלול חדש', principal: 100000, annualRate: 4, years: 20, linkage: 'fixed' },
    ]);
  const removeTrack = (id: number) => setTracks(ts => ts.filter(t => t.id !== id));

  const th: React.CSSProperties = { textAlign: 'right', padding: '8px 10px', fontSize: 13, color: '#5a6675', fontWeight: 700, borderBottom: `1px solid ${border}` };
  const td: React.CSSProperties = { textAlign: 'right', padding: '7px 10px', fontSize: 14, color: ink, borderBottom: `1px solid #eef2f1` };
  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${border}`, borderRadius: 14, padding: '16px 18px', flex: 1, minWidth: 180, boxShadow: '0 1px 2px rgba(15,40,35,.04),0 6px 20px rgba(15,40,35,.05)' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: `1px solid ${border}`, borderRadius: 7, fontSize: 14, textAlign: 'right' };

  return (
    <div dir="rtl" style={{ direction: 'rtl', fontFamily: 'Heebo, Arial, sans-serif', color: ink, padding: '26px 30px', overflow: 'auto', height: '100%', background: '#f5f9f8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: teal, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24 }}>ס</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: dark }}>סֶלַע — מחשבון משכנתא</h1>
          <div style={{ color: '#5a6675', fontSize: 14 }}>תמהיל מסלולים עם לוח סילוקין (שפיצר) וערך ריאלי מותאם-מדד</div>
        </div>
      </div>

      {/* summary cards */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '22px 0' }}>
        <div style={{ ...card, background: teal, color: '#fff', border: 'none' }}>
          <div style={{ fontSize: 13, opacity: 0.85 }}>תשלום חודשי מאוחד</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{ILS(unifiedMonthly)}</div>
        </div>
        <div style={card}><div style={{ fontSize: 13, color: '#5a6675' }}>סך הקרן</div><div style={{ fontSize: 26, fontWeight: 800, color: dark, marginTop: 4 }}>{ILS(totalPrincipal)}</div></div>
        <div style={card}><div style={{ fontSize: 13, color: '#5a6675' }}>סה"כ ריבית (נומינלי)</div><div style={{ fontSize: 26, fontWeight: 800, color: dark, marginTop: 4 }}>{ILS(totalInterest)}</div></div>
        <div style={card}><div style={{ fontSize: 13, color: '#5a6675' }}>עלות ריאלית (מותאם מדד)</div><div style={{ fontSize: 26, fontWeight: 800, color: teal, marginTop: 4 }}>{ILS(realCost)}</div></div>
      </div>

      {/* global params */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14 }}>ריבית פריים (בנק ישראל):&nbsp;
          <input type="number" step={0.1} value={prime} onChange={e => setPrime(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 90, display: 'inline-block' }} /> %
        </label>
        <label style={{ fontSize: 14 }}>אינפלציה שנתית (מדד):&nbsp;
          <input type="number" step={0.1} value={inflation} onChange={e => setInflation(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 90, display: 'inline-block' }} /> %
        </label>
        <button onClick={addTrack} style={{ background: teal, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ הוסף מסלול</button>
      </div>

      {/* tracks table */}
      <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 26 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: soft }}>
            <tr>
              <th style={th}>מסלול</th><th style={th}>סוג הצמדה</th><th style={th}>קרן (₪)</th>
              <th style={th}>ריבית שנתית (%)</th><th style={th}>שנים</th>
              <th style={th}>ריבית אפקטיבית</th><th style={th}>תשלום חודשי</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ track, monthly }) => (
              <tr key={track.id}>
                <td style={td}><input value={track.name} onChange={e => update(track.id, { name: e.target.value })} style={inputStyle} /></td>
                <td style={td}>
                  <select value={track.linkage} onChange={e => update(track.id, { linkage: e.target.value as LinkageType })} style={inputStyle}>
                    <option value="prime">{LINKAGE_LABEL.prime}</option>
                    <option value="cpi">{LINKAGE_LABEL.cpi}</option>
                    <option value="fixed">{LINKAGE_LABEL.fixed}</option>
                  </select>
                </td>
                <td style={td}><input type="number" value={track.principal} onChange={e => update(track.id, { principal: parseFloat(e.target.value) || 0 })} style={inputStyle} /></td>
                <td style={td}><input type="number" step={0.1} value={track.annualRate} onChange={e => update(track.id, { annualRate: parseFloat(e.target.value) || 0 })} style={inputStyle} /></td>
                <td style={td}><input type="number" value={track.years} onChange={e => update(track.id, { years: parseFloat(e.target.value) || 0 })} style={inputStyle} /></td>
                <td style={{ ...td, fontWeight: 700 }}>{effectiveAnnualRate(track, prime).toFixed(2)}%</td>
                <td style={{ ...td, fontWeight: 700, color: teal }}>{ILS(monthly)}</td>
                <td style={td}><button onClick={() => removeTrack(track.id)} style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 18 }}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* amortization preview for first track */}
      {results[0] && (
        <div>
          <h2 style={{ fontSize: 18, color: dark, margin: '0 0 10px' }}>לוח סילוקין — {results[0].track.name} (12 חודשים ראשונים)</h2>
          <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', maxWidth: 720 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: soft }}>
                <tr><th style={th}>תקופה</th><th style={th}>תשלום</th><th style={th}>ריבית</th><th style={th}>קרן</th><th style={th}>יתרה</th></tr>
              </thead>
              <tbody>
                {results[0].rows.slice(0, 12).map(r => (
                  <tr key={r.period}>
                    <td style={td}>{r.period}</td><td style={td}>{ILS(r.payment)}</td>
                    <td style={td}>{ILS(r.interest)}</td><td style={td}>{ILS(r.principal)}</td><td style={td}>{ILS(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ color: '#5a6675', fontSize: 13, marginTop: 10, maxWidth: 720 }}>
            כל מסלול מוצמד להצמדה <b>אחת בלבד</b> (פריים / מדד / קבועה). מסלול פריים מחושב לפי ריבית בנק ישראל + מרווח;
            מסלול צמוד-מדד מצמיד את הקרן למדד; מסלול קבועה יציב לכל התקופה. סכום המסלולים = התשלום החודשי המאוחד.
            העלות הריאלית מחושבת כערך נוכחי של זרם התשלומים לפי האינפלציה.
          </p>
        </div>
      )}
    </div>
  );
}
