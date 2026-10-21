"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  X,
  Plus,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp,
  User,
  Menu,
  ShieldCheck,
  Check,
  Wifi,
  Battery,
  Signal,
  ArrowRight,
  ClipboardPaste,
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

const TEMPLATE_PROMPTS = [
  {
    title: "Paste WhatsApp Memo",
    subtitle: "Extract candidate list from communiqué",
    text: `NESA UI 2026/2027 GENERAL ELECTIONS ASPIRANTS\n\n1. PRESIDENT\n- Adewale Ayomide (Matric: 219082) - "Progress & Prosperity"\n- Chisom Okeke (Matric: 218944) - "A New Dawn"\n\n2. VICE PRESIDENT\n- Kikelomo Olatunji (Matric: 220193)\n\n3. GENERAL SECRETARY\n- Babatunde Adeleke (Matric: 221004)\n\n4. PUBLIC RELATIONS OFFICER\n- Mary Rhoda (Matric: 223401)`,
  },
  {
    title: "Create Executive Offices",
    subtitle: "President, VP, Gen Sec, PRO",
    text: "Create elective offices for President, Vice President, General Secretary, and Public Relations Officer.",
  },
  {
    title: "Assign Candidates",
    subtitle: "Adebayo for President, Kikelomo for VP",
    text: "Add Adebayo Johnson (219082) as President, and Kikelomo Olatunji (220193) as Vice President.",
  },
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
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"Quantum 3" | "StudElect 3.8">("Quantum 3");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [applyingSlateId, setApplyingSlateId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState("9:41");
  const [greeting, setGreeting] = useState("Good Morning");

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Determine dynamic greeting based on hour
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    const now = new Date();
    setCurrentTime(
      now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false })
    );
  }, [isOpen]);

  // Lock background body scroll completely while open to prevent screen movement
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => textareaRef.current?.focus(), 150);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Isolated scroll down strictly when messages update
  useEffect(() => {
    if (isOpen && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
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
    setIsPlusMenuOpen(false);
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
        model: selectedModel,
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
          prev.map((m) => (m.id === messageId ? { ...m, executed: true } : m))
        );
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: "assistant",
            content: `🎉 **Election Slate Published!** ${res.message}\n\nAll ${slate.totalOffices} elective offices and ${slate.totalCandidates} candidates are live in Supabase and active on student voting booths.`,
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

  const handleResetSession = () => {
    setMessages([]);
    setInputPrompt("");
    setIsPlusMenuOpen(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-900/70 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* ── Mobile Phone Canvas Container ────────────────────────────────── */}
      <div className="w-full sm:max-w-[420px] h-[100dvh] sm:h-[94vh] sm:max-h-[850px] bg-[#fbfbfb] text-zinc-900 sm:rounded-[44px] shadow-2xl sm:border-[8px] sm:border-zinc-900 flex flex-col relative overflow-hidden select-none sm:select-auto">
        
        {/* Phone Speaker Notch (Desktop Shell) */}
        <div className="hidden sm:block absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-zinc-900 rounded-full z-30" />

        {/* ── Top Phone Status Bar (9:41, Signal, Wifi, Battery) ───────────── */}
        <div className="flex-shrink-0 pt-2 px-6 h-8 flex items-center justify-between text-xs font-semibold text-zinc-800 z-20">
          <span className="font-mono text-[11px] tracking-tight">{currentTime}</span>
          <div className="flex items-center gap-1.5 text-zinc-700">
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <Battery className="w-4 h-4 fill-zinc-800" />
          </div>
        </div>

        {/* ── Mobile App Navigation Bar ───────────────────────────────────── */}
        <header className="flex-shrink-0 px-4 py-2 flex items-center justify-between z-20">
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-1 rounded-full hover:bg-zinc-200/70 active:scale-95 transition text-zinc-700"
            title="Close Assistant"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Center Pill Badge */}
          <div className="px-3.5 py-1 rounded-full bg-zinc-100 border border-zinc-200/80 text-[11px] font-medium text-zinc-600 flex items-center gap-1.5 shadow-2xs">
            <span className="font-semibold text-zinc-800">{orgSlug.toUpperCase()} ELCOM</span>
            <span className="text-zinc-400">•</span>
            <span className="text-zinc-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Groq LLM Active
            </span>
          </div>

          <button
            type="button"
            onClick={handleResetSession}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/80 flex items-center justify-center text-zinc-700 active:scale-95 transition"
            title="Start New Session"
          >
            <User className="w-4 h-4" />
          </button>
        </header>

        {/* ── Main Conversation Stream / Hero View ─────────────────────────── */}
        <main
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4 text-xs font-sans"
        >
          {/* Initial Greeting Screen when no messages */}
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 -mt-6 space-y-4">
              {/* StudElect Folded Origami Logo Mark */}
              <div className="w-14 h-14 relative flex items-center justify-center">
                <svg
                  viewBox="0 0 100 100"
                  className="w-12 h-12 text-zinc-950 fill-current drop-shadow-sm"
                >
                  <path d="M20 20 L50 20 L40 50 L10 50 Z" opacity="0.9" />
                  <path d="M50 20 L80 20 L90 50 L60 50 Z" />
                  <path d="M40 50 L70 50 L60 80 L30 80 Z" opacity="0.8" />
                  <path d="M60 50 L90 50 L80 80 L50 80 Z" opacity="0.95" />
                </svg>
              </div>

              {/* Elegant Greeting Headline */}
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-serif text-zinc-900 tracking-tight">
                  {greeting}, Commissioner
                </h1>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  How can I help you configure the {orgSlug.toUpperCase()} elections today?
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {msg.role === "user" ? (
                    /* User Speech Bubble: Soft rounded pill on right */
                    <div className="bg-zinc-100 text-zinc-900 px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs sm:text-[13px] font-medium leading-relaxed max-w-[85%] shadow-2xs">
                      {msg.content}
                    </div>
                  ) : (
                    /* Assistant Response: Unboxed left-aligned typography with actionable card */
                    <div className="text-zinc-800 text-xs sm:text-[13px] leading-relaxed max-w-full space-y-3 pt-1">
                      <div className="whitespace-pre-wrap leading-relaxed text-zinc-800">
                        {msg.content}
                      </div>

                      {/* ── Interactive Staged Slate Action Card ───────────── */}
                      {msg.stagedSlate && msg.stagedSlate.totalOffices > 0 && (
                        <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-sm p-3.5 space-y-3 my-2">
                          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900">
                              <Layers className="w-3.5 h-3.5 text-zinc-700" />
                              <span>Staged Ballot Slate</span>
                            </div>
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                              {msg.stagedSlate.totalOffices} Offices • {msg.stagedSlate.totalCandidates} Candidates
                            </span>
                          </div>

                          {/* Offices & Candidates Breakdown */}
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {msg.stagedSlate.posts.map((post, pIdx) => {
                              const cands = post.candidates || [];
                              return (
                                <div
                                  key={pIdx}
                                  className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs text-zinc-900">
                                      {post.title}
                                    </span>
                                    <span className="text-[10px] font-mono text-zinc-400">
                                      Max: {post.maxSelections || 1}
                                    </span>
                                  </div>

                                  <div className="space-y-1">
                                    {cands.map((c, cIdx) => (
                                      <div
                                        key={cIdx}
                                        className="flex items-center justify-between gap-1 text-[11px] bg-white p-1.5 rounded-lg border border-zinc-200/60"
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="font-semibold text-zinc-900 truncate">
                                            {c.fullName}
                                          </span>
                                          {c.nickname && (
                                            <span className="text-amber-600 text-[10px] italic truncate">
                                              "{c.nickname}"
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          {c.matricNo && (
                                            <span className="font-mono text-[9px] px-1 rounded bg-zinc-100 text-zinc-600">
                                              {c.matricNo}
                                            </span>
                                          )}
                                          {c.isRosterVerified && (
                                            <span className="text-emerald-600 font-bold text-[9px] px-1 rounded bg-emerald-50">
                                              ✓ Verified
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* ⚡ Action Commit Button */}
                          {!msg.executed ? (
                            <button
                              type="button"
                              disabled={applyingSlateId === msg.id}
                              onClick={() => handleApplySlate(msg.id, msg.stagedSlate!)}
                              className="w-full py-2.5 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                            >
                              {applyingSlateId === msg.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Writing to Database...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>⚡ Commit to Official Ballot</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs font-semibold">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Published to Live Election Ballot</span>
                              </span>
                              <span className="text-[10px] font-mono text-emerald-600">
                                Done
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking / Parsing Animation */}
              {isLoading && (
                <div className="flex items-center gap-2 text-zinc-400 text-xs pl-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600" />
                  <span>Structuring election data & verifying voter roll...</span>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── Quick Templates Popup Menu (Triggered by + Button) ─────────────── */}
        {isPlusMenuOpen && (
          <div className="mx-4 mb-2 p-2 rounded-2xl bg-white border border-zinc-200/90 shadow-xl space-y-1 animate-in slide-in-from-bottom-2 duration-150 z-30">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Quick Action Templates
            </div>
            {TEMPLATE_PROMPTS.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputPrompt(tmpl.text);
                  setIsPlusMenuOpen(false);
                  textareaRef.current?.focus();
                }}
                className="w-full text-left p-2 rounded-xl hover:bg-zinc-50 transition flex flex-col"
              >
                <span className="font-semibold text-xs text-zinc-900">
                  {tmpl.title}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {tmpl.subtitle}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── Floating App Input Dock (Matches Reference Screenshot) ───────── */}
        <div className="flex-shrink-0 p-3 pt-0 z-20">
          <div className="bg-white rounded-3xl border border-zinc-200/90 shadow-lg p-3 space-y-2">
            {/* Input Text Area */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="How can I help you today?"
              className="w-full bg-transparent text-xs sm:text-[13px] text-zinc-900 placeholder-zinc-400 focus:outline-none resize-none max-h-24 leading-normal"
            />

            {/* Bottom Controls Row: [+] [ Model Selector ] [ Send / Wave Pill ] */}
            <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
              <div className="flex items-center gap-2">
                {/* Plus Button */}
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                    isPlusMenuOpen
                      ? "bg-zinc-950 text-white rotate-45"
                      : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                  }`}
                  title="Quick Actions & Templates"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Model Selector Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsModelDropdownOpen((prev) => !prev)}
                    className="px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-[11px] font-medium text-zinc-700 flex items-center gap-1 transition"
                  >
                    <span>{selectedModel}</span>
                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                  </button>

                  {isModelDropdownOpen && (
                    <div className="absolute bottom-8 left-0 w-44 bg-white rounded-xl border border-zinc-200 shadow-xl p-1 space-y-0.5 z-40">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModel("Quantum 3");
                          setIsModelDropdownOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 text-xs font-semibold text-zinc-800 flex items-center justify-between"
                      >
                        <span>Quantum 3</span>
                        {selectedModel === "Quantum 3" && <Check className="w-3 h-3 text-zinc-900" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModel("StudElect 3.8");
                          setIsModelDropdownOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 text-xs font-semibold text-zinc-800 flex items-center justify-between"
                      >
                        <span>StudElect 3.8</span>
                        {selectedModel === "StudElect 3.8" && <Check className="w-3 h-3 text-zinc-900" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action / Send Button (Solid Black Circular Pill with Waveform/Send) */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputPrompt.trim()}
                className="w-8 h-8 rounded-full bg-zinc-950 hover:bg-zinc-800 disabled:opacity-20 disabled:hover:bg-zinc-950 text-white flex items-center justify-center shadow-xs active:scale-95 transition"
                title="Send Message"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  /* Audio waveform / send icon as in reference image */
                  <div className="flex items-center gap-0.5">
                    <span className="w-0.5 h-2.5 bg-white rounded-full" />
                    <span className="w-0.5 h-4 bg-white rounded-full" />
                    <span className="w-0.5 h-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Bottom Phone Home Indicator Bar ──────────────────────────────── */}
        <div className="flex-shrink-0 py-1.5 flex justify-center">
          <div className="w-32 h-1 bg-zinc-900/30 rounded-full" />
        </div>
      </div>
    </div>
  );
}
