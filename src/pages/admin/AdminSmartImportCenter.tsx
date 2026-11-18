import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bug,
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
  extractEmbeddedOcrTextFromImageBase64,
  extractSportsDataWithGeminiAI,
  extractTextFromExcelBuffer,
  extractTextFromPdfBuffer,
  validateExtractedImportRows,
} from '../../utils/aiSmartImportEngine';

const STATUS_BADGES: Record<ImportBatchStatus, { label: string; style: string }> = {
  'Pending Review': {
    label: 'Pending Review • جاهز للمراجعة والاعتماد',
    style: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
  },
  'Needs Correction': {
    label: 'Needs Correction • يحتوي عناصر تحتاج تصحيحاً',
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

  const [stagedFiles, setStagedFiles] = useState<
    {
      meta: ImportSourceFileMeta;
      base64?: string;
      extractedText?: string;
    }[]
  >([]);
  const [pastedText, setPastedText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const [activeBatchId, setActiveBatchId] = useState<string | null>(
    data.importBatches?.[0]?.id || null
  );
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showDebugLog, setShowDebugLog] = useState<boolean>(false);
  const [ruleDraft, setRuleDraft] = useState<CompetitionRuleConfig>(currentRule);
  const [actorName, setActorName] = useState<string>('المدير الرياضي - وتين سبورت');

  const batches = data.importBatches || [];
  const activeBatch: SmartImportBatch | null =
    batches.find((b) => b.id === activeBatchId) || batches[0] || null;

  const allKnownTeams = Array.from(
    new Set([
      ...(data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY).map((t) => t.name),
      ...data.standings.map((s) => s.teamName),
    ])
  ).sort((a, b) => a.localeCompare(b, 'ar'));

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
      else if (
        ['xlsx', 'xls', 'csv', 'tsv'].includes(ext) ||
        file.type.includes('spreadsheet') ||
        file.type.includes('csv')
      )
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
            rawTextPreview: text.slice(0, 1200),
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
            rawTextPreview:
              pdfText ? pdfText.slice(0, 1200) : 'ملف PDF جاهز للتحليل البصري عبر Gemini AI',
            sizeBytes: file.size,
          },
          base64: dataUrl,
          extractedText: pdfText,
        });
      } else {
        const dataUrl = await readFileAsDataUrl(file);
        const embeddedOcr = extractEmbeddedOcrTextFromImageBase64(dataUrl);
        newStaged.push({
          meta: {
            id,
            name: file.name,
            mimeType: file.type || 'image/jpeg',
            format: 'image',
            previewDataUrl: dataUrl,
            rawTextPreview: embeddedOcr || undefined,
            sizeBytes: file.size,
          },
          base64: dataUrl,
          extractedText: embeddedOcr || undefined,
        });
      }
    }

    setStagedFiles((prev) => [...prev, ...newStaged]);
    showToast(`تم تجهيز ${newStaged.length} ملف/صورة للاستيراد الذكي`, 'emerald');
    e.target.value = '';
  };

  // تشغيل الذكاء الاصطناعي وطبقة التحقق البرمجية
  const handleRunSmartExtraction = async () => {
    if (stagedFiles.length === 0 && !pastedText.trim()) {
      showToast('يرجى رفع صورة / ملف (PDF أو Excel) أو لصق نص رياضي أولاً', 'crimson');
      return;
    }

    setIsAnalyzing(true);
    try {
      const allExtractedRows: Partial<SmartImportExtractedRow>[] = [];
      const sourceMetas: ImportSourceFileMeta[] = stagedFiles.map((s) => ({ ...s.meta }));
      let usedEngine: 'gemini_multimodal' | 'smart_deterministic' = 'smart_deterministic';
      const combinedExtractedTexts: string[] = [];
      const combinedRawResponses: string[] = [];
      const combinedParseErrors: string[] = [];
      let totalJsonItems = 0;

      for (let i = 0; i < stagedFiles.length; i++) {
        const item = stagedFiles[i];
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
        if (res.extractedOcrText) {
          sourceMetas[i].rawTextPreview = res.extractedOcrText.slice(0, 1500);
          combinedExtractedTexts.push(res.extractedOcrText);
        }
        if (res.rawAiResponseSanitized) {
          combinedRawResponses.push(res.rawAiResponseSanitized);
        }
        totalJsonItems += res.jsonItemsCount;
        combinedParseErrors.push(...res.parseErrors);
        allExtractedRows.push(...res.rows);
      }

      if (pastedText.trim()) {
        sourceMetas.push({
          id: `src-text-${Date.now()}`,
          name: 'نص رياضي ملصق',
          mimeType: 'text/plain',
          format: 'pasted_text',
          rawTextPreview: pastedText.trim().slice(0, 1500),
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
        if (textRes.extractedOcrText) {
          combinedExtractedTexts.push(textRes.extractedOcrText);
        }
        if (textRes.rawAiResponseSanitized) {
          combinedRawResponses.push(textRes.rawAiResponseSanitized);
        }
        totalJsonItems += textRes.jsonItemsCount;
        combinedParseErrors.push(...textRes.parseErrors);
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
        diagnosticMeta: {
          extractedText: combinedExtractedTexts.join('\n---\n'),
          rawAiResponseSanitized: combinedRawResponses.join('\n---\n'),
          jsonItemsCount: totalJsonItems,
          parseErrors: combinedParseErrors,
        },
      });

      await saveImportBatch(batch);
      setActiveBatchId(batch.id);
      setStagedFiles([]);
      setPastedText('');

      const readyCount = batch.rows.filter((r) => r.isReadyForApproval).length;
      const corrCount = batch.rows.length - readyCount;

      if (batch.rows.length === 0) {
        showToast(
          'لم يتم العثور على مباريات قابلة للاستخراج — راجع النص المستخرج أو سجل التشخيص للمطور',
          'crimson'
        );
      } else {
        showToast(
          `تم اكتشاف ${batch.rows.length} عناصر (${readyCount} جاهزة للمراجعة، ${corrCount} تحتاج تصحيحاً)`,
          corrCount > 0 ? 'amber' : 'emerald'
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // تحديث حقل في بطاقة المباراة داخل شاشة المراجعة وإعادة التحقق فوراً
  const handleUpdateBatchRowField = async (
    batch: SmartImportBatch,
    rowId: string,
    field: keyof SmartImportExtractedRow,
    value: string | number | null
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
      data.competitionRules?.[batch.competitionId],
      {
        season: batch.season,
        ageCategory: batch.ageCategory,
        groupName: batch.groupName,
        roundName: batch.roundName,
      }
    );
    const hasBlocking = revalidated.some((r) => !r.isReadyForApproval);
    await saveImportBatch({
      ...batch,
      rows: revalidated,
      status: hasBlocking ? 'Needs Correction' : 'Pending Review',
    });
  };

  // إضافة مباراة / صف جديد يدوياً داخل شاشة المراجعة
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
            roundNumber: batch.roundName || 'الجولة 15',
            round: batch.roundName || 'الجولة 15',
            stadium: 'ستاد الحسن - إربد',
            matchStatus: 'finished',
            status: 'finished',
          };

    const revalidated = validateExtractedImportRows(
      [...batch.rows, newRow],
      batch.dataType,
      batch.competitionId,
      data.matches,
      data.standings,
      data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY,
      data.competitionRules?.[batch.competitionId],
      {
        season: batch.season,
        ageCategory: batch.ageCategory,
        groupName: batch.groupName,
        roundName: batch.roundName,
      }
    );
    const hasBlocking = revalidated.some((r) => !r.isReadyForApproval);
    await saveImportBatch({
      ...batch,
      rows: revalidated,
      status: hasBlocking ? 'Needs Correction' : 'Pending Review',
    });
  };

  // حذف مباراة / صف خاطئ من شاشة المراجعة
  const handleDeleteRowFromBatch = async (batch: SmartImportBatch, rowId: string) => {
    const remaining = batch.rows.filter((r) => r.rowId !== rowId);
    const revalidated = validateExtractedImportRows(
      remaining,
      batch.dataType,
      batch.competitionId,
      data.matches,
      data.standings,
      data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY,
      data.competitionRules?.[batch.competitionId],
      {
        season: batch.season,
        ageCategory: batch.ageCategory,
        groupName: batch.groupName,
        roundName: batch.roundName,
      }
    );
    const hasBlocking = revalidated.some((r) => !r.isReadyForApproval);
    await saveImportBatch({
      ...batch,
      rows: revalidated,
      status: hasBlocking ? 'Needs Correction' : 'Pending Review',
    });
  };

  // إعادة تحليل المصدر الأصلي (النص المستخرج أو المنسوخ)
  const handleReanalyzeSource = async (batch: SmartImportBatch) => {
    const rawSourceText =
      batch.rawPastedText ||
      batch.diagnosticLog?.extractedText ||
      batch.sources.map((s) => s.rawTextPreview || '').join('\n');

    if (rawSourceText.trim()) {
      const res = await extractSportsDataWithGeminiAI({
        dataType: batch.dataType,
        competitionId: batch.competitionId,
        season: batch.season,
        roundName: batch.roundName,
        rawText: rawSourceText,
        sourceFileName: batch.sources[0]?.name || 'إعادة تحليل المصدر',
        geminiApiKey: data.geminiApiKey,
      });

      const revalidated = validateExtractedImportRows(
        res.rows.length > 0 ? res.rows : batch.rows,
        batch.dataType,
        batch.competitionId,
        data.matches,
        data.standings,
        data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY,
        data.competitionRules?.[batch.competitionId],
        {
          season: batch.season,
          ageCategory: batch.ageCategory,
          groupName: batch.groupName,
          roundName: batch.roundName,
        }
      );
      const hasBlocking = revalidated.some((r) => !r.isReadyForApproval);
      await saveImportBatch({
        ...batch,
        rows: revalidated,
        status: hasBlocking ? 'Needs Correction' : 'Pending Review',
      });
      showToast(`تمت إعادة تحليل المصدر (${revalidated.length} عناصر)`, 'emerald');
      return;
    }

    const revalidated = validateExtractedImportRows(
      batch.rows,
      batch.dataType,
      batch.competitionId,
      data.matches,
      data.standings,
      data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY,
      data.competitionRules?.[batch.competitionId]
    );
    const hasBlocking = revalidated.some((r) => !r.isReadyForApproval);
    await saveImportBatch({
      ...batch,
      rows: revalidated,
      status: hasBlocking ? 'Needs Correction' : 'Pending Review',
    });
    showToast('تمت إعادة فحص جميع البطاقات برمجياً', 'emerald');
  };

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
    const hasBlocking = revalidated.some((r) => !r.isReadyForApproval);
    await saveImportBatch({
      ...batch,
      rows: revalidated,
      status: hasBlocking ? 'Needs Correction' : 'Pending Review',
    });
  };

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
    const hasBlocking = revalidated.some((r) => !r.isReadyForApproval);
    await saveImportBatch({
      ...batch,
      rows: revalidated,
      status: hasBlocking ? 'Needs Correction' : 'Pending Review',
    });
  };

  const moveTiebreaker = (idx: number, dir: -1 | 1) => {
    const list = [...ruleDraft.tiebreakers];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    setRuleDraft({ ...ruleDraft, tiebreakers: list });
  };

  const totalDetectedCount = activeBatch?.rows.length || 0;
  const readyForReviewCount =
    activeBatch?.rows.filter((r) => r.isReadyForApproval).length || 0;
  const needsCorrectionCount = totalDetectedCount - readyForReviewCount;

  return (
    <div className="space-y-6">
      {/* قائمة الفرق المعتمدة للاختيار السريع في جميع حقول الفرق */}
      <datalist id="wateen-teams-db">
        {allKnownTeams.map((team) => (
          <option key={team} value={team} />
        ))}
      </datalist>

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
                  OCR + JSON Schema + تحقق برمجي
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                استيراد الجداول والفقرات الإخبارية والنتائج من الصور (JPG/PNG)، PDF، Excel (XLSX/CSV)، والنصوص
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
                ترتيب معايير كسر التعادل عند تساوي النقاط:
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
            يدعم الجداول، الفقرات الإخبارية، والصيغ المتعددة
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
                  رفع صور أو ملفات (يدعم تعدد الملفات والجداول)
                </span>
                <span className="text-[10px] text-emerald-300 font-bold">
                  JPG • PNG • PDF • XLSX • CSV
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                ارفع صورة جدول نتائج أو ترتيب، ملف PDF، أو ملف Excel يحتوي على عدة جولات ليتم استخراجها وعرض النص المقروء للمقارنة.
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

          {/* صندوق لصق النصوص والفقرات الرياضية العربية */}
          <div className="rounded-2xl bg-black/50 border border-white/15 p-4 flex flex-col justify-between space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-xs font-black text-white">
                لصق فقرة إخبارية أو جدول أو نتائج بصيغ متعددة
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setDataType('match_results');
                    setPastedText(
                      `فاز الكرمل على عجلون 2-1، وتغلب الحسين إربد على الوحدات (٣-٠)، وتعادل الفيصلي والرمثا 1-1 على ستاد عمّان الدولي.\nالسلط (2) شباب الأردن (1)\nالأهلي ? - 1 الجزيرة`
                    );
                  }}
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-emerald-300"
                >
                  مثال فقرة + صيغ متعددة
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
              placeholder="يدعم جميع الصيغ: (الكرمل 2 - 1 عجلون)، (الكرمل (2) عجلون (1))، الفقرات الإخبارية التي تضم عدة مباريات، أو الجداول المنسوخة..."
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
                ? 'جارٍ استخراج المباريات والتحقق البرمجي المستقل...'
                : 'بدء التحليل الذكي وتحويل البيانات لشاشة المراجعة'}
            </button>
          </div>
        </div>
      </div>

      {/* 4. شاشة المراجعة والاعتماد المحسّنة (Review & Approval Screen) */}
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
              <button
                type="button"
                onClick={() => setShowDebugLog((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
              >
                <Bug className="w-3.5 h-3.5 text-amber-400" />
                سجل التشخيص للمطور (Debug)
              </button>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black border ${
                  STATUS_BADGES[activeBatch.status].style
                }`}
              >
                {STATUS_BADGES[activeBatch.status].label}
              </span>
            </div>
          </div>

          {/* ملخص الأعداد الفعلي: تم اكتشاف X مباريات | Y جاهزة للمراجعة | Z تحتاج تصحيحاً */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-black/50 border border-white/15 p-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400">إجمالي العناصر المكتشفة</div>
                <div className="text-base sm:text-lg font-black text-white mt-0.5">
                  تم اكتشاف {totalDetectedCount} مباريات / صفوف
                </div>
              </div>
              <span className="text-2xl font-black text-white tabular-nums">
                {totalDetectedCount}
              </span>
            </div>

            <div className="rounded-2xl bg-emerald-950/30 border border-emerald-500/40 p-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-emerald-300">جاهزة للمراجعة والاعتماد</div>
                <div className="text-base sm:text-lg font-black text-emerald-200 mt-0.5">
                  {readyForReviewCount} مباريات جاهزة للمراجعة
                </div>
              </div>
              <span className="text-2xl font-black text-emerald-400 tabular-nums">
                {readyForReviewCount}
              </span>
            </div>

            <div
              className={`rounded-2xl border p-3.5 flex items-center justify-between ${
                needsCorrectionCount > 0
                  ? 'bg-amber-950/30 border-amber-500/45'
                  : 'bg-black/40 border-white/10'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-amber-300">تحتاج مراجعة وتصحيحاً</div>
                <div className="text-base sm:text-lg font-black text-amber-200 mt-0.5">
                  {needsCorrectionCount === 1
                    ? 'مباراة واحدة تحتاج تصحيحاً'
                    : `${needsCorrectionCount} مباريات تحتاج تصحيحاً`}
                </div>
              </div>
              <span className="text-2xl font-black text-amber-400 tabular-nums">
                {needsCorrectionCount}
              </span>
            </div>
          </div>

          {/* سجل التشخيص الداخلي للمطور (Developer Diagnostic Debug Log) */}
          {showDebugLog && activeBatch.diagnosticLog && (
            <div className="rounded-2xl bg-black/90 border border-amber-500/40 p-4 space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between text-amber-300 font-sans font-black">
                <span>سجل التشخيص الداخلي للمطور (Developer Import Debug Log)</span>
                <span className="text-[11px] text-slate-400">
                  {activeBatch.diagnosticLog.timestamp}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-sans">
                <div className="bg-white/5 rounded-xl p-2">
                  <div className="text-[10px] text-slate-400">نوع الملفات</div>
                  <div className="font-bold text-white truncate">
                    {activeBatch.diagnosticLog.fileTypes.join(', ') || 'نص مباشر'}
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-2">
                  <div className="text-[10px] text-slate-400">عناصر JSON الخام</div>
                  <div className="font-black text-emerald-300">
                    {activeBatch.diagnosticLog.jsonItemsCount}
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-2">
                  <div className="text-[10px] text-slate-400">الكائنات المحوّلة</div>
                  <div className="font-black text-sky-300">
                    {activeBatch.diagnosticLog.parsedObjectsCount}
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-2">
                  <div className="text-[10px] text-slate-400">الحقول المرفوضة</div>
                  <div className="font-black text-rose-300">
                    {activeBatch.diagnosticLog.failedValidationFields.length}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-sans font-bold text-slate-400 mb-1">
                  النص المستخرج (OCR / Source Text):
                </div>
                <pre className="bg-[#070B10] border border-white/10 rounded-xl p-2.5 text-[11px] text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {activeBatch.diagnosticLog.extractedText || '(لا يوجد نص خام)'}
                </pre>
              </div>
              <div>
                <div className="text-[11px] font-sans font-bold text-slate-400 mb-1">
                  استجابة الذكاء الاصطناعي / المحلل الخام (Sanitized):
                </div>
                <pre className="bg-[#070B10] border border-white/10 rounded-xl p-2.5 text-[11px] text-emerald-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {activeBatch.diagnosticLog.rawAiResponseSanitized}
                </pre>
              </div>
              {activeBatch.diagnosticLog.approvalRejectionReasons.length > 0 && (
                <div>
                  <div className="text-[11px] font-sans font-bold text-rose-300 mb-1">
                    أسباب إيقاف اعتماد الصفوف الناقصة:
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-rose-200 font-sans space-y-0.5">
                    {activeBatch.diagnosticLog.approvalRejectionReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* مقارنة المصدر بالبطاقات المستخرجة */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* العمود الأول: صورة/ملف المصدر + النص المستخرج للمقارنة */}
            <div className="rounded-2xl bg-black/55 border border-white/10 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-emerald-300">
                  المصدر الأصلي والنص المستخرج ({activeBatch.sources.length})
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
                    <div>
                      <div className="text-[10px] font-bold text-emerald-400 mb-1">
                        النص المستخرج للمقارنة مع المصدر:
                      </div>
                      <pre className="text-[11px] text-slate-300 bg-black/70 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono max-h-44">
                        {src.rawTextPreview}
                      </pre>
                    </div>
                  )}
                </div>
              ))}

              {/* سجل التعديلات والاعتماد */}
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

            {/* العمود الثاني والثالث: بطاقات المباريات المستقلة مع إبراز الحقول غير الواضحة فقط */}
            <div className="lg:col-span-2 rounded-2xl bg-black/45 border border-white/10 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    بطاقات المراجعة المستقلة ({totalDetectedCount})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    يمكنك اعتماد المباريات الجاهزة ({readyForReviewCount}) فوراً، بينما تبقى المباريات الناقصة ({needsCorrectionCount}) في المسودة لحين استكمالها
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddRowToBatch(activeBatch)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-extrabold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة مباراة يدوياً
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReanalyzeSource(activeBatch)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-300 text-xs font-extrabold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    إعادة تحليل المصدر
                  </button>
                </div>
              </div>

              {/* قائمة البطاقات المستخرجة */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {activeBatch.rows.map((row, rIdx) => {
                  const isReady = Boolean(row.isReadyForApproval);
                  const isHomeTeamUnclear = !row.homeTeam;
                  const isAwayTeamUnclear = !row.awayTeam;
                  const isHomeScoreUnclear =
                    row.matchStatus === 'finished' &&
                    (row.homeScore === null || row.homeScore === undefined || row.homeScore === '');
                  const isAwayScoreUnclear =
                    row.matchStatus === 'finished' &&
                    (row.awayScore === null || row.awayScore === undefined || row.awayScore === '');

                  return (
                    <div
                      key={row.rowId}
                      className={`rounded-2xl border p-3.5 space-y-3 transition-all ${
                        isReady
                          ? 'bg-[#0E1724] border-emerald-500/25'
                          : 'bg-[#17131A] border-amber-500/55'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                              isReady
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {isReady ? 'جاهزة للاعتماد ✓' : 'تحتاج تصحيحاً !'}
                          </span>
                          <span className="text-[11px] font-black text-slate-300">
                            بطاقة #{rIdx + 1}
                            {row.tableTitle ? ` • ${row.tableTitle}` : row.tableIndex && row.tableIndex > 1 ? ` • جدول #${row.tableIndex}` : ''}
                          </span>
                          {row.extractionConfidence !== undefined && (
                            <span className="text-[10px] text-slate-400">
                              (ثقة الاستخراج: {row.extractionConfidence}%)
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteRowFromBatch(activeBatch, row.rowId)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف المباراة
                        </button>
                      </div>

                      {/* حقول المباراة أو الصف مع إبراز الحقول غير الواضحة فقط */}
                      {activeBatch.dataType === 'standings_table' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-8 gap-2">
                          <div className="col-span-2">
                            <label className="block text-[10px] text-slate-400">الفريق</label>
                            <input
                              type="text"
                              list="wateen-teams-db"
                              value={String(row.teamName ?? '')}
                              placeholder="اختر أو اكتب اسم الفريق"
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'teamName',
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg px-2 py-1 text-xs font-extrabold border ${
                                !row.teamName
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
                          ).map(([fieldKey, labelAr]) => {
                            const cellUnclear =
                              row[fieldKey] === null ||
                              row[fieldKey] === undefined ||
                              row[fieldKey] === '';
                            return (
                              <div key={fieldKey}>
                                <label className="block text-[10px] text-slate-400">{labelAr}</label>
                                <input
                                  type="text"
                                  value={cellUnclear ? '' : String(row[fieldKey])}
                                  placeholder="غير واضح"
                                  onChange={(e) =>
                                    handleUpdateBatchRowField(
                                      activeBatch,
                                      row.rowId,
                                      fieldKey,
                                      e.target.value
                                    )
                                  }
                                  className={`w-full rounded-lg px-2 py-1 text-xs font-black text-center border ${
                                    cellUnclear
                                      ? 'bg-rose-950/60 border-rose-500 text-rose-200 placeholder:text-rose-300/70'
                                      : 'bg-black/60 border-white/15 text-white'
                                  }`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : activeBatch.dataType === 'match_results' ||
                        activeBatch.dataType === 'match_schedule' ||
                        activeBatch.dataType === 'rounds_data' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400">
                              الفريق الأول (المستضيف)
                            </label>
                            <input
                              type="text"
                              list="wateen-teams-db"
                              value={String(row.homeTeam ?? '')}
                              placeholder="اختر الفريق الأول"
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'homeTeam',
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg px-2 py-1.5 text-xs font-extrabold border ${
                                isHomeTeamUnclear
                                  ? 'bg-rose-950/60 border-rose-500 text-rose-200 placeholder:text-rose-300/70'
                                  : 'bg-black/60 border-white/15 text-white'
                              }`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">أهداف الأول</label>
                            <input
                              type="text"
                              value={
                                row.homeScore === null || row.homeScore === undefined
                                  ? ''
                                  : String(row.homeScore)
                              }
                              placeholder={isHomeScoreUnclear ? 'غير واضح' : '-'}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'homeScore',
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg px-2 py-1.5 text-xs font-black text-center border ${
                                isHomeScoreUnclear
                                  ? 'bg-rose-950/60 border-rose-500 text-rose-200 placeholder:text-rose-300/80'
                                  : 'bg-black/60 border-white/15 text-emerald-300'
                              }`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">أهداف الثاني</label>
                            <input
                              type="text"
                              value={
                                row.awayScore === null || row.awayScore === undefined
                                  ? ''
                                  : String(row.awayScore)
                              }
                              placeholder={isAwayScoreUnclear ? 'غير واضح' : '-'}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'awayScore',
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg px-2 py-1.5 text-xs font-black text-center border ${
                                isAwayScoreUnclear
                                  ? 'bg-rose-950/60 border-rose-500 text-rose-200 placeholder:text-rose-300/80'
                                  : 'bg-black/60 border-white/15 text-emerald-300'
                              }`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">
                              الفريق الثاني (الضيف)
                            </label>
                            <input
                              type="text"
                              list="wateen-teams-db"
                              value={String(row.awayTeam ?? '')}
                              placeholder="اختر الفريق الثاني"
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'awayTeam',
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg px-2 py-1.5 text-xs font-extrabold border ${
                                isAwayTeamUnclear
                                  ? 'bg-rose-950/60 border-rose-500 text-rose-200 placeholder:text-rose-300/70'
                                  : 'bg-black/60 border-white/15 text-white'
                              }`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">الجولة</label>
                            <input
                              type="text"
                              value={String(row.roundNumber ?? row.round ?? '')}
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'roundNumber',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1.5 text-xs font-bold bg-black/60 border border-white/15 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">
                              الملعب (اختياري)
                            </label>
                            <input
                              type="text"
                              value={String(row.stadium ?? '')}
                              placeholder="اختياري"
                              onChange={(e) =>
                                handleUpdateBatchRowField(
                                  activeBatch,
                                  row.rowId,
                                  'stadium',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg px-2 py-1.5 text-xs font-bold bg-black/60 border border-white/15 text-white placeholder:text-slate-500"
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
                              list="wateen-teams-db"
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
                              list="wateen-teams-db"
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
                              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-[11px] border ${
                                iss.blocking
                                  ? 'bg-rose-950/40 border-rose-500/45 text-rose-200'
                                  : 'bg-black/50 border-amber-500/35 text-amber-200'
                              }`}
                            >
                              <span className="flex items-center gap-1.5 font-bold">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
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
                                          String(
                                            row[iss.field as keyof SmartImportExtractedRow] || ''
                                          ),
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
                                        String(
                                          row[iss.field as keyof SmartImportExtractedRow] || ''
                                        )
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[10px] font-black"
                                  >
                                    <UserPlus className="w-3 h-3" />
                                    اعتماد كفريق جديد
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

              {/* شريط أزرار القرار النهائي */}
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
                    disabled={readyForReviewCount === 0}
                    onClick={() => approveAndPublishImportBatch(activeBatch.id, actorName)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-l from-[#00E640] to-emerald-500 hover:from-[#2bff65] hover:to-emerald-400 text-black text-xs font-black shadow-[0_0_20px_rgba(0,255,64,0.35)] disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    اعتماد المباريات الصحيحة ({readyForReviewCount})
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
