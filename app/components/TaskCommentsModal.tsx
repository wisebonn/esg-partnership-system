"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/utils/supabase";
import { X, Loader2, Send, AlertTriangle } from "lucide-react";

type Comment = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { full_name: string | null };
};

type Props = {
  taskId: string;
  taskTitle: string;
  currentUserId: string;
  onClose: () => void;
};

export default function TaskCommentsModal({ taskId, taskTitle, currentUserId, onClose }: Props) {
  const supabase = createClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const fetchComments = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("task_comments")
      .select(`
        id, task_id, user_id, content, created_at,
        profile:profiles(full_name)
      `)
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (err) {
      setError(err.message);
    } else {
      setComments((data as unknown as Comment[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const handleSend = async (e: React.FormEvent, isHelpRequest: boolean = false) => {
    e.preventDefault();
    if (!input.trim() && !isHelpRequest) return;
    
    setSending(true);
    setError(null);
    
    const content = isHelpRequest ? `[HELP REQUESTED] ${input.trim()}` : input.trim();
    
    const { error: insErr } = await supabase.from("task_comments").insert({
      task_id: taskId,
      user_id: currentUserId,
      content: content,
    });

    if (insErr) {
      setError(insErr.message);
      setSending(false);
      return;
    }

    if (isHelpRequest) {
      // Optionally mark the task as blocked when help is requested
      await supabase.from("tasks").update({ status: "Blocked" }).eq("id", taskId);
    }

    setInput("");
    setSending(false);
    fetchComments();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Comments</h2>
            <p className="text-sm text-slate-400 mt-1 line-clamp-1">{taskTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/50">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-blue-500" size={24} />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-10">No comments yet. Start the conversation.</p>
          ) : (
            comments.map((c) => {
              const isMe = c.user_id === currentUserId;
              const isHelp = c.content.startsWith("[HELP REQUESTED]");
              const displayContent = isHelp ? c.content.replace("[HELP REQUESTED] ", "") : c.content;

              return (
                <div key={c.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[80%] p-3 rounded-xl text-sm ${
                    isHelp ? "bg-red-500/20 border border-red-500/50 text-red-200" :
                    isMe ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-200"
                  }`}>
                    {isHelp && (
                      <div className="flex items-center gap-1 text-red-400 font-bold mb-1 text-xs">
                        <AlertTriangle size={12} /> HELP REQUESTED
                      </div>
                    )}
                    {displayContent}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">
                    {isMe ? "You" : (c.profile?.full_name ?? "Unknown")} • {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {error && (
          <div className="px-6 py-2 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <form onSubmit={(e) => handleSend(e, false)} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:border-blue-500 text-sm"
            />
            <button
              type="button"
              onClick={(e) => handleSend(e, true)}
              disabled={sending}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1"
              title="Request Help (Marks task as Blocked)"
            >
              <AlertTriangle size={16} /> Request Help
            </button>
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}