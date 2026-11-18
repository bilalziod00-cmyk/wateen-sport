import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  History,
  Image as ImageIcon,
  Layers,
  Link2,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import {
  COMPETITIONS,
  getDefaultCompetitionRules,
  INITIAL_JORDAN_TEAMS_DIRECTORY,
  PRIMARY_COMPETITION_LIST,
  SMART_IMPORT_DATA_TYPES,
  TIE_BREAKER_LABELS,
} from '../../constants/competitions';
import {
  CompetitionId,
  CompetitionRuleConfig,
  ImportBatchStatus,
  ImportSourceFileMeta,
  ImportSourceFormat,
  SmartImportBatch,
  SmartImportDataType,
  SmartImportExtractedRow,
  TieBreakerCriterion,
} from '../../types/sports';
import {
  buildValidatedImportBatch,
  extractSportsDataWithGeminiAI,
  extractTextFromExcelBuffer,
  extractTextFromPdfBuffer,
  validateExtractedImportRows,
} from '../../utils/aiSmartImportEngine';
import { UNCLEAR_VALUE_MARKER } from '../../utils/sportsMathEngine';

const STATUS_BADGES: Record<ImportBatchStatus, { label: string; style: string }> = {
  'Pending Review': {
    label: 'Pending Review • بانتظار المراجعة',
    style: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
  },
  'Needs Correction': {
    label: 'Needs Correction • يحتاج تصحيح',
    style: 'bg-amber-500/20 text-amber-300 border-amber-500/45',
  },
  Approved: {
    label: 'Approved • معتمد',
    style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  Published: {
    label: 'Published • منشور رسمياً',
    style: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50',
  },
  Rejected: {
    label: 'Rejected • مرفوض',
    style: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
};

export const AdminSmartImportCenter: React.FC = () => {
  const {
    data,
    showToast,
    saveImportBatch,
    approveAndPublishImportBatch,
    rejectImportBatch,
    deleteImportBatch,
    registerNewTeam,
    linkAliasToExistingTeam,
    saveCompetitionRule,
    recalculateCompetitionStandings,
  } = useAppData();

  // إعدادات سياق الاستيراد (البطولة، الموسم، الفئة، المجموعة، الجولة، ونوع البيانات)
  const [competitionId, setCompetitionId] = useState<CompetitionId>('pro_league');
  const currentRule: CompetitionRuleConfig =
    data.competitionRules?.[competitionId] ||
    getDefaultCompetitionRules()[competitionId] ||
    getDefaultCompetitionRules().pro_league;

  const [season, setSeason] = useState<string>(currentRule.season || '2026 / 2027');
  const [ageCategory, setAgeCategory] = useState<string>(
    currentRule.ageCategory || COMPETITIONS[competitionId].ageCategory
  );
  const [groupName, setGroupName] = useState<string>(
    currentRule.groups?.[0] || COMPETITIONS[competitionId].defaultGroups[0] || 'الدوري العام'
  );
  const [roundName, setRoundName] = useState<string>('الجولة 15');
  const [dataType, setDataType] = useState<SmartImportDataType>('match_results');

  // مصادر الإدخال (ملفات متعددة + نص منسوخ)
  const [stagedFiles, setStagedFiles] = useState<
    {
      meta: ImportSourceFileMeta;
      base64?: string;
      extractedText?: string;
    }[]
  >([]);
  const [pastedText, setPastedText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // دفعة المراجعة النشطة
  const [activeBatchId, setActiveBatchId] = useState<string | null>(
    data.importBatches?.[0]?.id || null
  );
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [ruleDraft, setRuleDraft] = useState<CompetitionRuleConfig>(currentRule);
  const [actorName, setActorName] = useState<string>('المدير الرياضي - وتين سبورت');

  const batches = data.importBatches || [];
  const activeBatch: SmartImportBatch | null =
    batches.find((b) => b.id === activeBatchId) || batches[0] || null;

  const handleCompetitionChange = (nextId: CompetitionId) => {
    setCompetitionId(nextId);
    const nextRule =
      data.competitionRules?.[nextId] ||
      getDefaultCompetitionRules()[nextId] ||
      getDefaultCompetitionRules().pro_league;
    setSeason(nextRule.season);
    setAgeCategory(nextRule.ageCategory);
    setGroupName(nextRule.groups?.[0] || COMPETITIONS[nextId].defaultGroups[0] || 'الدوري العام');
    setRuleDraft(nextRule);
  };

  // رفع ملفات متعددة (JPG, PNG, PDF, XLSX, CSV)
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newStaged: {
      meta: ImportSourceFileMeta;
      base64?: string;
      extractedText?: string;
    }[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let format: ImportSourceFormat = 'image';
      if (ext === 'pdf' || file.type === 'application/pdf') format = 'pdf';
      else if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext) || file.type.includes('spreadsheet') || file.type.includes('csv'))
        format = 'excel_csv';

      const id = `src-${Date.now()}-${i}`;

      if (format === 'excel_csv') {
        const buf = await file.arrayBuffer();
        const text = await extractTextFromExcelBuffer(buf, file.name);
        newStaged.push({
          meta: {
            id,
            name: file.name,
            mimeType: file.type || 'text/csv',
            format,
            rawTextPreview: text.slice(0, 600),
            sizeBytes: file.size,
          },
          extractedText: text,
        });
      } else if (format === 'pdf') {
        const buf = await file.arrayBuffer();
        const pdfText = extractTextFromPdfBuffer(buf);
        const dataUrl = await readFileAsDataUrl(file);
        newStaged.push({
          meta: {
            id,
            name: file.name,
            mimeType: 'application/pdf',
            format: 'pdf',
            rawTextPreview: pdfText ? pdfText.slice(0, 600) : 'ملف PDF جاهز للتحليل البصري عبر Gemini AI',
            sizeBytes: file.size,
          },
          base64: dataUrl,
          extractedText: pdfText,
        });
      } else {
        const dataUrl = await readFileAsDataUrl(file);
        newStaged.push({
          meta: {
            id,
            name: file.name,
            mimeType: file.type || 'image/jpeg',
            format: 'image',
            previewDataUrl: dataUrl,
            sizeBytes: file.size,
          },
          base64: dataUrl,
        });
      }
    }

    setStagedFiles((prev) => [...prev, ...newStaged]);
    showToast(`تم تجهيز ${newStaged.length} ملف/صورة للاستيراد الذكي`, 'emerald');
    e.target.value = '';
  };

  // تشغيل الذكاء الاصطناعي وطبقة التحقق البرمجية على جميع المصادر المرفوعة والنص المنسوخ
  const handleRunSmartExtraction = async () => {
    if (stagedFiles.length === 0 && !pastedText.trim()) {
      showToast('يرجى رفع صورة / ملف (PDF أو Excel) أو لصق نص رياضي أولاً', 'crimson');
      return;
    }

    setIsAnalyzing(true);
    try {
      const allExtractedRows: Partial<SmartImportExtractedRow>[] = [];
      const sourceMetas: ImportSourceFileMeta[] = stagedFiles.map((s) => s.meta);
      let usedEngine: 'gemini_multimodal' | 'smart_deterministic' = 'smart_deterministic';

      // 1) معالجة كل ملف مرفوع (يدعم عدة صور أو ملفات في عملية استيراد واحدة)
      for (const item of stagedFiles) {
        const res = await extractSportsDataWithGeminiAI({
          dataType,
          competitionId,
          season,
          roundName,
          fileBase64: item.base64,
          mimeType: item.meta.mimeType,
          rawText: item.extractedText,
          sourceFileName: item.meta.name,
          geminiApiKey: data.geminiApiKey,
        });
        if (res.usedEngine === 'gemini_multimodal') {
          usedEngine = 'gemini_multimodal';
        }
        allExtractedRows.push(...res.rows);
      }

      // 2) معالجة النص المنسوخ إن وجد
      if (pastedText.trim()) {
        sourceMetas.push({
          id: `src-text-${Date.now()}`,
          name: 'نص رياضي ملصق',
          mimeType: 'text/plain',
          format: 'pasted_text',
          rawTextPreview: pastedText.trim().slice(0, 600),
          sizeBytes: pastedText.length,
        });

        const textRes = await extractSportsDataWithGeminiAI({
          dataType,
          competitionId,
          season,
          roundName,
          rawText: pastedText.trim(),
          sourceFileName: 'نص رياضي ملصق',
          geminiApiKey: data.geminiApiKey,
        });
        if (textRes.usedEngine === 'gemini_multimodal') {
          usedEngine = 'gemini_multimodal';
        }
        allExtractedRows.push(...textRes.rows);
      }

      const batch = buildValidatedImportBatch({
        dataType,
        competitionId,
        season,
        ageCategory,
        groupName,
        roundName,
        sources: sourceMetas,
        rawPastedText: pastedText.trim() || undefined,
        extractedRows: allExtractedRows,
        usedEngine,
        existingMatches: data.matches,
        existingStandings: data.standings,
        directory: data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY,
        rule: currentRule,
      });

      await saveImportBatch(batch);
      setActiveBatchId(batch.id);
      setStagedFiles([]);
      setPastedText('');
      showToast(
        `تم استخراج ${batch.rows.length} صفوف وتحويلها لشاشة المراجعة (${
          batch.status === 'Needs Correction' ? 'تحتاج مراجعة وتصحيح' : 'جاهزة للاعتماد'
        })`,
        batch.status === 'Needs Correction' ? 'amber' : 'emerald'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // تحديث خلية داخل شاشة المراجعة وإعادة التحقق البرمجي فوراً
  const handleUpdateBatchRowField = async (
    batch: SmartImportBatch,
    rowId: string,
    field: keyof SmartImportExtractedRow,
    value: string | number
  ) => {
    const updatedRawRows = batch.rows.map((r) =>
      r.rowId === rowId ? { ...r, [field]: value } : r
    );
    const revalidated = validateExtractedImportRows(
      updatedRawRows,
      batch.dataType,
      batch.competitionId,
      data.matches,
      data.standings,
      data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY,
      data.competitionRules?.[batch.competitionId]
    );
    const hasIssues = revalidated.some(
      (r) => r.isUnclear || r.isDuplicate || r.hasConflict || r.unknownTeams.length > 0
    );
    await saveImportBatch({
      ...batch,
      rows: revalidated,
      status: hasIssues ? 'Needs Correction' : 'Pending Review',
    });
  };

  // إضافة صف جديد في شاشة المراجعة
  const handleAddRowToBatch = async (batch: SmartImportBatch) => {
    const newRow: Partial<SmartImportExtractedRow> =
      batch.dataType === 'standings_table'
        ? {
            rowId: `row-${Date.now()}`,
            sourceFileName: 'إدخال يدوي في المراجعة',
            teamName: 'الحسين إربد',
            played: 1,
            won: 1,
            drawn: 0,
            lost: 0,
            goalsFor: 2,
            goalsAgainst: 0,
            points: 3,
          }
        : batch.dataType === 'goalkeepers_stats'
        ? {
            rowId: `row-${Date.now()}`,
            sourceFileName: 'إدخال يدوي في المراجعة',
            playerName: 'يزيد أبو ليلى',
            teamName: 'الحسين إربد',
            matches: 1,
            cleanSheets: 1,
            goalsConceded: 0,
          }
        : batch.dataType === 'top_scorers' ||
          batch.dataType === 'players_stats' ||
          batch.dataType === 'players_list'
        ? {
            rowId: `row-${Date.now()}`,
            sourceFileName: 'إدخال يدوي في المراجعة',
            playerName: 'محمود مرضي',
            teamName: 'الحسين إربد',
            goals: 1,
            assists: 0,
            matches: 1,
          }
        : {
            rowId: `row-${Date.now()}`,
            sourceFileName: 'إدخال يدوي في المراجعة',
            homeTeam: 'الحسين إربد',
            awayTeam: 'الوحدات',
            homeScore: 1,
            awayScore: 0,
            round: batch.roundName || 'الجولة 15',
            stadium: 'ستاد الحسن - إربد',
            status: 'finished',
          };

    const revalidated = validateExtractedImportRows(
      [...batch.rows, newRow],
      batch.dataType,
      batch.competitionId,
      data.matches,
      data.standings,
      data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY,
      data.competitionRules?.[batch.competitionId]
    );
    const hasIssues = revalidated.some(
      (r) => r.isUnclear || r.isDuplicate || r.hasConflict || r.unknownTeams.length > 0
    );
    await saveImportBatch({
      ...batch,
      rows: revalidated,
      status: hasIssues ? 'Needs Correction' : 'Pending Review',
    });
  };

  // حذف صف من شاشة المراجعة
  const handleDeleteRowFromBatch = async (batch: SmartImportBatch, rowId: string) => {
    const remaining = batch.rows.filter((r) => r.rowId !== rowId);
    const revalidated = validateExtractedImportRows(
      remaining,
      batch.dataType,
      batch.competitionId,
      data.matches,
      data.standings,
      data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY,
      data.competitionRules?.[batch.competitionId]
    );
    const hasIssues = revalidated.some(
      (r) => r.isUnclear || r.isDuplicate || r.hasConflict || r.unknownTeams.length > 0
    );
    await saveImportBatch({
      ...batch,
      rows: revalidated,
      status: hasIssues ? 'Needs Correction' : 'Pending Review',
    });
  };

  // إنشاء فريق جديد مباشرة من شاشة المراجعة وإعادة التحقق
  const handleCreateNewTeamFromReview = async (
    batch: SmartImportBatch,
    unknownTeamName: string
  ) => {
    const created = await registerNewTeam({
      name: unknownTeamName,
      competitionId: batch.competitionId,
    });
    const updatedDir = [...(data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY), created];
    const revalidated = validateExtractedImportRows(
      batch.rows,
      batch.dataType,
      batch.competitionId,
      data.matches,
      data.standings,
      updatedDir,
      data.competitionRules?.[batch.competitionId]
    );
    const hasIssues = revalidated.some(
      (r) => r.isUnclear || r.isDuplicate || r.hasConflict || r.unknownTeams.length > 0
    );
    await saveImportBatch({
      ...batch,
      rows: revalidated,
      status: hasIssues ? 'Needs Correction' : 'Pending Review',
    });
  };

  // ربط اسم فريق غير معروف بفريق موجود
  const handleLinkUnknownTeam = async (
    batch: SmartImportBatch,
    rowId: string,
    unknownName: string,
    targetCanonicalName: string
  ) => {
    await linkAliasToExistingTeam(unknownName, targetCanonicalName);
    const updatedRows = batch.rows.map((r) => {
      if (r.rowId !== rowId) return r;
      return {
        ...r,
        teamName: r.teamName === unknownName ? targetCanonicalName : r.teamName,
        homeTeam: r.homeTeam === unknownName ? targetCanonicalName : r.homeTeam,
        awayTeam: r.awayTeam === unknownName ? targetCanonicalName : r.awayTeam,
      };
    });
    const revalidated = validateExtractedImportRows(
      updatedRows,
      batch.dataType,
      batch.competitionId,
      data.matches,
      data.standings,
      data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY,
      data.competitionRules?.[batch.competitionId]
    );
    const hasIssues = revalidated.some(
      (r) => r.isUnclear || r.isDuplicate || r.hasConflict || r.unknownTeams.length > 0
    );
    await saveImportBatch({
      ...batch,
      rows: revalidated,
      status: hasIssues ? 'Needs Correction' : 'Pending Review',
    });
  };

  // تحريك ترتيب معايير كسر التعادل لأعلى أو لأسفل
  const moveTiebreaker = (idx: number, dir: -1 | 1) => {
    const list = [...ruleDraft.tiebreakers];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    setRuleDraft({ ...ruleDraft, tiebreakers: list });
  };

  return (
    <div className="space-y-6">
      {/* 1. ترويسة مركز الإدخال الذكي وإعدادات البطولة */}
      <div className="rounded-3xl bg-gradient-to-l from-emerald-500/20 via-[#0E1824] to-[#090F17] border border-emerald-500/35 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-black border-2 border-[#00FF40]/70 flex items-center justify-center text-[#00FF40] shadow-[0_0_16px_rgba(0,255,64,0.28)]">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  مركز الإدخال الذكي — AI Sports Data Import
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Gemini AI + تحقق برمجي
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                استيراد الجداول والنتائج والترتيب والإحصائيات من الصور (JPG/PNG)، PDF، Excel (XLSX/CSV)، والنصوص مع شاشة مراجعة واعتماد
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRuleDraft(currentRule);
                setShowRulesModal((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#111D2C] hover:bg-[#17263A] border border-emerald-500/35 text-emerald-300 text-xs font-extrabold"
            >
              <Settings2 className="w-4 h-4" />
              لائحة البطولة وكسر التعادل
            </button>
            <button
              type="button"
              onClick={() => recalculateCompetitionStandings(competitionId)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-200 text-xs font-extrabold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              إعادة حساب الترتيب
            </button>
          </div>
        </div>

        {/* محددات البطولة والموسم والفئة والمجموعة والجولة */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              البطولة والدرجة
            </label>
            <select
              value={competitionId}
              onChange={(e) => handleCompetitionChange(e.target.value as CompetitionId)}
              className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs font-extrabold text-white focus:border-emerald-400 outline-none"
            >
              {PRIMARY_COMPETITION_LIST.map((cid) => (
                <option key={cid} value={cid} className="bg-[#0B121B]">
                  {COMPETITIONS[cid].name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              الموسم الرياضي
            </label>
            <input
              type="text"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="2026 / 2027"
              className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs font-extrabold text-white focus:border-emerald-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              الفئة العمرية
            </label>
            <input
              type="text"
              value={ageCategory}
              onChange={(e) => setAgeCategory(e.target.value)}
              placeholder="الفريق الأول / تحت 20 / سيدات"
              className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs font-extrabold text-white focus:border-emerald-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              المجموعة / المرحلة
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="الدوري العام / المجموعة الأولى"
              className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs font-extrabold text-white focus:border-emerald-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              الجولة
            </label>
            <input
              type="text"
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
              placeholder="الجولة 15"
              className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs font-extrabold text-white focus:border-emerald-400 outline-none"
            />
          </div>
        </div>

        {/* نافذة إعدادات لائحة البطولة ونظام النقاط ومعايير كسر التعادل */}
        {showRulesModal && (
          <div className="rounded-2xl bg-black/80 border border-emerald-500/40 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-emerald-300">
                إعدادات لائحة ({COMPETITIONS[competitionId].name}) — نظام النقاط والتأهل وكسر التعادل
              </h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="text-xs text-slate-400 hover:text-white font-bold"
              >
                إغلاق
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">نقاط الفوز</label>
                <input
                  type="number"
                  value={ruleDraft.pointsWin}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, pointsWin: Number(e.target.value) })}
                  className="w-full rounded-xl bg-[#0E1621] border border-white/15 px-2.5 py-1.5 text-xs font-black text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">نقاط التعادل</label>
                <input
                  type="number"
                  value={ruleDraft.pointsDraw}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, pointsDraw: Number(e.target.value) })}
                  className="w-full rounded-xl bg-[#0E1621] border border-white/15 px-2.5 py-1.5 text-xs font-black text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">نقاط الخسارة</label>
                <input
                  type="number"
                  value={ruleDraft.pointsLoss}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, pointsLoss: Number(e.target.value) })}
                  className="w-full rounded-xl bg-[#0E1621] border border-white/15 px-2.5 py-1.5 text-xs font-black text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">مقاعد اللقب</label>
                <input
                  type="number"
                  value={ruleDraft.championSpots}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, championSpots: Number(e.target.value) })}
                  className="w-full rounded-xl bg-[#0E1621] border border-white/15 px-2.5 py-1.5 text-xs font-black text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">مقاعد الصعود</label>
                <input
                  type="number"
                  value={ruleDraft.promotionSpots}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, promotionSpots: Number(e.target.value) })}
                  className="w-full rounded-xl bg-[#0E1621] border border-white/15 px-2.5 py-1.5 text-xs font-black text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">مقاعد الهبوط</label>
                <input
                  type="number"
                  value={ruleDraft.relegationSpots}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, relegationSpots: Number(e.target.value) })}
                  className="w-full rounded-xl bg-[#0E1621] border border-white/15 px-2.5 py-1.5 text-xs font-black text-white"
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold text-slate-300 mb-2">
                ترتيب معايير كسر التعادل عند تساوي النقاط (قابلة لإعادة الترتيب حسب لائحة البطولة):
              </div>
              <div className="space-y-1.5">
                {ruleDraft.tiebreakers.map((tb: TieBreakerCriterion, idx: number) => (
                  <div
                    key={tb}
                    className="flex items-center justify-between rounded-xl bg-[#0E1621] border border-white/10 px-3 py-2 text-xs"
                  >
                    <span className="font-extrabold text-white">
                      {idx + 1}. {TIE_BREAKER_LABELS[tb]}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveTiebreaker(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTiebreaker(idx, 1)}
                        disabled={idx === ruleDraft.tiebreakers.length - 1}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  await saveCompetitionRule(ruleDraft);
                  setShowRulesModal(false);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black"
              >
                <Save className="w-4 h-4" />
                حفظ اللائحة وتطبيقها على الترتيب
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. اختيار نوع البيانات المراد استخراجها (9 أنواع) */}
      <div className="rounded-3xl bg-[#0D1520] border border-white/10 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            1. اختر نوع البيانات المراد استخراجها
          </h3>
          <span className="text-[11px] text-slate-400">
            مخطط JSON ثابت + فحص برمجي مستقل لكل نوع
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SMART_IMPORT_DATA_TYPES.map((dt) => {
            const active = dataType === dt.id;
            return (
              <button
                key={dt.id}
                type="button"
                onClick={() => setDataType(dt.id)}
                className={`text-right p-3 rounded-2xl border transition-all ${
                  active
                    ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-glow'
                    : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="text-xs font-black text-emerald-300">{dt.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                  {dt.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* 3. رفع الصور وملفات PDF وExcel أو لصق النصوص */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {/* صندوق رفع الملفات المتعددة */}
          <div className="rounded-2xl bg-black/50 border border-dashed border-emerald-500/40 p-4 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  رفع صور أو ملفات (يدعم تعدد الملفات في عملية واحدة)
                </span>
                <span className="text-[10px] text-emerald-300 font-bold">
                  JPG • PNG • PDF • XLSX • CSV
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                ارفع صورة جدول ترتيب، كشف نتائج جولة، ملف PDF من الاتحاد، أو ملف Excel ليقوم النظام بقراءتها وربط الملف الأصلي بعملية المراجعة.
              </p>
            </div>

            <label className="cursor-pointer rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 py-3 px-4 text-center text-xs font-black text-emerald-200 transition-colors">
              + اختيار صور أو ملفات (JPG / PNG / PDF / XLSX / CSV)
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,.xlsx,.xls,.csv,.tsv"
                onChange={handleFilesSelected}
                className="hidden"
              />
            </label>

            {stagedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {stagedFiles.map((sf, i) => (
                  <div
                    key={sf.meta.id}
                    className="flex items-center justify-between rounded-xl bg-[#0E1722] border border-white/10 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {sf.meta.format === 'image' ? (
                        <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : sf.meta.format === 'excel_csv' ? (
                        <FileSpreadsheet className="w-4 h-4 text-sky-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate font-bold text-slate-200">{sf.meta.name}</span>
                      <span className="text-[10px] text-slate-400">
                        ({Math.max(1, Math.round(sf.meta.sizeBytes / 1024))} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setStagedFiles((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-rose-400 hover:text-rose-300 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* صندوق لصق النصوص الرياضية العربية */}
          <div className="rounded-2xl bg-black/50 border border-white/15 p-4 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white">
                لصق نص رياضي منسوخ (مباريات، نتائج جولة، ترتيب، هدافين، حراس)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setDataType('match_results');
                    setPastedText(
                      `الحسين إربد 2 - 1 الوحدات | الجولة 15 | ستاد الحسن - إربد\nالفيصلي 3 - 0 الرمثا | الجولة 15 | ستاد عمّان الدولي\nالسلط غير واضح - 1 شباب الأردن | الجولة 15 | ملعب السلط\nاتحاد جرش الجديد 1 - 0 الأهلي | الجولة 15 | ملعب جرش البلدي`
                    );
                  }}
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-emerald-300"
                >
                  مثال نتائج + حالات فحص
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDataType('standings_table');
                    setPastedText(
                      `الحسين إربد | 15 | 13 | 2 | 0 | 33 | 7 | 41\nالوحدات | 15 | 11 | 2 | 2 | 29 | 11 | 35\nالفيصلي | 15 | 10 | 3 | 2 | 27 | 12 | 33\nالرمثا | 15 | 8 | 3 | 4 | 21 | 15 | 27`
                    );
                  }}
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-sky-300"
                >
                  مثال جدول ترتيب
                </button>
              </div>
            </div>

            <textarea
              rows={5}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="الصق هنا نتائج المباريات، جدول الترتيب، أو قائمة الهدافين... (أي قيمة غير مقروءة بثقة سيتم تمييزها بعلامة 'غير واضح' للمراجعة)"
              className="w-full rounded-xl bg-[#090E15] border border-white/15 p-3 text-xs text-white placeholder:text-slate-500 focus:border-emerald-400 outline-none leading-relaxed"
            />

            <button
              type="button"
              disabled={isAnalyzing}
              onClick={handleRunSmartExtraction}
              className="w-full py-3 rounded-2xl bg-gradient-to-l from-[#00E640] to-emerald-500 hover:from-[#26ff60] hover:to-emerald-400 text-black font-black text-xs sm:text-sm shadow-[0_0_24px_rgba(0,255,64,0.3)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isAnalyzing
                ? 'جارٍ استخراج البيانات والتحقق البرمجي المستقل...'
                : 'بدء التحليل الذكي وتحويل البيانات لشاشة المراجعة'}
            </button>
          </div>
        </div>
      </div>

      {/* 4. شاشة المراجعة والاعتماد (Review & Approval Screen) */}
      {batches.length > 0 && activeBatch && (
        <div className="rounded-3xl bg-[#0B131E] border border-emerald-500/35 p-4 sm:p-5 space-y-4">
          {/* شريط اختيار دفعات الاستيراد وحالاتها */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {batches.map((b, idx) => {
                const isSelected = b.id === activeBatch.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setActiveBatchId(b.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border shrink-0 transition-all ${
                      isSelected
                        ? 'bg-emerald-500 text-black border-emerald-400'
                        : 'bg-black/40 text-slate-300 border-white/10 hover:border-white/25'
                    }`}
                  >
                    استيراد #{batches.length - idx} • {COMPETITIONS[b.competitionId].shortName} (
                    {b.rows.length})
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-black border ${
                  STATUS_BADGES[activeBatch.status].style
                }`}
              >
                {STATUS_BADGES[activeBatch.status].label}
              </span>
            </div>
          </div>

          {/* مقارنة المصدر بالبيانات المستخرجة */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* العمود الأول: معاينة ملف/صورة/نص المصدر الأصلي */}
            <div className="rounded-2xl bg-black/55 border border-white/10 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-emerald-300">
                  المصدر الأصلي المحفوظ للمراجعة ({activeBatch.sources.length})
                </h4>
                <span className="text-[10px] text-slate-400">
                  {activeBatch.usedEngine === 'gemini_multimodal'
                    ? 'Gemini Multimodal AI'
                    : 'محلل الجداول المدمج'}
                </span>
              </div>

              {activeBatch.sources.map((src) => (
                <div
                  key={src.id}
                  className="rounded-xl bg-[#0D1622] border border-white/10 p-2.5 space-y-2"
                >
                  <div className="text-xs font-extrabold text-white truncate">{src.name}</div>
                  {src.previewDataUrl && (
                    <img
                      src={src.previewDataUrl}
                      alt={src.name}
                      className="w-full max-h-52 object-contain rounded-lg border border-white/10 bg-black"
                    />
                  )}
                  {src.rawTextPreview && (
                    <pre className="text-[11px] text-slate-300 bg-black/70 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono max-h-40">
                      {src.rawTextPreview}
                    </pre>
                  )}
                </div>
              ))}

              {/* سجل التعديلات والاعتماد لهذه الدفعة */}
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <div className="text-[11px] font-black text-slate-300 flex items-center gap-1">
                  <History className="w-3.5 h-3.5 text-emerald-400" />
                  سجل المراجعة والاعتماد:
                </div>
                {(activeBatch.revisions || []).slice(0, 4).map((rev) => (
                  <div
                    key={rev.id}
                    className="text-[10px] text-slate-400 bg-black/40 rounded-lg px-2.5 py-1.5"
                  >
                    <span className="font-bold text-emerald-300">{rev.actor}</span>:{' '}
                    {rev.details}
                  </div>
                ))}
              </div>
            </div>

            {/* العمود الثاني والثالث: جدول البيانات المستخرجة القابل للتعديل */}
            <div className="lg:col-span-2 rounded-2xl bg-black/45 border border-white/10 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    مراجعة ومطابقة البيانات المستخرجة قبل الاعتماد الرسمي
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    لا يتم حفظ أي بيانات في الجداول الرسمية إلا بعد مراجعتها وتصحيح أي حقل يحمل علامة «غير واضح»
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddRowToBatch(activeBatch)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-extrabold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة صف
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const revalidated = validateExtractedImportRows(
                        activeBatch.rows,
                        activeBatch.dataType,
                        activeBatch.competitionId,
                        data.matches,
                        data.standings,
                        data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY,
                        data.competitionRules?.[activeBatch.competitionId]
                      );
                      const hasIssues = revalidated.some(
                        (r) =>
                          r.isUnclear ||
                          r.isDuplicate ||
                          r.hasConflict ||
                          r.unknownTeams.length > 0
                      );
                      await saveImportBatch({
                        ...activeBatch,
                        rows: revalidated,
                        status: hasIssues ? 'Needs Correction' : 'Pending Review',
                      });
                      showToast('تمت إعادة فحص وتحليل جميع الصفوف برمجياً', 'emerald');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-300 text-xs font-extrabold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    إعادة التحليل
                  </button>
                </div>
              </div>

              {/* قائمة الصفوف المستخرجة مع تمييز الأخطاء والقيم غير الواضحة */}
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {activeBatch.rows.map((row, rIdx) => {
                  const hasRowIssue =
                    row.isUnclear ||
                    row.isDuplicate ||
                    row.hasConflict ||
                    row.unknownTeams.length > 0;

                  return (
                    <div
                      key={row.rowId}
                      className={`rounded-2xl border p-3 space-y-2.5 transition-all ${
                        hasRowIssue
                          ? 'bg-amber-950/25 border-amber-500/50'
                          : 'bg-[#0E1724] border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-slate-300">
                          صف #{rIdx + 1} • المصدر: {row.sourceFileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRowFromBatch(activeBatch, row.rowId)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف الصف
                        </button>
                      </div>

                      {/* حقول قابلة للتعديل حسب نوع البيانات */}
                      {activeBatch.dataType === 'standings_table' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-8 gap-2">
                          <div className="col-span-2">
                            <label className="block text-[10px] text-slate-400">الفريق</label>
                            <input
                              type="text"
                              value={String(row.teamName ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'teamName',
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg px-2 py-1 text-xs font-extrabold border ${
                                row.teamName === UNCLEAR_VALUE_MARKER
                                  ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                                  : 'bg-black/60 border-white/15 text-white'
                              }`}
                            />
                          </div>
                          {(
                            [
                              ['played', 'لعب'],
                              ['won', 'فاز'],
                              ['drawn', 'تعادل'],
                              ['lost', 'خسر'],
                              ['goalsFor', 'له'],
                              ['goalsAgainst', 'عليه'],
                              ['points', 'النقاط'],
                            ] as const
                          ).map(([fieldKey, labelAr]) => (
                            <div key={fieldKey}>
                              <label className="block text-[10px] text-slate-400">{labelAr}</label>
                              <input
                                type="text"
                                value={String(row[fieldKey] ?? '')}
                                onChange={(e) =>
                                  handleUpdateBatchRowField(
                                    activeBatch,
                                    row.rowId,
                                    fieldKey,
                                    e.target.value
                                  )
                                }
                                className={`w-full rounded-lg px-2 py-1 text-xs font-black text-center border ${
                                  row[fieldKey] === UNCLEAR_VALUE_MARKER
                                    ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                                    : 'bg-black/60 border-white/15 text-white'
                                }`}
                              />
                            </div>
                          ))}
                        </div>
                      ) : activeBatch.dataType === 'match_results' ||
                        activeBatch.dataType === 'match_schedule' ||
                        activeBatch.dataType === 'rounds_data' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400">المستضيف</label>
                            <input
                              type="text"
                              value={String(row.homeTeam ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'homeTeam',
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg px-2 py-1 text-xs font-extrabold border ${
                                row.homeTeam === UNCLEAR_VALUE_MARKER
                                  ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                                  : 'bg-black/60 border-white/15 text-white'
                              }`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">أهداف المستضيف</label>
                            <input
                              type="text"
                              value={String(row.homeScore ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'homeScore',
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg px-2 py-1 text-xs font-black text-center border ${
                                row.homeScore === UNCLEAR_VALUE_MARKER
                                  ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                                  : 'bg-black/60 border-white/15 text-emerald-300'
                              }`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">أهداف الضيف</label>
                            <input
                              type="text"
                              value={String(row.awayScore ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'awayScore',
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg px-2 py-1 text-xs font-black text-center border ${
                                row.awayScore === UNCLEAR_VALUE_MARKER
                                  ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                                  : 'bg-black/60 border-white/15 text-emerald-300'
                              }`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">الضيف</label>
                            <input
                              type="text"
                              value={String(row.awayTeam ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'awayTeam',
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg px-2 py-1 text-xs font-extrabold border ${
                                row.awayTeam === UNCLEAR_VALUE_MARKER
                                  ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                                  : 'bg-black/60 border-white/15 text-white'
                              }`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">الجولة</label>
                            <input
                              type="text"
                              value={String(row.round ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'round',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1 text-xs font-bold bg-black/60 border border-white/15 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">الملعب</label>
                            <input
                              type="text"
                              value={String(row.stadium ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'stadium',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1 text-xs font-bold bg-black/60 border border-white/15 text-white"
                            />
                          </div>
                        </div>
                      ) : activeBatch.dataType === 'goalkeepers_stats' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400">اسم الحارس</label>
                            <input
                              type="text"
                              value={String(row.playerName ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'playerName',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1 text-xs font-extrabold bg-black/60 border border-white/15 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">النادي</label>
                            <input
                              type="text"
                              value={String(row.teamName ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'teamName',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1 text-xs font-extrabold bg-black/60 border border-white/15 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">المباريات</label>
                            <input
                              type="text"
                              value={String(row.matches ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'matches',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1 text-xs font-black text-center bg-black/60 border border-white/15 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">الشباك النظيفة</label>
                            <input
                              type="text"
                              value={String(row.cleanSheets ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'cleanSheets',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1 text-xs font-black text-center bg-black/60 border border-white/15 text-emerald-300"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">أهداف مستقبلة</label>
                            <input
                              type="text"
                              value={String(row.goalsConceded ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'goalsConceded',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1 text-xs font-black text-center bg-black/60 border border-white/15 text-rose-300"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400">اللاعب / الاسم</label>
                            <input
                              type="text"
                              value={String(row.playerName ?? row.teamName ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  row.playerName !== undefined ? 'playerName' : 'teamName',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1 text-xs font-extrabold bg-black/60 border border-white/15 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">النادي</label>
                            <input
                              type="text"
                              value={String(row.teamName ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'teamName',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1 text-xs font-extrabold bg-black/60 border border-white/15 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">الأهداف</label>
                            <input
                              type="text"
                              value={String(row.goals ?? 0)}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'goals',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1 text-xs font-black text-center bg-black/60 border border-white/15 text-emerald-300"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">صناعة الأهداف</label>
                            <input
                              type="text"
                              value={String(row.assists ?? 0)}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'assists',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1 text-xs font-black text-center bg-black/60 border border-white/15 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">المباريات</label>
                            <input
                              type="text"
                              value={String(row.matches ?? 1)}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'matches',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1 text-xs font-black text-center bg-black/60 border border-white/15 text-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* رسائل التحقق البرمجي وأزرار ربط الفرق أو إنشاء فريق جديد */}
                      {row.issues.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {row.issues.map((iss, iIdx) => (
                            <div
                              key={iIdx}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/50 border border-amber-500/35 px-2.5 py-1.5 text-[11px]"
                            >
                              <span className="flex items-center gap-1.5 text-amber-200 font-bold">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                {iss.message}
                              </span>

                              {iss.type === 'unknown_team' && (
                                <div className="flex items-center gap-1.5">
                                  {iss.suggestedTeamName && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleLinkUnknownTeam(
                                          activeBatch,
                                          row.rowId,
                                          String(row[iss.field as keyof SmartImportExtractedRow] || ''),
                                          iss.suggestedTeamName!
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-black"
                                    >
                                      <Link2 className="w-3 h-3" />
                                      ربط بـ «{iss.suggestedTeamName}»
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCreateNewTeamFromReview(
                                        activeBatch,
                                        String(row[iss.field as keyof SmartImportExtractedRow] || '')
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[10px] font-black"
                                  >
                                    <UserPlus className="w-3 h-3" />
                                    إنشاء فريق جديد
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* شريط أزرار القرار النهائي (حفظ كمسودة / اعتماد ونشر / رفض الاستيراد) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400">اسم المعتمد:</span>
                  <input
                    type="text"
                    value={actorName}
                    onChange={(e) => setActorName(e.target.value)}
                    className="rounded-xl bg-black/60 border border-white/15 px-2.5 py-1 text-xs font-bold text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      saveImportBatch(activeBatch);
                      showToast('تم حفظ الدفعة كمسودة للمراجعة لاحقاً', 'emerald');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-extrabold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    حفظ كمسودة
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      rejectImportBatch(activeBatch.id, 'رفض من شاشة المراجعة الإدارية', actorName)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-extrabold"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    رفض الاستيراد
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteImportBatch(activeBatch.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-xs font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => approveAndPublishImportBatch(activeBatch.id, actorName)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-l from-[#00E640] to-emerald-500 hover:from-[#2bff65] hover:to-emerald-400 text-black text-xs font-black shadow-[0_0_20px_rgba(0,255,64,0.35)]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    اعتماد البيانات ونشرها رسمياً
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
