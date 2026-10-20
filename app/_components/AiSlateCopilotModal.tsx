"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp,
  User,
  Bot,
  AlertCircle,
  ClipboardPaste,
  ShieldCheck,
  Check,
} from "lucide-react";
import {
  processAiCopilotMessageAction,
  executeAiSlateAction,
  AiChatMessage,
  StagedSlate,
} from "@/app/actions/ai-copilot";

interface AiSlateCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  electionId: string;
  orgSlug: string;
  instSlug: string;
  currentPostsCount: number;
  onSlateApplied: (newPosts: any[]) => void;
}

const QUICK_PROMPTS = [
  { label: "📋 Paste WhatsApp Memo", text: "PASTE_SAMPLE" },
  { label: "🏛️ Executive Slate (Pres, VP, Gen Sec, PRO)", text: "Create elective offices for President, Vice President, General Secretary, and Public Relations Officer." },
  { label: "👤 Add Aspirants for President & VP", text: "Add Adebayo Johnson (219082) as President, and Kikelomo Olatunji (220193) as Vice President." },
  { label: "💡 How does this work?", text: "What can you do and what format should I paste?" },
];

export function AiSlateCopilotModal({
  isOpen,
  onClose,
  electionId,
  orgSlug,
  instSlug,
  currentPostsCount,
  onSlateApplied,
}: AiSlateCopilotModalProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: "msg-welcome",
      role: "assistant",
      content: `Hello! I am your **StudElect AI Slate Architect** for **${orgSlug.toUpperCase()}**.\n\nYou can talk to me naturally, paste raw WhatsApp election broadcasts, or give me a list of offices and candidates. I will extract all data and let you commit it to your live election ballot in **one tap**.\n\nTry pasting your candidate memo or tapping one of the quick suggestions below!`,
      timestamp: Date.now(),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [applyingSlateId, setApplyingSlateId] = useState<string | null>(null);
  const [expandedOfficeMap, setExpandedOfficeMap] = useState<Record<string, boolean>>({});

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Lock background body scroll completely while open to prevent screen movement
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => textareaRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    const userMessage: AiChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt("");
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await processAiCopilotMessageAction({
        prompt: text,
        history,
        electionId,
        orgSlug,
        instSlug,
        currentPostsCount,
      });

      if (res.success) {
        const assistantMsg: AiChatMessage = {
          id: `ast-${Date.now()}`,
          role: "assistant",
          content: res.reply,
          timestamp: Date.now(),
          stagedSlate: res.stagedSlate,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: res.reply || "Sorry, I could not parse your request. Please check formatting and try again.",
            timestamp: Date.now(),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "A connection error occurred while communicating with the AI service. Please verify your network.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickPromptClick = (promptObj: { label: string; text: string }) => {
    if (promptObj.text === "PASTE_SAMPLE") {
      setInputPrompt(
        `NESA UI 2026/2027 GENERAL ELECTIONS ASPIRANTS\n\n1. PRESIDENT\n- Adewale Ayomide (Matric: 219082) - "Progress & Prosperity"\n- Chisom Okeke (Matric: 218944) - "A New Dawn"\n\n2. VICE PRESIDENT\n- Kikelomo Olatunji (Matric: 220193)\n\n3. GENERAL SECRETARY\n- Babatunde Adeleke (Matric: 221004)\n\n4. PUBLIC RELATIONS OFFICER\n- Mary Rhoda (Matric: 223401)`
      );
      textareaRef.current?.focus();
      return;
    }
    handleSendMessage(promptObj.text);
  };

  const handleApplySlate = async (messageId: string, slate: StagedSlate) => {
    if (applyingSlateId) return;
    setApplyingSlateId(messageId);

    try {
      const res = await executeAiSlateAction({
        electionId,
        stagedSlate: slate,
      });

      if (res.success) {
        onSlateApplied(slate.posts);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, executed: true }
              : m
          )
        );
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: "assistant",
            content: `🎉 **Successfully Published!** ${res.message}\n\nAll ${slate.totalOffices} elective offices and ${slate.totalCandidates} candidate profiles are now live in the database and visible to students in the voting booth.`,
            timestamp: Date.now(),
          },
        ]);
      } else {
        alert(res.message || "Failed to commit slate to database.");
      }
    } catch (err: any) {
      alert("Error committing election slate: " + (err.message || String(err)));
    } finally {
      setApplyingSlateId(null);
    }
  };

  const handleResetChat = () => {
    if (!confirm("Clear conversation history?")) return;
    setMessages([
      {
        id: "msg-welcome-reset",
        role: "assistant",
        content: `Conversation cleared. I am ready for new election instructions or candidate memos for **${orgSlug.toUpperCase()}**.`,
        timestamp: Date.now(),
      },
    ]);
  };

  const toggleOfficeExpand = (officeKey: string) => {
    setExpandedOfficeMap((prev) => ({
      ...prev,
      [officeKey]: !prev[officeKey],
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] w-full h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden animate-in fade-in duration-150 select-none md:select-auto">
      {/* ── Mobile App Navigation Header ─────────────────────────────────── */}
      <header className="flex-shrink-0 h-14 bg-zinc-900 border-b border-zinc-800 px-3 sm:px-4 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition flex items-center gap-1.5"
            title="Return to ELCOM Admin"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-200" />
            <span className="text-xs font-semibold hidden sm:inline text-zinc-300">
              Exit
            </span>
          </button>

          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-zinc-950 flex items-center justify-center font-bold shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-zinc-100 tracking-tight leading-none">
                AI Slate Architect
              </h2>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {orgSlug.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-zinc-400 font-mono">
                Conversational Model Active
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleResetChat}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="Clear Chat History"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main Chat Stream (Isolated Scroll Area) ────────────────────────── */}
      <main
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-4 max-w-4xl w-full mx-auto"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 sm:gap-3 max-w-2xl ${
              msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs shadow-xs ${
                msg.role === "user"
                  ? "bg-zinc-800 text-zinc-100 font-bold border border-zinc-700"
                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
              }`}
            >
              {msg.role === "user" ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            {/* Bubble Content */}
            <div
              className={`rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs leading-relaxed space-y-2.5 ${
                msg.role === "user"
                  ? "bg-amber-500 text-zinc-950 font-medium rounded-tr-xs shadow-xs"
                  : "bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-tl-xs shadow-sm"
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>

              {/* ── Interactive Staged Slate Card (In-Stream) ────────────────── */}
              {msg.stagedSlate && msg.stagedSlate.totalOffices > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between text-zinc-400 font-mono text-[11px]">
                    <span className="flex items-center gap-1.5 font-bold text-amber-300">
                      <Layers className="w-3.5 h-3.5" />
                      <span>
                        {msg.stagedSlate.totalOffices} Offices • {msg.stagedSlate.totalCandidates} Candidates
                      </span>
                    </span>
                    {msg.executed ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Live on Ballot</span>
                      </span>
                    ) : (
                      <span className="text-amber-400/90 text-[10px]">Staged for Commit</span>
                    )}
                  </div>

                  {/* Offices & Candidates Breakdown */}
                  <div className="space-y-2 bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/80">
                    {msg.stagedSlate.posts.map((post, pIdx) => {
                      const officeKey = `${msg.id}-p-${pIdx}`;
                      const isExpanded = expandedOfficeMap[officeKey] !== false; // expanded by default
                      const cands = post.candidates || [];

                      return (
                        <div
                          key={pIdx}
                          className="rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden"
                        >
                          {/* Office Header */}
                          <button
                            type="button"
                            onClick={() => toggleOfficeExpand(officeKey)}
                            className="w-full px-3 py-2 bg-zinc-900/90 hover:bg-zinc-800/80 transition flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-4 h-4 rounded bg-zinc-800 text-amber-300 font-mono text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                                {pIdx + 1}
                              </span>
                              <span className="font-bold text-xs text-zinc-100 truncate">
                                {post.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] font-mono text-zinc-400">
                                {cands.length} {cands.length === 1 ? "cand" : "cands"}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                              )}
                            </div>
                          </button>

                          {/* Candidates List under this office */}
                          {isExpanded && (
                            <div className="p-2 space-y-1.5 border-t border-zinc-800/60 bg-zinc-950/40">
                              {cands.length > 0 ? (
                                cands.map((cand, cIdx) => (
                                  <div
                                    key={cIdx}
                                    className="p-2 rounded-md bg-zinc-900/60 border border-zinc-800 flex items-start gap-2"
                                  >
                                    <div className="w-6 h-6 rounded bg-zinc-800 text-amber-400 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                                      {cand.fullName.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-zinc-100 text-[11px]">
                                          {cand.fullName}
                                        </span>
                                        {cand.nickname && (
                                          <span className="text-amber-400 text-[10px] font-medium">
                                            "{cand.nickname}"
                                          </span>
                                        )}
                                        {cand.matricNo && (
                                          <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-300">
                                            {cand.matricNo}
                                          </span>
                                        )}
                                      </div>
                                      {cand.manifesto && (
                                        <p className="text-[10px] text-zinc-400 italic truncate">
                                          "{cand.manifesto}"
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-[10px] text-zinc-500 italic px-1 py-0.5">
                                  No candidates listed under this office.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Apply All Button */}
                  {!msg.executed ? (
                    <button
                      type="button"
                      disabled={applyingSlateId === msg.id}
                      onClick={() => handleApplySlate(msg.id, msg.stagedSlate!)}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] text-zinc-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                    >
                      {applyingSlateId === msg.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Publishing to Supabase Cloud & Local Booths...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-zinc-950" />
                          <span>⚡ Apply All to Live Election Slate</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Successfully Applied to Slate!</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400/80">
                        Live on Ballot
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="flex gap-2.5 max-w-xl mr-auto">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-xs px-4 py-3 flex items-center gap-2 text-zinc-400 text-xs shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Extracting elective offices and candidates...</span>
            </div>
          </div>
        )}
      </main>

      {/* ── Quick Action Suggestion Chips ─────────────────────────────────── */}
      <div className="flex-shrink-0 bg-zinc-950/90 border-t border-zinc-900 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {QUICK_PROMPTS.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleQuickPromptClick(q)}
            className="flex-shrink-0 px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] font-medium active:scale-95 transition"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* ── Bottom App Input Bar ─────────────────────────────────────────── */}
      <footer className="flex-shrink-0 bg-zinc-900 border-t border-zinc-800 p-2.5 sm:p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-4xl mx-auto flex items-end gap-2">
          <div className="flex-1 bg-zinc-950 rounded-2xl border border-zinc-800 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition overflow-hidden">
            <textarea
              ref={textareaRef}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste WhatsApp memo, candidate list, or type instructions..."
              rows={1}
              className="w-full bg-transparent p-3 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none max-h-32"
            />
          </div>

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputPrompt.trim()}
            className="h-11 w-11 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500 text-zinc-950 font-bold transition flex items-center justify-center flex-shrink-0 shadow-md active:scale-95"
            title="Send (Enter)"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
