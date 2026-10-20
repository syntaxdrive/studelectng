"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  X,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Layers,
  Users,
  ArrowRight,
  Bot,
  User,
  ClipboardPaste,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
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
  "📋 Paste WhatsApp election memo",
  "🏛️ Create Executive Slate (President, VP, Gen Sec, PRO)",
  "👤 Add candidates for President and VP",
  "💡 How do I use this AI model?",
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
      content: `Hello! I am your **StudElect AI Slate Architect** for **${orgSlug.toUpperCase()}**.\n\nYou can talk to me naturally, paste raw WhatsApp election broadcasts, or give me a list of offices and candidates. I will extract everything into structured ballots and let you apply them to your live election in **one click**.\n\nTry pasting a candidate list or clicking one of the suggestions below!`,
      timestamp: Date.now(),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeStagedSlate, setActiveStagedSlate] = useState<StagedSlate | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
      scrollToBottom();
    }
  }, [isOpen, messages]);

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
    setAppliedSuccess(null);

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
        if (res.stagedSlate && res.stagedSlate.totalOffices > 0) {
          setActiveStagedSlate(res.stagedSlate);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: res.reply || "Sorry, I encountered an issue parsing your request. Please try again.",
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
          content: "Network error occurred while connecting to the AI model. Please verify your connection.",
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

  const handleQuickPrompt = (promptText: string) => {
    if (promptText.includes("WhatsApp")) {
      setInputPrompt(
        `NESA UI 2026 GENERAL ELECTIONS ASPIRANTS\n\n1. PRESIDENT\n- Adewale Ayomide (219082) - "Progress & Prosperity"\n- Chisom Okeke (218944) - "A New Dawn"\n\n2. VICE PRESIDENT\n- Kikelomo Olatunji (220193)\n\n3. GENERAL SECRETARY\n- Babatunde Adeleke (221004)\n\n4. PUBLIC RELATIONS OFFICER\n- Mary Rhoda (223401)`
      );
      textareaRef.current?.focus();
      return;
    }
    if (promptText.includes("Executive Slate")) {
      handleSendMessage("Create elective offices for President, Vice President, General Secretary, and Public Relations Officer.");
      return;
    }
    if (promptText.includes("Add candidates")) {
      setInputPrompt("Add Adebayo Johnson for President, and Kikelomo Olatunji for Vice President.");
      textareaRef.current?.focus();
      return;
    }
    if (promptText.includes("How do I use")) {
      handleSendMessage("What can you do and how do I format my input?");
      return;
    }
    handleSendMessage(promptText);
  };

  const handleApplyStagedSlate = async () => {
    if (!activeStagedSlate || isApplying) return;

    setIsApplying(true);
    try {
      const res = await executeAiSlateAction({
        electionId,
        stagedSlate: activeStagedSlate,
      });

      if (res.success) {
        setAppliedSuccess(res.message);
        onSlateApplied(activeStagedSlate.posts);
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: "assistant",
            content: `✅ **Success!** ${res.message}\n\nAll elective offices and candidates are now live on your election ballot and student voting booths.`,
            timestamp: Date.now(),
            executed: true,
          },
        ]);
        setActiveStagedSlate(null);
      } else {
        alert(res.message || "Failed to commit slate.");
      }
    } catch (err: any) {
      alert("Error applying slate: " + (err.message || String(err)));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div
        className={`bg-zinc-950 text-zinc-100 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullScreen
            ? "w-full h-full rounded-none"
            : "w-full max-w-6xl h-[90vh] max-h-[850px]"
        }`}
      >
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-zinc-900/80 border-b border-zinc-800/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 text-zinc-950 flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-zinc-100 tracking-tight">
                  StudElect AI Slate Architect
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {orgSlug.toUpperCase()}
                </span>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-emerald-400 bg-emerald-950/60 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Model
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Conversational election builder • NLP memo extraction • Instant batch execution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-zinc-400">
            <button
              type="button"
              onClick={() => setIsFullScreen((prev) => !prev)}
              className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 transition"
              title={isFullScreen ? "Exit Fullscreen" : "Fullscreen Chat"}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 transition"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Body: Two Columns (Chat on Left, Live Slate Staging on Right) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Chat Column (7 cols on large screens) */}
          <div className="lg:col-span-7 flex flex-col h-full border-r border-zinc-800/80 bg-zinc-950">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs font-sans">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-3xl ${
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs ${
                      msg.role === "user"
                        ? "bg-zinc-800 text-zinc-200 font-bold"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-3 leading-relaxed ${
                      msg.role === "user"
                        ? "bg-zinc-800 text-zinc-100 rounded-tr-xs"
                        : "bg-zinc-900/90 text-zinc-200 border border-zinc-800/80 rounded-tl-xs"
                    }`}
                  >
                    <div className="whitespace-pre-wrap space-y-1.5">
                      {msg.content}
                    </div>

                    {/* Staged Slate Preview Pill inside Chat */}
                    {msg.stagedSlate && !msg.executed && (
                      <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" />
                          <span>
                            {msg.stagedSlate.totalOffices} Offices • {msg.stagedSlate.totalCandidates} Candidates Staged
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveStagedSlate(msg.stagedSlate!)}
                          className="px-2.5 py-1 rounded bg-amber-500 text-zinc-950 font-bold text-[11px] hover:bg-amber-400 transition"
                        >
                          View & Apply
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 max-w-xl mr-auto">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                  </div>
                  <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl rounded-tl-xs px-4 py-3 flex items-center gap-2 text-zinc-400 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Analyzing input and structuring elective slate...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div className="px-4 py-2 bg-zinc-900/40 border-t border-zinc-800/60 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
              <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-mono font-bold flex-shrink-0">
                Suggestions:
              </span>
              {QUICK_PROMPTS.map((promptText, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleQuickPrompt(promptText)}
                  className="px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 whitespace-nowrap transition text-[11px] flex items-center gap-1"
                >
                  {promptText}
                </button>
              ))}
            </div>

            {/* Input Box Area */}
            <div className="p-3 sm:p-4 bg-zinc-900/80 border-t border-zinc-800/80 flex items-end gap-2 flex-shrink-0">
              <div className="flex-1 bg-zinc-950 rounded-xl border border-zinc-800 focus-within:border-amber-500/70 focus-within:ring-1 focus-within:ring-amber-500/50 transition">
                <textarea
                  ref={textareaRef}
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Paste WhatsApp election memo, type candidate names, or ask to create offices..."
                  rows={2}
                  className="w-full bg-transparent p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none"
                />
              </div>

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputPrompt.trim()}
                className="p-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-zinc-950 font-bold transition flex items-center justify-center flex-shrink-0 shadow-xs"
                title="Send message (Enter)"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Live Slate Staging & Action Panel (5 cols on large screens) */}
          <div className="lg:col-span-5 flex flex-col h-full bg-zinc-900/40 overflow-hidden">
            <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between flex-shrink-0 bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-200">
                  Live Slate Staging Area
                </h4>
              </div>
              {activeStagedSlate && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  {activeStagedSlate.totalOffices} Offices • {activeStagedSlate.totalCandidates} Candidates
                </span>
              )}
            </div>

            {/* Slate Content Display */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
              {appliedSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Election Slate Synchronized!</span>
                  </div>
                  <p className="text-[11px] text-emerald-400/90 leading-relaxed">
                    {appliedSuccess}
                  </p>
                </div>
              )}

              {activeStagedSlate ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                    <span>Ready for instant database commit</span>
                    <button
                      type="button"
                      onClick={() => setActiveStagedSlate(null)}
                      className="text-zinc-500 hover:text-zinc-300 transition"
                      title="Clear staged preview"
                    >
                      Clear Preview
                    </button>
                  </div>

                  {activeStagedSlate.posts.map((post, pIdx) => (
                    <div
                      key={pIdx}
                      className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[10px] flex items-center justify-center font-bold">
                            {pIdx + 1}
                          </span>
                          <span className="font-bold text-sm text-zinc-100">
                            {post.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">
                          Max: {post.maxSelections || 1}
                        </span>
                      </div>

                      {/* Candidates List under Post */}
                      <div className="space-y-2">
                        {post.candidates && post.candidates.length > 0 ? (
                          post.candidates.map((cand, cIdx) => (
                            <div
                              key={cIdx}
                              className="p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800/80 flex items-start gap-2.5"
                            >
                              <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-amber-300 flex-shrink-0">
                                {cand.fullName.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <p className="font-bold text-zinc-100 truncate text-xs">
                                  {cand.fullName}
                                  {cand.nickname && (
                                    <span className="text-amber-400 font-normal ml-1">
                                      "{cand.nickname}"
                                    </span>
                                  )}
                                </p>
                                {cand.matricNo && (
                                  <p className="font-mono text-[10px] text-zinc-400">
                                    Matric: {cand.matricNo}
                                  </p>
                                )}
                                {cand.manifesto && (
                                  <p className="text-[10px] text-zinc-500 italic line-clamp-1">
                                    "{cand.manifesto}"
                                  </p>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-[11px] text-zinc-500 italic py-1">
                            No candidates listed under this office yet.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center space-y-3 rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-950/40 my-auto">
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-amber-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-sm text-zinc-200">
                      No Staged Slate Yet
                    </h5>
                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                      Paste a candidate list or type instructions in the chat on the left. The AI will extract the slate and display it here for one-click publishing.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Apply Bar */}
            {activeStagedSlate && (
              <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-zinc-100">
                    Ready to Publish
                  </span>
                  <p className="text-[11px] text-zinc-400">
                    {activeStagedSlate.totalOffices} offices • {activeStagedSlate.totalCandidates} candidates
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleApplyStagedSlate}
                  disabled={isApplying}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Writing to Database...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Apply All to Election Slate</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
