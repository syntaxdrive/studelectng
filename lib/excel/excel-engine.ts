import * as XLSX from "xlsx";
import { MockStudent, MockElection } from "../mock-data";
import { validateAndNormalizeNigerianPhone } from "../phone-normalizer";

export interface ParsedStudentRow {
  matricNo: string;
  fullName: string;
  department: string;
  level: number;
  duesPaid: boolean;
  disciplinaryStatus: "GOOD_STANDING" | "SUSPENDED";
  programType: "FULL_TIME" | "PART_TIME" | "DLI" | "SANDWICH";
  email?: string;
  phoneNumber?: string;
  hallOfResidence?: string;
}

/**
 * Intelligent Fuzzy Column Matcher for Nigerian School Portal Dumps.
 * Matches column keys against a list of candidate strings, ignoring punctuation and case.
 */
function findColumnValue(row: Record<string, any>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const normCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchedKey = keys.find((k) =>
      k.trim().toLowerCase().replace(/[^a-z0-9]/g, "").includes(normCandidate)
    );
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      return String(row[matchedKey]).trim();
    }
  }
  return undefined;
}

// ── Comprehensive Nigerian university matric column header synonyms ────────────
// Covers conventional and unconventional naming in school portal exports.
// `findColumnValue` strips all non-alphanumeric chars before comparing, so
// "Matric No", "Matric. No.", "MATRIC_NO", "matric-no" etc. all resolve to "matricno".
const MATRIC_COLUMN_SYNONYMS = [
  // Core matric variants
  "matric",              // "Matric", "Matric No", "Matric Number", "Matric."
  "matricno",            // "Matric No", "MatricNo", "Matric_No"
  "matricnumber",        // "Matric Number", "MatricNumber"
  "matriculation",       // "Matriculation Number", "Matriculation No", "Matriculation"
  "matrucno",            // common typo
  // Registration number variants
  "regno",               // "Reg No", "RegNo", "Reg.No"
  "regnumber",           // "Reg Number"
  "registrationno",      // "Registration No", "Registration Number"
  "registrationnumber",
  "registrationnum",
  // Student ID variants
  "studentid",           // "Student ID", "Student Id"
  "idnumber",            // "ID Number"
  "studentno",           // "Student No"
  "studentnum",
  "studenno",            // typo variant
  // Admission variants
  "admissionno",         // "Admission No", "Admission Number"
  "admissionnumber",
  "admno",
  "admnum",
  // Index / Roll number variants
  "indexno",
  "indexnumber",
  "rollno",
  "rollnumber",
  // File / record number (used in some university portals)
  "filenum",
  "filenumber",
  "schoolno",
  "uid",
];

/**
 * Returns true if a raw cell value looks like a Nigerian university matric number.
 * Matric numbers are typically 4–30 chars, alphanumeric, often with / - . separators.
 * Examples: "21/52HA045", "FSC/CSC/19/004", "UNN/2020/45678", "190408012"
 */
function looksLikeMatricNo(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  const v = value.trim();
  if (v.length < 4 || v.length > 35) return false;
  // Must contain at least one digit
  if (!/\d/.test(v)) return false;
  // Must be alphanumeric (with allowed separators: / - . _)
  if (!/^[A-Za-z0-9/\-._]+$/.test(v)) return false;
  // Reject pure integers longer than 9 digits (likely phone numbers)
  if (/^\d+$/.test(v) && v.length > 9) return false;
  // Reject standalone year values
  if (/^20\d{2}$/.test(v)) return false;
  return true;
}

/**
 * Inspects a sample of rows and returns the column key that most consistently
 * contains matric-like values. Used as a fallback when no header matches.
 * Returns null if no suitable column found (score < 30% match).
 */
function detectMatricColumnByValues(rows: Record<string, any>[]): string | null {
  if (!rows || rows.length === 0) return null;
  const sampleSize = Math.min(rows.length, 20);
  const sample = rows.slice(0, sampleSize);
  const keys = Object.keys(sample[0] || {});

  let bestKey: string | null = null;
  let bestScore = 0;

  for (const key of keys) {
    let score = 0;
    for (const row of sample) {
      const val = String(row[key] ?? "").trim();
      if (looksLikeMatricNo(val)) score++;
    }
    if (score > bestScore && score / sampleSize >= 0.3) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestKey;
}

/**
 * Reads all sheets in a workbook and returns a flat array of row objects.
 * Handles multi-sheet / multi-table Excel files.
 */
function extractAllRowsFromWorkbook(workbook: XLSX.WorkBook): Record<string, any>[] {
  const allRows: Record<string, any>[] = [];
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    try {
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      allRows.push(...rows);
    } catch (_) {
      // Skip any sheet that can't be parsed (e.g. charts)
    }
  }
  return allRows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Roster Import — used when uploading voter register with all fields
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses any Excel (.xlsx, .xls) or CSV file with intelligent column mapping.
 * Scans ALL sheets. Falls back to pattern-based matric column detection.
 * Used for full voter roster import (includes name, dept, level, dues, etc.)
 */
export async function parseExcelOrCsvFile(file: File): Promise<{
  success: boolean;
  rows: ParsedStudentRow[];
  totalParsed: number;
  message: string;
}> {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    const rawJson = extractAllRowsFromWorkbook(workbook);

    if (!rawJson || rawJson.length === 0) {
      return {
        success: false,
        rows: [],
        totalParsed: 0,
        message: "The uploaded spreadsheet is empty or has no recognizable rows.",
      };
    }

    // Auto-detect the matric column if standard headers aren't found
    const matricFallbackKey = detectMatricColumnByValues(rawJson);

    const parsedRows: ParsedStudentRow[] = [];

    for (const row of rawJson) {
      // 1. Matriculation Number — try all synonyms first, then fallback to pattern-detected column
      let matric = findColumnValue(row, MATRIC_COLUMN_SYNONYMS);
      if (!matric && matricFallbackKey) {
        const v = String(row[matricFallbackKey] ?? "").trim();
        if (looksLikeMatricNo(v)) matric = v;
      }
      if (!matric || !looksLikeMatricNo(matric)) continue;

      // 2. Full Name
      let fullName = findColumnValue(row, ["fullname", "studentname", "name", "names", "studentnames"]);
      if (!fullName) {
        const surname = findColumnValue(row, ["surname", "lastname", "familyname"]) || "";
        const firstName = findColumnValue(row, ["firstname", "othernames", "givenname", "middlename"]) || "";
        fullName = `${surname} ${firstName}`.trim();
      }
      if (!fullName) fullName = "Student Voter";

      // 3. Department
      const dept =
        findColumnValue(row, ["department", "dept", "course", "programme", "major", "faculty", "school"]) ||
        "General";

      // 4. Level (handles "300L", "Year 3", "300", 300)
      const rawLevel = findColumnValue(row, ["level", "year", "class", "academiclevel", "studylevel", "yearofstudy"]);
      let level = 100;
      if (rawLevel) {
        const num = parseInt(String(rawLevel).replace(/[^0-9]/g, ""));
        if (!isNaN(num)) level = num > 10 ? num : num * 100;
      }

      // 5. Dues Status
      const rawDues = findColumnValue(row, [
        "dues", "duesstatus", "dues_status", "duespaid", "dues_paid",
        "facultydues", "associationdues", "departmentaldues", "amountpaid",
        "paid", "cleared", "paymentstatus", "financialstatus",
        "receipt", "receiptno", "treasurer", "feesstatus", "levyfees",
      ]);
      let duesPaid = true;
      if (rawDues !== undefined && rawDues !== null) {
        const lower = String(rawDues).toLowerCase().trim();
        if (
          lower === "unpaid" || lower === "not paid" || lower === "no" ||
          lower === "false" || lower === "0" || lower === "nil" || lower === "owing" ||
          lower.includes("unpaid") || lower.includes("debt") ||
          lower.includes("pending") || lower.includes("defaulter") ||
          lower.includes("not cleared")
        ) {
          duesPaid = false;
        } else if (
          lower === "paid" || lower === "yes" || lower === "true" || lower === "1" ||
          lower === "cleared" || lower.includes("cleared") || lower.includes("paid") ||
          lower.includes("receipt")
        ) {
          duesPaid = true;
        }
      }

      // 6. Disciplinary Status
      const rawSDC = findColumnValue(row, ["sdc", "discipline", "disciplinary", "status", "disciplinarystatus"]);
      let disciplinaryStatus: "GOOD_STANDING" | "SUSPENDED" = "GOOD_STANDING";
      if (rawSDC) {
        const lower = String(rawSDC).toLowerCase();
        if (
          lower.includes("suspend") || lower.includes("expel") ||
          lower.includes("probation") || lower.includes("flag")
        ) {
          disciplinaryStatus = "SUSPENDED";
        }
      }

      // 7. Program Type
      const rawProgram = findColumnValue(row, ["program", "programtype", "mode", "studymode", "modeofentry"]);
      let programType: "FULL_TIME" | "PART_TIME" | "DLI" | "SANDWICH" = "FULL_TIME";
      if (rawProgram) {
        const lower = String(rawProgram).toLowerCase();
        if (lower.includes("dli")) programType = "DLI";
        else if (lower.includes("part") || lower.includes("evening")) programType = "PART_TIME";
        else if (lower.includes("sand")) programType = "SANDWICH";
      }

      // 8. Contact & Hall
      const email = findColumnValue(row, ["email", "studentemail", "mail", "emailaddress"]);
      const rawPhone = findColumnValue(row, ["phone", "phonenumber", "gsm", "mobile", "telephone", "tel"]);
      const phoneValidation = rawPhone ? validateAndNormalizeNigerianPhone(rawPhone) : null;
      const phoneNumber = phoneValidation?.isValid
        ? phoneValidation.normalized
        : rawPhone
        ? String(rawPhone).trim()
        : undefined;
      const hall = findColumnValue(row, ["hall", "hostel", "residence", "hallofresidence"]) || "On-Campus";

      parsedRows.push({
        matricNo: matric,
        fullName,
        department: dept,
        level,
        duesPaid,
        disciplinaryStatus,
        programType,
        email,
        phoneNumber,
        hallOfResidence: hall,
      });
    }

    return {
      success: true,
      rows: parsedRows,
      totalParsed: parsedRows.length,
      message: `Successfully mapped and imported ${parsedRows.length} student records.`,
    };
  } catch (error: any) {
    return {
      success: false,
      rows: [],
      totalParsed: 0,
      message: error.message || "Failed to process spreadsheet file.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Whitelist-only Import — extracts matric numbers from ANY arrangement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whitelist-specific parser. Extracts matric numbers regardless of:
 *  - Column header name (uses 30+ synonyms: "Matric No", "Matriculation Number",
 *    "Reg No", "Student ID", "Admission No", "Index No", etc.)
 *  - Column position / arrangement (any order works)
 *  - Number of tables in the file (scans ALL sheets)
 *  - Missing headers entirely (falls back to pattern-based cell scanning)
 *
 * Detection strategy (in priority order):
 *   1. Header match   — find a column whose header matches any known synonym
 *   2. Pattern match  — auto-detect the matric column by inspecting cell values
 *   3. Brute force    — scan every single cell for matric-like values
 *
 * Results are deduplicated by normalized matric (stripped of / - . spaces).
 */
export async function parseWhitelistFile(file: File): Promise<{
  success: boolean;
  rows: Array<{ matricNo: string; fullName?: string; department?: string; level?: number }>;
  totalParsed: number;
  skipped: number;
  message: string;
  detectionMethod: "header" | "pattern" | "brute_force";
}> {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    // ── Step 1: Collect rows from ALL sheets ────────────────────────────────
    const allRows = extractAllRowsFromWorkbook(workbook);
    if (!allRows || allRows.length === 0) {
      return {
        success: false,
        rows: [],
        totalParsed: 0,
        skipped: 0,
        message: "The uploaded file is empty or could not be read.",
        detectionMethod: "brute_force",
      };
    }

    let detectionMethod: "header" | "pattern" | "brute_force" = "header";

    // ── Step 2: Header-based column detection ───────────────────────────────
    let matricKey: string | null = null;
    const firstRowKeys = Object.keys(allRows[0] || {});
    for (const key of firstRowKeys) {
      const keyNorm = key.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      // Check if the key contains any synonym OR if any synonym contains the key
      if (MATRIC_COLUMN_SYNONYMS.some((s) => keyNorm.includes(s) || s.includes(keyNorm))) {
        matricKey = key;
        break;
      }
    }

    // ── Step 3: Pattern-based fallback ─────────────────────────────────────
    if (!matricKey) {
      detectionMethod = "pattern";
      matricKey = detectMatricColumnByValues(allRows);
    }

    const seenMatrics = new Set<string>();
    const resultRows: Array<{ matricNo: string; fullName?: string; department?: string; level?: number }> = [];
    let skipped = 0;

    if (matricKey) {
      // ── Structured extraction from detected column ──────────────────────
      for (const row of allRows) {
        const raw = String(row[matricKey] ?? "").trim();
        if (!raw || !looksLikeMatricNo(raw)) {
          skipped++;
          continue;
        }

        const normalized = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        if (seenMatrics.has(normalized)) continue;
        seenMatrics.add(normalized);

        // Optional metadata (nice-to-have, not required for whitelist gating)
        const fullName =
          findColumnValue(row, ["fullname", "studentname", "name", "names"]) ||
          (() => {
            const sn = findColumnValue(row, ["surname", "lastname"]) || "";
            const fn = findColumnValue(row, ["firstname", "othernames"]) || "";
            return `${sn} ${fn}`.trim();
          })() ||
          undefined;

        const department =
          findColumnValue(row, ["department", "dept", "course", "programme"]) || undefined;

        const rawLevel = findColumnValue(row, ["level", "year", "class", "academiclevel"]);
        let level: number | undefined;
        if (rawLevel) {
          const num = parseInt(String(rawLevel).replace(/[^0-9]/g, ""));
          if (!isNaN(num)) level = num > 10 ? num : num * 100;
        }

        resultRows.push({ matricNo: raw, fullName: fullName || undefined, department, level });
      }
    } else {
      // ── Step 4: Brute-force — scan every cell ──────────────────────────
      detectionMethod = "brute_force";
      for (const row of allRows) {
        for (const cellValue of Object.values(row)) {
          const raw = String(cellValue ?? "").trim();
          if (!raw || !looksLikeMatricNo(raw)) continue;
          const normalized = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
          if (seenMatrics.has(normalized)) continue;
          seenMatrics.add(normalized);
          resultRows.push({ matricNo: raw });
        }
      }
    }

    const methodLabels: Record<typeof detectionMethod, string> = {
      header: "matched column header",
      pattern: "auto-detected column by value pattern",
      brute_force: "scanned all cells (no recognizable column header found)",
    };

    if (resultRows.length === 0) {
      return {
        success: false,
        rows: [],
        totalParsed: 0,
        skipped,
        message:
          `No valid matriculation numbers found. ` +
          `Make sure the file has a column named "Matric No", "Matriculation Number", ` +
          `"Reg No", "Student ID", "Admission No", or similar — ` +
          `or that cells contain values like "21/52HA045" or "UNN/2020/12345".`,
        detectionMethod,
      };
    }

    return {
      success: true,
      rows: resultRows,
      totalParsed: resultRows.length,
      skipped,
      message:
        `${resultRows.length} unique matric number(s) extracted (${methodLabels[detectionMethod]}).` +
        (skipped > 0 ? ` ${skipped} non-matric row(s) skipped.` : ""),
      detectionMethod,
    };
  } catch (error: any) {
    return {
      success: false,
      rows: [],
      totalParsed: 0,
      skipped: 0,
      message: error.message || "Failed to process whitelist file.",
      detectionMethod: "brute_force",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exports the Voter Register to a styled .xlsx Excel spreadsheet
 */
export function exportVoterRegisterToExcel(students: MockStudent[], institutionCode = "CAMPUS") {
  const exportData = students.map((s, index) => ({
    "S/N": index + 1,
    "Matriculation Number": s.matricNo,
    "Full Name": s.fullName,
    "Department": s.department,
    "Level": `${s.level}L`,
    "Program": s.programType,
    "Dues Clearance": s.duesPaid ? "PAID (CLEARED)" : "UNPAID",
    "SDC Standing": s.disciplinaryStatus,
    "Hall of Residence": s.hallOfResidence || "N/A",
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Voter Register");
  XLSX.writeFile(workbook, `${institutionCode}_Voter_Register_${Date.now()}.xlsx`);
}

/**
 * Exports Voter PIN Slips to a printable Excel spreadsheet
 */
export function exportVoterPinsToExcel(students: MockStudent[], electionTitle = "Election") {
  const exportData = students.map((s, index) => ({
    "S/N": index + 1,
    "Matriculation Number": s.matricNo,
    "Full Name": s.fullName,
    "Department": s.department,
    "Level": `${s.level}L`,
    "Voter Access PIN": s.portalPin,
    "Voting Instructions": "Enter Matric No + Voter PIN at the polling booth",
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Voter PIN Slips");
  XLSX.writeFile(workbook, `VOTER_PIN_SLIPS_${Date.now()}.xlsx`);
}

/**
 * Downloads a clean Sample Excel Template for ELCOM whitelist uploads.
 * Shows the recommended column names.
 */
export function downloadSampleExcelTemplate() {
  const sampleData = [
    {
      "Matric No": "21/52HA045",
      "Full Name": "Adebayo Chukwuma Olawale",
      "Department": "Computer Science",
      "Level": "300",
      "Dues Status": "Paid",
      "Disciplinary Status": "Good Standing",
      "Program Type": "Full-Time",
      "Email": "adebayo.cs@student.unilag.edu.ng",
      "Phone": "08012345678",
      "Hall": "Jaja Hall",
    },
    {
      "Matric No": "22/52HA089",
      "Full Name": "Chioma Blessing Nnamdi",
      "Department": "Computer Science",
      "Level": "200",
      "Dues Status": "Paid",
      "Disciplinary Status": "Good Standing",
      "Program Type": "Full-Time",
      "Email": "chioma.blessing@student.unilag.edu.ng",
      "Phone": "08098765432",
      "Hall": "Moremi Hall",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Student Template");
  XLSX.writeFile(workbook, "StudElect_Student_Roster_Template.xlsx");
}
