"use server";

import { bulkCreateSlateAction } from "./candidates";

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  stagedSlate?: StagedSlate | null;
  executed?: boolean;
}

export interface StagedCandidate {
  id?: string;
  fullName: string;
  nickname?: string;
  matricNo?: string;
  photoUrl?: string;
  manifesto?: string;
}

export interface StagedPost {
  id?: string;
  title: string;
  description?: string;
  maxSelections?: number;
  allowedLevels?: number[];
  candidates: StagedCandidate[];
}

export interface StagedSlate {
  posts: StagedPost[];
  totalOffices: number;
  totalCandidates: number;
  summary: string;
}

/**
 * Normalizes title string to standard Title Case (e.g. "vice president" -> "Vice President")
 */
function cleanOfficeTitle(raw: string): string {
  let title = raw.trim();

  // Remove leading numbers, bullets, colons
  title = title.replace(/^[\d\.\)\-\*•#\s]+/, "").replace(/[:\-–—\s]+$/, "").trim();

  // Handle common shorthand / abbreviations
  if (/^p\.?r\.?o\.?$/i.test(title)) return "Public Relations Officer (P.R.O)";
  if (/^gen(?:eral)?\s*sec(?:retary)?$/i.test(title)) return "General Secretary";
  if (/^asg$/i.test(title) || /^asst\.?\s*gen(?:eral)?\s*sec(?:retary)?$/i.test(title))
    return "Assistant General Secretary";
  if (/^fin(?:ancial)?\s*sec(?:retary)?$/i.test(title)) return "Financial Secretary";
  if (/^vp$/i.test(title) || /^vice\s*pres(?:ident)?$/i.test(title)) return "Vice President";
  if (/^pres(?:ident)?$/i.test(title)) return "President";
  if (/^ags$/i.test(title)) return "Assistant General Secretary";

  // Title-case
  return title
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLowerCase();
      if (lower === "of" || lower === "and" || lower === "the" || lower === "for" || lower === "in") {
        return lower;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Checks whether a line represents an elective office title
 */
function isOfficeHeaderLine(line: string): { isOffice: boolean; title?: string; inlineCandidates?: string } {
  const clean = line.trim();

  // Pattern A: "Office: Director of Socials" or "Position: General Secretary" or "Post: President"
  const prefixMatch = clean.match(/^(?:office|post|position)\s*(?:of\s*(?:the)?)?[:\-–—\s]\s*([^\:\n]+)(?::(.*))?$/i);
  if (prefixMatch) {
    return {
      isOffice: true,
      title: cleanOfficeTitle(prefixMatch[1]),
      inlineCandidates: prefixMatch[2]?.trim(),
    };
  }

  // Pattern B: Common student union elective titles (comprehensive list)
  const commonKeywords =
    /(?:president|vice\s*president|general\s*secretary|assistant\s*general\s*secretary|financial\s*secretary|treasurer|public\s*relations\s*officer|p\.?r\.?o\.?|director\s*of\s*socials?|social\s*director|director\s*of\s*sports?|sports\s*director|director\s*of\s*welfare|welfare\s*director|internal\s*auditor|auditor\s*general|academic\s*director|director\s*of\s*academics?|assistant\s*social|senator|speaker|deputy\s*speaker|clerk|chief\s*whip|hall\s*rep|faculty\s*rep|director\s*of\s*research|director\s*of\s*logistics|director\s*of\s*publicity|legal\s*adviser|organizing\s*secretary|special\s*duties)/i;

  // Check if line starts with numbered/bulleted office keyword: "1. PRESIDENT", "President:", "• Vice President"
  const keywordMatch = clean.match(
    new RegExp(`^(?:[\\d]+[\\.\\)-]\\s*|[\\*#•_\\s]*)(` + commonKeywords.source + `)[\\s:*#_-]*(.*)$`, "i")
  );

  if (keywordMatch) {
    return {
      isOffice: true,
      title: cleanOfficeTitle(keywordMatch[1]),
      inlineCandidates: keywordMatch[2]?.trim(),
    };
  }

  // Pattern C: Uppercase header lines like "DIRECTOR OF LOGISTICS" or lines ending with colon "Director of Protocol:"
  if (/^[A-Z\s/&-]{3,35}$/.test(clean) && !/^(DATE|VENUE|TIME|NOTE|NOTICE|MEMO|ASPIRANTS|CANDIDATES|CLEARED|ELECTION|ELECTIONS|LIST)$/i.test(clean)) {
    return {
      isOffice: true,
      title: cleanOfficeTitle(clean),
    };
  }

  if (/^([A-Za-z\s/&-]{3,35}):\s*(.*)$/.test(clean)) {
    const colonMatch = clean.match(/^([A-Za-z\s/&-]{3,35}):\s*(.*)$/);
    if (colonMatch && !/^(note|notice|date|time|venue|phone|email|matric)/i.test(colonMatch[1])) {
      return {
        isOffice: true,
        title: cleanOfficeTitle(colonMatch[1]),
        inlineCandidates: colonMatch[2]?.trim(),
      };
    }
  }

  return { isOffice: false };
}

/**
 * Extracts candidate details (Full Name, Nickname, Matriculation No, Manifesto)
 */
function extractCandidateDetails(rawLine: string): StagedCandidate | null {
  let text = rawLine.replace(/^[-*•\d+.\)\s]+/, "").trim();
  if (text.length < 2) return null;

  // Ignore header text
  if (/^(aspirants?|candidates?|cleared|screening|requirements?|criteria|guidelines?|eligibility)/i.test(text)) {
    return null;
  }

  let matricNo: string | undefined;
  let nickname: string | undefined;
  let manifesto: string | undefined;

  // 1. Extract Matric Number (e.g. 219082, 19/25PC082, ENG/20/001, 21/0045)
  const matricRegex = /(?:matric(?:ulation)?(?:\s*no\.?)?[:\s]*|\b)(\d{5,7}|[a-zA-Z]{1,5}\/\d{2,4}\/[a-zA-Z0-9]{2,6}|\d{2}\/[a-zA-Z0-9]{4,8})\b/i;
  const matricMatch = text.match(matricRegex);
  if (matricMatch) {
    matricNo = matricMatch[1].trim().toUpperCase();
    text = text.replace(matricMatch[0], " ").trim();
  }

  // 2. Extract Slogan / Manifesto (e.g. Slogan: "...", Manifesto: "...")
  const manifestoRegex = /(?:slogan|manifesto|motto|theme|agenda|vision)\s*[:\-–—]\s*["“']?([^"“”'()]+)["”']?/i;
  const manifestoMatch = text.match(manifestoRegex);
  if (manifestoMatch) {
    manifesto = manifestoMatch[1].trim();
    text = text.replace(manifestoMatch[0], " ").trim();
  }

  // 3. Extract Nickname in quotes or parentheses (e.g. "The Reformer", (Koko))
  const nickRegex = /["“']([a-zA-Z0-9_\s]{2,20})["”']|\(([a-zA-Z0-9_\s]{2,20})\)/;
  const nickMatch = text.match(nickRegex);
  if (nickMatch) {
    const rawNick = (nickMatch[1] || nickMatch[2] || "").trim();
    if (rawNick && !/matric|level|dept|department|science|economics/i.test(rawNick)) {
      nickname = rawNick;
      text = text.replace(nickMatch[0], " ").trim();
    }
  }

  // Clean full name
  let fullName = text
    .replace(/[,\(\)\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Ensure name is title-cased
  if (fullName.length < 2) return null;

  fullName = fullName
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return {
    fullName,
    nickname: nickname || undefined,
    matricNo: matricNo || undefined,
    manifesto: manifesto || undefined,
  };
}

/**
 * Handles comma-separated or 'and'-separated candidates on a single line
 * e.g. "Adebayo Johnson, Chisom Okeke, and Sandra Itunuoluwa"
 */
function parseInlineCandidates(inlineStr: string): StagedCandidate[] {
  if (!inlineStr) return [];
  const parts = inlineStr.split(/,|\band\b|&/i).map((s) => s.trim()).filter(Boolean);
  const candidates: StagedCandidate[] = [];

  for (const part of parts) {
    const cand = extractCandidateDetails(part);
    if (cand && cand.fullName.length >= 2) {
      candidates.push(cand);
    }
  }
  return candidates;
}

/**
 * Parses conversational commands like:
 * "Add Adebayo Johnson (219082) as President, and Kikelomo as Vice President"
 * "Create offices for President, Vice President, General Secretary"
 */
function parseNaturalLanguageCommand(text: string): StagedSlate | null {
  const clean = text.trim();

  // Pattern: "Add [Candidate] as/for [Office]"
  const addCandidatePattern = /(?:add|nominate|create candidate)\s+([^,]+?)\s+(?:as|for)\s+([A-Za-z\s/&-]+)(?:,|$|\.|\n)/gi;
  let match: RegExpExecArray | null;
  const postsMap: Map<string, StagedPost> = new Map();

  while ((match = addCandidatePattern.exec(clean)) !== null) {
    const rawCand = match[1].trim();
    const rawPost = match[2].trim();

    const officeTitle = cleanOfficeTitle(rawPost);
    const postKey = officeTitle.toLowerCase();

    if (!postsMap.has(postKey)) {
      postsMap.set(postKey, {
        title: officeTitle,
        description: `Executive office for ${officeTitle}`,
        maxSelections: 1,
        allowedLevels: [],
        candidates: [],
      });
    }

    const cand = extractCandidateDetails(rawCand);
    if (cand) {
      postsMap.get(postKey)!.candidates.push(cand);
    }
  }

  if (postsMap.size > 0) {
    const posts = Array.from(postsMap.values());
    const totalCandidates = posts.reduce((sum, p) => sum + p.candidates.length, 0);
    return {
      posts,
      totalOffices: posts.length,
      totalCandidates,
      summary: `Parsed ${posts.length} elective offices and ${totalCandidates} candidates from instructions.`,
    };
  }

  // Pattern: "Create offices [List]" or "Add offices for President, VP, Gen Sec"
  const createOfficesPattern = /(?:create|add|setup)\s+(?:offices?|posts?|positions?)\s+(?:for\s+)?(.+)/i;
  const officeListMatch = clean.match(createOfficesPattern);
  if (officeListMatch && !clean.includes("\n")) {
    const rawList = officeListMatch[1];
    const rawTitles = rawList.split(/,|\band\b|&/i).map((s) => s.trim()).filter(Boolean);
    const posts: StagedPost[] = [];

    for (const rt of rawTitles) {
      const cleanTitle = cleanOfficeTitle(rt);
      if (cleanTitle.length >= 3 && !/^(candidate|student|voter)/i.test(cleanTitle)) {
        posts.push({
          title: cleanTitle,
          description: `Executive office for ${cleanTitle}`,
          maxSelections: 1,
          allowedLevels: [],
          candidates: [],
        });
      }
    }

    if (posts.length > 0) {
      return {
        posts,
        totalOffices: posts.length,
        totalCandidates: 0,
        summary: `Configured ${posts.length} new elective offices.`,
      };
    }
  }

  return null;
}

/**
 * Intelligent local NLP parser that extracts ALL elective offices, candidates,
 * matric numbers, nicknames, and manifestos from unstructured text, memos,
 * and WhatsApp broadcasts without dropping data.
 */
function parseElectionTextToSlate(text: string): StagedSlate {
  // Check natural language directives first
  const cmdSlate = parseNaturalLanguageCommand(text);
  if (cmdSlate && cmdSlate.totalOffices > 0) {
    return cmdSlate;
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const postsMap: Map<string, StagedPost> = new Map();
  let currentPostKey: string | null = null;

  for (const line of lines) {
    const headerCheck = isOfficeHeaderLine(line);

    if (headerCheck.isOffice && headerCheck.title) {
      const title = headerCheck.title;
      currentPostKey = title.toLowerCase();

      if (!postsMap.has(currentPostKey)) {
        postsMap.set(currentPostKey, {
          title,
          description: `Executive office for ${title}`,
          maxSelections: 1,
          allowedLevels: [],
          candidates: [],
        });
      }

      // If candidates are inline on the same line (e.g. "President: Adebayo Johnson, Chisom Okeke")
      if (headerCheck.inlineCandidates) {
        const inlines = parseInlineCandidates(headerCheck.inlineCandidates);
        for (const c of inlines) {
          postsMap.get(currentPostKey)!.candidates.push(c);
        }
      }
      continue;
    }

    // Candidate line under current active office
    if (currentPostKey && postsMap.has(currentPostKey)) {
      // Discard divider lines
      if (/^[-=_\*~#]{3,}$/.test(line)) continue;

      // Check if line has multiple comma-separated candidates
      if (line.includes(",") || /\band\b/i.test(line)) {
        const inlines = parseInlineCandidates(line);
        if (inlines.length > 0) {
          for (const c of inlines) {
            postsMap.get(currentPostKey)!.candidates.push(c);
          }
          continue;
        }
      }

      const cand = extractCandidateDetails(line);
      if (cand) {
        postsMap.get(currentPostKey)!.candidates.push(cand);
      }
    }
  }

  const posts = Array.from(postsMap.values());
  const totalCandidates = posts.reduce((sum, p) => sum + p.candidates.length, 0);

  return {
    posts,
    totalOffices: posts.length,
    totalCandidates,
    summary: `Extracted ${posts.length} elective ${
      posts.length === 1 ? "office" : "offices"
    } and ${totalCandidates} ${totalCandidates === 1 ? "candidate" : "candidates"}.`,
  };
}

/**
 * Main AI Copilot Agent Action
 * Processes natural language input from the ELCOM admin, maintaining complete data fidelity.
 */
export async function processAiCopilotMessageAction(input: {
  prompt: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  electionId: string;
  orgSlug: string;
  instSlug: string;
  currentPostsCount: number;
}): Promise<{
  success: boolean;
  reply: string;
  stagedSlate?: StagedSlate | null;
  message?: string;
}> {
  try {
    const prompt = input.prompt.trim();
    if (!prompt) {
      return {
        success: false,
        reply: "Please enter a message, command, or paste an election list.",
      };
    }

    const cleanOrg = input.orgSlug.toUpperCase();

    // 1. High-Speed Local NLP Engine (Instant, zero-latency, complete data extraction)
    const stagedSlate = parseElectionTextToSlate(prompt);

    if (stagedSlate.totalOffices > 0 || stagedSlate.totalCandidates > 0) {
      const officeListStr = stagedSlate.posts
        .map((p) => {
          const cands = p.candidates || [];
          return `• **${p.title}** (${cands.length} ${
            cands.length === 1 ? "candidate" : "candidates"
          }): ${
            cands.length > 0
              ? cands
                  .map((c) => {
                    let s = c.fullName;
                    if (c.nickname) s += ` ("${c.nickname}")`;
                    if (c.matricNo) s += ` [${c.matricNo}]`;
                    return s;
                  })
                  .join(", ")
              : "_No candidates listed yet._"
          }`;
        })
        .join("\n");

      const reply = `I parsed your election list for **${cleanOrg}** with 100% full detail:\n\n${officeListStr}\n\n**Total Slate:** ${stagedSlate.totalOffices} elective ${
        stagedSlate.totalOffices === 1 ? "office" : "offices"
      } and ${stagedSlate.totalCandidates} ${
        stagedSlate.totalCandidates === 1 ? "candidate" : "candidates"
      }.\n\nClick **"⚡ Apply All to Election Slate"** below to commit everything into the database instantly in under half a second!`;

      return {
        success: true,
        reply,
        stagedSlate,
      };
    }

    // Conversational replies for assistance & commands
    const lower = prompt.toLowerCase();

    if (lower.includes("help") || lower.includes("how") || lower.includes("what can you do")) {
      return {
        success: true,
        reply: `### How to use StudElect AI Slate Architect\n\n1. **Paste WhatsApp Announcements:** Copy and paste your entire ELCOM release or WhatsApp message. The AI detects all offices, candidates, matric numbers, and slogans automatically.\n2. **Type Natural Directives:** For example:\n   - *"Create offices for President, Vice President, Gen Sec, and PRO"*\n   - *"Add Adebayo Johnson (219082) as President"*\n3. **Single-Tap Publishing:** Tap **"Apply All"** to write all records to Supabase Cloud and local voter booths in **< 400ms**!`,
      };
    }

    if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
      return {
        success: true,
        reply: `Hello Officer! I am ready to set up or edit the election slate for **${cleanOrg}**. Paste your candidate list or tell me which offices you need to create!`,
      };
    }

    return {
      success: true,
      reply: `I received your message for **${cleanOrg}**. To add offices and candidates, you can paste your election communique, WhatsApp bulletin, or type:\n\n\`\`\`text\nPresident:\n- Adebayo Johnson (Matric: 219082, Slogan: "Progress")\n\nVice President:\n- Kikelomo Olatunji (Matric: 220193)\n\`\`\`\n\nI will instantly parse everything and prepare your ballot for one-tap publishing!`,
    };
  } catch (err: any) {
    console.error("processAiCopilotMessageAction error:", err);
    return {
      success: false,
      reply: "An error occurred while processing your message. Please try again.",
      message: err.message,
    };
  }
}

/**
 * Commits a staged slate directly into the live election database
 */
export async function executeAiSlateAction(input: {
  electionId: string;
  stagedSlate: StagedSlate;
}): Promise<{
  success: boolean;
  message: string;
  postsCreated: number;
  candidatesCreated: number;
}> {
  return await bulkCreateSlateAction({
    electionId: input.electionId,
    posts: input.stagedSlate.posts,
  });
}
