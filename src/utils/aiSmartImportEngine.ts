import {
  CompetitionId,
  CompetitionRuleConfig,
  ImportedRowIssue,
  ImportSourceFileMeta,
  ImportSourceFormat,
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
  getDefaultCompetitionRules,
  INITIAL_JORDAN_TEAMS_DIRECTORY,
} from '../constants/competitions';

// تحويل الأرقام العربية المشرقية (٠-٩) إلى أرقام قياسية (0-9)
export function normalizeDigits(str: string): string {
  return (str || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function isValueUnclear(val: unknown): boolean {
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
    s.toLowerCase() === 'unclear' ||
    s.toLowerCase() === 'null' ||
    s.toLowerCase() === 'nan'
  ) {
    return true;
  }
  return false;
}

function parseNumOrUnclear(val: unknown): number | string {
  if (isValueUnclear(val)) return UNCLEAR_VALUE_MARKER;
  const s = normalizeDigits(String(val)).trim();
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || !/^\d+$/.test(s)) {
    return UNCLEAR_VALUE_MARKER;
  }
  return n;
}

/**
 * طبقة التحقق البرمجية المستقلة عن الذكاء الاصطناعي:
 * تفحص كل صف مستخرج، وتتحقق من الأسماء، التكرار، التعارض الحسابي، والقيم غير الواضحة
 */
export function validateExtractedImportRows(
  rawRows: Partial<SmartImportExtractedRow>[],
  dataType: SmartImportDataType,
  competitionId: CompetitionId,
  existingMatches: MatchItem[] = [],
  existingStandings: StandingRow[] = [],
  directory: TeamDirectoryItem[] = INITIAL_JORDAN_TEAMS_DIRECTORY,
  rule?: CompetitionRuleConfig
): SmartImportExtractedRow[] {
  const activeRule =
    rule ||
    getDefaultCompetitionRules()[competitionId] ||
    getDefaultCompetitionRules().pro_league;

  const seenInBatch = new Set<string>();

  return rawRows.map((raw, idx) => {
    const issues: ImportedRowIssue[] = [];
    const unknownTeams: string[] = [];
    let isUnclear = false;
    let isDuplicate = false;
    let hasConflict = false;

    const row: SmartImportExtractedRow = {
      rowId: raw.rowId || `row-${Date.now()}-${idx}`,
      sourceFileName: raw.sourceFileName || 'مصدر مباشر',
      ...raw,
      isUnclear: false,
      isDuplicate: false,
      hasConflict: false,
      unknownTeams: [],
      issues: [],
    };

    const checkTeamField = (fieldKey: 'teamName' | 'homeTeam' | 'awayTeam', labelAr: string) => {
      const val = String(row[fieldKey] || '').trim();
      if (!val || isValueUnclear(val)) {
        row[fieldKey] = UNCLEAR_VALUE_MARKER;
        isUnclear = true;
        issues.push({
          field: fieldKey,
          type: 'unclear',
          message: `${labelAr} غير واضح أو مفقود في المصدر`,
        });
        return;
      }

      const resolved = resolveTeamFromDirectory(val, competitionId, directory, existingStandings);
      if (resolved.status === 'matched') {
        row[fieldKey] = resolved.canonicalName;
      } else if (resolved.status === 'similar') {
        unknownTeams.push(val);
        issues.push({
          field: fieldKey,
          type: 'unknown_team',
          message: `اسم مشابه لفريق مسجل: "${val}" — هل تقصد "${resolved.suggestedTeamName}"؟`,
          suggestedTeamName: resolved.suggestedTeamName,
        });
      } else {
        unknownTeams.push(val);
        issues.push({
          field: fieldKey,
          type: 'unknown_team',
          message: `الفريق "${val}" غير مسجل في دليل البطولة (يمكنك ربطه أو إنشاؤه كفريق جديد)`,
        });
      }
    };

    // 1) التحقق حسب نوع البيانات المستوردة
    if (dataType === 'standings_table') {
      checkTeamField('teamName', 'اسم الفريق');
      row.played = parseNumOrUnclear(row.played);
      row.won = parseNumOrUnclear(row.won);
      row.drawn = parseNumOrUnclear(row.drawn);
      row.lost = parseNumOrUnclear(row.lost);
      row.goalsFor = parseNumOrUnclear(row.goalsFor);
      row.goalsAgainst = parseNumOrUnclear(row.goalsAgainst);
      row.points = parseNumOrUnclear(row.points);

      const numFields: (keyof SmartImportExtractedRow)[] = [
        'played',
        'won',
        'drawn',
        'lost',
        'goalsFor',
        'goalsAgainst',
        'points',
      ];
      for (const nf of numFields) {
        if (row[nf] === UNCLEAR_VALUE_MARKER) {
          isUnclear = true;
          issues.push({
            field: nf,
            type: 'unclear',
            message: `قيمة الحقل (${nf}) غير واضحة في المصدر`,
          });
        }
      }

      if (
        typeof row.played === 'number' &&
        typeof row.won === 'number' &&
        typeof row.drawn === 'number' &&
        typeof row.lost === 'number'
      ) {
        if (row.played !== row.won + row.drawn + row.lost) {
          hasConflict = true;
          issues.push({
            field: 'played',
            type: 'conflict',
            message: `تعارض حسابي: عدد المباريات (${row.played}) لا يساوي مجموع (فوز ${row.won} + تعادل ${row.drawn} + خسارة ${row.lost})`,
          });
        }
        const expectedPts =
          row.won * activeRule.pointsWin +
          row.drawn * activeRule.pointsDraw +
          row.lost * activeRule.pointsLoss;
        if (typeof row.points === 'number' && row.points !== expectedPts) {
          hasConflict = true;
          issues.push({
            field: 'points',
            type: 'conflict',
            message: `تعارض في النقاط: النقاط المسجلة (${row.points}) تختلف عن النقاط المحسوبة حسب لائحة البطولة (${expectedPts})`,
          });
        }
      }

      const teamKey = normalizeArabicTeamName(String(row.teamName || ''));
      if (teamKey && teamKey !== normalizeArabicTeamName(UNCLEAR_VALUE_MARKER)) {
        if (seenInBatch.has(`st:${teamKey}`)) {
          isDuplicate = true;
          issues.push({
            field: 'teamName',
            type: 'duplicate',
            message: `الفريق "${row.teamName}" مكرر مرتين في نفس جدول الاستيراد`,
          });
        }
        seenInBatch.add(`st:${teamKey}`);
      }
    } else if (
      dataType === 'match_results' ||
      dataType === 'match_schedule' ||
      dataType === 'rounds_data'
    ) {
      checkTeamField('homeTeam', 'الفريق المستضيف');
      checkTeamField('awayTeam', 'الفريق الضيف');

      if (
        row.homeTeam &&
        row.awayTeam &&
        row.homeTeam !== UNCLEAR_VALUE_MARKER &&
        normalizeArabicTeamName(row.homeTeam) === normalizeArabicTeamName(row.awayTeam)
      ) {
        hasConflict = true;
        issues.push({
          field: 'awayTeam',
          type: 'conflict',
          message: 'تعارض: لا يمكن أن يكون الفريق المستضيف والضيف نفس الفريق',
        });
      }

      const isResultRow =
        dataType === 'match_results' ||
        row.status === 'finished' ||
        (row.homeScore !== undefined && row.homeScore !== '' && row.status !== 'upcoming');

      if (isResultRow) {
        row.status = row.status || 'finished';
        row.homeScore = parseNumOrUnclear(row.homeScore);
        row.awayScore = parseNumOrUnclear(row.awayScore);
        if (row.homeScore === UNCLEAR_VALUE_MARKER || row.awayScore === UNCLEAR_VALUE_MARKER) {
          isUnclear = true;
          issues.push({
            field: 'homeScore',
            type: 'unclear',
            message: 'نتيجة المباراة غير واضحة وتحتاج تأكيد المدير قبل الاعتماد',
          });
        }
      } else {
        row.status = row.status || 'upcoming';
        row.homeScore = typeof row.homeScore === 'number' ? row.homeScore : 0;
        row.awayScore = typeof row.awayScore === 'number' ? row.awayScore : 0;
      }

      // فحص التكرار مع المباريات المسجلة أو داخل نفس الدفعة
      const batchMatchKey = `${normalizeArabicTeamName(row.homeTeam || '')}__${normalizeArabicTeamName(
        row.awayTeam || ''
      )}__${(row.round || '').trim()}`;

      if (
        row.homeTeam &&
        row.awayTeam &&
        row.homeTeam !== UNCLEAR_VALUE_MARKER &&
        row.awayTeam !== UNCLEAR_VALUE_MARKER
      ) {
        if (seenInBatch.has(batchMatchKey)) {
          isDuplicate = true;
          issues.push({
            field: 'homeTeam',
            type: 'duplicate',
            message: 'مباراة مكررة داخل نفس عملية الاستيراد',
          });
        }
        seenInBatch.add(batchMatchKey);

        const dupExisting = isDuplicateMatchItem(
          {
            competitionId,
            round: row.round,
            homeTeam: row.homeTeam,
            awayTeam: row.awayTeam,
          },
          existingMatches
        );
        if (dupExisting) {
          isDuplicate = true;
          issues.push({
            field: 'homeTeam',
            type: 'duplicate',
            message: `هذه المباراة مسجلة مسبقاً في (${dupExisting.round}) بنتيجة (${dupExisting.homeScore}-${dupExisting.awayScore})`,
          });
        }
      }
    } else if (dataType === 'top_scorers' || dataType === 'players_stats' || dataType === 'players_list') {
      if (!row.playerName || isValueUnclear(row.playerName)) {
        row.playerName = UNCLEAR_VALUE_MARKER;
        isUnclear = true;
        issues.push({
          field: 'playerName',
          type: 'unclear',
          message: 'اسم اللاعب غير واضح في المصدر',
        });
      }
      checkTeamField('teamName', 'نادي اللاعب');
      if (dataType !== 'players_list') {
        row.goals = parseNumOrUnclear(row.goals ?? 0);
        row.assists = parseNumOrUnclear(row.assists ?? 0);
        row.matches = parseNumOrUnclear(row.matches ?? 1);
        if (row.goals === UNCLEAR_VALUE_MARKER) {
          isUnclear = true;
          issues.push({
            field: 'goals',
            type: 'unclear',
            message: 'عدد أهداف اللاعب غير واضح',
          });
        }
      }
    } else if (dataType === 'goalkeepers_stats') {
      if (!row.playerName || isValueUnclear(row.playerName)) {
        row.playerName = UNCLEAR_VALUE_MARKER;
        isUnclear = true;
        issues.push({
          field: 'playerName',
          type: 'unclear',
          message: 'اسم حارس المرمى غير واضح',
        });
      }
      checkTeamField('teamName', 'نادي الحارس');
      row.matches = parseNumOrUnclear(row.matches ?? 1);
      row.cleanSheets = parseNumOrUnclear(row.cleanSheets ?? 0);
      row.goalsConceded = parseNumOrUnclear(row.goalsConceded ?? 0);
      if (
        row.cleanSheets === UNCLEAR_VALUE_MARKER ||
        row.goalsConceded === UNCLEAR_VALUE_MARKER
      ) {
        isUnclear = true;
        issues.push({
          field: 'cleanSheets',
          type: 'unclear',
          message: 'أرقام الشباك النظيفة أو الأهداف المستقبلة غير واضحة',
        });
      }
      if (
        typeof row.matches === 'number' &&
        typeof row.cleanSheets === 'number' &&
        row.cleanSheets > row.matches
      ) {
        hasConflict = true;
        issues.push({
          field: 'cleanSheets',
          type: 'conflict',
          message: `تعارض: الشباك النظيفة (${row.cleanSheets}) أكبر من عدد المباريات (${row.matches})`,
        });
      }
    } else if (dataType === 'teams_list') {
      const val = String(row.teamName || '').trim();
      if (!val || isValueUnclear(val)) {
        row.teamName = UNCLEAR_VALUE_MARKER;
        isUnclear = true;
        issues.push({
          field: 'teamName',
          type: 'unclear',
          message: 'اسم الفريق غير واضح',
        });
      }
    }

    row.isUnclear = isUnclear;
    row.isDuplicate = isDuplicate;
    row.hasConflict = hasConflict;
    row.unknownTeams = unknownTeams;
    row.issues = issues;
    return row;
  });
}

/**
 * تحليل النصوص الرياضية العربية المنسوخة أو المستخرجة من الجداول (بدون اختراع أي بيانات)
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
    .map((l) => l.replace(/^[(\[\s]+|[)\]\s]+$/g, '').trim())
    .filter((l) => l.length > 1 && !/^[-=_*#]+$/.test(l));

  const rows: Partial<SmartImportExtractedRow>[] = [];
  let currentRound = defaultRound;

  for (const line of lines) {
    // التقاط عنوان الجولة إن وجد في سطر مستقل
    if (/^(الجولة|جولة|الأسبوع|اسبوع)\s+[\u0600-\u06FF0-9]+$/i.test(line) && line.length < 28) {
      currentRound = line;
      continue;
    }

    if (
      dataType === 'match_results' ||
      dataType === 'match_schedule' ||
      dataType === 'rounds_data'
    ) {
      // أنماط المباريات والنتائج:
      // 1) "الحسين إربد 2 - 1 الوحدات | الجولة 11 | ستاد الحسن"
      // 2) "الفيصلي × الرمثا (1 - 1) - ستاد عمان"
      // 3) "السلط ضد شباب الأردن | غير واضح - 0"
      const parts = line.split(/[|،]/).map((p) => p.trim());
      const mainPart = parts[0];

      let round = currentRound;
      let stadium = 'ستاد عمّان الدولي';
      let matchDate = '';
      let status: MatchStatus | undefined;

      if (/مؤجل|تأجيل/.test(line)) status = 'postponed';
      else if (/ملغ|إلغاء/.test(line)) status = 'cancelled';

      for (const extra of parts.slice(1)) {
        if (/الجولة|جولة|الأسبوع/.test(extra)) round = extra;
        else if (/ستاد|ملعب|مدينة/.test(extra)) stadium = extra;
        else if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}:\d{2}/.test(extra)) matchDate = extra;
      }

      // نمط النتيجة المباشرة في المنتصف: فريق1 2 - 1 فريق2 (أو غير واضح / ؟)
      const scoreMidMatch = mainPart.match(
        /^(.+?)\s+(\d+|غير واضح|\?+|؟؟)\s*[-–:×xX]\s*(\d+|غير واضح|\?+|؟؟)\s+(.+)$/
      );
      if (scoreMidMatch) {
        const homeTeam = scoreMidMatch[1].replace(/^(مباراة|تأجيل|نتيجة)[:\s]+/, '').trim();
        const hsRaw = scoreMidMatch[2].trim();
        const asRaw = scoreMidMatch[3].trim();
        const awayTeam = scoreMidMatch[4].trim();
        rows.push({
          sourceFileName,
          homeTeam,
          awayTeam,
          homeScore: parseNumOrUnclear(hsRaw),
          awayScore: parseNumOrUnclear(asRaw),
          round,
          stadium,
          matchDate,
          status: status || 'finished',
        });
        continue;
      }

      // نمط: فريق1 × فريق2 (2-1) أو فريق1 ضد فريق2
      const vsMatch = mainPart.match(
        /^(.+?)\s+(?:×|ضد|vs|VS|امام|أمام|-|–)\s+(.+?)(?:\s*\(([^)]+)\))?$/
      );
      if (vsMatch) {
        const homeTeam = vsMatch[1].replace(/^(مباراة|تأجيل)[:\s]+/, '').trim();
        let awayTeam = vsMatch[2].trim();
        let hs: number | string = 0;
        let as: number | string = 0;
        let rowStatus: MatchStatus =
          status || (dataType === 'match_results' ? 'finished' : 'upcoming');

        const parenScore = (vsMatch[3] || '').match(
          /(\d+|غير واضح|\?+)\s*[-–:]\s*(\d+|غير واضح|\?+)/
        );
        const trailingScore = awayTeam.match(
          /^(.+?)\s+(\d+|غير واضح|\?+)\s*[-–:]\s*(\d+|غير واضح|\?+)$/
        );

        if (parenScore) {
          hs = parseNumOrUnclear(parenScore[1]);
          as = parseNumOrUnclear(parenScore[2]);
          rowStatus = status || 'finished';
        } else if (trailingScore) {
          awayTeam = trailingScore[1].trim();
          hs = parseNumOrUnclear(trailingScore[2]);
          as = parseNumOrUnclear(trailingScore[3]);
          rowStatus = status || 'finished';
        } else if (dataType === 'match_results') {
          hs = UNCLEAR_VALUE_MARKER;
          as = UNCLEAR_VALUE_MARKER;
        }

        rows.push({
          sourceFileName,
          homeTeam,
          awayTeam,
          homeScore: hs,
          awayScore: as,
          round,
          stadium,
          matchDate,
          status: rowStatus,
        });
      }
    } else if (dataType === 'standings_table') {
      // تجاهل سطر الترويسة إن كان يحتوي على كلمات "الفريق" و"لعب" بدون أرقام
      if (/الفريق|النادي/.test(line) && /لعب|نقاط/.test(line) && !/\d/.test(line)) {
        continue;
      }

      // نمط جدول الترتيب: "1. الحسين إربد 10 8 2 0 22 5 26" أو مفصول بـ | أو Tab
      const cleanedLine = line.replace(/^\d+\s*[.)-]\s*/, '').trim();
      const tokens = cleanedLine
        .split(/\s*[|\t،;]\s*|\s{2,}/)
        .map((t) => t.trim())
        .filter(Boolean);

      if (tokens.length >= 4) {
        const teamName = tokens[0];
        const nums = tokens.slice(1);
        if (nums.length >= 7) {
          rows.push({
            sourceFileName,
            teamName,
            played: parseNumOrUnclear(nums[0]),
            won: parseNumOrUnclear(nums[1]),
            drawn: parseNumOrUnclear(nums[2]),
            lost: parseNumOrUnclear(nums[3]),
            goalsFor: parseNumOrUnclear(nums[4]),
            goalsAgainst: parseNumOrUnclear(nums[5]),
            points: parseNumOrUnclear(nums[nums.length - 1]),
          });
          continue;
        }
      }

      // نمط سطر المسافات العادية: "الحسين إربد 10 8 2 0 22 5 26"
      const spaceMatch = cleanedLine.match(
        /^([\u0600-\u06FFa-zA-Z\s]+?)\s+(\d+|غير واضح|\?+)\s+(\d+|غير واضح|\?+)\s+(\d+|غير واضح|\?+)\s+(\d+|غير واضح|\?+)\s+(\d+|غير واضح|\?+)\s+(\d+|غير واضح|\?+)(?:\s+[+-]?\d+)?\s+(\d+|غير واضح|\?+)$/
      );
      if (spaceMatch) {
        rows.push({
          sourceFileName,
          teamName: spaceMatch[1].trim(),
          played: parseNumOrUnclear(spaceMatch[2]),
          won: parseNumOrUnclear(spaceMatch[3]),
          drawn: parseNumOrUnclear(spaceMatch[4]),
          lost: parseNumOrUnclear(spaceMatch[5]),
          goalsFor: parseNumOrUnclear(spaceMatch[6]),
          goalsAgainst: parseNumOrUnclear(spaceMatch[7]),
          points: parseNumOrUnclear(spaceMatch[8]),
        });
      }
    } else if (dataType === 'top_scorers' || dataType === 'players_stats' || dataType === 'players_list') {
      // نمط: "محمود المرضي | الحسين إربد | 9 أهداف | 4 تمريرات | 11 مباراة"
      const parts = line
        .replace(/^\d+\s*[.)-]\s*/, '')
        .split(/[|\t،-]/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        const nums = parts.slice(2).map((p) => {
          const m = p.match(/\d+|غير واضح|\?+/);
          return m ? parseNumOrUnclear(m[0]) : UNCLEAR_VALUE_MARKER;
        });
        rows.push({
          sourceFileName,
          playerName: parts[0],
          teamName: parts[1],
          goals: nums[0] ?? 0,
          assists: nums[1] ?? 0,
          matches: nums[2] ?? 1,
        });
      }
    } else if (dataType === 'goalkeepers_stats') {
      // نمط: "يزيد أبو ليلى | الحسين إربد | 11 مباراة | 7 شباك نظيفة | 5 أهداف مستقبلة"
      const parts = line
        .replace(/^\d+\s*[.)-]\s*/, '')
        .split(/[|\t،-]/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        const nums = parts.slice(2).map((p) => {
          const m = p.match(/\d+|غير واضح|\?+/);
          return m ? parseNumOrUnclear(m[0]) : UNCLEAR_VALUE_MARKER;
        });
        rows.push({
          sourceFileName,
          playerName: parts[0],
          teamName: parts[1],
          matches: nums[0] ?? 1,
          cleanSheets: nums[1] ?? 0,
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
          teamName: parts[0],
          city: parts[1] || 'الأردن',
        });
      }
    }
  }

  return rows;
}

/**
 * تحليل ملفات Excel (CSV / TSV / XLSX XML) إلى صفوف منظمة
 */
export function parseSpreadsheetContentToRows(
  textContent: string,
  dataType: SmartImportDataType,
  sourceFileName: string
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

  const firstCells = splitCsvLine(lines[0]);
  const hasHeader = firstCells.some((c) =>
    /فريق|نادي|مستضيف|ضيف|لعب|نقاط|لاعب|حارس|team|home|away|played|points|player/i.test(c)
  );

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: Partial<SmartImportExtractedRow>[] = [];

  for (const line of dataLines) {
    const cells = splitCsvLine(line);
    if (cells.length < 2) continue;

    if (dataType === 'standings_table') {
      // إذا كان العمود الأول رقم المركز، نتجاوزه
      const offset = /^\d+$/.test(cells[0]) && cells.length >= 8 ? 1 : 0;
      rows.push({
        sourceFileName,
        teamName: cells[offset] || UNCLEAR_VALUE_MARKER,
        played: parseNumOrUnclear(cells[offset + 1]),
        won: parseNumOrUnclear(cells[offset + 2]),
        drawn: parseNumOrUnclear(cells[offset + 3]),
        lost: parseNumOrUnclear(cells[offset + 4]),
        goalsFor: parseNumOrUnclear(cells[offset + 5]),
        goalsAgainst: parseNumOrUnclear(cells[offset + 6]),
        points: parseNumOrUnclear(cells[offset + 7] ?? cells[cells.length - 1]),
      });
    } else if (
      dataType === 'match_results' ||
      dataType === 'match_schedule' ||
      dataType === 'rounds_data'
    ) {
      // الأعمدة المتوقعة: الجولة | المستضيف | أهداف المستضيف | أهداف الضيف | الضيف | الملعب | التاريخ
      // أو: المستضيف | الضيف | النتيجة (2-1) | الجولة | الملعب
      if (cells.length >= 4 && /^\d+|غير واضح|\?+$/.test(cells[1]) && /^\d+|غير واضح|\?+$/.test(cells[2])) {
        rows.push({
          sourceFileName,
          homeTeam: cells[0],
          homeScore: parseNumOrUnclear(cells[1]),
          awayScore: parseNumOrUnclear(cells[2]),
          awayTeam: cells[3],
          round: cells[4] || 'الجولة 1',
          stadium: cells[5] || 'ستاد عمّان الدولي',
          matchDate: cells[6] || '',
          status: dataType === 'match_schedule' ? 'upcoming' : 'finished',
        });
      } else if (cells.length >= 3 && /(\d+|غير واضح|\?+)\s*[-–:]\s*(\d+|غير واضح|\?+)/.test(cells[2])) {
        const sm = cells[2].match(/(\d+|غير واضح|\?+)\s*[-–:]\s*(\d+|غير واضح|\?+)/)!;
        rows.push({
          sourceFileName,
          homeTeam: cells[0],
          awayTeam: cells[1],
          homeScore: parseNumOrUnclear(sm[1]),
          awayScore: parseNumOrUnclear(sm[2]),
          round: cells[3] || 'الجولة 1',
          stadium: cells[4] || 'ستاد عمّان الدولي',
          status: 'finished',
        });
      } else {
        rows.push({
          sourceFileName,
          homeTeam: cells[0],
          awayTeam: cells[1],
          homeScore: cells[2] !== undefined ? parseNumOrUnclear(cells[2]) : 0,
          awayScore: cells[3] !== undefined ? parseNumOrUnclear(cells[3]) : 0,
          round: cells[4] || 'الجولة 1',
          stadium: cells[5] || 'ستاد عمّان الدولي',
          status: dataType === 'match_schedule' ? 'upcoming' : 'finished',
        });
      }
    } else if (dataType === 'top_scorers' || dataType === 'players_stats' || dataType === 'players_list') {
      rows.push({
        sourceFileName,
        playerName: cells[0],
        teamName: cells[1],
        goals: parseNumOrUnclear(cells[2] ?? 0),
        assists: parseNumOrUnclear(cells[3] ?? 0),
        matches: parseNumOrUnclear(cells[4] ?? 1),
      });
    } else if (dataType === 'goalkeepers_stats') {
      rows.push({
        sourceFileName,
        playerName: cells[0],
        teamName: cells[1],
        matches: parseNumOrUnclear(cells[2] ?? 1),
        cleanSheets: parseNumOrUnclear(cells[3] ?? 0),
        goalsConceded: parseNumOrUnclear(cells[4] ?? 0),
      });
    } else if (dataType === 'teams_list') {
      rows.push({
        sourceFileName,
        teamName: cells[0],
        city: cells[1] || 'الأردن',
      });
    }
  }

  return rows;
}

/**
 * استخراج النصوص والجداول من ملف Excel (.xlsx) أو (.csv) مباشرة بدون مكتبات خارجية ثقيلة
 */
export async function extractTextFromExcelBuffer(
  buffer: ArrayBuffer,
  fileName: string
): Promise<string> {
  const bytes = new Uint8Array(buffer);
  // التحقق مما إذا كان الملف CSV نصياً أو ملف ZIP خاص بـ XLSX (يبدأ بـ PK\x03\x04)
  const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip || fileName.toLowerCase().endsWith('.csv') || fileName.toLowerCase().endsWith('.tsv')) {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  try {
    // قراءة مدخلات ملف ZIP لاستخراج xl/sharedStrings.xml و xl/worksheets/sheet1.xml
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

    const sheetKey = Object.keys(entries).find((k) => k.startsWith('xl/worksheets/sheet'));
    if (sheetKey && entries[sheetKey]) {
      const sheetXml = entries[sheetKey];
      const rowMatches = sheetXml.match(/<row[\s\S]*?<\/row>/g) || [];
      const csvLines: string[] = [];

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
 * استخراج النصوص والجداول من ملف PDF مباشرة (يدعم PDF النصي + Gemini Multimodal لملفات PDF المصورة)
 */
export function extractTextFromPdfBuffer(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

    // 1) استخراج مقاطع النصوص داخل أقواس PDF النصية (...) أو التعليقات المضمنة
    const extractedLines: string[] = [];
    const textBlocks = utf8Text.match(/\(([^()]{2,200})\)/g) || [];
    for (const block of textBlocks) {
      const inner = block.slice(1, -1).trim();
      if (/[\u0600-\u06FF]/.test(inner) || /\d+\s*[-:]\s*\d+/.test(inner)) {
        extractedLines.push(inner);
      }
    }

    // 2) التقاط أي أسطر عربية واضحة مدمجة داخل ملف الـ PDF
    const arabicLines = utf8Text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /[\u0600-\u06FF]{2,}/.test(l) && !l.startsWith('%PDF'));

    const combined = [...arabicLines, ...extractedLines].join('\n').trim();
    return combined;
  } catch {
    return '';
  }
}

/**
 * استدعاء Gemini Multimodal (عبر Firebase AI Logic / Gemini 2.0 Flash API)
 * لاستخراج الجداول الرياضية من الصور (JPG/PNG) وملفات PDF والنصوص وفق مخطط JSON ثابت
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
}> {
  const apiKey = params.geminiApiKey?.trim();

  if (apiKey && (params.fileBase64 || params.rawText)) {
    try {
      const schemaInstruction = `أنت نظام ذكاء اصطناعي رياضي متخصص في استخراج الجداول الرياضية الأردنية لتطبيق WATEEN SPORT.
نوع البيانات المطلوب استخراجها: "${params.dataType}".
قواعد صارمة إلزامية:
1. لا تخترع أو تخمّن أي معلومة غير موجودة في المصدر نهائياً.
2. إذا كانت أي قيمة أو رقم أو اسم غير مقروء بثقة 100%، ضع القيمة النصية "${UNCLEAR_VALUE_MARKER}".
3. أعد النتيجة بصيغة JSON فقط تحتوي على مصفوفة باسم "rows".
4. لكل عنصر في "rows" استخدم الحقول التالية حسب نوع البيانات:
- جدول ترتيب (standings_table): {"teamName": "", "played": 0, "won": 0, "drawn": 0, "lost": 0, "goalsFor": 0, "goalsAgainst": 0, "points": 0}
- مباريات أو نتائج أو جولات (match_results / match_schedule / rounds_data): {"homeTeam": "", "awayTeam": "", "homeScore": 0, "awayScore": 0, "round": "${params.roundName || 'الجولة 1'}", "stadium": "", "matchDate": "", "status": "finished"}
- هدافين أو إحصائيات لاعبين (top_scorers / players_stats / players_list): {"playerName": "", "teamName": "", "goals": 0, "assists": 0, "matches": 0}
- إحصائيات حراس (goalkeepers_stats): {"playerName": "", "teamName": "", "matches": 0, "cleanSheets": 0, "goalsConceded": 0}
- قائمة فرق (teams_list): {"teamName": "", "city": ""}`;

      const parts: Record<string, unknown>[] = [{ text: schemaInstruction }];
      if (params.rawText) {
        parts.push({ text: `النص المصدر:\n${params.rawText}` });
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
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        const rawTextOut = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawTextOut) {
          const cleaned = rawTextOut.replace(/^```json\s*|\s*```$/g, '').trim();
          const parsed = JSON.parse(cleaned);
          const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.rows) ? parsed.rows : [];
          if (arr.length > 0) {
            return {
              rows: arr.map((r: Partial<SmartImportExtractedRow>) => ({
                ...r,
                sourceFileName: params.sourceFileName,
              })),
              usedEngine: 'gemini_multimodal',
            };
          }
        }
      }
    } catch {
      // الانتقال التلقائي إلى المحرك التحليلي المحلي الموثوق
    }
  }

  // المحرك التحليلي المدمج للنصوص وملفات الجداول
  if (params.rawText) {
    const isCsvLike =
      params.sourceFileName.endsWith('.csv') ||
      params.sourceFileName.endsWith('.tsv') ||
      params.sourceFileName.endsWith('.xlsx') ||
      (params.rawText.includes(',') && params.rawText.split('\n')[0].split(',').length >= 3);

    const parsedRows = isCsvLike
      ? parseSpreadsheetContentToRows(params.rawText, params.dataType, params.sourceFileName)
      : parseArabicSportsTextToRows(
          params.rawText,
          params.dataType,
          params.roundName || 'الجولة 1',
          params.sourceFileName
        );

    return {
      rows: parsedRows,
      usedEngine: 'smart_deterministic',
    };
  }

  if (params.fileBase64 && (params.mimeType?.startsWith('image/') || params.mimeType === 'application/pdf')) {
    // في حال عدم توفر مفتاح Gemini، نحاول استخراج أي نص مضمّن داخل البيانات الثنائية أو إنشاء صفوف أولية قابلة للمراجعة مع الصورة المصدر
    try {
      const cleanBase64 = params.fileBase64.replace(/^data:[^;]+;base64,/, '');
      const binaryStr = typeof atob === 'function' ? atob(cleanBase64) : Buffer.from(cleanBase64, 'base64').toString('binary');
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const decodedText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      const parsedFromEmbedded = parseArabicSportsTextToRows(
        decodedText,
        params.dataType,
        params.roundName || 'الجولة 1',
        params.sourceFileName
      );
      if (parsedFromEmbedded.length > 0) {
        return {
          rows: parsedFromEmbedded,
          usedEngine: 'smart_deterministic',
        };
      }
    } catch {
      // ignore binary decode error
    }

    // إرجاع صف أولي بعلامة "غير واضح" لإلزام المراجعة اليدوية أمام صورة المصدر عند غياب مفتاح Gemini
    if (params.dataType === 'standings_table') {
      return {
        rows: [
          {
            sourceFileName: params.sourceFileName,
            teamName: UNCLEAR_VALUE_MARKER,
            played: UNCLEAR_VALUE_MARKER,
            won: UNCLEAR_VALUE_MARKER,
            drawn: UNCLEAR_VALUE_MARKER,
            lost: UNCLEAR_VALUE_MARKER,
            goalsFor: UNCLEAR_VALUE_MARKER,
            goalsAgainst: UNCLEAR_VALUE_MARKER,
            points: UNCLEAR_VALUE_MARKER,
          },
        ],
        usedEngine: 'smart_deterministic',
      };
    }

    return {
      rows: [
        {
          sourceFileName: params.sourceFileName,
          homeTeam: UNCLEAR_VALUE_MARKER,
          awayTeam: UNCLEAR_VALUE_MARKER,
          homeScore: UNCLEAR_VALUE_MARKER,
          awayScore: UNCLEAR_VALUE_MARKER,
          round: params.roundName || 'الجولة 1',
          stadium: 'ستاد عمّان الدولي',
          status: params.dataType === 'match_schedule' ? 'upcoming' : 'finished',
        },
      ],
      usedEngine: 'smart_deterministic',
    };
  }

  return {
    rows: [],
    usedEngine: 'smart_deterministic',
  };
}

/**
 * إنشاء دفعة استيراد كاملة مع التحقق البرمجي المستقل وتحديد حالة المراجعة تلقائياً
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
}): SmartImportBatch {
  const validatedRows = validateExtractedImportRows(
    params.extractedRows,
    params.dataType,
    params.competitionId,
    params.existingMatches,
    params.existingStandings,
    params.directory || INITIAL_JORDAN_TEAMS_DIRECTORY,
    params.rule
  );

  const hasIssuesRequiringCorrection = validatedRows.some(
    (r) => r.isUnclear || r.isDuplicate || r.hasConflict || r.unknownTeams.length > 0
  );

  const now = new Date().toISOString();
  return {
    id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    dataType: params.dataType,
    competitionId: params.competitionId,
    season: params.season,
    ageCategory: params.ageCategory,
    groupName: params.groupName,
    roundName: params.roundName,
    status: hasIssuesRequiringCorrection ? 'Needs Correction' : 'Pending Review',
    sources: params.sources,
    rawPastedText: params.rawPastedText,
    rows: validatedRows,
    usedEngine: params.usedEngine,
    createdAt: now,
    updatedAt: now,
    revisions: [
      {
        id: `rev-${Date.now()}`,
        timestamp: now,
        actor: 'محرك الاستيراد الذكي',
        action: 'IMPORT_CREATED',
        details: `تم استخراج ${validatedRows.length} صفوف (${
          hasIssuesRequiringCorrection ? 'يحتاج مراجعة وتصحيح' : 'جاهز للمراجعة'
        })`,
      },
    ],
  };
}
