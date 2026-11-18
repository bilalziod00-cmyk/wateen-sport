import React, { useState } from 'react';
import { Download, Image as ImageIcon, Palette, PlusCircle, ShieldCheck } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { COMPETITIONS, PRIMARY_COMPETITION_LIST } from '../../constants/competitions';
import { AutoTemplateCardType, CompetitionId, SportsGraphicCard } from '../../types/sports';
import {
  buildAutoTemplateCardFromOfficialData,
  exportSportsCardAsPng,
} from '../../utils/cardCanvasExport';

const AUTO_TEMPLATES: { id: AutoTemplateCardType; label: string; desc: string }[] = [
  { id: 'match_card', label: 'بطاقة مباراة', desc: 'تصميم بطاقة لمباراة قادمة أو مؤجلة' },
  { id: 'result_card', label: 'بطاقة نتيجة', desc: 'تصميم بطاقة لنتيجة مباراة معتمدة' },
  { id: 'standings_card', label: 'جدول ترتيب', desc: 'تصميم جدول ترتيب البطولة المعتمد' },
  { id: 'round_fixtures_card', label: 'جدول مباريات الجولة', desc: 'تصميم كامل لمباريات ونتائج الجولة' },
  { id: 'top_scorers_card', label: 'قائمة الهدافين', desc: 'تصميم قائمة هدافي البطولة' },
  { id: 'goalkeepers_card', label: 'إحصائيات الحراس', desc: 'تصميم الشباك النظيفة والأهداف المستقبلة' },
  { id: 'mvp_player_card', label: 'بطاقة أفضل لاعب', desc: 'تصميم بطاقة نجم الجولة / أفضل لاعب' },
];

export const AdminAutoDesignStudio: React.FC = () => {
  const { data, saveSportsCard, showToast } = useAppData();
  const [competitionId, setCompetitionId] = useState<CompetitionId>('pro_league');
  const [templateType, setTemplateType] = useState<AutoTemplateCardType>('result_card');
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [selectedScorerId, setSelectedScorerId] = useState<string>('');
  const [previewCard, setPreviewCard] = useState<SportsGraphicCard | null>(null);

  const compMatches = data.matches.filter(
    (m) => m.competitionId === competitionId && m.isApproved !== false
  );
  const compStandings = data.standings.filter((s) => s.competitionId === competitionId);
  const compScorers = data.scorers.filter((s) => s.competitionId === competitionId);
  const compGoalkeepers = (data.goalkeepers || []).filter((g) => g.competitionId === competitionId);

  const rounds = Array.from(new Set(compMatches.map((m) => m.round)));
  const activeMatch =
    compMatches.find((m) => m.id === selectedMatchId) || compMatches[0] || undefined;
  const activeRound = selectedRound || rounds[0] || 'الجولة 14';
  const activeScorer =
    compScorers.find((s) => s.id === selectedScorerId) || compScorers[0] || undefined;

  const handleGenerateCard = () => {
    const built = buildAutoTemplateCardFromOfficialData({
      templateType,
      competitionId,
      roundName: activeRound,
      match: activeMatch,
      standings: compStandings,
      roundMatches: compMatches.filter((m) => m.round === activeRound),
      scorers: compScorers,
      goalkeepers: compGoalkeepers,
      mvpPlayer: activeScorer
        ? {
            playerName: activeScorer.playerName,
            teamName: activeScorer.teamName,
            goals: activeScorer.goals,
            assists: activeScorer.assists,
            rating: '9.2',
          }
        : undefined,
    });

    if (!built) {
      showToast('لا يمكن إنشاء التصميم: يرجى التأكد من وجود بيانات معتمدة لهذا القالب', 'crimson');
      return;
    }

    setPreviewCard(built);
    showToast('تم توليد التصميم الرياضي التلقائي بهوية WATEEN SPORT', 'emerald');
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-[#0D1622] border border-emerald-500/35 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-black border-2 border-[#00FF40]/70 flex items-center justify-center text-[#00FF40]">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                استوديو التصميم الرياضي التلقائي — WATEEN SPORT
              </h2>
              <p className="text-xs text-slate-400">
                توليد وتصدير تصاميم PNG (1080×1080) مباشرة من البيانات الرسمية المعتمدة فقط
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-black text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            مرتبط بالبيانات المعتمدة فقط
          </span>
        </div>

        {/* اختيار القالب من القوالب السبعة */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {AUTO_TEMPLATES.map((tpl) => {
            const active = templateType === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setTemplateType(tpl.id)}
                className={`p-2.5 rounded-2xl border text-right transition-all ${
                  active
                    ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-glow'
                    : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="text-xs font-black text-emerald-300">{tpl.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{tpl.desc}</div>
              </button>
            );
          })}
        </div>

        {/* محددات البطولة والمباراة أو الجولة أو اللاعب */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">البطولة</label>
            <select
              value={competitionId}
              onChange={(e) => setCompetitionId(e.target.value as CompetitionId)}
              className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs font-extrabold text-white"
            >
              {PRIMARY_COMPETITION_LIST.map((cid) => (
                <option key={cid} value={cid} className="bg-[#0B121B]">
                  {COMPETITIONS[cid].name}
                </option>
              ))}
            </select>
          </div>

          {(templateType === 'match_card' || templateType === 'result_card') && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                اختر المباراة المعتمدة
              </label>
              <select
                value={activeMatch?.id || ''}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs font-extrabold text-white"
              >
                {compMatches.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0B121B]">
                    {m.homeTeam} ({m.homeScore}-{m.awayScore}) {m.awayTeam} • {m.round}
                  </option>
                ))}
              </select>
            </div>
          )}

          {templateType === 'round_fixtures_card' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">اختر الجولة</label>
              <select
                value={activeRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs font-extrabold text-white"
              >
                {rounds.map((r) => (
                  <option key={r} value={r} className="bg-[#0B121B]">
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {templateType === 'mvp_player_card' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                اختر اللاعب (نجم الجولة)
              </label>
              <select
                value={activeScorer?.id || ''}
                onChange={(e) => setSelectedScorerId(e.target.value)}
                className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs font-extrabold text-white"
              >
                {compScorers.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#0B121B]">
                    {s.playerName} ({s.teamName}) - {s.goals} أهداف
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleGenerateCard}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-l from-[#00E640] to-emerald-500 hover:from-[#2bff65] hover:to-emerald-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-[0_0_18px_rgba(0,255,64,0.3)]"
            >
              <ImageIcon className="w-4 h-4" />
              توليد التصميم الرياضي الآن
            </button>
          </div>
        </div>
      </div>

      {/* معاينة البطاقة المولدة وتصديرها كصورة PNG أو نشرها */}
      {previewCard && (
        <div className="rounded-3xl bg-black border-2 border-[#00FF40]/50 p-5 space-y-4 shadow-[0_0_40px_rgba(0,255,64,0.18)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <img
                src="./images/app-icon.png"
                alt="WATEEN SPORT"
                className="w-12 h-12 rounded-full border-2 border-[#00FF40] bg-black object-contain"
              />
              <div>
                <div className="text-xs font-extrabold text-[#00FF40]">{previewCard.kicker}</div>
                <h3 className="text-lg font-black text-white">{previewCard.title}</h3>
                <div className="text-xs text-slate-400">{previewCard.subtitle}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const ok = await exportSportsCardAsPng(previewCard);
                  if (ok) showToast('تم تحميل صورة البطاقة بدقة 1080×1080 PNG', 'emerald');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00E640] hover:bg-[#2bff65] text-black text-xs font-black"
              >
                <Download className="w-4 h-4" />
                حفظ كصورة PNG (1080×1080)
              </button>

              <button
                type="button"
                onClick={() => saveSportsCard(previewCard)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-extrabold"
              >
                <PlusCircle className="w-4 h-4" />
                نشر في بطاقات التطبيق
              </button>
            </div>
          </div>

          {Array.isArray(previewCard.tableRows) && previewCard.tableRows.length > 0 && (
            <div className="space-y-1.5">
              {previewCard.tableRows.map((rCells, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-extrabold border ${
                    idx === 0
                      ? 'bg-[#00FF40]/15 border-[#00FF40]/50 text-[#00FF40]'
                      : 'bg-white/5 border-white/10 text-white'
                  }`}
                >
                  <span>{rCells.slice(0, 2).join('  •  ')}</span>
                  <span className="text-slate-300">{rCells.slice(2).join('   |   ')}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            {previewCard.metrics.map((m, idx) => (
              <div
                key={idx}
                className={`rounded-2xl p-3 text-center border ${
                  m.highlight
                    ? 'bg-[#00FF40]/15 border-[#00FF40]/50 text-[#00FF40]'
                    : 'bg-white/5 border-white/10 text-white'
                }`}
              >
                <div className="text-lg font-black">{m.value}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span>وتين سبورت | WATEEN SPORT</span>
            <span>نبض الملاعب والكرة الأردنية ⚽🇯🇴</span>
          </div>
        </div>
      )}
    </div>
  );
};
