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
 * Intelligent Fuzzy Column Matcher for Nigerian School Portal Dumps
 */
function findColumnValue(row: Record<string, any>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const matchedKey = keys.find((k) =>
      k.trim().toLowerCase().replace(/[^a-z0-9]/g, "").includes(candidate.toLowerCase().replace(/[^a-z0-9]/g, ""))
    );
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      return String(row[matchedKey]).trim();
    }
  }
  return undefined;
}

/**
 * Parses any Excel (.xlsx, .xls) or CSV file with intelligent column mapping
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
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    if (!rawJson || rawJson.length === 0) {
      return {
        success: false,
        rows: [],
        totalParsed: 0,
        message: "The uploaded spreadsheet is empty or has no recognizable rows.",
      };
    }

    const parsedRows: ParsedStudentRow[] = [];

    for (const row of rawJson) {
      // 1. Matriculation Number
      const matric = findColumnValue(row, ["matric", "matricno", "regno", "matriculationnumber", "registrationno", "idnumber"]);
      if (!matric) continue;

      // 2. Full Name (Checks Full Name, or concatenates Surname + First Name)
      let fullName = findColumnValue(row, ["fullname", "studentname", "name"]);
      if (!fullName) {
        const surname = findColumnValue(row, ["surname", "lastname"]) || "";
        const firstName = findColumnValue(row, ["firstname", "othernames", "givenname"]) || "";
        fullName = `${surname} ${firstName}`.trim();
      }
      if (!fullName) fullName = "Student Voter";

      // 3. Department
      const dept = findColumnValue(row, ["department", "dept", "course", "programme", "major"]) || "General";

      // 4. Level (Parses "300L", "Year 3", "300", 300)
      const rawLevel = findColumnValue(row, ["level", "year", "class", "academic_level"]);
      let level = 100;
      if (rawLevel) {
        const num = parseInt(String(rawLevel).replace(/[^0-9]/g, ""));
        if (!isNaN(num)) {
          level = num > 10 ? num : num * 100;
        }
      }

      // 5. Association / Faculty Dues Status
      const rawDues = findColumnValue(row, [
        "dues",
        "duesstatus",
        "dues_status",
        "duespaid",
        "dues_paid",
        "facultydues",
        "associationdues",
        "departmentaldues",
        "amountpaid",
        "paid",
        "cleared",
        "paymentstatus",
        "financialstatus",
        "receipt",
        "receiptno",
        "treasurer",
      ]);
      let duesPaid = true;
      if (rawDues !== undefined && rawDues !== null) {
        const lower = String(rawDues).toLowerCase().trim();
        if (
          lower === "unpaid" ||
          lower === "not paid" ||
          lower === "no" ||
          lower === "false" ||
          lower === "0" ||
          lower === "nil" ||
          lower === "owing" ||
          lower.includes("unpaid") ||
          lower.includes("debt") ||
          lower.includes("pending") ||
          lower.includes("defaulter") ||
          lower.includes("not cleared")
        ) {
          duesPaid = false;
        } else if (
          lower === "paid" ||
          lower === "yes" ||
          lower === "true" ||
          lower === "1" ||
          lower === "cleared" ||
          lower.includes("cleared") ||
          lower.includes("paid") ||
          lower.includes("receipt")
        ) {
          duesPaid = true;
        }
      }

      // 6. SDC Disciplinary Status
      const rawSDC = findColumnValue(row, ["sdc", "discipline", "disciplinary", "status", "disciplinarystatus"]);
      let disciplinaryStatus: "GOOD_STANDING" | "SUSPENDED" = "GOOD_STANDING";
      if (rawSDC) {
        const lower = String(rawSDC).toLowerCase();
        if (lower.includes("suspend") || lower.includes("expel") || lower.includes("probation") || lower.includes("flag")) {
          disciplinaryStatus = "SUSPENDED";
        }
      }

      // 7. Program Type (Full-time vs Part-time/DLI)
      const rawProgram = findColumnValue(row, ["program", "programtype", "mode", "study_mode"]);
      let programType: "FULL_TIME" | "PART_TIME" | "DLI" | "SANDWICH" = "FULL_TIME";
      if (rawProgram) {
        const lower = String(rawProgram).toLowerCase();
        if (lower.includes("dli")) programType = "DLI";
        else if (lower.includes("part") || lower.includes("evening")) programType = "PART_TIME";
        else if (lower.includes("sand")) programType = "SANDWICH";
      }

      // 8. Contact & Hall
      const email = findColumnValue(row, ["email", "studentemail", "mail"]);
      const rawPhone = findColumnValue(row, ["phone", "phonenumber", "gsm", "mobile"]);
      const phoneValidation = rawPhone ? validateAndNormalizeNigerianPhone(rawPhone) : null;
      const phoneNumber = phoneValidation?.isValid
        ? phoneValidation.normalized
        : (rawPhone ? String(rawPhone).trim() : undefined);
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
 * Exports ₦0 Voter PIN Slips to a printable Excel spreadsheet
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
 * Downloads a clean Sample Excel Template for ELCOM
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
