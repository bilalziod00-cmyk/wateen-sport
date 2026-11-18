import React, { useRef, useState } from 'react';
import { Edit3, Minus, Plus, Radio, Sparkles, Trash2, Tv, X } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { COMPETITIONS, JORDAN_STADIUMS, PRIMARY_COMPETITION_LIST } from '../../constants/competitions';
import { CompetitionId, MatchEvent, MatchItem, MatchStatus } from '../../types/sports';
import { formatAmmanDateTime, toLocalDateTimeInput } from '../../utils/ammanTime';
import { getMatchStatusShortBadge, isLiveMatchStatus } from '../../utils/matchStatus';

const DEFAULT_MATCH_FORM = {
  competitionId: 'pro_league' as CompetitionId,
  round: 'الأسبوع 15',
  homeTeam: '',
  homeShort: '',
  homeColor: '#10B981',
  awayTeam: '',
  awayShort: '',
  awayColor: '#38BDF8',
  homeScore: 0,
  awayScore: 0,
  status: 'upcoming' as MatchStatus,
  liveMinute: 1,
  kickoffLocal: toLocalDateTimeInput(new Date(Date.now() + 3600 * 1000 * 4).toISOString()),
  stadium: JORDAN_STADIUMS[0],
  referee: '',
  broadcast: 'الأردن الرياضية',
  liveStreamUrl: '',
  featured: true,
};

export const AdminMatchesManager: React.FC = () => {
  const {
    data,
    saveMatch,
    deleteMatch,
    adjustMatchScore,
    updateMatchLiveState,
    recordMatchEvent,
    showToast,
  } = useAppData();

  const formRef = useRef<HTMLFormElement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_MATCH_FORM);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [newEvPlayer, setNewEvPlayer] = useState('');
  const [newEvMinute, setNewEvMinute] = useState(45);
  const [newEvTeam, setNewEvTeam] = useState<'home' | 'away'>('home');
  const [newEvType, setNewEvType] = useState<MatchEvent['type']>('goal');
  const [quickEventMatchId, setQuickEventMatchId] = useState<string | null>(null);
  const [quickEvMinute, setQuickEvMinute] = useState<number>(45);
  const [quickEvTeam, setQuickEvTeam] = useState<'home' | 'away'>('home');
  const [quickEvType, setQuickEvType] = useState<MatchEvent['type']>('goal');
  const [quickEvPlayer, setQuickEvPlayer] = useState<string>('');
  const [quickEvSyncScore, setQuickEvSyncScore] = useState<boolean>(true);

  const scrollToForm = () => {
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(DEFAULT_MATCH_FORM);
    setEvents([]);
    setShowForm(true);
    scrollToForm();
  };

  const openEdit = (m: MatchItem) => {
    setEditingId(m.id);
    setForm({
      competitionId: m.competitionId,
      round: m.round,
      homeTeam: m.homeTeam,
      homeShort: m.homeShort,
      homeColor: m.homeColor,
      awayTeam: m.awayTeam,
      awayShort: m.awayShort,
      awayColor: m.awayColor,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      status: m.status,
      liveMinute: m.liveMinute ?? 1,
      kickoffLocal: toLocalDateTimeInput(m.kickoffIso),
      stadium: m.stadium,
      referee: m.referee || '',
      broadcast: m.broadcast || '',
      liveStreamUrl: m.liveStreamUrl || '',
      featured: Boolean(m.featured),
    });
    setEvents(m.events || []);
    setShowForm(true);
    scrollToForm();
  };

  const addEventRow = () => {
    if (!newEvPlayer.trim()) return;
    setEvents((prev) => [
      ...prev,
      {
        id: `ev-${Date.now()}`,
        minute: Number(newEvMinute) || 1,
        team: newEvTeam,
        type: newEvType,
        playerName: newEvPlayer.trim(),
      },
    ]);
    setNewEvPlayer('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.homeTeam.trim() || !form.awayTeam.trim()) {
      showToast('يرجى إدخال اسمي الفريقين', 'crimson');
      return;
    }

    const existing = editingId ? data.matches.find((m) => m.id === editingId) : null;
    const match: MatchItem = {
      id: editingId || `m-${Date.now()}`,
      competitionId: form.competitionId,
      round: form.round.trim() || 'جولة جديدة',
      homeTeam: form.homeTeam.trim(),
      homeShort: form.homeShort.trim() || form.homeTeam.trim().slice(0, 4),
      homeColor: form.homeColor,
      awayTeam: form.awayTeam.trim(),
      awayShort: form.awayShort.trim() || form.awayTeam.trim().slice(0, 4),
      awayColor: form.awayColor,
      homeScore: Number(form.homeScore) || 0,
      awayScore: Number(form.awayScore) || 0,
      status: form.status,
      liveMinute: isLiveMatchStatus(form.status) ? Number(form.liveMinute) || 1 : undefined,
      kickoffIso: form.kickoffLocal
        ? new Date(form.kickoffLocal).toISOString()
        : new Date().toISOString(),
      stadium: form.stadium.trim() || JORDAN_STADIUMS[0],
      referee: form.referee.trim() || undefined,
      broadcast: form.broadcast.trim() || undefined,
      liveStreamUrl: form.liveStreamUrl.trim() || undefined,
      featured: form.featured,
      events,
      stats: existing?.stats,
    };

    await saveMatch(match);
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-white">إدارة المباريات والنتائج الفورية</h2>
          <p className="text-[11px] text-slate-400">
            تحديث النتائج بضغطة زر وتعديل المواعيد والملاعب الأردنية والأهداف
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-pitch-950 font-black text-xs shadow-glow shrink-0"
        >
          <Plus className="w-4 h-4" />
          مباراة جديدة
        </button>
      </div>

      {showForm && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[#111B29] border border-emerald-500/35 p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-black text-emerald-300">
              {editingId ? 'تعديل بيانات المباراة' : 'إضافة مباراة جديدة'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-lg bg-white/5 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">البطولة / الفئة</label>
              <select
                value={form.competitionId}
                onChange={(e) =>
                  setForm({ ...form, competitionId: e.target.value as CompetitionId })
                }
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              >
                {PRIMARY_COMPETITION_LIST.map((cid) => (
                  <option key={cid} value={cid}>
                    {COMPETITIONS[cid].name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">الجولة / الدور</label>
              <input
                type="text"
                value={form.round}
                onChange={(e) => setForm({ ...form, round: e.target.value })}
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="rounded-xl bg-black/30 p-3 space-y-2 border border-white/8">
              <div className="text-[11px] font-black text-emerald-300">الفريق المستضيف</div>
              <input
                type="text"
                value={form.homeTeam}
                onChange={(e) => setForm({ ...form, homeTeam: e.target.value })}
                placeholder="اسم الفريق (مثال: الحسين إربد)"
                className="w-full rounded-lg bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
                required
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.homeShort}
                  onChange={(e) => setForm({ ...form, homeShort: e.target.value })}
                  placeholder="اختصار"
                  className="rounded-lg bg-[#070B10] border border-white/12 px-2 py-1.5 text-xs text-white"
                />
                <input
                  type="number"
                  min={0}
                  value={form.homeScore}
                  onChange={(e) => setForm({ ...form, homeScore: Number(e.target.value) })}
                  className="rounded-lg bg-[#070B10] border border-white/12 px-2 py-1.5 text-xs text-center font-black text-emerald-300"
                />
                <input
                  type="color"
                  value={form.homeColor}
                  onChange={(e) => setForm({ ...form, homeColor: e.target.value })}
                  className="w-full h-8 rounded-lg bg-[#070B10] border border-white/12 p-0.5 cursor-pointer"
                />
              </div>
            </div>

            <div className="rounded-xl bg-black/30 p-3 space-y-2 border border-white/8">
              <div className="text-[11px] font-black text-sky-300">الفريق الضيف</div>
              <input
                type="text"
                value={form.awayTeam}
                onChange={(e) => setForm({ ...form, awayTeam: e.target.value })}
                placeholder="اسم الفريق (مثال: الفيصلي)"
                className="w-full rounded-lg bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
                required
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.awayShort}
                  onChange={(e) => setForm({ ...form, awayShort: e.target.value })}
                  placeholder="اختصار"
                  className="rounded-lg bg-[#070B10] border border-white/12 px-2 py-1.5 text-xs text-white"
                />
                <input
                  type="number"
                  min={0}
                  value={form.awayScore}
                  onChange={(e) => setForm({ ...form, awayScore: Number(e.target.value) })}
                  className="rounded-lg bg-[#070B10] border border-white/12 px-2 py-1.5 text-xs text-center font-black text-sky-300"
                />
                <input
                  type="color"
                  value={form.awayColor}
                  onChange={(e) => setForm({ ...form, awayColor: e.target.value })}
                  className="w-full h-8 rounded-lg bg-[#070B10] border border-white/12 p-0.5 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">حالة المباراة</label>
              <div className="flex gap-2">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as MatchStatus })}
                  className="flex-1 rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
                >
                  <option value="upcoming">قادمة</option>
                  <option value="live">مباشر الآن</option>
                  <option value="first_half">الشوط الأول</option>
                  <option value="halftime">استراحة بين الشوطين</option>
                  <option value="second_half">الشوط الثاني</option>
                  <option value="finished">انتهت</option>
                  <option value="postponed">مؤجلة</option>
                  <option value="cancelled">ملغاة</option>
                </select>
                {isLiveMatchStatus(form.status) && form.status !== 'halftime' && (
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={form.liveMinute}
                    onChange={(e) => setForm({ ...form, liveMinute: Number(e.target.value) })}
                    placeholder="الدقيقة"
                    className="w-20 rounded-xl bg-[#070B10] border border-rose-500/40 px-2 py-2 text-xs text-center font-black text-rose-300"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                الموعد (بتوقيت عمّان)
              </label>
              <input
                type="datetime-local"
                value={form.kickoffLocal}
                onChange={(e) => setForm({ ...form, kickoffLocal: e.target.value })}
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">الملعب الأردني</label>
              <input
                list="jordan-stadiums"
                value={form.stadium}
                onChange={(e) => setForm({ ...form, stadium: e.target.value })}
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              />
              <datalist id="jordan-stadiums">
                {JORDAN_STADIUMS.map((st) => (
                  <option key={st} value={st} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">القناة الناقلة / الحكم</label>
              <input
                type="text"
                value={form.broadcast}
                onChange={(e) => setForm({ ...form, broadcast: e.target.value })}
                placeholder="مثال: الأردن الرياضية"
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5" />
                رابط بث مباشر للمباراة (يوتيوب أو فيسبوك — اختياري)
              </label>
              <input
                type="url"
                dir="ltr"
                value={form.liveStreamUrl}
                onChange={(e) => setForm({ ...form, liveStreamUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=... أو رابط بث فيسبوك"
                className="w-full rounded-xl bg-[#070B10] border border-rose-500/30 focus:border-rose-400 focus:outline-none px-3 py-2 text-xs text-left text-emerald-300"
              />
            </div>
          </div>

          {/* إضافة أحداث المباراة (الأهداف والبطاقات) */}
          <div className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-2.5">
            <div className="text-xs font-extrabold text-amber-300">أحداث المباراة (الأهداف / البطاقات)</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <input
                type="number"
                min={1}
                max={120}
                value={newEvMinute}
                onChange={(e) => setNewEvMinute(Number(e.target.value))}
                placeholder="الدقيقة"
                className="rounded-lg bg-[#070B10] border border-white/12 px-2 py-1.5 text-xs text-center text-white"
              />
              <select
                value={newEvTeam}
                onChange={(e) => setNewEvTeam(e.target.value as 'home' | 'away')}
                className="rounded-lg bg-[#070B10] border border-white/12 px-2 py-1.5 text-xs text-white"
              >
                <option value="home">المستضيف</option>
                <option value="away">الضيف</option>
              </select>
              <select
                value={newEvType}
                onChange={(e) => setNewEvType(e.target.value as MatchEvent['type'])}
                className="rounded-lg bg-[#070B10] border border-white/12 px-2 py-1.5 text-xs text-white"
              >
                <option value="goal">⚽ هدف</option>
                <option value="yellow_card">🟨 بطاقة صفراء</option>
                <option value="red_card">🟥 بطاقة حمراء</option>
                <option value="substitution">🔄 تبديل</option>
              </select>
              <input
                type="text"
                value={newEvPlayer}
                onChange={(e) => setNewEvPlayer(e.target.value)}
                placeholder="اسم اللاعب"
                className="rounded-lg bg-[#070B10] border border-white/12 px-2 py-1.5 text-xs text-white"
              />
              <button
                type="button"
                onClick={addEventRow}
                className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold py-1.5"
              >
                + إضافة
              </button>
            </div>
            {events.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {events.map((ev) => (
                  <span
                    key={ev.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/8 text-[11px] text-slate-200"
                  >
                    {ev.minute}&apos; {ev.type === 'goal' ? '⚽' : ev.type === 'yellow_card' ? '🟨' : '🟥'}{' '}
                    {ev.playerName}
                    <button
                      type="button"
                      onClick={() => setEvents((prev) => prev.filter((x) => x.id !== ev.id))}
                      className="text-rose-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl bg-white/8 text-xs font-bold text-slate-300"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-500 text-pitch-950 font-black text-xs shadow-glow"
            >
              حفظ المباراة فوراً
            </button>
          </div>
        </form>
      )}

      {/* بطاقات التحكم السريع بالنتائج */}
      <div className="space-y-3">
        {data.matches.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl bg-[#0E1621] border border-white/10 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bold text-emerald-300">
                {COMPETITIONS[m.competitionId].shortName} • {m.round}
              </span>
              <span className="text-slate-400">{formatAmmanDateTime(m.kickoffIso)}</span>
            </div>

            {/* تعديل فوري للنتيجة بضغطة زر */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="space-y-1.5">
                <div className="text-xs sm:text-sm font-black text-white">{m.homeTeam}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustMatchScore(m.id, 'home', 1)}
                    className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/35"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustMatchScore(m.id, 'home', -1)}
                    className="w-7 h-7 rounded-lg bg-white/5 text-slate-300 flex items-center justify-center border border-white/10"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="px-4 py-2 rounded-xl bg-pitch-950 border border-white/10 text-xl font-black text-white tabular-nums">
                {m.homeScore} - {m.awayScore}
              </div>

              <div className="space-y-1.5 text-left flex flex-col items-end">
                <div className="text-xs sm:text-sm font-black text-white">{m.awayTeam}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustMatchScore(m.id, 'away', 1)}
                    className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center border border-sky-500/35"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustMatchScore(m.id, 'away', -1)}
                    className="w-7 h-7 rounded-lg bg-white/5 text-slate-300 flex items-center justify-center border border-white/10"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* شريط تغيير الحالة المباشرة والتعديل والحذف */}
            <div className="pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    'upcoming',
                    'first_half',
                    'halftime',
                    'second_half',
                    'live',
                    'finished',
                    'postponed',
                    'cancelled',
                  ] as MatchStatus[]
                ).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() =>
                      updateMatchLiveState(
                        m.id,
                        st,
                        isLiveMatchStatus(st) && st !== 'halftime' ? m.liveMinute ?? 1 : undefined
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${
                      m.status === st
                        ? isLiveMatchStatus(st)
                          ? 'bg-rose-500/25 border-rose-500/50 text-rose-200'
                          : st === 'postponed'
                          ? 'bg-amber-500/25 border-amber-500/50 text-amber-200'
                          : st === 'cancelled'
                          ? 'bg-rose-900/40 border-rose-500/40 text-rose-300'
                          : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/5 border-white/8 text-slate-400'
                    }`}
                  >
                    {isLiveMatchStatus(st) ? (
                      <span className="inline-flex items-center gap-1">
                        <Radio className="w-3 h-3" />{' '}
                        {getMatchStatusShortBadge(st, m.status === st ? m.liveMinute : undefined)}
                      </span>
                    ) : (
                      getMatchStatusShortBadge(st)
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setQuickEventMatchId(quickEventMatchId === m.id ? null : m.id)
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-extrabold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  حدث ({m.events?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(m)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[11px] font-extrabold"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  تعديل
                </button>
                <button
                  type="button"
                  onClick={() => deleteMatch(m.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-extrabold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف
                </button>
              </div>
            </div>

            {quickEventMatchId === m.id && (
              <div className="rounded-xl bg-black/45 border border-emerald-500/30 p-3 space-y-2.5">
                <div className="text-[11px] font-black text-emerald-300">
                  تسجيل حدث رسمي موثّق (هدف / بطاقة / تبديل)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input
                    type="number"
                    min={1}
                    max={125}
                    value={quickEvMinute}
                    onChange={(e) => setQuickEvMinute(Number(e.target.value))}
                    placeholder="الدقيقة"
                    className="rounded-lg bg-[#070B10] border border-white/12 px-2 py-1.5 text-xs text-center text-white"
                  />
                  <select
                    value={quickEvTeam}
                    onChange={(e) => setQuickEvTeam(e.target.value as 'home' | 'away')}
                    className="rounded-lg bg-[#070B10] border border-white/12 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="home">{m.homeTeam}</option>
                    <option value="away">{m.awayTeam}</option>
                  </select>
                  <select
                    value={quickEvType}
                    onChange={(e) => setQuickEvType(e.target.value as MatchEvent['type'])}
                    className="rounded-lg bg-[#070B10] border border-white/12 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="goal">⚽ هدف</option>
                    <option value="yellow_card">🟨 بطاقة صفراء</option>
                    <option value="red_card">🟥 بطاقة حمراء</option>
                    <option value="substitution">🔄 تبديل</option>
                  </select>
                  <input
                    type="text"
                    value={quickEvPlayer}
                    onChange={(e) => setQuickEvPlayer(e.target.value)}
                    placeholder="اسم اللاعب"
                    className="rounded-lg bg-[#070B10] border border-white/12 px-2 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await recordMatchEvent(
                        m.id,
                        {
                          minute: quickEvMinute,
                          team: quickEvTeam,
                          type: quickEvType,
                          playerName: quickEvPlayer,
                        },
                        quickEvSyncScore
                      );
                      if (ok) setQuickEvPlayer('');
                    }}
                    className="rounded-lg bg-emerald-500 text-black text-xs font-black py-1.5"
                  >
                    + حفظ الحدث
                  </button>
                </div>
                {quickEvType === 'goal' && (
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quickEvSyncScore}
                      onChange={(e) => setQuickEvSyncScore(e.target.checked)}
                      className="accent-emerald-500"
                    />
                    زيادة نتيجة الفريق تلقائياً بمقدار هدف عند حفظ الهدف
                  </label>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
