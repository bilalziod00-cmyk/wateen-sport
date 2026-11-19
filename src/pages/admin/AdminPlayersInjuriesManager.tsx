import React, { useState } from 'react';
import {
  Award,
  Plus,
  Shield,
  Stethoscope,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import {
  COMPETITIONS,
  INITIAL_JORDAN_TEAMS_DIRECTORY,
  PRIMARY_COMPETITION_LIST,
} from '../../constants/competitions';
import {
  CompetitionId,
  GoalkeeperStat,
  InjuryReportItem,
  TopScorer,
} from '../../types/sports';
import { INJURY_STATUS_META } from '../../services/playersAndMedicalService';

type SubSection = 'injuries' | 'players' | 'teams';

export const AdminPlayersInjuriesManager: React.FC = () => {
  const {
    data,
    saveScorer,
    deleteScorer,
    saveGoalkeeper,
    deleteGoalkeeper,
    saveInjuryReport,
    deleteInjuryReport,
    registerNewTeam,
    updateTeamDirectoryItem,
    showToast,
  } = useAppData();

  const [sub, setSub] = useState<SubSection>('injuries');

  // نموذج الإصابات والجاهزية
  const [showInjuryForm, setShowInjuryForm] = useState(false);
  const [injPlayer, setInjPlayer] = useState('');
  const [injTeam, setInjTeam] = useState('');
  const [injComp, setInjComp] = useState<CompetitionId>('pro_league');
  const [injDesc, setInjDesc] = useState('');
  const [injDuration, setInjDuration] = useState('');
  const [injDate, setInjDate] = useState(new Date().toISOString().slice(0, 10));
  const [injStatus, setInjStatus] = useState<InjuryReportItem['returnStatus']>('injured');
  const [injSourceName, setInjSourceName] = useState('');
  const [injSourceUrl, setInjSourceUrl] = useState('');
  const [injVerified, setInjVerified] = useState(true);

  // نموذج إضافة لاعب / هداف بإحصائيات اختيارية
  const [playerType, setPlayerType] = useState<'outfield' | 'goalkeeper'>('outfield');
  const [pName, setPName] = useState('');
  const [pTeam, setPTeam] = useState('');
  const [pComp, setPComp] = useState<CompetitionId>('pro_league');
  const [pPosition, setPPosition] = useState('');
  const [pShirt, setPShirt] = useState('');
  const [pMatches, setPMatches] = useState('1');
  const [pGoals, setPGoals] = useState('0');
  const [pAssists, setPAssists] = useState('0');
  const [pMinutes, setPMinutes] = useState('');
  const [pYellow, setPYellow] = useState('');
  const [pRed, setPRed] = useState('');
  const [pCleanSheets, setPCleanSheets] = useState('0');
  const [pConceded, setPConceded] = useState('0');

  // نموذج تسجيل/تعديل نادي
  const [tName, setTName] = useState('');
  const [tComp, setTComp] = useState<CompetitionId>('pro_league');
  const [tCity, setTCity] = useState('');
  const [tStadium, setTStadium] = useState('');
  const [tCoach, setTCoach] = useState('');

  const directory =
    data.teamsDirectory && data.teamsDirectory.length > 0
      ? data.teamsDirectory
      : INITIAL_JORDAN_TEAMS_DIRECTORY;
  const injuries = data.injuries || [];

  const handleInjurySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await saveInjuryReport({
      playerName: injPlayer,
      teamName: injTeam,
      competitionId: injComp,
      declaredInjury: injDesc,
      announcedDate: injDate,
      declaredAbsenceDuration: injDuration,
      returnStatus: injStatus,
      sourceName: injSourceName,
      sourceUrl: injSourceUrl,
      isVerifiedOfficial: injVerified,
    });
    if (ok) {
      setInjPlayer('');
      setInjDesc('');
      setInjDuration('');
      setInjSourceName('');
      setInjSourceUrl('');
      setShowInjuryForm(false);
    }
  };

  const handlePlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim() || !pTeam.trim()) {
      showToast('يرجى إدخال اسم اللاعب والنادي', 'crimson');
      return;
    }

    if (playerType === 'goalkeeper') {
      const gk: GoalkeeperStat = {
        id: `gk-${Date.now()}`,
        competitionId: pComp,
        playerName: pName.trim(),
        teamName: pTeam.trim(),
        teamColor: '#10B981',
        matches: Math.max(1, Number(pMatches) || 1),
        cleanSheets: Math.max(0, Number(pCleanSheets) || 0),
        goalsConceded: Math.max(0, Number(pConceded) || 0),
      };
      await saveGoalkeeper(gk);
    } else {
      const parseOptionalNum = (s: string) =>
        s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s);

      const sc: TopScorer = {
        id: `sc-${Date.now()}`,
        competitionId: pComp,
        playerName: pName.trim(),
        teamName: pTeam.trim(),
        teamColor: '#10B981',
        position: pPosition.trim() || undefined,
        shirtNumber: pShirt.trim() ? Number(pShirt) : undefined,
        matches: Math.max(0, Number(pMatches) || 0),
        goals: Math.max(0, Number(pGoals) || 0),
        assists: Math.max(0, Number(pAssists) || 0),
        minutesPlayed: parseOptionalNum(pMinutes),
        yellowCards: parseOptionalNum(pYellow),
        redCards: parseOptionalNum(pRed),
      };
      await saveScorer(sc);
    }

    setPName('');
    setPPosition('');
    setPShirt('');
    setPMinutes('');
    setPYellow('');
    setPRed('');
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tName.trim()) return;
    const created = await registerNewTeam({
      name: tName.trim(),
      competitionId: tComp,
      city: tCity.trim() || 'الأردن',
    });
    if (tStadium.trim() || tCoach.trim()) {
      await updateTeamDirectoryItem({
        ...created,
        stadium: tStadium.trim() || created.stadium,
        coachName: tCoach.trim() || created.coachName,
      });
    }
    setTName('');
    setTCity('');
    setTStadium('');
    setTCoach('');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-[#0D1520] border border-white/10 p-4 space-y-2">
        <h2 className="text-base font-black text-white">
          إدارة اللاعبين والأندية والقسم الطبي (الإصابات والجاهزية)
        </h2>
        <p className="text-[11px] text-slate-400">
          الإحصائيات غير المدخلة تبقى فارغة وتظهر للمستخدم كـ «غير متوفر» • تقارير الإصابات تتطلب مصدراً رسمياً واضحاً
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 bg-[#0D1520] p-1.5 rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => setSub('injuries')}
          className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 ${
            sub === 'injuries' ? 'bg-rose-500 text-white shadow' : 'text-slate-300'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          الإصابات ({injuries.length})
        </button>
        <button
          type="button"
          onClick={() => setSub('players')}
          className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 ${
            sub === 'players' ? 'bg-emerald-500 text-black shadow' : 'text-slate-300'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          اللاعبون والحراس
        </button>
        <button
          type="button"
          onClick={() => setSub('teams')}
          className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 ${
            sub === 'teams' ? 'bg-emerald-500 text-black shadow' : 'text-slate-300'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          الأندية ({directory.length})
        </button>
      </div>

      {/* 1. إدارة الإصابات والجاهزية */}
      {sub === 'injuries' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowInjuryForm(!showInjuryForm)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black"
            >
              <Plus className="w-4 h-4" />
              تسجيل تقرير إصابة / جاهزية رسمي
            </button>
          </div>

          {showInjuryForm && (
            <form
              onSubmit={handleInjurySubmit}
              className="rounded-2xl bg-[#111B29] border border-rose-500/35 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-rose-300">
                  تقرير طبي موثق (ممنوع النشر دون مصدر رسمي)
                </span>
                <button
                  type="button"
                  onClick={() => setShowInjuryForm(false)}
                  className="text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={injPlayer}
                  onChange={(e) => setInjPlayer(e.target.value)}
                  placeholder="اسم اللاعب"
                  className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  required
                />
                <input
                  type="text"
                  list="wateen-medical-teams"
                  value={injTeam}
                  onChange={(e) => setInjTeam(e.target.value)}
                  placeholder="النادي / المنتخب"
                  className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  required
                />
                <datalist id="wateen-medical-teams">
                  {directory.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>

                <select
                  value={injComp}
                  onChange={(e) => setInjComp(e.target.value as CompetitionId)}
                  className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                >
                  {PRIMARY_COMPETITION_LIST.map((cid) => (
                    <option key={cid} value={cid}>
                      {COMPETITIONS[cid].name}
                    </option>
                  ))}
                </select>

                <select
                  value={injStatus}
                  onChange={(e) =>
                    setInjStatus(e.target.value as InjuryReportItem['returnStatus'])
                  }
                  className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                >
                  <option value="injured">مصاب</option>
                  <option value="rehab">برنامج تأهيلي</option>
                  <option value="light_training">تدريب خفيف</option>
                  <option value="fit_to_play">جاهز للعب</option>
                  <option value="unknown">غير محدد رسمياً</option>
                </select>

                <input
                  type="text"
                  value={injDesc}
                  onChange={(e) => setInjDesc(e.target.value)}
                  placeholder="الإصابة المعلنة رسمياً (مثال: شد عضلي في العضلة الخلفية)"
                  className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  required
                />
                <input
                  type="text"
                  value={injDuration}
                  onChange={(e) => setInjDuration(e.target.value)}
                  placeholder="مدة الغياب المعلنة (اتركه فارغاً ليعرض: غير محدد رسمياً)"
                  className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                />

                <input
                  type="date"
                  value={injDate}
                  onChange={(e) => setInjDate(e.target.value)}
                  className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  value={injSourceName}
                  onChange={(e) => setInjSourceName(e.target.value)}
                  placeholder="المصدر الرسمي (مثال: بيان نادي الحسين إربد الرسمي)"
                  className="rounded-xl bg-black/60 border border-emerald-500/35 px-3 py-2 text-xs text-white"
                  required
                />
                <input
                  type="url"
                  dir="ltr"
                  value={injSourceUrl}
                  onChange={(e) => setInjSourceUrl(e.target.value)}
                  placeholder="رابط الخبر/البيان الرسمي (اختياري عند التوثيق)"
                  className="sm:col-span-2 rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-emerald-300 text-left"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-emerald-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={injVerified}
                  onChange={(e) => setInjVerified(e.target.checked)}
                  className="accent-emerald-500"
                />
                أؤكد أن هذه المعلومة منشورة رسمياً عن النادي أو الاتحاد وليست تشخيصاً غير موثق
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-black"
                >
                  حفظ ونشر التقرير الطبي
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {injuries.map((inj) => (
              <div
                key={inj.id}
                className="rounded-2xl bg-[#0D1520] border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-black text-white">
                    {inj.playerName} • {inj.teamName}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {inj.declaredInjury} ({INJURY_STATUS_META[inj.returnStatus].label}) • المصدر:{' '}
                    {inj.sourceName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteInjuryReport(inj.id)}
                  className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. إضافة وإدارة اللاعبين والحراس */}
      {sub === 'players' && (
        <div className="space-y-4">
          <form
            onSubmit={handlePlayerSubmit}
            className="rounded-2xl bg-[#0D1520] border border-emerald-500/30 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-emerald-300">
                إضافة لاعب أو حارس مرمى (الحقول الفارغة تظهر «غير متوفر»)
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPlayerType('outfield')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                    playerType === 'outfield'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/5 text-slate-300'
                  }`}
                >
                  لاعب / هداف
                </button>
                <button
                  type="button"
                  onClick={() => setPlayerType('goalkeeper')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                    playerType === 'goalkeeper'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/5 text-slate-300'
                  }`}
                >
                  حارس مرمى
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="اسم اللاعب"
                className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                required
              />
              <input
                type="text"
                list="wateen-medical-teams"
                value={pTeam}
                onChange={(e) => setPTeam(e.target.value)}
                placeholder="النادي"
                className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                required
              />
              <select
                value={pComp}
                onChange={(e) => setPComp(e.target.value as CompetitionId)}
                className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
              >
                {PRIMARY_COMPETITION_LIST.map((cid) => (
                  <option key={cid} value={cid}>
                    {COMPETITIONS[cid].shortName}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={0}
                value={pMatches}
                onChange={(e) => setPMatches(e.target.value)}
                placeholder="المباريات"
                className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
              />

              {playerType === 'goalkeeper' ? (
                <>
                  <input
                    type="number"
                    min={0}
                    value={pCleanSheets}
                    onChange={(e) => setPCleanSheets(e.target.value)}
                    placeholder="الشباك النظيفة"
                    className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    value={pConceded}
                    onChange={(e) => setPConceded(e.target.value)}
                    placeholder="الأهداف المستقبلة"
                    className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                </>
              ) : (
                <>
                  <input
                    type="number"
                    min={0}
                    value={pGoals}
                    onChange={(e) => setPGoals(e.target.value)}
                    placeholder="الأهداف"
                    className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    value={pAssists}
                    onChange={(e) => setPAssists(e.target.value)}
                    placeholder="الصناعة"
                    className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={pPosition}
                    onChange={(e) => setPPosition(e.target.value)}
                    placeholder="المركز (اختياري)"
                    className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={pShirt}
                    onChange={(e) => setPShirt(e.target.value)}
                    placeholder="الرقم (اختياري)"
                    className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    value={pMinutes}
                    onChange={(e) => setPMinutes(e.target.value)}
                    placeholder="الدقائق (اختياري)"
                    className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    value={pYellow}
                    onChange={(e) => setPYellow(e.target.value)}
                    placeholder="الصفراء (اختياري)"
                    className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    value={pRed}
                    onChange={(e) => setPRed(e.target.value)}
                    placeholder="الحمراء (اختياري)"
                    className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                </>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-black font-black text-xs"
            >
              حفظ بيانات اللاعب في القاعدة
            </button>
          </form>

          <div className="space-y-2">
            {(data.scorers || []).map((sc) => (
              <div
                key={sc.id}
                className="rounded-2xl bg-[#0D1520] border border-white/10 px-3.5 py-2 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-black text-white">{sc.playerName}</span>{' '}
                  <span className="text-slate-400">
                    ({sc.teamName}) • {sc.goals} هدف
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteScorer(sc.id)}
                  className="p-1 rounded bg-rose-500/15 text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {(data.goalkeepers || []).map((gk) => (
              <div
                key={gk.id}
                className="rounded-2xl bg-[#0D1520] border border-white/10 px-3.5 py-2 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-black text-sky-300">حارس: {gk.playerName}</span>{' '}
                  <span className="text-slate-400">
                    ({gk.teamName}) • {gk.cleanSheets} كلين شيت
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteGoalkeeper(gk.id)}
                  className="p-1 rounded bg-rose-500/15 text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. تسجيل الأندية */}
      {sub === 'teams' && (
        <form
          onSubmit={handleTeamSubmit}
          className="rounded-2xl bg-[#0D1520] border border-emerald-500/30 p-4 space-y-3"
        >
          <div className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" />
            إضافة نادٍ جديد إلى دليل الأندية المعتمدة
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              placeholder="اسم النادي الرسمي"
              className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
              required
            />
            <select
              value={tComp}
              onChange={(e) => setTComp(e.target.value as CompetitionId)}
              className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
            >
              {PRIMARY_COMPETITION_LIST.map((cid) => (
                <option key={cid} value={cid}>
                  {COMPETITIONS[cid].name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={tCity}
              onChange={(e) => setTCity(e.target.value)}
              placeholder="المدينة (اختياري)"
              className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              value={tStadium}
              onChange={(e) => setTStadium(e.target.value)}
              placeholder="الملعب البيتي (اختياري)"
              className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              value={tCoach}
              onChange={(e) => setTCoach(e.target.value)}
              placeholder="المدير الفني / المدرب (اختياري)"
              className="sm:col-span-2 rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-black font-black text-xs"
          >
            تسجيل النادي في قاعدة البيانات
          </button>
        </form>
      )}
    </div>
  );
};
