import {
  CompetitionId,
  CompetitionRuleConfig,
  ImportDiagnosticLog,
  ImportedRowIssue,
  ImportSourceFileMeta,
  MatchItem,
  MatchStatus,
  SmartImportBatch,
  SmartImportDataType,
  SmartImportExtractedRow,
  StandingRow,
  TeamDirectoryItem,
} from '../types/sports';
import {
  isDuplicateMatchItem,
  normalizeArabicTeamName,
  resolveTeamFromDirectory,
  UNCLEAR_VALUE_MARKER,
} from './sportsMathEngine';
import {
  COMPETITIONS,
  getDefaultCompetitionRules,
  INITIAL_JORDAN_TEAMS_DIRECTORY,
} from '../constants/competitions';

/**
 * تحويل الأرقام العربية/الهندية (٠-٩) والفارسية (۰-۹) إلى أرقام قياسية (0-9)
 */
export function normalizeDigits(str: string): string {
  return (str || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

/**
 * ضمان ترميز UTF-8 سليم للنصوص العربية والإنجليزية المستوردة من CSV/Excel/PDF:
 * - إزالة علامة BOM (\uFEFF) ومحارف التحكم غير المرئية
 * - التطبيع المعياري Unicode NFC
 * - استرداد تلقائي لملفات CSV العربية المحفوظة بترميز Windows-1256 عند ظهور رموز تالفة (\uFFFD)
 */
export function decodeSportsTextBufferUtf8(bytes: Uint8Array): string {
  let decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (decoded.includes('\uFFFD')) {
    try {
      const win1256 = new TextDecoder('windows-1256', { fatal: false }).decode(bytes);
      const arabicCountWin = (win1256.match(/[\u0600-\u06FF]/g) || []).length;
      const arabicCountUtf8 = (decoded.match(/[\u0600-\u06FF]/g) || []).length;
      if (arabicCountWin > arabicCountUtf8) {
        decoded = win1256;
      }
    } catch {
      // بيئة لا تدعم windows-1256، نكتفي بنتيجة UTF-8
    }
  }
  return decoded
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000\u200B\u200C\u200D\uFEFF]/g, '')
    .normalize('NFC');
}

export function isValueUnclearOrMissing(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  const s = normalizeDigits(String(val)).trim();
  if (!s) return true;
  if (
    s.includes(UNCLEAR_VALUE_MARKER) ||
    s.includes('غير معروف') ||
    s.includes('غير مقروء') ||
    s === '?' ||
    s === '؟؟' ||
    s === '??' ||
    s === '-' ||
    s === '—' ||
    s.toLowerCase() === 'unclear' ||
    s.toLowerCase() === 'null' ||
    s.toLowerCase() === 'undefined' ||
    s.toLowerCase() === 'nan'
  ) {
    return true;
  }
  return false;
}

/**
 * تحويل قيمة رقمية بأمان: إذا كانت غير واضحة أو ناقصة تُرجع null بدلاً من اختراع قيمة
 */
export function parseScoreOrNull(val: unknown): number | null {
  if (isValueUnclearOrMissing(val)) return null;
  const s = normalizeDigits(String(val)).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function cleanTeamNameToken(raw: string): string {
  return (raw || '')
    .replace(/^(فاز|فوز|تغلب|انتصر|انتصار|تعادل|خسر|خسارة|مباراة|لقاء|تأجيل|ملغاة|نتيجة|نادي|فريق)\s+/g, '')
    .replace(/^(على|أمام|امام|مع|ضد|و)\s+/g, '')
    .replace(/\s+(على|أمام|امام|مع|ضد|بنتيجة|بهدفين|بهدف|بثلاثية)$/g, '')
    .replace(/^[(\[\s"'«»]+|[)\]\s"'«»]+$/g, '')
    .trim();
}

/**
 * طبقة التحقق البرمجية المستقلة عن الذكاء الاصطناعي:
 * تبني المخطط الموحد للمباراة (Unified Match Schema) وتحدد الجاهزية للاعتماد لكل صف على حدة
 */
export function validateExtractedImportRows(
  rawRows: Partial<SmartImportExtractedRow>[],
  dataType: SmartImportDataType,
  competitionId: CompetitionId,
  existingMatches: MatchItem[] = [],
  existingStandings: StandingRow[] = [],
  directory: TeamDirectoryItem[] = INITIAL_JORDAN_TEAMS_DIRECTORY,
  rule?: CompetitionRuleConfig,
  contextMeta?: {
    season?: string;
    ageCategory?: string;
    groupName?: string;
    roundName?: string;
  }
): SmartImportExtractedRow[] {
  const activeRule =
    rule ||
    getDefaultCompetitionRules()[competitionId] ||
    getDefaultCompetitionRules().pro_league;

  const compMeta = COMPETITIONS[competitionId] || COMPETITIONS.pro_league;
  const defaultSeason = contextMeta?.season || activeRule.season || compMeta.season;
  const defaultAge = contextMeta?.ageCategory || activeRule.ageCategory || compMeta.ageCategory;
  const defaultGroup = contextMeta?.groupName || activeRule.groups?.[0] || compMeta.defaultGroups[0] || 'الدوري العام';
  const defaultRound = contextMeta?.roundName || 'الجولة 1';

  const seenInBatch = new Set<string>();

  return rawRows.map((raw, idx) => {
    const issues: ImportedRowIssue[] = [];
    const validationWarnings: string[] = [];
    const unknownTeams: string[] = [];
    const fieldConfidences: Record<string, number> = {
      ...(raw.fieldConfidences || {}),
    };
    let isUnclear = false;
    let isDuplicate = false;
    let hasConflict = false;
    let confidence = typeof raw.extractionConfidence === 'number' ? raw.extractionConfidence : 95;

    const roundVal = String(raw.roundNumber || raw.round || defaultRound).trim() || defaultRound;
    const stadiumVal = String(raw.stadium ?? '').trim();
    const dateVal = String(raw.matchDate ?? '').trim();
    const timeVal = String(raw.matchTime || raw.kickoffTime || '').trim();
    const statusVal: MatchStatus = (raw.matchStatus || raw.status || (dataType === 'match_schedule' ? 'upcoming' : 'finished')) as MatchStatus;

    const row: SmartImportExtractedRow = {
      rowId: raw.rowId || `row-${Date.now()}-${idx}`,
      sourceFileName: raw.sourceFileName || 'مصدر مباشر',
      tableIndex: raw.tableIndex ?? 1,
      tableTitle: raw.tableTitle,
      competitionName: raw.competitionName || compMeta.name,
      season: raw.season || defaultSeason,
      ageCategory: raw.ageCategory || defaultAge,
      groupName: raw.groupName || defaultGroup,
      roundNumber: roundVal,
      round: roundVal,
      matchDate: dateVal,
      matchTime: timeVal,
      kickoffTime: timeVal,
      stadium: stadiumVal,
      homeTeam: raw.homeTeam !== undefined ? String(raw.homeTeam || '').trim() : undefined,
      awayTeam: raw.awayTeam !== undefined ? String(raw.awayTeam || '').trim() : undefined,
      homeScore: raw.homeScore,
      awayScore: raw.awayScore,
      matchStatus: statusVal,
      status: statusVal,
      sourceReference: raw.sourceReference || `${raw.sourceFileName || 'مصدر مباشر'} #${idx + 1}`,
      extractionConfidence: confidence,
      fieldConfidences,
      validationWarnings: [],
      teamName: raw.teamName !== undefined ? String(raw.teamName || '').trim() : undefined,
      played: raw.played,
      won: raw.won,
      drawn: raw.drawn,
      lost: raw.lost,
      goalsFor: raw.goalsFor,
      goalsAgainst: raw.goalsAgainst,
      points: raw.points,
      playerName: raw.playerName,
      playerPosition: raw.playerPosition,
      goals: raw.goals,
      assists: raw.assists,
      matches: raw.matches,
      cleanSheets: raw.cleanSheets,
      goalsConceded: raw.goalsConceded,
      city: raw.city,
      isUnclear: false,
      isDuplicate: false,
      hasConflict: false,
      isReadyForApproval: true,
      unknownTeams: [],
      issues: [],
    };

    const inspectTeam = (fieldKey: 'teamName' | 'homeTeam' | 'awayTeam', labelAr: string) => {
      const rawVal = String(row[fieldKey] || '').trim();
      if (!rawVal || isValueUnclearOrMissing(rawVal)) {
        row[fieldKey] = '';
        isUnclear = true;
        confidence = Math.min(confidence, 35);
        fieldConfidences[fieldKey] = 0;
        const msg = `${labelAr} غير موجود أو غير واضح في المصدر`;
        validationWarnings.push(msg);
        issues.push({
          field: fieldKey,
          type: 'unclear',
          blocking: true,
          message: msg,
        });
        return;
      }

      const resolved = resolveTeamFromDirectory(rawVal, competitionId, directory, existingStandings);
      if (resolved.status === 'matched') {
        row[fieldKey] = resolved.canonicalName;
        fieldConfidences[fieldKey] = Math.min(fieldConfidences[fieldKey] ?? 98, 98);
      } else if (resolved.status === 'similar') {
        unknownTeams.push(rawVal);
        confidence = Math.min(confidence, 78);
        fieldConfidences[fieldKey] = Math.min(fieldConfidences[fieldKey] ?? 76, 76);
        const msg = `اسم مشابه لفريق مسجل: "${rawVal}" — هل تقصد "${resolved.suggestedTeamName}"؟`;
        validationWarnings.push(msg);
        issues.push({
          field: fieldKey,
          type: 'unknown_team',
          blocking: false,
          message: msg,
          suggestedTeamName: resolved.suggestedTeamName,
        });
      } else {
        unknownTeams.push(rawVal);
        confidence = Math.min(confidence, 82);
        fieldConfidences[fieldKey] = Math.min(fieldConfidences[fieldKey] ?? 82, 82);
        const msg = `الفريق "${rawVal}" غير موجود في قاعدة البيانات (يمكن ربطه أو اعتماده كفريق جديد)`;
        validationWarnings.push(msg);
        issues.push({
          field: fieldKey,
          type: 'unknown_team',
          blocking: false,
          message: msg,
        });
      }
    };

    // 1) التحقق من المباريات والنتائج والجولات
    if (
      dataType === 'match_results' ||
      dataType === 'match_schedule' ||
      dataType === 'rounds_data'
    ) {
      inspectTeam('homeTeam', 'الفريق المستضيف');
      inspectTeam('awayTeam', 'الفريق الضيف');

      fieldConfidences.roundNumber = row.roundNumber ? 95 : 70;
      fieldConfidences.stadium = row.stadium ? 92 : 50;
      if (row.matchDate) {
        fieldConfidences.matchDate = 92;
      }

      if (
        row.homeTeam &&
        row.awayTeam &&
        normalizeArabicTeamName(row.homeTeam) === normalizeArabicTeamName(row.awayTeam)
      ) {
        hasConflict = true;
        confidence = Math.min(confidence, 20);
        fieldConfidences.homeTeam = 20;
        fieldConfidences.awayTeam = 20;
        const msg = 'تعارض: لا يمكن أن يكون الفريق المستضيف والضيف نفس الفريق';
        validationWarnings.push(msg);
        issues.push({
          field: 'awayTeam',
          type: 'conflict',
          blocking: true,
          message: msg,
        });
      }

      // الملعب والتاريخ حقول اختيارية: غيابها لا يفشل استخراج المباراة ولا يمنع اعتمادها
      if (!row.stadium) {
        validationWarnings.push('اسم الملعب غير مذكور في المصدر (حقل اختياري)');
      }

      const requiresScore =
        row.matchStatus === 'finished' ||
        (dataType === 'match_results' && row.matchStatus !== 'upcoming' && row.matchStatus !== 'postponed' && row.matchStatus !== 'cancelled');

      const parsedHome = parseScoreOrNull(row.homeScore);
      const parsedAway = parseScoreOrNull(row.awayScore);

      if (requiresScore) {
        row.matchStatus = 'finished';
        row.status = 'finished';
        row.homeScore = parsedHome;
        row.awayScore = parsedAway;

        fieldConfidences.homeScore = parsedHome === null ? 0 : parsedHome > 30 ? 45 : 97;
        fieldConfidences.awayScore = parsedAway === null ? 0 : parsedAway > 30 ? 45 : 97;

        if (parsedHome === null || parsedAway === null) {
          isUnclear = true;
          confidence = Math.min(confidence, 40);
          const msg = 'نتيجة المباراة غير واضحة في المصدر وتحتاج تحديد الأهداف قبل الاعتماد';
          validationWarnings.push(msg);
          issues.push({
            field: parsedHome === null ? 'homeScore' : 'awayScore',
            type: 'unclear',
            blocking: true,
            message: msg,
          });
        } else if (parsedHome > 30 || parsedAway > 30) {
          confidence = Math.min(confidence, 55);
          const msg = `تنبيه: نتيجة غير اعتيادية (${parsedHome}-${parsedAway}) — يُرجى مراجعة الأهداف قبل الاعتماد`;
          validationWarnings.push(msg);
          issues.push({
            field: parsedHome > 30 ? 'homeScore' : 'awayScore',
            type: 'warning',
            blocking: false,
            message: msg,
          });
        }
      } else {
        row.homeScore = parsedHome;
        row.awayScore = parsedAway;
        fieldConfidences.homeScore = parsedHome === null ? 85 : 95;
        fieldConfidences.awayScore = parsedAway === null ? 85 : 95;
      }

      // فحص التكرار
      if (row.homeTeam && row.awayTeam) {
        const batchKey = `${normalizeArabicTeamName(row.homeTeam)}__${normalizeArabicTeamName(
          row.awayTeam
        )}__${normalizeArabicTeamName(row.roundNumber || '')}`;

        if (seenInBatch.has(batchKey)) {
          isDuplicate = true;
          confidence = Math.min(confidence, 30);
          const msg = 'مباراة مكررة داخل نفس المصدر المستورد';
          validationWarnings.push(msg);
          issues.push({
            field: 'homeTeam',
            type: 'duplicate',
            blocking: true,
            message: msg,
          });
        }
        seenInBatch.add(batchKey);

        const dupExisting = isDuplicateMatchItem(
          {
            competitionId,
            round: row.roundNumber,
            homeTeam: row.homeTeam,
            awayTeam: row.awayTeam,
          },
          existingMatches
        );
        if (dupExisting) {
          isDuplicate = true;
          confidence = Math.min(confidence, 30);
          const msg = `مباراة مكررة: مسجلة مسبقاً في (${dupExisting.round}) بنتيجة (${dupExisting.homeScore}-${dupExisting.awayScore})`;
          validationWarnings.push(msg);
          issues.push({
            field: 'homeTeam',
            type: 'duplicate',
            blocking: true,
            message: msg,
          });
        }
      }
    }
    // 2) التحقق الحسابي الصارم لجدول الترتيب
    else if (dataType === 'standings_table') {
      inspectTeam('teamName', 'اسم الفريق');
      row.played = parseScoreOrNull(row.played);
      row.won = parseScoreOrNull(row.won);
      row.drawn = parseScoreOrNull(row.drawn);
      row.lost = parseScoreOrNull(row.lost);
      row.goalsFor = parseScoreOrNull(row.goalsFor ?? 0);
      row.goalsAgainst = parseScoreOrNull(row.goalsAgainst ?? 0);
      row.points = parseScoreOrNull(row.points);

      const numericFields: (keyof SmartImportExtractedRow)[] = [
        'played',
        'won',
        'drawn',
        'lost',
        'goalsFor',
        'goalsAgainst',
        'points',
      ];
      for (const nf of numericFields) {
        fieldConfidences[nf] = row[nf] === null ? 0 : 96;
      }

      const essentialFields: (keyof SmartImportExtractedRow)[] = [
        'played',
        'won',
        'drawn',
        'lost',
        'points',
      ];
      for (const ef of essentialFields) {
        if (row[ef] === null) {
          isUnclear = true;
          confidence = Math.min(confidence, 45);
          fieldConfidences[ef] = 0;
          const msg = `قيمة الحقل (${ef}) غير واضحة في جدول الترتيب`;
          validationWarnings.push(msg);
          issues.push({
            field: ef,
            type: 'unclear',
            blocking: true,
            message: msg,
          });
        }
      }

      if (
        typeof row.played === 'number' &&
        typeof row.won === 'number' &&
        typeof row.drawn === 'number' &&
        typeof row.lost === 'number'
      ) {
        const sumPlayed = row.won + row.drawn + row.lost;
        if (row.played !== sumPlayed) {
          // خطأ حسابي حرج يمنع الاعتماد حتى التصحيح (لعب != فوز + تعادل + خسارة)
          hasConflict = true;
          confidence = Math.min(confidence, 30);
          fieldConfidences.played = 20;
          const msg = `خطأ حسابي حرج: لعب (${row.played}) لا يساوي مجموع (فوز ${row.won} + تعادل ${row.drawn} + خسارة ${row.lost} = ${sumPlayed})`;
          validationWarnings.push(msg);
          issues.push({
            field: 'played',
            type: 'conflict',
            blocking: true,
            message: msg,
          });
        }

        if (typeof row.points === 'number') {
          const expectedPoints =
            row.won * activeRule.pointsWin +
            row.drawn * activeRule.pointsDraw +
            row.lost * activeRule.pointsLoss;
          if (row.points > expectedPoints) {
            // يستحيل رياضياً أن تزيد النقاط عن مجموع الفوز والتعادل
            hasConflict = true;
            confidence = Math.min(confidence, 30);
            fieldConfidences.points = 20;
            const msg = `خطأ حسابي حرج: النقاط (${row.points}) تتجاوز الحد الأقصى الممكن وفق لائحة البطولة (${expectedPoints})`;
            validationWarnings.push(msg);
            issues.push({
              field: 'points',
              type: 'conflict',
              blocking: true,
              message: msg,
            });
          } else if (row.points < expectedPoints) {
            // قد يكون هناك خصم نقاط رسمي من الاتحاد، لذا يُعرض كتنبيه واضح للمراجع
            const diff = expectedPoints - row.points;
            confidence = Math.min(confidence, 72);
            fieldConfidences.points = 65;
            const msg = `تنبيه نقاط: النقاط (${row.points}) أقل من الحساب القياسي (${expectedPoints}) بفارق ${diff} — تحقق من وجود خصم نقاط رسمي`;
            validationWarnings.push(msg);
            issues.push({
              field: 'points',
              type: 'warning',
              blocking: false,
              message: msg,
            });
          }
        }
      }

      if (row.teamName) {
        const key = `st:${normalizeArabicTeamName(row.teamName)}:${row.tableIndex || 1}`;
        if (seenInBatch.has(key)) {
          isDuplicate = true;
          fieldConfidences.teamName = 25;
          const msg = `الفريق "${row.teamName}" مكرر في نفس الجدول`;
          validationWarnings.push(msg);
          issues.push({
            field: 'teamName',
            type: 'duplicate',
            blocking: true,
            message: msg,
          });
        }
        seenInBatch.add(key);
      }
    }
    // 3) التحقق من الهدافين واللاعبين والحراس والفرق
    else if (
      dataType === 'top_scorers' ||
      dataType === 'players_stats' ||
      dataType === 'players_list'
    ) {
      const pName = String(row.playerName || '').trim();
      if (!pName || isValueUnclearOrMissing(pName)) {
        row.playerName = '';
        isUnclear = true;
        fieldConfidences.playerName = 0;
        issues.push({
          field: 'playerName',
          type: 'unclear',
          blocking: true,
          message: 'اسم اللاعب غير واضح في المصدر',
        });
      } else {
        fieldConfidences.playerName = 96;
      }
      inspectTeam('teamName', 'نادي اللاعب');
      row.goals = parseScoreOrNull(row.goals ?? 0) ?? 0;
      row.assists = parseScoreOrNull(row.assists ?? 0) ?? 0;
      row.matches = parseScoreOrNull(row.matches ?? 1) ?? 1;
      fieldConfidences.goals = 95;
      fieldConfidences.assists = 95;
      fieldConfidences.matches = 95;
    } else if (dataType === 'goalkeepers_stats') {
      const pName = String(row.playerName || '').trim();
      if (!pName || isValueUnclearOrMissing(pName)) {
        row.playerName = '';
        isUnclear = true;
        fieldConfidences.playerName = 0;
        issues.push({
          field: 'playerName',
          type: 'unclear',
          blocking: true,
          message: 'اسم حارس المرمى غير واضح',
        });
      } else {
        fieldConfidences.playerName = 96;
      }
      inspectTeam('teamName', 'نادي الحارس');
      row.matches = parseScoreOrNull(row.matches ?? 1) ?? 1;
      row.cleanSheets = parseScoreOrNull(row.cleanSheets);
      row.goalsConceded = parseScoreOrNull(row.goalsConceded ?? 0) ?? 0;
      fieldConfidences.matches = 95;
      fieldConfidences.goalsConceded = 95;
      if (row.cleanSheets === null) {
        isUnclear = true;
        fieldConfidences.cleanSheets = 0;
        issues.push({
          field: 'cleanSheets',
          type: 'unclear',
          blocking: true,
          message: 'عدد الشباك النظيفة غير واضح',
        });
      } else if (typeof row.matches === 'number' && row.cleanSheets > row.matches) {
        hasConflict = true;
        confidence = Math.min(confidence, 25);
        fieldConfidences.cleanSheets = 20;
        const msg = `خطأ حسابي حرج: الشباك النظيفة (${row.cleanSheets}) أكبر من عدد المباريات (${row.matches})`;
        validationWarnings.push(msg);
        issues.push({
          field: 'cleanSheets',
          type: 'conflict',
          blocking: true,
          message: msg,
        });
      } else {
        fieldConfidences.cleanSheets = 96;
      }
    } else if (dataType === 'teams_list') {
      inspectTeam('teamName', 'اسم الفريق');
    }

    // حساب متوسط الثقة الإجمالي من ثقة الحقول الأساسية
    const confValues = Object.entries(fieldConfidences)
      .filter(([k]) => k !== 'stadium' && k !== 'matchDate')
      .map(([, v]) => v);
    if (confValues.length > 0) {
      const avgFieldConf = Math.round(
        confValues.reduce((acc, n) => acc + n, 0) / confValues.length
      );
      confidence = Math.min(confidence, avgFieldConf);
    }

    const hasBlockingIssue = issues.some((i) => i.blocking);
    row.isUnclear = isUnclear;
    row.isDuplicate = isDuplicate;
    row.hasConflict = hasConflict;
    row.isReadyForApproval = !hasBlockingIssue;
    row.extractionConfidence = confidence;
    row.fieldConfidences = fieldConfidences;
    row.validationWarnings = validationWarnings;
    row.unknownTeams = unknownTeams;
    row.issues = issues;
    return row;
  });
}

/**
 * استخراج مباراة واحدة من جملة أو سطر عربي بجميع الصيغ الممكنة:
 * - "الكرمل 2 - 1 عجلون" / "الكرمل ٢ : ١ عجلون"
 * - "الكرمل (2) عجلون (1)" / "الكرمل (2) - (1) عجلون" / "الكرمل [2] عجلون [1]"
 * - "الكرمل 2 عجلون 1"
 * - "فاز الكرمل على عجلون 2-1" / "تغلب الكرمل على عجلون بنتيجة 2-1" / "تعادل الكرمل وعجلون 1-1"
 * - "الكرمل × عجلون (2-1)" / "الكرمل ضد عجلون"
 */
function stripOuterWrappingParens(s: string): string {
  const t = (s || '').trim();
  if (t.startsWith('(') && t.endsWith(')') && !/\)\s*[\u0600-\u06FFa-zA-Z]/.test(t.slice(1, -1))) {
    return t.slice(1, -1).trim();
  }
  return t.replace(/^[•*#-\s]+/, '').trim();
}

function parseMatchClause(
  clauseRaw: string,
  context: {
    round: string;
    stadium: string;
    matchDate: string;
    matchTime: string;
    tableIndex: number;
    tableTitle?: string;
    sourceFileName: string;
    defaultStatus: MatchStatus;
  }
): Partial<SmartImportExtractedRow> | null {
  let clause = stripOuterWrappingParens(normalizeDigits(clauseRaw));
  if (clause.length < 4) return null;

  let round = context.round;
  let stadium = context.stadium;
  let matchDate = context.matchDate;
  let matchTime = context.matchTime;
  let status: MatchStatus | undefined;

  if (/مؤجل|تأجيل/.test(clause)) status = 'postponed';
  else if (/ملغ|إلغاء/.test(clause)) status = 'cancelled';

  // فصل الملحقات المفصولة بـ | أو - في آخر الجملة (مثل الملعب، الجولة، التاريخ، الوقت)
  const pipeSegments = clause
    .split(/\s*\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  let coreText = pipeSegments[0] || clause;
  for (const seg of pipeSegments.slice(1)) {
    if (/^(الجولة|جولة|الأسبوع|اسبوع)\s+[\u0600-\u06FF0-9]+/i.test(seg)) {
      round = seg;
    } else if (/ستاد|ملعب|مدينة|صالة/.test(seg)) {
      stadium = seg;
    } else if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(seg)) {
      const dm = seg.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/);
      if (dm) matchDate = dm[0];
      const tm = seg.match(/\b\d{1,2}:\d{2}\b/);
      if (tm) matchTime = tm[0];
    } else if (/^\d{1,2}:\d{2}(\s*(ص|م|AM|PM))?$/i.test(seg) || /الساعة/.test(seg)) {
      matchTime = seg.replace(/الساعة\s*/, '').trim();
    }
  }

  // استخراج الملعب أو التاريخ إن كان مكتوباً داخل الجملة نفسها مثل "على ستاد الحسن" أو "في ملعب البترا"
  const inlineStadiumMatch = coreText.match(
    /\s+(?:على|في|بملعب)\s+((?:ستاد|ملعب|مدينة)\s+[\u0600-\u06FF\s-]+)$/
  );
  if (inlineStadiumMatch) {
    if (!stadium) stadium = inlineStadiumMatch[1].trim();
    coreText = coreText.slice(0, inlineStadiumMatch.index).trim();
  }

  // إزالة رقم الترتيب في بداية السطر مثل "1)" أو "1-" أو "1." فقط إذا تلاه حرف عربي
  coreText = coreText.replace(/^\d{1,2}\s*[.)\-]\s*(?=[\u0600-\u06FF])/, '').trim();

  // الصيغة (1): الكرمل (2) عجلون (1) أو الكرمل (2) - عجلون (1) أو الكرمل [2] عجلون [1]
  const eachParenMatch = coreText.match(
    /^(.+?)\s*[([]\s*(\d+|غير واضح|\?+|؟؟)\s*[)\]]\s*(?:[-–:×xXضدvsVSو]|\s)\s*(.+?)\s*[([]\s*(\d+|غير واضح|\?+|؟؟)\s*[)\]]$/
  );
  if (eachParenMatch) {
    const homeTeam = cleanTeamNameToken(eachParenMatch[1]);
    const hs = parseScoreOrNull(eachParenMatch[2]);
    const awayTeam = cleanTeamNameToken(eachParenMatch[3]);
    const as = parseScoreOrNull(eachParenMatch[4]);
    if (homeTeam && awayTeam) {
      return {
        sourceFileName: context.sourceFileName,
        tableIndex: context.tableIndex,
        tableTitle: context.tableTitle,
        homeTeam,
        awayTeam,
        homeScore: hs,
        awayScore: as,
        roundNumber: round,
        round,
        stadium,
        matchDate,
        matchTime,
        matchStatus: status || 'finished',
        status: status || 'finished',
        extractionConfidence: hs !== null && as !== null ? 96 : 55,
      };
    }
  }

  // الصيغة (2): الكرمل (2) - (1) عجلون
  const midParenScoreMatch = coreText.match(
    /^(.+?)\s*[([]\s*(\d+|غير واضح|\?+|؟؟)\s*[)\]]\s*[-–:×xX]?\s*[([]\s*(\d+|غير واضح|\?+|؟؟)\s*[)\]]\s*(.+)$/
  );
  if (midParenScoreMatch) {
    const homeTeam = cleanTeamNameToken(midParenScoreMatch[1]);
    const hs = parseScoreOrNull(midParenScoreMatch[2]);
    const as = parseScoreOrNull(midParenScoreMatch[3]);
    const awayTeam = cleanTeamNameToken(midParenScoreMatch[4]);
    if (homeTeam && awayTeam) {
      return {
        sourceFileName: context.sourceFileName,
        tableIndex: context.tableIndex,
        tableTitle: context.tableTitle,
        homeTeam,
        awayTeam,
        homeScore: hs,
        awayScore: as,
        roundNumber: round,
        round,
        stadium,
        matchDate,
        matchTime,
        matchStatus: status || 'finished',
        status: status || 'finished',
        extractionConfidence: hs !== null && as !== null ? 96 : 55,
      };
    }
  }

  // الصيغة (3): صيغة خبرية عربية: "فاز الكرمل على عجلون 2-1" أو "شهدت الجولة فوز الكرمل على عجلون 2-1" أو "وتغلب الحسين إربد على الوحدات بنتيجة (3-0)" أو "وتعادل الفيصلي والرمثا 1-1"
  const narrativeMatch = coreText.match(
    /(?:^|.*?\s)(و?(?:فاز|فوز|تغلب|انتصر|انتصار|تعادل|خسر|خسارة))\s+(.+?)\s+(?:(?:على|أمام|امام|مع|ضد|و)\s+|و(?=ال))(.+?)\s+(?:بنتيجة\s*)?[([]?\s*(\d+|غير واضح|\?+|؟؟)\s*[-–:/]\s*(\d+|غير واضح|\?+|؟؟)\s*[)\]]?$/
  );
  if (narrativeMatch) {
    const verb = narrativeMatch[1];
    const isLossVerb = /^و?(?:خسر|خسارة)/.test(verb);
    const homeTeam = cleanTeamNameToken(narrativeMatch[2]);
    const awayTeam = cleanTeamNameToken(narrativeMatch[3]);
    const s1 = parseScoreOrNull(narrativeMatch[4]);
    const s2 = parseScoreOrNull(narrativeMatch[5]);
    const hs = isLossVerb && s1 !== null && s2 !== null && s1 > s2 ? s2 : s1;
    const as = isLossVerb && s1 !== null && s2 !== null && s1 > s2 ? s1 : s2;
    if (homeTeam && awayTeam) {
      return {
        sourceFileName: context.sourceFileName,
        tableIndex: context.tableIndex,
        tableTitle: context.tableTitle,
        homeTeam,
        awayTeam,
        homeScore: hs,
        awayScore: as,
        roundNumber: round,
        round,
        stadium,
        matchDate,
        matchTime,
        matchStatus: status || 'finished',
        status: status || 'finished',
        extractionConfidence: hs !== null && as !== null ? 94 : 50,
      };
    }
  }

  // الصيغة (4): النتيجة في المنتصف: "الكرمل 2 - 1 عجلون" أو "السلط غير واضح - 1 شباب الأردن" أو "الكرمل ? - ? عجلون"
  const midScoreMatch = coreText.match(
    /^(.+?)\s+(\d+|غير واضح|\?+|؟؟)\s*[-–:/×xX]\s*(\d+|غير واضح|\?+|؟؟)\s+(.+)$/
  );
  if (midScoreMatch) {
    const homeTeam = cleanTeamNameToken(midScoreMatch[1]);
    const hs = parseScoreOrNull(midScoreMatch[2]);
    const as = parseScoreOrNull(midScoreMatch[3]);
    const awayTeam = cleanTeamNameToken(midScoreMatch[4]);
    if (homeTeam && awayTeam) {
      return {
        sourceFileName: context.sourceFileName,
        tableIndex: context.tableIndex,
        tableTitle: context.tableTitle,
        homeTeam,
        awayTeam,
        homeScore: hs,
        awayScore: as,
        roundNumber: round,
        round,
        stadium,
        matchDate,
        matchTime,
        matchStatus: status || 'finished',
        status: status || 'finished',
        extractionConfidence: hs !== null && as !== null ? 97 : 50,
      };
    }
  }

  // الصيغة (5): النتيجة بعد كل فريق بدون أقواس: "الكرمل 2 عجلون 1"
  const spaceEachScoreMatch = coreText.match(
    /^([\u0600-\u06FFa-zA-Z\s]{2,25}?)\s+(\d+|غير واضح|\?+)\s+([\u0600-\u06FFa-zA-Z\s]{2,25}?)\s+(\d+|غير واضح|\?+)$/
  );
  if (spaceEachScoreMatch) {
    const homeTeam = cleanTeamNameToken(spaceEachScoreMatch[1]);
    const hs = parseScoreOrNull(spaceEachScoreMatch[2]);
    const awayTeam = cleanTeamNameToken(spaceEachScoreMatch[3]);
    const as = parseScoreOrNull(spaceEachScoreMatch[4]);
    if (homeTeam && awayTeam) {
      return {
        sourceFileName: context.sourceFileName,
        tableIndex: context.tableIndex,
        tableTitle: context.tableTitle,
        homeTeam,
        awayTeam,
        homeScore: hs,
        awayScore: as,
        roundNumber: round,
        round,
        stadium,
        matchDate,
        matchTime,
        matchStatus: status || 'finished',
        status: status || 'finished',
        extractionConfidence: hs !== null && as !== null ? 92 : 50,
      };
    }
  }

  // الصيغة (6): "الكرمل × عجلون (2-1)" أو "الكرمل ضد عجلون 2-1" أو "الكرمل × عجلون"
  const vsMatch = coreText.match(
    /^(.+?)\s+(?:×|ضد|vs|VS|امام|أمام|على|-|–)\s+(.+?)(?:\s*[([]\s*([^)\]]+)\s*[)\]])?$/
  );
  if (vsMatch) {
    const homeTeam = cleanTeamNameToken(vsMatch[1]);
    let awayRaw = vsMatch[2].trim();
    const parenContent = (vsMatch[3] || '').trim();

    let hs: number | null = null;
    let as: number | null = null;
    let hasScoreAttempt = false;

    const parenScore = parenContent.match(
      /(\d+|غير واضح|\?+|؟؟)\s*[-–:/]\s*(\d+|غير واضح|\?+|؟؟)/
    );
    const trailingScore = awayRaw.match(
      /^(.+?)\s+(?:بنتيجة\s*)?[([]?\s*(\d+|غير واضح|\?+|؟؟)\s*[-–:/]\s*(\d+|غير واضح|\?+|؟؟)\s*[)\]]?$/
    );

    if (parenScore) {
      hasScoreAttempt = true;
      hs = parseScoreOrNull(parenScore[1]);
      as = parseScoreOrNull(parenScore[2]);
    } else if (trailingScore) {
      hasScoreAttempt = true;
      awayRaw = trailingScore[1].trim();
      hs = parseScoreOrNull(trailingScore[2]);
      as = parseScoreOrNull(trailingScore[3]);
    } else if (/غير واضح|\?+|؟؟/.test(awayRaw) || /غير واضح|\?+|؟؟/.test(parenContent)) {
      hasScoreAttempt = true;
      awayRaw = awayRaw.replace(/غير واضح|\?+|؟؟/g, '').trim();
    }

    const awayTeam = cleanTeamNameToken(awayRaw);
    if (homeTeam && awayTeam) {
      const effectiveStatus: MatchStatus =
        status ||
        (hasScoreAttempt ? 'finished' : context.defaultStatus);

      return {
        sourceFileName: context.sourceFileName,
        tableIndex: context.tableIndex,
        tableTitle: context.tableTitle,
        homeTeam,
        awayTeam,
        homeScore: hs,
        awayScore: as,
        roundNumber: round,
        round,
        stadium,
        matchDate,
        matchTime,
        matchStatus: effectiveStatus,
        status: effectiveStatus,
        extractionConfidence:
          effectiveStatus === 'upcoming' || (hs !== null && as !== null) ? 93 : 45,
      };
    }
  }

  return null;
}

/**
 * تقسيم الفقرة النصية العربية الواحدة إلى جمل/مقاطع لاستخراج عدة مباريات من فقرة واحدة
 */
function splitArabicParagraphIntoMatchClauses(line: string): string[] {
  // إذا كان السطر جدولاً مفصولاً بـ | ويحتوي على مباراة واحدة مع ملعب وجولة، لا نقسمه عند الفاصلة
  if (line.includes('|') && !/،\s*(?:وفاز|وتغلب|وتعادل|وخسر|وفي|كما)/.test(line)) {
    return [line];
  }

  // تقسيم الفقرة الإخبارية عند الفواصل العربية والنقاط وأدوات العطف الإخبارية
  const clauses = line
    .split(
      /\s*(?:[؛;.]|،\s*(?=(?:و?(?:فاز|فوز|تغلب|انتصر|تعادل|خسر|خسارة|فيما|بينما|وفي|كما)|[\u0600-\u06FF\s]{2,20}\s+(?:\d+|\(\d+\)|×|ضد))))\s*/g
    )
    .map((c) => c.trim())
    .filter((c) => c.length > 3);

  // إذا كان هناك أكثر من نتيجة (2-1) في نفس المقطع مفصولة بفاصلة عادية "،" نقسمها أيضاً
  const expanded: string[] = [];
  for (const cl of clauses) {
    const scoreMatches = cl.match(/(\d+|\(\d+\))\s*[-–:]?\s*(\d+|\(\d+\))/g) || [];
    if (scoreMatches.length > 1 && cl.includes('،')) {
      const subParts = cl
        .split('،')
        .map((s) => s.trim())
        .filter(Boolean);
      expanded.push(...subParts);
    } else {
      expanded.push(cl);
    }
  }

  return expanded;
}

/**
 * تحليل النصوص الرياضية العربية (جداول، فقرات إخبارية، قوائم مباريات، نتائج، ترتيب، وأكثر من جدول في مصدر واحد)
 */
export function parseArabicSportsTextToRows(
  rawText: string,
  dataType: SmartImportDataType,
  defaultRound = 'الجولة 1',
  sourceFileName = 'نص ملصق'
): Partial<SmartImportExtractedRow>[] {
  const normalized = normalizeDigits(rawText || '').replace(/\r\n/g, '\n');
  const lines = normalized
    .split('\n')
    .map((l) => stripOuterWrappingParens(l))
    .filter((l) => l.length > 1 && !/^[-=_*#]+$/.test(l));

  const rows: Partial<SmartImportExtractedRow>[] = [];
  let currentRound = defaultRound;
  let currentTableIndex = 1;
  let currentTableTitle: string | undefined;

  for (const line of lines) {
    // اكتشاف بداية جدول جديد أو مجموعة جديدة في نفس الصورة/النص (عربي أو إنجليزي)
    if (
      /^(?:جدول|المجموعة|مجموعة|المرحلة|Group|Table)\s+[\u0600-\u06FFa-zA-Z0-9]+/i.test(line) &&
      line.length < 42 &&
      !/\d+\s*[-:]\s*\d+/.test(line)
    ) {
      if (rows.length > 0) {
        currentTableIndex += 1;
      }
      currentTableTitle = line;
      continue;
    }

    // التقاط عنوان الجولة إن وجد في سطر مستقل (عربي أو إنجليزي)
    if (
      /^(?:الجولة|جولة|الأسبوع|اسبوع|Round|Matchweek|Week)\s+[\u0600-\u06FFa-zA-Z0-9]+$/i.test(line) &&
      line.length < 30
    ) {
      currentRound = line;
      continue;
    }

    if (
      dataType === 'match_results' ||
      dataType === 'match_schedule' ||
      dataType === 'rounds_data'
    ) {
      const clauses = splitArabicParagraphIntoMatchClauses(line);
      for (const clause of clauses) {
        const parsed = parseMatchClause(clause, {
          round: currentRound,
          stadium: '',
          matchDate: '',
          matchTime: '',
          tableIndex: currentTableIndex,
          tableTitle: currentTableTitle,
          sourceFileName,
          defaultStatus: dataType === 'match_schedule' ? 'upcoming' : 'finished',
        });
        if (parsed) {
          rows.push(parsed);
        }
      }
    } else if (dataType === 'standings_table') {
      if (
        ((/الفريق|النادي/.test(line) && /لعب|نقاط/.test(line)) ||
          (/\b(team|club)\b/i.test(line) && /\b(pts|points|played|mp|pld|w)\b/i.test(line))) &&
        !/\d/.test(line)
      ) {
        if (rows.length > 0) currentTableIndex += 1;
        continue;
      }

      const cleanedLine = line.replace(/^\d+\s*[.)-]\s*/, '').trim();
      const tokens = cleanedLine
        .split(/\s*[|\t،;]\s*|\s{2,}/)
        .map((t) => t.trim())
        .filter(Boolean);

      if (tokens.length >= 6) {
        const offset = /^\d+$/.test(tokens[0]) && tokens.length >= 8 ? 1 : 0;
        const teamName = tokens[offset];
        const nums = tokens.slice(offset + 1);
        if (nums.length >= 5) {
          rows.push({
            sourceFileName,
            tableIndex: currentTableIndex,
            tableTitle: currentTableTitle,
            teamName,
            played: parseScoreOrNull(nums[0]),
            won: parseScoreOrNull(nums[1]),
            drawn: parseScoreOrNull(nums[2]),
            lost: parseScoreOrNull(nums[3]),
            goalsFor: nums.length >= 7 ? parseScoreOrNull(nums[4]) : 0,
            goalsAgainst: nums.length >= 7 ? parseScoreOrNull(nums[5]) : 0,
            points: parseScoreOrNull(nums[nums.length - 1]),
          });
          continue;
        }
      }

      const spaceMatch = cleanedLine.match(
        /^([\u0600-\u06FFa-zA-Z0-9.'\-\s]+?)\s+(\d+|غير واضح|\?+)\s+(\d+|غير واضح|\?+)\s+(\d+|غير واضح|\?+)\s+(\d+|غير واضح|\?+)\s+(\d+|غير واضح|\?+)\s+(\d+|غير واضح|\?+)(?:\s+[+-]?\d+)?\s+(\d+|غير واضح|\?+)$/
      );
      if (spaceMatch) {
        rows.push({
          sourceFileName,
          tableIndex: currentTableIndex,
          tableTitle: currentTableTitle,
          teamName: spaceMatch[1].trim(),
          played: parseScoreOrNull(spaceMatch[2]),
          won: parseScoreOrNull(spaceMatch[3]),
          drawn: parseScoreOrNull(spaceMatch[4]),
          lost: parseScoreOrNull(spaceMatch[5]),
          goalsFor: parseScoreOrNull(spaceMatch[6]),
          goalsAgainst: parseScoreOrNull(spaceMatch[7]),
          points: parseScoreOrNull(spaceMatch[8]),
        });
      }
    } else if (
      dataType === 'top_scorers' ||
      dataType === 'players_stats' ||
      dataType === 'players_list'
    ) {
      const parts = line
        .replace(/^\d+\s*[.)-]\s*/, '')
        .split(/[|\t،-]/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        const nums = parts.slice(2).map((p) => {
          const m = p.match(/\d+|غير واضح|\?+/);
          return m ? parseScoreOrNull(m[0]) : null;
        });
        rows.push({
          sourceFileName,
          tableIndex: currentTableIndex,
          playerName: parts[0],
          teamName: parts[1],
          goals: nums[0] ?? 0,
          assists: nums[1] ?? 0,
          matches: nums[2] ?? 1,
        });
      }
    } else if (dataType === 'goalkeepers_stats') {
      const parts = line
        .replace(/^\d+\s*[.)-]\s*/, '')
        .split(/[|\t،-]/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        const nums = parts.slice(2).map((p) => {
          const m = p.match(/\d+|غير واضح|\?+/);
          return m ? parseScoreOrNull(m[0]) : null;
        });
        rows.push({
          sourceFileName,
          tableIndex: currentTableIndex,
          playerName: parts[0],
          teamName: parts[1],
          matches: nums[0] ?? 1,
          cleanSheets: nums[1],
          goalsConceded: nums[2] ?? 0,
        });
      }
    } else if (dataType === 'teams_list') {
      const parts = line
        .replace(/^\d+\s*[.)-]\s*/, '')
        .split(/[|\t،-]/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 1) {
        rows.push({
          sourceFileName,
          tableIndex: currentTableIndex,
          teamName: parts[0],
          city: parts[1] || '',
        });
      }
    }
  }

  return rows;
}

/**
 * تحليل ملفات Excel (CSV / TSV / XLSX) مع دعم عدة جولات وترتيب أعمدة مرن
 */
export function parseSpreadsheetContentToRows(
  textContent: string,
  dataType: SmartImportDataType,
  sourceFileName: string,
  defaultRound = 'الجولة 1'
): Partial<SmartImportExtractedRow>[] {
  const normalized = normalizeDigits(textContent || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const splitCsvLine = (line: string): string[] => {
    const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
    return line
      .split(delimiter)
      .map((cell) => cell.replace(/^["']|["']$/g, '').trim());
  };

  // فحص أسماء الأعمدة في السطر الأول لربطها ذكياً بأي ترتيب
  const firstCells = splitCsvLine(lines[0]);
  const hasHeader = firstCells.some((c) =>
    /فريق|نادي|مستضيف|ضيف|لعب|نقاط|لاعب|حارس|جولة|ملعب|نتيجة|team|home|away|played|points|player|round|stadium|score/i.test(
      c
    )
  );

  const headerMap: Record<string, number> = {};
  if (hasHeader) {
    firstCells.forEach((colName, idx) => {
      const c = colName.trim().toLowerCase();
      if (/أهداف المستضيف|اهداف المستضيف|اهداف 1|أهداف 1|home_score|homescore|score1/.test(c))
        headerMap.homeScore = idx;
      else if (/أهداف الضيف|اهداف الضيف|اهداف 2|أهداف 2|away_score|awayscore|score2/.test(c))
        headerMap.awayScore = idx;
      else if (/نتيجة|النتيجة|score|result/.test(c)) headerMap.combinedScore = idx;
      else if (/مستضيف|الفريق الأول|فريق 1|home/.test(c)) headerMap.homeTeam = idx;
      else if (/ضيف|الفريق الثاني|فريق 2|away/.test(c)) headerMap.awayTeam = idx;
      else if (/جولة|الجولة|الأسبوع|round|week|matchweek/.test(c)) headerMap.round = idx;
      else if (/ملعب|الملعب|ستاد|stadium|venue/.test(c)) headerMap.stadium = idx;
      else if (/تاريخ|التاريخ|date/.test(c)) headerMap.matchDate = idx;
      else if (/وقت|الوقت|الساعة|time/.test(c)) headerMap.matchTime = idx;
      else if (/فريق|النادي|team|club/.test(c)) headerMap.teamName = idx;
      else if (/^لعب$|^مباريات$|^p$|^mp$|^pld$|^played$/.test(c)) headerMap.played = idx;
      else if (/^فاز$|^فوز$|^w$|^won$|^wins$/.test(c)) headerMap.won = idx;
      else if (/^تعادل$|^ت$|^d$|^draw$|^drawn$/.test(c)) headerMap.drawn = idx;
      else if (/^خسر$|^خسارة$|^خ$|^l$|^lost$|^losses$/.test(c)) headerMap.lost = idx;
      else if (/^له$|^أهداف له$|^gf$|^f$|^goals_for$|^goalsfor$/.test(c)) headerMap.goalsFor = idx;
      else if (/^عليه$|^أهداف عليه$|^ga$|^a$|^goals_against$|^goalsagainst$/.test(c))
        headerMap.goalsAgainst = idx;
      else if (/^نقاط$|^النقاط$|^ن$|^pts$|^points$/.test(c)) headerMap.points = idx;
    });
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: Partial<SmartImportExtractedRow>[] = [];
  let currentRound = defaultRound;
  let currentTableIndex = 1;

  for (const line of dataLines) {
    const cells = splitCsvLine(line).filter((c, idx, arr) => !(arr.length === 1 && !c));
    if (cells.length === 0) continue;

    // إذا كان السطر عبارة عن عنوان جولة مستقل داخل ملف Excel (مثل: "الجولة 2" أو "Round 2")
    const nonEmptyCells = cells.filter(Boolean);
    if (
      nonEmptyCells.length === 1 &&
      /^(?:الجولة|جولة|الأسبوع|اسبوع|Round|Matchweek|Week)\s+[\u0600-\u06FFa-zA-Z0-9]+$/i.test(
        nonEmptyCells[0]
      )
    ) {
      currentRound = nonEmptyCells[0];
      continue;
    }

    if (dataType === 'standings_table') {
      if (
        nonEmptyCells.some(
          (c) =>
            (/الفريق|النادي/.test(c) && /لعب|نقاط/.test(line)) ||
            (/\b(team|club)\b/i.test(c) && /\b(pts|points|played|mp|pld)\b/i.test(line))
        )
      ) {
        currentTableIndex += 1;
        continue;
      }

      if (
        hasHeader &&
        headerMap.teamName !== undefined &&
        headerMap.played !== undefined &&
        headerMap.points !== undefined
      ) {
        rows.push({
          sourceFileName,
          tableIndex: currentTableIndex,
          teamName: cells[headerMap.teamName] || '',
          played: parseScoreOrNull(cells[headerMap.played]),
          won: headerMap.won !== undefined ? parseScoreOrNull(cells[headerMap.won]) : null,
          drawn: headerMap.drawn !== undefined ? parseScoreOrNull(cells[headerMap.drawn]) : null,
          lost: headerMap.lost !== undefined ? parseScoreOrNull(cells[headerMap.lost]) : null,
          goalsFor:
            headerMap.goalsFor !== undefined ? parseScoreOrNull(cells[headerMap.goalsFor] ?? 0) : 0,
          goalsAgainst:
            headerMap.goalsAgainst !== undefined
              ? parseScoreOrNull(cells[headerMap.goalsAgainst] ?? 0)
              : 0,
          points: parseScoreOrNull(cells[headerMap.points]),
        });
        continue;
      }

      const offset = /^\d+$/.test(cells[0]) && cells.length >= 8 ? 1 : 0;
      const statsSlice = cells.slice(offset + 1);
      // دعم الجداول ذات عمود الفارق GD (+/-) بأمان بحيث نأخذ النقاط دائماً من آخر عمود
      rows.push({
        sourceFileName,
        tableIndex: currentTableIndex,
        teamName: cells[offset] || '',
        played: parseScoreOrNull(statsSlice[0]),
        won: parseScoreOrNull(statsSlice[1]),
        drawn: parseScoreOrNull(statsSlice[2]),
        lost: parseScoreOrNull(statsSlice[3]),
        goalsFor: statsSlice.length >= 7 ? parseScoreOrNull(statsSlice[4] ?? 0) : 0,
        goalsAgainst: statsSlice.length >= 7 ? parseScoreOrNull(statsSlice[5] ?? 0) : 0,
        points: parseScoreOrNull(statsSlice[statsSlice.length - 1]),
      });
    } else if (
      dataType === 'match_results' ||
      dataType === 'match_schedule' ||
      dataType === 'rounds_data'
    ) {
      // 1) إذا توفرت خريطة ترويسة الأعمدة، نستخدمها مباشرة
      if (hasHeader && headerMap.homeTeam !== undefined && headerMap.awayTeam !== undefined) {
        let hs: number | null =
          headerMap.homeScore !== undefined ? parseScoreOrNull(cells[headerMap.homeScore]) : null;
        let as: number | null =
          headerMap.awayScore !== undefined ? parseScoreOrNull(cells[headerMap.awayScore]) : null;

        if (hs === null && as === null && headerMap.combinedScore !== undefined) {
          const scText = cells[headerMap.combinedScore] || '';
          const sm = scText.match(/(\d+|غير واضح|\?+)\s*[-–:/]\s*(\d+|غير واضح|\?+)/);
          if (sm) {
            hs = parseScoreOrNull(sm[1]);
            as = parseScoreOrNull(sm[2]);
          }
        }

        const rVal =
          (headerMap.round !== undefined ? cells[headerMap.round] : '') || currentRound;
        const stVal = headerMap.stadium !== undefined ? cells[headerMap.stadium] || '' : '';
        const dtVal = headerMap.matchDate !== undefined ? cells[headerMap.matchDate] || '' : '';
        const tmVal = headerMap.matchTime !== undefined ? cells[headerMap.matchTime] || '' : '';

        rows.push({
          sourceFileName,
          tableIndex: currentTableIndex,
          homeTeam: cleanTeamNameToken(cells[headerMap.homeTeam] || ''),
          awayTeam: cleanTeamNameToken(cells[headerMap.awayTeam] || ''),
          homeScore: hs,
          awayScore: as,
          roundNumber: rVal,
          round: rVal,
          stadium: stVal,
          matchDate: dtVal,
          matchTime: tmVal,
          matchStatus: dataType === 'match_schedule' && hs === null ? 'upcoming' : 'finished',
          status: dataType === 'match_schedule' && hs === null ? 'upcoming' : 'finished',
        });
        continue;
      }

      // 2) تصنيف الخلايا ذكياً مهما كان ترتيب الأعمدة في ملف Excel
      let round = currentRound;
      let stadium = '';
      let matchDate = '';
      let matchTime = '';
      let hs: number | null = null;
      let as: number | null = null;
      const teamCandidates: string[] = [];
      const numericCells: (number | null)[] = [];
      let sawScoreToken = false;

      for (const cell of cells) {
        const c = cell.trim();
        if (!c) continue;
        if (/^(الجولة|جولة|الأسبوع|اسبوع)\s+[\u0600-\u06FF0-9]+$/i.test(c)) {
          round = c;
        } else if (/^(?:ستاد|ملعب|مدينة|صالة)\s+/.test(c)) {
          stadium = c;
        } else if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(c)) {
          matchDate = c;
        } else if (/^\d{1,2}:\d{2}(\s*(?:ص|م|AM|PM))?$/i.test(c)) {
          matchTime = c;
        } else if (/^[([]?\s*(\d+|غير واضح|\?+)\s*[-–:/]\s*(\d+|غير واضح|\?+)\s*[)\]]?$/.test(c)) {
          const sm = c.match(/(\d+|غير واضح|\?+)\s*[-–:/]\s*(\d+|غير واضح|\?+)/)!;
          hs = parseScoreOrNull(sm[1]);
          as = parseScoreOrNull(sm[2]);
          sawScoreToken = true;
        } else if (/^\d+$|^غير واضح$|^\?+$/.test(c)) {
          numericCells.push(parseScoreOrNull(c));
          sawScoreToken = true;
        } else {
          teamCandidates.push(c);
        }
      }

      if (hs === null && as === null && numericCells.length >= 2) {
        hs = numericCells[0];
        as = numericCells[1];
      }

      if (teamCandidates.length >= 2) {
        rows.push({
          sourceFileName,
          tableIndex: currentTableIndex,
          homeTeam: cleanTeamNameToken(teamCandidates[0]),
          awayTeam: cleanTeamNameToken(teamCandidates[1]),
          homeScore: hs,
          awayScore: as,
          roundNumber: round,
          round,
          stadium: stadium || teamCandidates[2] || '',
          matchDate,
          matchTime,
          matchStatus:
            dataType === 'match_schedule' && !sawScoreToken ? 'upcoming' : 'finished',
          status:
            dataType === 'match_schedule' && !sawScoreToken ? 'upcoming' : 'finished',
        });
      } else if (teamCandidates.length === 1) {
        // ربما الكل في خلية نصية واحدة داخل Excel
        const parsedClause = parseMatchClause(teamCandidates[0], {
          round,
          stadium,
          matchDate,
          matchTime,
          tableIndex: currentTableIndex,
          sourceFileName,
          defaultStatus: dataType === 'match_schedule' ? 'upcoming' : 'finished',
        });
        if (parsedClause) rows.push(parsedClause);
      }
    } else if (
      dataType === 'top_scorers' ||
      dataType === 'players_stats' ||
      dataType === 'players_list'
    ) {
      rows.push({
        sourceFileName,
        tableIndex: currentTableIndex,
        playerName: cells[0] || '',
        teamName: cells[1] || '',
        goals: parseScoreOrNull(cells[2] ?? 0) ?? 0,
        assists: parseScoreOrNull(cells[3] ?? 0) ?? 0,
        matches: parseScoreOrNull(cells[4] ?? 1) ?? 1,
      });
    } else if (dataType === 'goalkeepers_stats') {
      rows.push({
        sourceFileName,
        tableIndex: currentTableIndex,
        playerName: cells[0] || '',
        teamName: cells[1] || '',
        matches: parseScoreOrNull(cells[2] ?? 1) ?? 1,
        cleanSheets: parseScoreOrNull(cells[3]),
        goalsConceded: parseScoreOrNull(cells[4] ?? 0) ?? 0,
      });
    } else if (dataType === 'teams_list') {
      rows.push({
        sourceFileName,
        tableIndex: currentTableIndex,
        teamName: cells[0] || '',
        city: cells[1] || '',
      });
    }
  }

  return rows;
}

/**
 * استخراج النصوص والجداول من جميع أوراق ملف Excel (.xlsx) أو (.csv)
 */
export async function extractTextFromExcelBuffer(
  buffer: ArrayBuffer,
  fileName: string
): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip || fileName.toLowerCase().endsWith('.csv') || fileName.toLowerCase().endsWith('.tsv')) {
    return decodeSportsTextBufferUtf8(bytes);
  }

  try {
    const view = new DataView(buffer);
    const entries: Record<string, string> = {};
    let offset = 0;

    while (offset + 30 < bytes.length) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x04034b50) break;
      const compression = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);
      const nameBytes = bytes.subarray(offset + 30, offset + 30 + nameLen);
      const entryName = new TextDecoder('utf-8').decode(nameBytes);
      const dataStart = offset + 30 + nameLen + extraLen;
      const compData = bytes.subarray(dataStart, dataStart + compSize);

      if (
        entryName === 'xl/sharedStrings.xml' ||
        entryName.startsWith('xl/worksheets/sheet')
      ) {
        if (compression === 0) {
          entries[entryName] = new TextDecoder('utf-8', { fatal: false }).decode(compData);
        } else if (compression === 8 && typeof DecompressionStream !== 'undefined') {
          try {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(compData);
            writer.close();
            const decompressedBuf = await new Response(ds.readable).arrayBuffer();
            entries[entryName] = new TextDecoder('utf-8', { fatal: false }).decode(
              new Uint8Array(decompressedBuf)
            );
          } catch {
            // fallback
          }
        }
      }
      offset = dataStart + compSize;
    }

    const sharedXml = entries['xl/sharedStrings.xml'] || '';
    const sharedStrings: string[] = [];
    const siMatches = sharedXml.match(/<si[\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      const tMatches = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
      const text = tMatches
        .map((t) => t.replace(/<[^>]+>/g, ''))
        .join('')
        .trim();
      sharedStrings.push(text);
    }

    // قراءة جميع أوراق العمل (Worksheets) لدعم ملفات Excel التي تحتوي على عدة جولات في عدة أوراق
    const sheetKeys = Object.keys(entries)
      .filter((k) => k.startsWith('xl/worksheets/sheet'))
      .sort();

    if (sheetKeys.length > 0) {
      const csvLines: string[] = [];
      for (const sheetKey of sheetKeys) {
        const sheetXml = entries[sheetKey];
        const rowMatches = sheetXml.match(/<row[\s\S]*?<\/row>/g) || [];
        for (const rowXml of rowMatches) {
          const cellMatches = rowXml.match(/<c\b[\s\S]*?(?:\/>|<\/c>)/g) || [];
          const rowCells: string[] = [];
          for (const cXml of cellMatches) {
            const isShared = /t=["']s["']/.test(cXml);
            const inlineMatch = cXml.match(/<t[^>]*>([\s\S]*?)<\/t>/);
            const vMatch = cXml.match(/<v>([\s\S]*?)<\/v>/);
            if (inlineMatch) {
              rowCells.push(inlineMatch[1].trim());
            } else if (vMatch) {
              const rawV = vMatch[1].trim();
              if (isShared && sharedStrings[Number(rawV)] !== undefined) {
                rowCells.push(sharedStrings[Number(rawV)]);
              } else {
                rowCells.push(rawV);
              }
            }
          }
          if (rowCells.length > 0) {
            csvLines.push(rowCells.join(','));
          }
        }
      }
      if (csvLines.length > 0) {
        return csvLines.join('\n');
      }
    }
  } catch {
    // fallback to raw text scan
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/**
 * استخراج النصوص والجداول من ملف PDF مباشرة
 */
export function extractTextFromPdfBuffer(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    const utf8Text = decodeSportsTextBufferUtf8(bytes);

    const extractedLines: string[] = [];
    const textBlocks = utf8Text.match(/\(([^()]{2,240})\)/g) || [];
    for (const block of textBlocks) {
      const inner = block.slice(1, -1).trim();
      if (/[\u0600-\u06FF]/.test(inner) || /\d+\s*[-:]\s*\d+/.test(inner)) {
        extractedLines.push(inner);
      }
    }

    const arabicLines = utf8Text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /[\u0600-\u06FF]{2,}/.test(l) && !l.startsWith('%PDF'));

    return Array.from(new Set([...arabicLines, ...extractedLines])).join('\n').trim();
  } catch {
    return '';
  }
}

/**
 * محول JSON المرن والآمن (JSON Schema Normalizer):
 * يتعامل مع أي تنسيق يرجعه النموذج (rows, matches, standings, tables, results)
 * ويتحقق من نوع كل حقل دون إسقاط الصفوف الصحيحة أو إنشاء صفوف وهمية
 */
export function normalizeAiJsonResponse(
  rawJsonText: string,
  dataType: SmartImportDataType,
  sourceFileName: string,
  defaultRound = 'الجولة 1'
): {
  rows: Partial<SmartImportExtractedRow>[];
  extractedOcrText: string;
  jsonItemsCount: number;
  parseErrors: string[];
} {
  const parseErrors: string[] = [];
  if (!rawJsonText || !rawJsonText.trim()) {
    return { rows: [], extractedOcrText: '', jsonItemsCount: 0, parseErrors: ['استجابة JSON فارغة'] };
  }

  let parsed: unknown;
  try {
    const cleaned = rawJsonText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    // محاولة استخراج أول كائن JSON أو مصفوفة JSON من النص في حال أضاف النموذج شرحاً نصياً
    const objMatch = rawJsonText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!objMatch) {
      return {
        rows: [],
        extractedOcrText: rawJsonText,
        jsonItemsCount: 0,
        parseErrors: [err instanceof Error ? err.message : 'تعذر تحليل JSON'],
      };
    }
    try {
      parsed = JSON.parse(objMatch[1]);
    } catch (innerErr) {
      return {
        rows: [],
        extractedOcrText: rawJsonText,
        jsonItemsCount: 0,
        parseErrors: [innerErr instanceof Error ? innerErr.message : 'خطأ في بناء JSON'],
      };
    }
  }

  const rootObj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const extractedOcrText =
    typeof rootObj.extractedText === 'string'
      ? rootObj.extractedText
      : typeof rootObj.ocrText === 'string'
      ? rootObj.ocrText
      : '';

  // جمع العناصر سواء كانت في rows أو matches أو standings أو results أو tables متعددة
  const rawItems: { item: Record<string, unknown>; tableIndex: number; tableTitle?: string }[] = [];

  if (Array.isArray(parsed)) {
    parsed.forEach((it) => {
      if (it && typeof it === 'object') {
        rawItems.push({ item: it as Record<string, unknown>, tableIndex: 1 });
      }
    });
  } else if (Array.isArray(rootObj.tables)) {
    rootObj.tables.forEach((tbl, tIdx) => {
      if (tbl && typeof tbl === 'object') {
        const tObj = tbl as Record<string, unknown>;
        const tTitle = typeof tObj.title === 'string' ? tObj.title : typeof tObj.tableName === 'string' ? tObj.tableName : undefined;
        const tRows = (tObj.rows || tObj.matches || tObj.standings || tObj.items) as unknown[];
        if (Array.isArray(tRows)) {
          tRows.forEach((r) => {
            if (r && typeof r === 'object') {
              rawItems.push({
                item: r as Record<string, unknown>,
                tableIndex: tIdx + 1,
                tableTitle: tTitle,
              });
            }
          });
        }
      }
    });
  } else {
    const candidateArrays = [
      rootObj.rows,
      rootObj.matches,
      rootObj.results,
      rootObj.standings,
      rootObj.data,
      rootObj.items,
      rootObj.players,
      rootObj.teams,
    ];
    for (const arr of candidateArrays) {
      if (Array.isArray(arr)) {
        arr.forEach((it) => {
          if (it && typeof it === 'object') {
            rawItems.push({ item: it as Record<string, unknown>, tableIndex: 1 });
          }
        });
        break;
      }
    }
  }

  const normalizedRows: Partial<SmartImportExtractedRow>[] = [];

  rawItems.forEach(({ item, tableIndex, tableTitle }, idx) => {
    try {
      const str = (v: unknown): string =>
        v === null || v === undefined ? '' : normalizeDigits(String(v)).trim();

      const homeTeam = cleanTeamNameToken(
        str(
          item.homeTeam ??
            item.home_team ??
            item.team1 ??
            item.firstTeam ??
            item.hostTeam ??
            item['الفريق_الأول'] ??
            item['المستضيف']
        )
      );
      const awayTeam = cleanTeamNameToken(
        str(
          item.awayTeam ??
            item.away_team ??
            item.team2 ??
            item.secondTeam ??
            item.guestTeam ??
            item['الفريق_الثاني'] ??
            item['الضيف']
        )
      );

      let homeScore = parseScoreOrNull(
        item.homeScore ?? item.home_score ?? item.score1 ?? item.homeGoals ?? item['أهداف_المستضيف']
      );
      let awayScore = parseScoreOrNull(
        item.awayScore ?? item.away_score ?? item.score2 ?? item.awayGoals ?? item['أهداف_الضيف']
      );

      // إذا أرسل النموذج النتيجة مدمجة في حقل score أو result مثل "2-1" أو "(2) (1)"
      if (homeScore === null && awayScore === null && (item.score || item.result || item['النتيجة'])) {
        const combined = str(item.score ?? item.result ?? item['النتيجة']);
        const sm = combined.match(/(\d+)\s*[-–:/)\]]\s*[([\s]*(\d+)/);
        if (sm) {
          homeScore = parseScoreOrNull(sm[1]);
          awayScore = parseScoreOrNull(sm[2]);
        }
      }

      const roundVal =
        str(item.roundNumber ?? item.round ?? item.week ?? item['الجولة']) || defaultRound;
      const stadiumVal = str(item.stadium ?? item.venue ?? item['الملعب']);
      const dateVal = str(item.matchDate ?? item.date ?? item['التاريخ']);
      const timeVal = str(item.matchTime ?? item.time ?? item.kickoffTime ?? item['الوقت']);
      const teamName = cleanTeamNameToken(
        str(item.teamName ?? item.team ?? item.club ?? item['الفريق'] ?? item['النادي'])
      );

      normalizedRows.push({
        sourceFileName,
        tableIndex: typeof item.tableIndex === 'number' ? item.tableIndex : tableIndex,
        tableTitle: typeof item.tableTitle === 'string' ? item.tableTitle : tableTitle,
        competitionName: str(item.competitionName ?? item.competition),
        season: str(item.season),
        ageCategory: str(item.ageCategory),
        groupName: str(item.groupName ?? item.group),
        roundNumber: roundVal,
        round: roundVal,
        matchDate: dateVal,
        matchTime: timeVal,
        stadium: stadiumVal,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        matchStatus: (item.matchStatus ||
          item.status ||
          (dataType === 'match_schedule' && homeScore === null ? 'upcoming' : 'finished')) as MatchStatus,
        status: (item.matchStatus ||
          item.status ||
          (dataType === 'match_schedule' && homeScore === null ? 'upcoming' : 'finished')) as MatchStatus,
        extractionConfidence:
          typeof item.extractionConfidence === 'number' ? item.extractionConfidence : 92,
        fieldConfidences:
          item.fieldConfidences && typeof item.fieldConfidences === 'object'
            ? (item.fieldConfidences as Record<string, number>)
            : undefined,
        teamName,
        played: parseScoreOrNull(item.played ?? item.p ?? item['لعب']),
        won: parseScoreOrNull(item.won ?? item.w ?? item['فاز']),
        drawn: parseScoreOrNull(item.drawn ?? item.d ?? item['تعادل']),
        lost: parseScoreOrNull(item.lost ?? item.l ?? item['خسر']),
        goalsFor: parseScoreOrNull(item.goalsFor ?? item.gf ?? item['له']),
        goalsAgainst: parseScoreOrNull(item.goalsAgainst ?? item.ga ?? item['عليه']),
        points: parseScoreOrNull(item.points ?? item.pts ?? item['النقاط']),
        playerName: str(item.playerName ?? item.player ?? item['اللاعب']),
        goals: parseScoreOrNull(item.goals ?? item['الأهداف']),
        assists: parseScoreOrNull(item.assists ?? item['الصناعة']),
        matches: parseScoreOrNull(item.matches ?? item['المباريات']),
        cleanSheets: parseScoreOrNull(item.cleanSheets ?? item.clean_sheets ?? item['الشباك_النظيفة']),
        goalsConceded: parseScoreOrNull(
          item.goalsConceded ?? item.goals_conceded ?? item['الأهداف_المستقبلة']
        ),
        city: str(item.city ?? item['المدينة']),
      });
    } catch (rowErr) {
      parseErrors.push(`خطأ في تحويل العنصر #${idx + 1}: ${String(rowErr)}`);
    }
  });

  return {
    rows: normalizedRows,
    extractedOcrText,
    jsonItemsCount: rawItems.length,
    parseErrors,
  };
}

/**
 * استخراج النص المضمن أو جدول الصورة (OCR & Table Structure Decoder)
 */
export function extractEmbeddedOcrTextFromImageBase64(fileBase64: string): string {
  try {
    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const binaryStr =
      typeof atob === 'function'
        ? atob(cleanBase64)
        : Buffer.from(cleanBase64, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    // استخراج الأسطر التي تحتوي على أحرف عربية أو نتائج رياضية واضحة
    const validLines = decoded
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /[\u0600-\u06FF]{2,}/.test(l));
    return validLines.join('\n').trim();
  } catch {
    return '';
  }
}

/**
 * استدعاء Gemini Multimodal + OCR + محلل الجداول المتعددة مع إرجاع سجل تشخيصي كامل للمطور
 */
export async function extractSportsDataWithGeminiAI(params: {
  dataType: SmartImportDataType;
  competitionId: CompetitionId;
  season: string;
  roundName?: string;
  fileBase64?: string;
  mimeType?: string;
  rawText?: string;
  sourceFileName: string;
  geminiApiKey?: string;
}): Promise<{
  rows: Partial<SmartImportExtractedRow>[];
  usedEngine: 'gemini_multimodal' | 'smart_deterministic';
  extractedOcrText: string;
  rawAiResponseSanitized: string;
  jsonItemsCount: number;
  parseErrors: string[];
}> {
  const apiKey = params.geminiApiKey?.trim();
  const parseErrors: string[] = [];
  let rawAiResponseSanitized = '';
  let extractedOcrText = params.rawText || '';

  // استخراج النص المضمن في الصورة إن وجد للمقارنة في شاشة المراجعة
  if (!extractedOcrText && params.fileBase64) {
    extractedOcrText = extractEmbeddedOcrTextFromImageBase64(params.fileBase64);
  }

  // 1) إذا توفر مفتاح Gemini، نرسل الصورة/المستند/النص إلى Gemini 2.0 Flash Multimodal
  if (apiKey && (params.fileBase64 || params.rawText)) {
    try {
      const schemaInstruction = `أنت محرك استخراج بيانات رياضية وتحليل جداول OCR متخصص في البطولات الأردنية لتطبيق WATEEN SPORT.
نوع البيانات المطلوب: "${params.dataType}".
التعليمات الصارمة:
1. اقرأ جميع الجداول والفقرات الموجودة في المصدر بدقة (حتى لو احتوت الصورة على أكثر من جدول واحد).
2. حافظ على ترتيب الصفوف والأعمدة، وحوّل الأرقام الهندية (٠-٩) إلى أرقام قياسية (0-9).
3. لا تخترع أي فريق أو نتيجة غير موجودة في المصدر. إذا كانت النتيجة أو اسم الفريق غير واضح، ضع null في حقل النتيجة أو "" في اسم الفريق.
4. غياب اسم الملعب أو الوقت لا يمنع استخراج المباراة؛ اترك الحقل الاختياري فارغاً "".
5. أعد كائن JSON فقط بالتنسيق التالي:
{
  "extractedText": "النص الكامل المقروء من الصورة أو الجدول للمقارنة",
  "rows": [
    {
      "tableIndex": 1,
      "tableTitle": "اسم الجدول أو المجموعة إن وجد",
      "homeTeam": "اسم الفريق الأول",
      "awayTeam": "اسم الفريق الثاني",
      "homeScore": 2,
      "awayScore": 1,
      "roundNumber": "${params.roundName || 'الجولة 1'}",
      "matchDate": "",
      "matchTime": "",
      "stadium": "",
      "matchStatus": "finished",
      "teamName": "لجداول الترتيب أو قوائم الفرق",
      "played": 0,
      "won": 0,
      "drawn": 0,
      "lost": 0,
      "goalsFor": 0,
      "goalsAgainst": 0,
      "points": 0,
      "playerName": "",
      "goals": 0,
      "assists": 0,
      "matches": 0,
      "cleanSheets": 0,
      "goalsConceded": 0,
      "extractionConfidence": 95,
      "fieldConfidences": { "homeTeam": 98, "awayTeam": 98, "homeScore": 97, "awayScore": 97 }
    }
  ]
}`;

      const parts: Record<string, unknown>[] = [{ text: schemaInstruction }];
      if (params.rawText) {
        parts.push({ text: `المحتوى النصي المصدر:\n${params.rawText}` });
      }
      if (params.fileBase64 && params.mimeType) {
        const cleanBase64 = params.fileBase64.replace(/^data:[^;]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: params.mimeType,
            data: cleanBase64,
          },
        });
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.05,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        const rawTextOut = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        rawAiResponseSanitized = rawTextOut.slice(0, 4000);
        const normResult = normalizeAiJsonResponse(
          rawTextOut,
          params.dataType,
          params.sourceFileName,
          params.roundName || 'الجولة 1'
        );
        parseErrors.push(...normResult.parseErrors);

        if (normResult.extractedOcrText) {
          extractedOcrText = normResult.extractedOcrText;
        }

        if (normResult.rows.length > 0) {
          return {
            rows: normResult.rows,
            usedEngine: 'gemini_multimodal',
            extractedOcrText,
            rawAiResponseSanitized,
            jsonItemsCount: normResult.jsonItemsCount,
            parseErrors,
          };
        }
      } else {
        parseErrors.push(`Gemini HTTP ${res.status}`);
      }
    } catch (err) {
      parseErrors.push(`Gemini Request Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2) تحليل النص المستخرج (سواء من لصق مباشر، أو Excel، أو PDF، أو نص OCR المستخرج من الصورة)
  if (extractedOcrText) {
    // فحص ما إذا كان النص نفسه عبارة عن JSON
    if (extractedOcrText.trim().startsWith('{') || extractedOcrText.trim().startsWith('[')) {
      const jsonNorm = normalizeAiJsonResponse(
        extractedOcrText,
        params.dataType,
        params.sourceFileName,
        params.roundName || 'الجولة 1'
      );
      if (jsonNorm.rows.length > 0) {
        return {
          rows: jsonNorm.rows,
          usedEngine: 'smart_deterministic',
          extractedOcrText: jsonNorm.extractedOcrText || extractedOcrText,
          rawAiResponseSanitized: extractedOcrText.slice(0, 2000),
          jsonItemsCount: jsonNorm.jsonItemsCount,
          parseErrors: [...parseErrors, ...jsonNorm.parseErrors],
        };
      }
    }

    const isSpreadsheet =
      params.sourceFileName.toLowerCase().endsWith('.csv') ||
      params.sourceFileName.toLowerCase().endsWith('.tsv') ||
      params.sourceFileName.toLowerCase().endsWith('.xlsx') ||
      (extractedOcrText.includes(',') &&
        extractedOcrText.split('\n')[0].split(',').length >= 3 &&
        !/،/.test(extractedOcrText.split('\n')[0]));

    const parsedRows = isSpreadsheet
      ? parseSpreadsheetContentToRows(
          extractedOcrText,
          params.dataType,
          params.sourceFileName,
          params.roundName || 'الجولة 1'
        )
      : parseArabicSportsTextToRows(
          extractedOcrText,
          params.dataType,
          params.roundName || 'الجولة 1',
          params.sourceFileName
        );

    return {
      rows: parsedRows,
      usedEngine: 'smart_deterministic',
      extractedOcrText,
      rawAiResponseSanitized: rawAiResponseSanitized || `[Deterministic Parser: ${parsedRows.length} items]`,
      jsonItemsCount: parsedRows.length,
      parseErrors,
    };
  }

  // 3) في حال كانت صورة مضغوطة ولم يتوفر مفتاح Gemini ولم يتم استخراج نص OCR بعد،
  // لا ننشئ صفاً وهمياً ("غير واضح - غير واضح") بل نرجع 0 صفوف مع سبب تشخيصي واضح
  parseErrors.push(
    'الصورة لا تحتوي على طبقة نصية مضمنة؛ يرجى تفعيل مفتاح Gemini Vision API أو لصق النص المرافق للصورة.'
  );
  return {
    rows: [],
    usedEngine: 'smart_deterministic',
    extractedOcrText: '',
    rawAiResponseSanitized: '[No OCR text or Gemini API key configured]',
    jsonItemsCount: 0,
    parseErrors,
  };
}

/**
 * إنشاء دفعة استيراد كاملة مع المخطط الموحد والسجل التشخيصي للمطور (Developer Diagnostic Debug Log)
 */
export function buildValidatedImportBatch(params: {
  dataType: SmartImportDataType;
  competitionId: CompetitionId;
  season: string;
  ageCategory: string;
  groupName: string;
  roundName?: string;
  sources: ImportSourceFileMeta[];
  rawPastedText?: string;
  extractedRows: Partial<SmartImportExtractedRow>[];
  usedEngine: 'gemini_multimodal' | 'smart_deterministic';
  existingMatches: MatchItem[];
  existingStandings: StandingRow[];
  directory?: TeamDirectoryItem[];
  rule?: CompetitionRuleConfig;
  diagnosticMeta?: {
    extractedText?: string;
    rawAiResponseSanitized?: string;
    jsonItemsCount?: number;
    parseErrors?: string[];
  };
}): SmartImportBatch {
  const validatedRows = validateExtractedImportRows(
    params.extractedRows,
    params.dataType,
    params.competitionId,
    params.existingMatches,
    params.existingStandings,
    params.directory || INITIAL_JORDAN_TEAMS_DIRECTORY,
    params.rule,
    {
      season: params.season,
      ageCategory: params.ageCategory,
      groupName: params.groupName,
      roundName: params.roundName,
    }
  );

  const readyRows = validatedRows.filter((r) => r.isReadyForApproval);
  const needsCorrectionRows = validatedRows.filter((r) => !r.isReadyForApproval);

  const failedValidationFields: { rowIndex: number; field: string; reason: string }[] = [];
  const approvalRejectionReasons: string[] = [];

  validatedRows.forEach((r, idx) => {
    r.issues
      .filter((iss) => iss.blocking)
      .forEach((iss) => {
        failedValidationFields.push({
          rowIndex: idx + 1,
          field: iss.field,
          reason: iss.message,
        });
        approvalRejectionReasons.push(`صف #${idx + 1} (${iss.field}): ${iss.message}`);
      });
  });

  const now = new Date().toISOString();
  const diagnosticLog: ImportDiagnosticLog = {
    timestamp: now,
    fileTypes: params.sources.map((s) => `${s.name} (${s.format})`),
    extractedText:
      params.diagnosticMeta?.extractedText ||
      params.rawPastedText ||
      params.sources.map((s) => s.rawTextPreview || '').join('\n'),
    rawAiResponseSanitized:
      params.diagnosticMeta?.rawAiResponseSanitized ||
      `[Extracted ${validatedRows.length} rows via ${params.usedEngine}]`,
    jsonItemsCount: params.diagnosticMeta?.jsonItemsCount ?? params.extractedRows.length,
    parsedObjectsCount: validatedRows.length,
    readyObjectsCount: readyRows.length,
    needsCorrectionCount: needsCorrectionRows.length,
    failedValidationFields,
    approvalRejectionReasons,
    parseErrors: params.diagnosticMeta?.parseErrors || [],
  };

  const hasBlockingIssues = needsCorrectionRows.length > 0 || validatedRows.length === 0;

  return {
    id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    dataType: params.dataType,
    competitionId: params.competitionId,
    season: params.season,
    ageCategory: params.ageCategory,
    groupName: params.groupName,
    roundName: params.roundName,
    status: hasBlockingIssues ? 'Needs Correction' : 'Pending Review',
    sources: params.sources,
    rawPastedText: params.rawPastedText,
    rows: validatedRows,
    usedEngine: params.usedEngine,
    createdAt: now,
    updatedAt: now,
    diagnosticLog,
    revisions: [
      {
        id: `rev-${Date.now()}`,
        timestamp: now,
        actor: 'محرك الاستيراد الذكي',
        action: 'IMPORT_CREATED',
        details: `تم اكتشاف ${validatedRows.length} عناصر (${readyRows.length} جاهزة للاعتماد، ${needsCorrectionRows.length} تحتاج تصحيحاً)`,
      },
    ],
  };
}
