import { createContext, useContext, useState, type ReactNode } from "react";

interface ChatScope {
  jobId?: string;
  resumeId?: string;
}

interface ChatScopeContextValue {
  scope: ChatScope;
  setScope: (scope: ChatScope) => void;
}

const ChatScopeContext = createContext<ChatScopeContextValue>({
  scope: {},
  setScope: () => {},
});

export function ChatScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<ChatScope>({});
  return <ChatScopeContext.Provider value={{ scope, setScope }}>{children}</ChatScopeContext.Provider>;
}

export function useChatScope() {
  return useContext(ChatScopeContext);
}
