import React, { useMemo, useState } from 'react';
import { Award, Edit3, Plus, Table2, Trash2, X } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { COMPETITIONS, PRIMARY_COMPETITION_LIST } from '../../constants/competitions';
import { CompetitionId, StandingRow, StandingZone, TopScorer } from '../../types/sports';
import { sortStandings } from '../../components/StandingsTable';

export const AdminStandingsManager: React.FC = () => {
  const { data, saveStandingRow, deleteStandingRow, saveScorer, deleteScorer, showToast } =
    useAppData();
  const [compId, setCompId] = useState<CompetitionId>('pro_league');
  const [subMode, setSubMode] = useState<'table' | 'scorers'>('table');

  // حالة نموذج الترتيب
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [showRowForm, setShowRowForm] = useState(false);
  const [rowForm, setRowForm] = useState({
    teamName: '',
    shortName: '',
    teamColor: '#10B981',
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    autoCalcPoints: true,
    zone: 'none' as StandingZone,
  });

  // حالة نموذج الهدافين
  const [editingScorerId, setEditingScorerId] = useState<string | null>(null);
  const [showScorerForm, setShowScorerForm] = useState(false);
  const [scorerForm, setScorerForm] = useState({
    playerName: '',
    teamName: '',
    teamColor: '#10B981',
    goals: 1,
    assists: 0,
    matches: 1,
  });

  const rows = useMemo(
    () => sortStandings(data.standings.filter((s) => s.competitionId === compId)),
    [data.standings, compId]
  );

  const scorers = useMemo(
    () =>
      [...data.scorers]
        .filter((sc) => sc.competitionId === compId)
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists),
    [data.scorers, compId]
  );

  const openNewRow = () => {
    setEditingRowId(null);
    setRowForm({
      teamName: '',
      shortName: '',
      teamColor: '#10B981',
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      autoCalcPoints: true,
      zone: 'none',
    });
    setShowRowForm(true);
  };

  const openEditRow = (r: StandingRow) => {
    setEditingRowId(r.id);
    setRowForm({
      teamName: r.teamName,
      shortName: r.shortName,
      teamColor: r.teamColor,
      played: r.played,
      won: r.won,
      drawn: r.drawn,
      lost: r.lost,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      points: r.points,
      autoCalcPoints: r.points === r.won * 3 + r.drawn,
      zone: r.zone || 'none',
    });
    setShowRowForm(true);
  };

  const handleRowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rowForm.teamName.trim()) {
      showToast('يرجى إدخال اسم الفريق', 'crimson');
      return;
    }
    const existing = editingRowId ? data.standings.find((s) => s.id === editingRowId) : null;
    const computedPoints = rowForm.autoCalcPoints
      ? rowForm.won * 3 + rowForm.drawn
      : Number(rowForm.points);
    const computedPlayed = Math.max(rowForm.played, rowForm.won + rowForm.drawn + rowForm.lost);

    await saveStandingRow({
      id: editingRowId || `st-${Date.now()}`,
      competitionId: compId,
      teamName: rowForm.teamName.trim(),
      shortName: rowForm.shortName.trim() || rowForm.teamName.trim().slice(0, 4),
      teamColor: rowForm.teamColor,
      played: computedPlayed,
      won: Number(rowForm.won),
      drawn: Number(rowForm.drawn),
      lost: Number(rowForm.lost),
      goalsFor: Number(rowForm.goalsFor),
      goalsAgainst: Number(rowForm.goalsAgainst),
      points: computedPoints,
      form: existing?.form || ['W', 'D', 'W'],
      zone: rowForm.zone,
    });
    setShowRowForm(false);
  };

  const openNewScorer = () => {
    setEditingScorerId(null);
    setScorerForm({
      playerName: '',
      teamName: '',
      teamColor: '#10B981',
      goals: 1,
      assists: 0,
      matches: 1,
    });
    setShowScorerForm(true);
  };

  const openEditScorer = (sc: TopScorer) => {
    setEditingScorerId(sc.id);
    setScorerForm({
      playerName: sc.playerName,
      teamName: sc.teamName,
      teamColor: sc.teamColor,
      goals: sc.goals,
      assists: sc.assists,
      matches: sc.matches,
    });
    setShowScorerForm(true);
  };

  const handleScorerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scorerForm.playerName.trim() || !scorerForm.teamName.trim()) {
      showToast('يرجى إدخال اسم اللاعب والنادي', 'crimson');
      return;
    }
    await saveScorer({
      id: editingScorerId || `sc-${Date.now()}`,
      competitionId: compId,
      playerName: scorerForm.playerName.trim(),
      teamName: scorerForm.teamName.trim(),
      teamColor: scorerForm.teamColor,
      goals: Number(scorerForm.goals) || 0,
      assists: Number(scorerForm.assists) || 0,
      matches: Number(scorerForm.matches) || 1,
    });
    setShowScorerForm(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-black text-white">إدارة جداول الترتيب والهدافين</h2>
        <p className="text-[11px] text-slate-400">
          اختر أي دوري أو فئة عمرية وعدّل النقاط والأهداف والهدافين بترتيب تلقائي فوري
        </p>
      </div>

      {/* اختيار الدوري / الفئة */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {PRIMARY_COMPETITION_LIST.filter((c) => c !== 'jordan_cup').map((cid) => (
          <button
            key={cid}
            type="button"
            onClick={() => {
              setCompId(cid);
              setShowRowForm(false);
              setShowScorerForm(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap border ${
              compId === cid
                ? 'bg-emerald-500 text-pitch-950 border-emerald-400'
                : 'bg-[#0E1621] text-slate-300 border-white/10'
            }`}
          >
            {COMPETITIONS[cid].shortName}
          </button>
        ))}
      </div>

      {/* التبديل بين الترتيب والهدافين */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 bg-[#0E1621] p-1 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => setSubMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 ${
              subMode === 'table' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            الترتيب ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setSubMode('scorers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 ${
              subMode === 'scorers' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            الهدافون ({scorers.length})
          </button>
        </div>

        <button
          type="button"
          onClick={subMode === 'table' ? openNewRow : openNewScorer}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-pitch-950 font-black text-xs"
        >
          <Plus className="w-4 h-4" />
          {subMode === 'table' ? 'إضافة فريق' : 'إضافة هداف'}
        </button>
      </div>

      {/* نموذج جدول الترتيب */}
      {subMode === 'table' && showRowForm && (
        <form
          onSubmit={handleRowSubmit}
          className="rounded-2xl bg-[#111B29] border border-emerald-500/35 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-300">
              {editingRowId ? 'تعديل فريق في الجدول' : `إضافة فريق لـ ${COMPETITIONS[compId].name}`}
            </span>
            <button type="button" onClick={() => setShowRowForm(false)} className="text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] text-slate-400 block mb-1">اسم الفريق</label>
              <input
                type="text"
                value={rowForm.teamName}
                onChange={(e) => setRowForm({ ...rowForm, teamName: e.target.value })}
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
                required
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">الاختصار</label>
              <input
                type="text"
                value={rowForm.shortName}
                onChange={(e) => setRowForm({ ...rowForm, shortName: e.target.value })}
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">لون الشعار</label>
              <input
                type="color"
                value={rowForm.teamColor}
                onChange={(e) => setRowForm({ ...rowForm, teamColor: e.target.value })}
                className="w-full h-9 rounded-xl bg-[#070B10] border border-white/12 p-1"
              />
            </div>

            {[
              { key: 'won', label: 'فوز' },
              { key: 'drawn', label: 'تعادل' },
              { key: 'lost', label: 'خسارة' },
              { key: 'goalsFor', label: 'له (أهداف)' },
              { key: 'goalsAgainst', label: 'عليه' },
              { key: 'played', label: 'لعب' },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-[11px] text-slate-400 block mb-1">{field.label}</label>
                <input
                  type="number"
                  min={0}
                  value={rowForm[field.key as keyof typeof rowForm] as number}
                  onChange={(e) =>
                    setRowForm({ ...rowForm, [field.key]: Number(e.target.value) })
                  }
                  className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-center font-bold text-white"
                />
              </div>
            ))}

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">علامة المركز</label>
              <select
                value={rowForm.zone}
                onChange={(e) => setRowForm({ ...rowForm, zone: e.target.value as StandingZone })}
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-2.5 py-2 text-xs text-white"
              >
                <option value="none">عادي</option>
                <option value="champion">الصدارة / البطل</option>
                <option value="promotion">صعود / تأهل</option>
                <option value="continental">مقعد آسيوي</option>
                <option value="relegation">منطقة الهبوط</option>
              </select>
            </div>

            <div className="col-span-2 flex flex-wrap items-center gap-3 pt-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-emerald-300 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={rowForm.autoCalcPoints}
                  onChange={(e) => setRowForm({ ...rowForm, autoCalcPoints: e.target.checked })}
                  className="accent-emerald-500"
                />
                حساب النقاط تلقائياً ({rowForm.won * 3 + rowForm.drawn} نقطة)
              </label>
              {!rowForm.autoCalcPoints && (
                <input
                  type="number"
                  value={rowForm.points}
                  onChange={(e) => setRowForm({ ...rowForm, points: Number(e.target.value) })}
                  className="w-24 rounded-lg bg-[#070B10] border border-white/12 px-2 py-1 text-xs text-center text-emerald-300 font-black"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRowForm(false)}
              className="px-3.5 py-1.5 rounded-xl bg-white/8 text-xs text-slate-300"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-emerald-500 text-pitch-950 font-black text-xs"
            >
              حفظ في الجدول
            </button>
          </div>
        </form>
      )}

      {/* نموذج الهدافين */}
      {subMode === 'scorers' && showScorerForm && (
        <form
          onSubmit={handleScorerSubmit}
          className="rounded-2xl bg-[#111B29] border border-amber-500/35 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-300">
              {editingScorerId ? 'تعديل بيانات هداف' : 'إضافة هداف جديد'}
            </span>
            <button type="button" onClick={() => setShowScorerForm(false)} className="text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              value={scorerForm.playerName}
              onChange={(e) => setScorerForm({ ...scorerForm, playerName: e.target.value })}
              placeholder="اسم اللاعب"
              className="rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              required
            />
            <input
              type="text"
              value={scorerForm.teamName}
              onChange={(e) => setScorerForm({ ...scorerForm, teamName: e.target.value })}
              placeholder="النادي"
              className="rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              required
            />
            <input
              type="color"
              value={scorerForm.teamColor}
              onChange={(e) => setScorerForm({ ...scorerForm, teamColor: e.target.value })}
              className="w-full h-9 rounded-xl bg-[#070B10] border border-white/12 p-1"
            />
            <div>
              <label className="text-[11px] text-slate-400">الأهداف</label>
              <input
                type="number"
                min={0}
                value={scorerForm.goals}
                onChange={(e) => setScorerForm({ ...scorerForm, goals: Number(e.target.value) })}
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-center font-black text-emerald-300"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">صناعة (أسيست)</label>
              <input
                type="number"
                min={0}
                value={scorerForm.assists}
                onChange={(e) => setScorerForm({ ...scorerForm, assists: Number(e.target.value) })}
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-center text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">المباريات</label>
              <input
                type="number"
                min={1}
                value={scorerForm.matches}
                onChange={(e) => setScorerForm({ ...scorerForm, matches: Number(e.target.value) })}
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-center text-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowScorerForm(false)}
              className="px-3.5 py-1.5 rounded-xl bg-white/8 text-xs text-slate-300"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-amber-400 text-pitch-950 font-black text-xs"
            >
              حفظ الهداف
            </button>
          </div>
        </form>
      )}

      {/* عرض القائمة القابلة للتعديل */}
      {subMode === 'table' ? (
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div
              key={r.id}
              className="rounded-2xl bg-[#0E1621] border border-white/8 px-3.5 py-2.5 flex items-center justify-between gap-2 tabular-nums"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-6 text-center text-xs font-black text-slate-400">{idx + 1}</span>
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: r.teamColor }}
                />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                    {r.teamName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    لعب {r.played} • ف {r.won} • ت {r.drawn} • خ {r.lost} • فارق{' '}
                    {r.goalsFor - r.goalsAgainst}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-black">
                  {r.points} ن
                </span>
                <button
                  type="button"
                  onClick={() => openEditRow(r)}
                  className="p-1.5 rounded-lg bg-sky-500/15 text-sky-300"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteStandingRow(r.id)}
                  className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {scorers.map((sc, idx) => (
            <div
              key={sc.id}
              className="rounded-2xl bg-[#0E1621] border border-white/8 px-3.5 py-2.5 flex items-center justify-between gap-2 tabular-nums"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-6 text-center text-xs font-black text-amber-300">{idx + 1}</span>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                    {sc.playerName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {sc.teamName} • {sc.goals} هدف • {sc.assists} أسيست
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditScorer(sc)}
                  className="p-1.5 rounded-lg bg-sky-500/15 text-sky-300"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteScorer(sc.id)}
                  className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
