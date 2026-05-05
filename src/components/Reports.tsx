import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type Language } from '../lib/i18n';
import { type Zone } from '../lib/api';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function pct(actual: number, expected: number) {
  if (!expected) return '—';
  return `${Math.round((actual / expected) * 100)}%`;
}

function perfColor(p: string): string {
  if (p === '—') return 'bg-gray-100 text-gray-500';
  const v = parseInt(p);
  if (v >= 80) return 'bg-green-50 text-green-700';
  if (v >= 50) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-600';
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── types ────────────────────────────────────────────────────────────────────

type ReportTab = 'farm' | 'zone';

interface UserInfo {
  first_name?: string | null;
  last_name?: string | null;
  region?: string | null;
  district?: string | null;
  farm_size_acres?: number | null;
}

// ─── shared KPI summary bar ───────────────────────────────────────────────────

function SummaryBar({
  zoneCount, totalArea, totalExpected, totalActual, performance, lang,
}: {
  zoneCount: number; totalArea: number; totalExpected: number;
  totalActual: number; performance: string; lang: Language;
}) {
  const kpis = [
    { label: lang === 'sw' ? 'Maeneo' : 'Total Zones',       value: String(zoneCount),                  icon: '🌱', color: '#035925' },
    { label: lang === 'sw' ? 'Eneo Lote' : 'Total Area',      value: `${totalArea.toFixed(1)} ac`,        icon: '📐', color: '#0082f3' },
    { label: lang === 'sw' ? 'Mavuno Yanayotarajiwa' : 'Expected Yield', value: `${fmt(totalExpected)} kg`, icon: '📊', color: '#fc8e44' },
    { label: lang === 'sw' ? 'Mavuno Halisi' : 'Actual Yield', value: `${fmt(totalActual)} kg`,           icon: '🌾', color: '#035925' },
    { label: lang === 'sw' ? 'Utendaji' : 'Performance',      value: performance,                          icon: '🎯',
      color: performance === '—' ? '#5d6c7b' : parseInt(performance) >= 80 ? '#035925' : parseInt(performance) >= 50 ? '#fc8e44' : '#d32f2f' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map(k => (
        <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border border-[#002c11]/[0.06] border-l-[3px]" style={{ borderLeftColor: k.color }}>
          <span className="text-xl block mb-1.5">{k.icon}</span>
          <p className="text-lg font-black text-[#002c11] leading-tight" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{k.value}</p>
          <p className="text-[10px] text-[#5d6c7b] mt-0.5">{k.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Reports({
  zones,
  lang = 'en',
  user,
}: {
  zones: Zone[];
  lang?: Language;
  user?: UserInfo | null;
}) {
  const [tab, setTab] = useState<ReportTab>('farm');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateField, setDateField] = useState<'planting_date' | 'expected_harvest_date'>('planting_date');

  // ── farm owner & location ─────────────────────────────────────────────────
  const ownerName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '—';
  const location = [user?.district, user?.region].filter(Boolean).join(', ') || '—';

  // ── filtered zones ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return zones.filter(z => {
      const raw = z[dateField];
      if (!raw) return true;
      const d = new Date(raw).getTime();
      if (dateFrom && d < new Date(dateFrom).getTime()) return false;
      if (dateTo && d > new Date(dateTo + 'T23:59:59').getTime()) return false;
      return true;
    });
  }, [zones, dateFrom, dateTo, dateField]);

  // ── Report 1: Farm Yield Summary ──────────────────────────────────────────
  const farmRow = useMemo(() => {
    const totalExpected = filtered.reduce((s, z) => s + (z.expected_yield_kg || 0), 0);
    const totalActual   = filtered.reduce((s, z) => s + (z.actual_yield_kg   || 0), 0);
    const totalArea     = filtered.reduce((s, z) => s + (z.area_size         || 0), 0);
    const map: Record<string, { expected: number; actual: number; area: number; zones: number }> = {};
    filtered.forEach(z => {
      if (!map[z.crop_type]) map[z.crop_type] = { expected: 0, actual: 0, area: 0, zones: 0 };
      map[z.crop_type].expected += z.expected_yield_kg || 0;
      map[z.crop_type].actual   += z.actual_yield_kg   || 0;
      map[z.crop_type].area     += z.area_size         || 0;
      map[z.crop_type].zones    += 1;
    });
    return {
      totalExpected, totalActual, totalArea,
      zoneCount: filtered.length,
      performance: pct(totalActual, totalExpected),
      breakdown: Object.entries(map)
        .sort((a, b) => b[1].expected - a[1].expected)
        .map(([crop, v]) => ({ crop, ...v, performance: pct(v.actual, v.expected) })),
    };
  }, [filtered]);

  // ── Report 2: by Zone ─────────────────────────────────────────────────────
  const byZone = useMemo(() => filtered.map(z => ({
    zone:          z.name,
    crop:          z.crop_type,
    area:          z.area_size,
    plantingDate:  fmtDate(z.planting_date),
    harvestDate:   fmtDate(z.expected_harvest_date),
    status:        z.status,
    expectedYield: z.expected_yield_kg || 0,
    actualYield:   z.actual_yield_kg   || 0,
    performance:   pct(z.actual_yield_kg || 0, z.expected_yield_kg || 0),
  })), [filtered]);

  // ── Excel export ──────────────────────────────────────────────────────────
  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1 — Farm Summary
    const farmMeta = [
      ['BwanaShamba — Farm Yield Report'],
      ['Generated', new Date().toLocaleDateString('en-GB')],
      ['Farm Owner', ownerName],
      ['Location', location],
      ...(user?.farm_size_acres ? [['Farm Size', `${user.farm_size_acres} acres`]] : []),
      [],
      ['FARM TOTALS'],
      ['Total Zones', farmRow.zoneCount],
      ['Total Area (ac)', farmRow.totalArea.toFixed(1)],
      ['Expected Yield (kg)', fmt(farmRow.totalExpected)],
      ['Actual Yield (kg)', fmt(farmRow.totalActual)],
      ['Performance', farmRow.performance],
      [],
      ['CROP BREAKDOWN'],
      ['Crop', 'Zones', 'Area (ac)', 'Expected Yield (kg)', 'Actual Yield (kg)', 'Performance', 'Farm Share'],
      ...farmRow.breakdown.map(b => [
        b.crop, b.zones, b.area.toFixed(1), fmt(b.expected), fmt(b.actual),
        b.performance,
        farmRow.totalExpected > 0 ? `${Math.round((b.expected / farmRow.totalExpected) * 100)}%` : '—',
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(farmMeta), 'Report 1 – Farm Summary');

    // Sheet 2 — by Zone
    const zoneData = [
      ['BwanaShamba — Yield by Zone'],
      ['Farm Owner', ownerName],
      ['Location', location],
      [],
      ['Zone', 'Crop', 'Area (ac)', 'Planting Date', 'Expected Harvest', 'Status', 'Expected Yield (kg)', 'Actual Yield (kg)', 'Performance'],
      ...byZone.map(r => [
        r.zone, r.crop, r.area?.toFixed(1), r.plantingDate, r.harvestDate,
        r.status, fmt(r.expectedYield), fmt(r.actualYield), r.performance,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(zoneData), 'Report 2 – By Zone');

    const fieldLabel = dateField === 'planting_date' ? 'Planted' : 'Harvest';
    const dateLabel  = dateFrom || dateTo ? `_${fieldLabel}_${dateFrom || ''}${dateTo ? '_to_' + dateTo : ''}` : '';
    XLSX.writeFile(wb, `BwanaShamba_YieldReport${dateLabel}.xlsx`);
  }

  // ── PDF export ────────────────────────────────────────────────────────────
  function exportPDF() {
    const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const filterLabel = dateField === 'planting_date' ? 'Planting Date' : 'Harvest Date';
    const dateRange   = dateFrom || dateTo
      ? `  |  ${filterLabel}: ${dateFrom ? 'From ' + dateFrom : ''}${dateTo ? ' To ' + dateTo : ''}`
      : '';

    function addPageHeader(title: string, pageNum: number) {
      doc.setFillColor(0, 44, 17);
      doc.rect(0, 0, pageW, 18, 'F');
      doc.setFontSize(13); doc.setTextColor(255, 232, 107); doc.setFont('helvetica', 'bold');
      doc.text('BwanaShamba — Yield Report', 14, 12);
      doc.setFontSize(7.5); doc.setTextColor(180, 210, 180); doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}${dateRange}`, pageW - 14, 7, { align: 'right' });
      doc.text(`Page ${pageNum}`, pageW - 14, 14, { align: 'right' });
      // Owner / location line
      doc.setFontSize(8); doc.setTextColor(93, 108, 123);
      doc.text(`${ownerName}  ·  ${location}`, 14, 24);
      doc.setFontSize(11); doc.setTextColor(0, 44, 17); doc.setFont('helvetica', 'bold');
      doc.text(title, 14, 31);
    }

    function addKpiBoxes(startY: number) {
      const kpis = [
        { label: 'Total Zones',    value: String(farmRow.zoneCount) },
        { label: 'Total Area',     value: `${farmRow.totalArea.toFixed(1)} ac` },
        { label: 'Expected Yield', value: `${fmt(farmRow.totalExpected)} kg` },
        { label: 'Actual Yield',   value: `${fmt(farmRow.totalActual)} kg` },
        { label: 'Performance',    value: farmRow.performance },
      ];
      const boxW = (pageW - 28) / kpis.length;
      kpis.forEach((k, i) => {
        const x = 14 + i * boxW;
        doc.setFillColor(240, 248, 242);
        doc.roundedRect(x, startY, boxW - 2, 18, 2, 2, 'F');
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 44, 17);
        doc.text(k.value, x + (boxW - 2) / 2, startY + 10, { align: 'center' });
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(93, 108, 123);
        doc.text(k.label, x + (boxW - 2) / 2, startY + 16, { align: 'center' });
      });
      return startY + 22;
    }

    let pageNum = 1;

    // ── Page 1: Farm Summary ──────────────────────────────────────────────
    addPageHeader('Report 1 — Farm Yield Summary', pageNum);
    const afterKpi = addKpiBoxes(34);

    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 44, 17);
    doc.text('Crop Breakdown', 14, afterKpi + 1);

    autoTable(doc, {
      startY: afterKpi + 4,
      head: [['Crop', 'Zones', 'Area (ac)', 'Expected (kg)', 'Actual (kg)', 'Performance', 'Farm Share']],
      body: [
        ...farmRow.breakdown.map(b => [
          b.crop, b.zones, b.area.toFixed(1), fmt(b.expected), fmt(b.actual),
          b.performance,
          farmRow.totalExpected > 0 ? `${Math.round((b.expected / farmRow.totalExpected) * 100)}%` : '—',
        ]),
        ['TOTAL', farmRow.zoneCount, farmRow.totalArea.toFixed(1),
          fmt(farmRow.totalExpected), fmt(farmRow.totalActual), farmRow.performance, '100%'],
      ],
      headStyles:          { fillColor: [3, 89, 37], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles:          { fontSize: 8, textColor: [0, 44, 17] },
      alternateRowStyles:  { fillColor: [245, 250, 246] },
      didParseCell(data) {
        if (data.row.index === farmRow.breakdown.length) {
          data.cell.styles.fillColor  = [0, 44, 17];
          data.cell.styles.textColor  = [255, 232, 107];
          data.cell.styles.fontStyle  = 'bold';
        }
      },
    });

    // ── Page 2: by Zone ───────────────────────────────────────────────────
    doc.addPage(); pageNum++;
    addPageHeader('Report 2 — Yield by Zone', pageNum);
    addKpiBoxes(34);

    autoTable(doc, {
      startY: 60,
      head: [['Zone', 'Crop', 'Area', 'Planted', 'Exp. Harvest', 'Status', 'Exp. Yield', 'Act. Yield', 'Perf.']],
      body: byZone.map(r => [
        r.zone, r.crop, r.area?.toFixed(1), r.plantingDate, r.harvestDate,
        r.status, fmt(r.expectedYield), fmt(r.actualYield), r.performance,
      ]),
      headStyles:         { fillColor: [3, 89, 37], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles:         { fontSize: 7.5, textColor: [0, 44, 17] },
      alternateRowStyles: { fillColor: [245, 250, 246] },
      columnStyles: {
        0: { cellWidth: 22 }, 1: { cellWidth: 20 }, 2: { cellWidth: 11 },
        3: { cellWidth: 20 }, 4: { cellWidth: 20 }, 5: { cellWidth: 15 },
        6: { cellWidth: 17 }, 7: { cellWidth: 17 }, 8: { cellWidth: 13 },
      },
    });

    const fieldLabel = dateField === 'planting_date' ? 'Planted' : 'Harvest';
    const dateLabel  = dateFrom || dateTo ? `_${fieldLabel}_${dateFrom || ''}${dateTo ? '_to_' + dateTo : ''}` : '';
    doc.save(`BwanaShamba_YieldReport${dateLabel}.pdf`);
  }

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-8">

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
            📊 {lang === 'sw' ? 'Ripoti' : 'Reports'}
          </h2>
          {/* Farm owner + location */}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            <p className="text-xs text-[#5d6c7b]">
              👤 <span className="font-semibold text-[#002c11]">{ownerName}</span>
            </p>
            {location !== '—' && (
              <p className="text-xs text-[#5d6c7b]">
                📍 <span className="font-semibold text-[#002c11]">{location}</span>
              </p>
            )}
            {user?.farm_size_acres && (
              <p className="text-xs text-[#5d6c7b]">
                📐 <span className="font-semibold text-[#002c11]">{user.farm_size_acres} ac</span>
              </p>
            )}
          </div>
          <p className="text-[10px] text-[#5d6c7b] mt-1">
            {filtered.length} zone{filtered.length !== 1 ? 's' : ''}
            {(dateFrom || dateTo)
              ? ` · filtered by ${dateField === 'planting_date' ? 'planting date' : 'harvest date'}`
              : ''}
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all hover:opacity-90 active:scale-95"
            style={{ background: '#217346', color: 'white' }}
          >
            <span>📥</span> Excel
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all hover:opacity-90 active:scale-95"
            style={{ background: '#d32f2f', color: 'white' }}
          >
            <span>📄</span> PDF
          </button>
        </div>
      </div>

      {/* ── Date filter ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#002c11]/[0.06]">
        <p className="text-[10px] font-bold text-[#5d6c7b] uppercase tracking-wider mb-3">
          {lang === 'sw' ? 'Chujio cha Tarehe' : 'Date Filter'}
        </p>

        {/* Filter by toggle */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] text-[#5d6c7b] shrink-0">{lang === 'sw' ? 'Chuja kwa:' : 'Filter by:'}</span>
          <div className="flex rounded-lg overflow-hidden border border-[#002c11]/10">
            <button
              onClick={() => setDateField('planting_date')}
              className="px-3 py-1.5 text-[11px] font-bold transition-colors"
              style={{ background: dateField === 'planting_date' ? '#002c11' : 'transparent', color: dateField === 'planting_date' ? 'white' : '#5d6c7b' }}
            >
              🌱 {lang === 'sw' ? 'Tarehe ya Kupanda' : 'Planting Date'}
            </button>
            <button
              onClick={() => setDateField('expected_harvest_date')}
              className="px-3 py-1.5 text-[11px] font-bold transition-colors border-l border-[#002c11]/10"
              style={{ background: dateField === 'expected_harvest_date' ? '#002c11' : 'transparent', color: dateField === 'expected_harvest_date' ? 'white' : '#5d6c7b' }}
            >
              🌾 {lang === 'sw' ? 'Tarehe ya Kuvuna' : 'Harvest Date'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[10px] text-[#5d6c7b] mb-1">{lang === 'sw' ? 'Kuanzia' : 'From'}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-[#002c11]/10 rounded-lg px-3 py-1.5 text-[13px] text-[#002c11] focus:outline-none focus:border-[#035925]/40 bg-[#f9f6f1]" />
          </div>
          <div>
            <label className="block text-[10px] text-[#5d6c7b] mb-1">{lang === 'sw' ? 'Hadi' : 'To'}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-[#002c11]/10 rounded-lg px-3 py-1.5 text-[13px] text-[#002c11] focus:outline-none focus:border-[#035925]/40 bg-[#f9f6f1]" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-[11px] text-[#5d6c7b] hover:text-red-500 underline pb-1.5 transition-colors">
              {lang === 'sw' ? 'Futa Chujio' : 'Clear filter'}
            </button>
          )}
        </div>
      </div>

      {/* ── Report tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {([
          { id: 'farm', label: lang === 'sw' ? 'Ripoti 1 — Muhtasari wa Shamba' : 'Report 1 — Farm Yield Summary' },
          { id: 'zone', label: lang === 'sw' ? 'Ripoti 2 — kwa Eneo'           : 'Report 2 — Yield by Zone' },
        ] as { id: ReportTab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="whitespace-nowrap px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
            style={{
              background: tab === t.id ? '#002c11' : 'white',
              color: tab === t.id ? 'white' : '#5d6c7b',
              border: tab === t.id ? '1px solid #002c11' : '1px solid rgba(0,44,17,0.1)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Report 1: Farm Yield Summary ──────────────────────────────── */}
      {tab === 'farm' && (
        <div className="space-y-4">

          <SummaryBar
            zoneCount={farmRow.zoneCount} totalArea={farmRow.totalArea}
            totalExpected={farmRow.totalExpected} totalActual={farmRow.totalActual}
            performance={farmRow.performance} lang={lang}
          />

          {/* Overall performance progress bar */}
          {farmRow.totalExpected > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-[#002c11]/[0.06]">
              <div className="flex justify-between text-xs text-[#5d6c7b] mb-2">
                <span>{lang === 'sw' ? 'Utendaji wa Jumla' : 'Overall Farm Performance'}</span>
                <span className="font-bold text-[#002c11]">{farmRow.performance}</span>
              </div>
              <div className="w-full bg-[#002c11]/[0.06] h-4 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (farmRow.totalActual / farmRow.totalExpected) * 100)}%`,
                    background: 'linear-gradient(90deg, #035925, #0a8f3f)',
                  }} />
              </div>
              <div className="flex justify-between text-[10px] text-[#5d6c7b] mt-1.5">
                <span>{fmt(farmRow.totalActual)} kg {lang === 'sw' ? 'halisi' : 'actual'}</span>
                <span>{fmt(farmRow.totalExpected)} kg {lang === 'sw' ? 'yanayotarajiwa' : 'expected'}</span>
              </div>
            </div>
          )}

          {/* Crop breakdown table */}
          <div className="bg-white rounded-xl shadow-sm border border-[#002c11]/[0.06] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#002c11]/[0.05]">
              <h3 className="font-black text-[#002c11] text-sm" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                {lang === 'sw' ? 'Mgawanyo kwa Zao' : 'Breakdown by Crop'}
              </h3>
            </div>
            {farmRow.breakdown.length === 0 ? (
              <p className="text-sm text-[#5d6c7b] text-center py-10">{lang === 'sw' ? 'Hakuna data' : 'No data for selected period'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#f0f7f2' }}>
                      {[
                        { label: lang === 'sw' ? 'Zao'                         : 'Crop',            align: 'left'  },
                        { label: lang === 'sw' ? 'Maeneo'                      : 'Zones',           align: 'right' },
                        { label: lang === 'sw' ? 'Eneo (ac)'                   : 'Area (ac)',        align: 'right' },
                        { label: lang === 'sw' ? 'Mavuno Yanayotarajiwa (kg)'  : 'Expected (kg)',   align: 'right' },
                        { label: lang === 'sw' ? 'Mavuno Halisi (kg)'          : 'Actual (kg)',     align: 'right' },
                        { label: lang === 'sw' ? 'Utendaji'                    : 'Performance',     align: 'right' },
                        { label: lang === 'sw' ? 'Sehemu'                      : 'Farm Share',      align: 'right' },
                      ].map(h => (
                        <th key={h.label}
                          className={`text-${h.align} px-4 py-3 text-[11px] font-bold text-[#002c11] uppercase tracking-wider`}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {farmRow.breakdown.map((b, i) => (
                      <tr key={b.crop} className={i % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'}>
                        <td className="px-4 py-3 font-bold text-[#002c11]">{b.crop}</td>
                        <td className="px-4 py-3 text-right text-[#5d6c7b]">{b.zones}</td>
                        <td className="px-4 py-3 text-right text-[#5d6c7b]">{b.area.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right text-[#5d6c7b]">{fmt(b.expected)}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#035925]">{fmt(b.actual)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${perfColor(b.performance)}`}>
                            {b.performance}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14 bg-[#002c11]/[0.06] h-1.5 rounded-full overflow-hidden">
                              <div className="h-full bg-[#035925] rounded-full"
                                style={{ width: farmRow.totalExpected > 0 ? `${Math.min(100, (b.expected / farmRow.totalExpected) * 100)}%` : '0%' }} />
                            </div>
                            <span className="text-[11px] text-[#5d6c7b] w-8 text-right">
                              {farmRow.totalExpected > 0 ? `${Math.round((b.expected / farmRow.totalExpected) * 100)}%` : '—'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#002c11' }}>
                      <td className="px-4 py-3 font-black text-white text-[12px]">{lang === 'sw' ? 'JUMLA' : 'TOTAL'}</td>
                      <td className="px-4 py-3 text-right font-bold text-white text-[12px]">{farmRow.zoneCount}</td>
                      <td className="px-4 py-3 text-right font-bold text-white text-[12px]">{farmRow.totalArea.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right font-bold text-white text-[12px]">{fmt(farmRow.totalExpected)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#ffe86b] text-[12px]">{fmt(farmRow.totalActual)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#ffe86b] text-[12px]">{farmRow.performance}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#ffe86b] text-[12px]">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Report 2: by Zone ─────────────────────────────────────────── */}
      {tab === 'zone' && (
        <div className="space-y-4">

          <SummaryBar
            zoneCount={farmRow.zoneCount} totalArea={farmRow.totalArea}
            totalExpected={farmRow.totalExpected} totalActual={farmRow.totalActual}
            performance={farmRow.performance} lang={lang}
          />

          <div className="bg-white rounded-xl shadow-sm border border-[#002c11]/[0.06] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#002c11]/[0.05]">
              <h3 className="font-black text-[#002c11] text-sm" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                {lang === 'sw' ? 'Mavuno kwa Eneo' : 'Yield by Zone'}
              </h3>
              <p className="text-[10px] text-[#5d6c7b] mt-0.5">
                {lang === 'sw' ? 'Mavuno ya kila eneo la shamba' : 'Individual zone yield details'}
              </p>
            </div>
            {byZone.length === 0 ? (
              <p className="text-sm text-[#5d6c7b] text-center py-10">{lang === 'sw' ? 'Hakuna data' : 'No data for selected period'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#f0f7f2' }}>
                      {['Zone', 'Crop', 'Area (ac)', 'Planted', 'Exp. Harvest', 'Status', 'Exp. Yield (kg)', 'Act. Yield (kg)', 'Perf.'].map(h => (
                        <th key={h} className="text-left px-3 py-3 text-[10px] font-bold text-[#002c11] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byZone.map((r, i) => (
                      <tr key={r.zone} className={i % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'}>
                        <td className="px-3 py-3 font-bold text-[#002c11] whitespace-nowrap">{r.zone}</td>
                        <td className="px-3 py-3 text-[#5d6c7b] whitespace-nowrap">{r.crop}</td>
                        <td className="px-3 py-3 text-[#5d6c7b]">{r.area?.toFixed(1)}</td>
                        <td className="px-3 py-3 text-[#5d6c7b] whitespace-nowrap">{r.plantingDate}</td>
                        <td className="px-3 py-3 text-[#5d6c7b] whitespace-nowrap">{r.harvestDate}</td>
                        <td className="px-3 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            r.status === 'Active'    ? 'bg-green-50 text-green-700' :
                            r.status === 'Harvested' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                          }`}>{r.status}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-[#5d6c7b]">{fmt(r.expectedYield)}</td>
                        <td className="px-3 py-3 text-right font-bold text-[#035925]">{fmt(r.actualYield)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${perfColor(r.performance)}`}>
                            {r.performance}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
