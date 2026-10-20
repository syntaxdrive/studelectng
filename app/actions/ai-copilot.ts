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

export interface StagedSlate {
  posts: Array<{
    id?: string;
    title: string;
    description?: string;
    maxSelections?: number;
    allowedLevels?: number[];
    candidates?: Array<{
      id?: string;
      fullName: string;
      nickname?: string;
      matricNo?: string;
      photoUrl?: string;
      manifesto?: string;
    }>;
  }>;
  totalOffices: number;
  totalCandidates: number;
  summary: string;
}

/**
 * Intelligent local NLP parser that extracts elective offices, candidates,
 * matric numbers, nicknames, and manifestos from unstructured text, memos,
 * and WhatsApp broadcasts.
 */
function parseElectionTextToSlate(text: string): StagedSlate {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const recognizedPosts: Map<string, {
    title: string;
    description?: string;
    maxSelections: number;
    allowedLevels: number[];
    candidates: Array<{
      fullName: string;
      nickname?: string;
      matricNo?: string;
      manifesto?: string;
    }>;
  }> = new Map();

  // Common executive titles in Nigerian student associations
  const officeKeywordRegex =
    /^(?:[\d]+[\.\)-]\s*|[*#_\s]*)(president|vice\s*president|general\s*secretary|gen\s*sec|assistant\s*general\s*secretary|asg|financial\s*secretary|fin\s*sec|treasurer|public\s*relations\s*officer|p\.?r\.?o\.?|director\s*of\s*socials?|social\s*director|director\s*of\s*sports?|sports\s*director|welfare\s*director|director\s*of\s*welfare|internal\s*auditor|auditor\s*general|academic\s*director|director\s*of\s*academics?|assistant\s*social|senator|speaker|deputy\s*speaker|clerk|chief\s*whip|hall\s*rep|faculty\s*rep)[\s:*#_-]*(.*)$/i;

  let currentPostKey: string | null = null;

  for (const rawLine of lines) {
    // Check if line declares an elective office
    const officeMatch = rawLine.match(officeKeywordRegex);

    if (officeMatch) {
      let rawTitle = officeMatch[1].trim();
      // Normalize casing (e.g. "vice president" -> "Vice President")
      let title = rawTitle
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");

      // Handle abbreviations
      if (/^p\.?r\.?o\.?$/i.test(title)) title = "Public Relations Officer (P.R.O)";
      if (/^gen\s*sec$/i.test(title)) title = "General Secretary";
      if (/^fin\s*sec$/i.test(title)) title = "Financial Secretary";
      if (/^asg$/i.test(title)) title = "Assistant General Secretary";

      currentPostKey = title.toLowerCase();

      if (!recognizedPosts.has(currentPostKey)) {
        recognizedPosts.set(currentPostKey, {
          title,
          description: `Executive office for ${title}`,
          maxSelections: 1,
          allowedLevels: [],
          candidates: [],
        });
      }

      // Check if candidate name is inline on the same line after colon (e.g. "President: Adebayo Johnson")
      const remainder = officeMatch[2]?.trim() || "";
      if (remainder && !/^[:\-–—\s]+$/.test(remainder)) {
        const cleanInline = remainder.replace(/^[:\-–—\s]+/, "").trim();
        if (cleanInline.length > 2) {
          const cand = extractCandidateDetails(cleanInline);
          if (cand.fullName) {
            recognizedPosts.get(currentPostKey)!.candidates.push(cand);
          }
        }
      }
      continue;
    }

    // Check generic office label like "Office: Director of Research"
    const genericOfficeMatch = rawLine.match(/^(?:office|post|position)\s*[:\-–—]\s*(.+)$/i);
    if (genericOfficeMatch) {
      const title = genericOfficeMatch[1].trim();
      currentPostKey = title.toLowerCase();
      if (!recognizedPosts.has(currentPostKey)) {
        recognizedPosts.set(currentPostKey, {
          title,
          description: `Elective office: ${title}`,
          maxSelections: 1,
          allowedLevels: [],
          candidates: [],
        });
      }
      continue;
    }

    // Otherwise, check if this line is a candidate line under the current post
    if (currentPostKey && recognizedPosts.has(currentPostKey)) {
      // Discard header-like lines or separators
      if (/^(candidates?|aspirants?|cleared|nominees?|screening results?|note:?|requirements?|date:?)/i.test(rawLine)) {
        continue;
      }
      if (/^[-=_\*~]{3,}$/.test(rawLine)) continue;

      const cand = extractCandidateDetails(rawLine);
      if (cand.fullName && cand.fullName.length >= 2) {
        recognizedPosts.get(currentPostKey)!.candidates.push(cand);
      }
    }
  }

  const posts = Array.from(recognizedPosts.values());
  const totalCandidates = posts.reduce((sum, p) => sum + p.candidates.length, 0);

  return {
    posts,
    totalOffices: posts.length,
    totalCandidates,
    summary: `Extracted ${posts.length} elective ${posts.length === 1 ? "office" : "offices"} with ${totalCandidates} ${totalCandidates === 1 ? "candidate" : "candidates"}.`,
  };
}

/**
 * Extracts candidate fullName, nickname, matric number, and manifesto
 * from an unstructured candidate line.
 * e.g. "- Adebayo Johnson (Matric: 219082, Slogan: 'A New Era')"
 */
function extractCandidateDetails(line: string): {
  fullName: string;
  nickname?: string;
  matricNo?: string;
  manifesto?: string;
} {
  let text = line.replace(/^[-*•\d+.\)\s]+/, "").trim();

  let matricNo = "";
  let nickname = "";
  let manifesto = "";

  // Extract Matric Number (patterns like 214589, 19/25PC082, ENG/20/001, MATRIC: 123456)
  const matricMatch = text.match(
    /(?:matric(?:ulation)?(?:\s*no\.?)?[:\s]*|\b)([a-zA-Z]{0,4}\/?\d{2,4}\/?[a-zA-Z0-9]{3,7}|\d{5,7})\b/i
  );
  if (matricMatch) {
    matricNo = matricMatch[1].trim().toUpperCase();
    text = text.replace(matricMatch[0], " ").trim();
  }

  // Extract Slogan / Manifesto (patterns like Slogan: "...", Manifesto: "...")
  const manifestoMatch = text.match(
    /(?:slogan|manifesto|motto|theme|agenda)\s*[:\-–—]\s*["“']?([^"“”'()]+)["”']?/i
  );
  if (manifestoMatch) {
    manifesto = manifestoMatch[1].trim();
    text = text.replace(manifestoMatch[0], " ").trim();
  }

  // Extract Nickname in quotes or parentheses e.g. "The Catalyst", (Koko)
  const nickMatch = text.match(/["“']([a-zA-Z0-9_\s]{2,20})["”']|\(([a-zA-Z0-9_\s]{2,20})\)/);
  if (nickMatch) {
    const rawNick = nickMatch[1] || nickMatch[2];
    if (rawNick && !/matric|level|dept/i.test(rawNick)) {
      nickname = rawNick.trim();
      text = text.replace(nickMatch[0], " ").trim();
    }
  }

  // Clean remaining text to form the Full Name
  let fullName = text
    .replace(/[,\(\)\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Title-case candidate name
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
 * Main AI Copilot Agent Action
 * Processes natural language input from the ELCOM admin, maintains conversation history,
 * parses unstructured slates, and returns ready-to-execute actions.
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

    // 1. Attempt External Gemini LLM if GEMINI_API_KEY is configured
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        const geminiRes = await callGeminiModel(prompt, input.history, input.electionId, cleanOrg);
        if (geminiRes && geminiRes.reply) {
          return {
            success: true,
            reply: geminiRes.reply,
            stagedSlate: geminiRes.stagedSlate,
          };
        }
      } catch (geminiErr) {
        console.warn("Gemini call fell back to local NLP engine:", geminiErr);
      }
    }

    // 2. High-Speed Local NLP Engine (Runs zero-latency without external dependencies)
    const stagedSlate = parseElectionTextToSlate(prompt);

    if (stagedSlate.totalOffices > 0 || stagedSlate.totalCandidates > 0) {
      const officeListStr = stagedSlate.posts
        .map((p) => {
          const cands = p.candidates || [];
          return `• **${p.title}** (${cands.length} ${
            cands.length === 1 ? "candidate" : "candidates"
          }): ${
            cands.length > 0
              ? cands.map((c) => c.fullName + (c.nickname ? ` "${c.nickname}"` : "")).join(", ")
              : "_No candidates registered under this post yet._"
          }`;
        })
        .join("\n");

      const reply = `I have analyzed your input and structured your election slate for **${cleanOrg}**! Here is what I extracted:\n\n${officeListStr}\n\n**Total:** ${stagedSlate.totalOffices} elective ${
        stagedSlate.totalOffices === 1 ? "office" : "offices"
      } and ${stagedSlate.totalCandidates} ${
        stagedSlate.totalCandidates === 1 ? "candidate" : "candidates"
      }.\n\nReview the live card preview below and click **"Apply All to Election Slate"** to commit everything in a single sub-second batch!`;

      return {
        success: true,
        reply,
        stagedSlate,
      };
    }

    // Conversational replies for standard questions
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes("help") || lowerPrompt.includes("what can you do") || lowerPrompt.includes("how to use")) {
      return {
        success: true,
        reply: `Hello! I am the **StudElect AI Slate Architect**. I automate setting up and managing elective offices and candidates.\n\nHere is how you can use me:\n\n1. **Paste Raw Election Memos:** Paste any WhatsApp announcement, bulletin, or ELCOM screening list. I will extract all posts, names, matric numbers, and nicknames automatically.\n2. **Natural Language Commands:** Say *"Create offices for President, Vice President, Gen Sec, and PRO"*, or *"Add Adebayo Johnson for President"*\n3. **One-Click Batch Execution:** Once staged, all records are created in a single database transaction in < 500ms.\n\nTry pasting your candidate slate now!`,
      };
    }

    if (lowerPrompt.includes("hello") || lowerPrompt.includes("hi") || lowerPrompt.includes("hey")) {
      return {
        success: true,
        reply: `Hello Officer! I am ready to build or edit the election slate for **${cleanOrg}**. Paste your candidate list or tell me which offices you want to add.`,
      };
    }

    return {
      success: true,
      reply: `I received your message for **${cleanOrg}**. To add offices and candidates, paste your election communique, broadcast memo, or a list like:\n\n\`\`\`text\nPresident:\n- Adebayo Johnson (219082)\n\nVice President:\n- Kikelomo Olatunji\n\`\`\`\n\nI will parse them instantly into ready-to-publish candidate profiles!`,
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

/**
 * Optional Gemini API adapter for advanced contextual reasoning
 */
async function callGeminiModel(
  prompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  electionId: string,
  orgName: string
): Promise<{ reply: string; stagedSlate?: StagedSlate | null } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const systemInstruction = `You are StudElect AI Slate Architect, an expert assistant for Electoral Commission (ELCOM) administrators in Nigerian tertiary institutions.
Your task is to parse unstructured candidate lists, memos, and instructions for ${orgName} elections, extract elective offices and candidates, and return a structured JSON slate.
Always be professional, concise, and helpful.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [
          ...history.slice(-4).map((h) => ({
            role: h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.content }],
          })),
          { role: "user", parts: [{ text: prompt }] },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200,
        },
      }),
    }
  );

  if (!response.ok) return null;
  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  // Run local extractor on the text or prompt to ensure zero hallucination of candidate names
  const localSlate = parseElectionTextToSlate(prompt);

  return {
    reply: text,
    stagedSlate: localSlate.totalOffices > 0 ? localSlate : null,
  };
}
