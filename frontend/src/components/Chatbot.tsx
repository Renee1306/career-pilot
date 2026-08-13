import { useState, type FormEvent } from "react";
import { useChatScope } from "../context/ChatContext";
import { sendChatMessage, type ChatMessage } from "../lib/api";

function IconChat() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function Chatbot() {
  const { scope } = useChatScope();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const history = messages;
    const userMessage: ChatMessage = { role: "user", content: text };
    setMessages([...history, userMessage]);
    setInput("");
    setError(null);
    setSending(true);
    try {
      const { reply } = await sendChatMessage({
        message: text,
        history,
        job_id: scope.jobId,
        resume_id: scope.resumeId,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <IconClose /> : <IconChat />}
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <strong>Ask CareerPilot</strong>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              {scope.jobId ? "Grounded in your loaded job and resume." : "Open a job to get grounded answers."}
            </p>
          </div>

          <div className="chat-panel-messages">
            {messages.length === 0 && (
              <p className="muted" style={{ fontSize: 13 }}>
                Ask about the job, the resume match, or how to prepare.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "chat-message-user" : "chat-message-assistant"}>
                {m.content}
              </div>
            ))}
            {sending && <div className="chat-message-assistant muted">Thinking...</div>}
          </div>

          {error && <p className="alert" style={{ margin: "0 16px 10px" }}>{error}</p>}

          <form className="chat-panel-input" onSubmit={handleSend}>
            <input
              className="input"
              placeholder="Type a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
