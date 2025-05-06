import { useCallback, useMemo, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "./components/ui/button";
import { useToast } from "./hooks/use-toast";
import { useAuthToken } from "@convex-dev/auth/react";

const STREAM_URL = `${import.meta.env.VITE_CONVEX_URL.replace(".cloud", ".site")}/streamText`;

export function ChatInterface() {
  const { toast } = useToast();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");

  const createThread = useMutation(api.chat.createThread);
  // const sendMessage = useAction(api.chat.sendMessage);
  const [streamingText, startStreaming] = useStreamingText(selectedThreadId);
  const threads = usePaginatedQuery(
    api.chat.getThreads,
    {},
    { initialNumItems: 20 }
  );

  const messages = usePaginatedQuery(
    api.chat.getMessages,
    selectedThreadId
      ? {
          threadId: selectedThreadId,
        }
      : "skip",
    { initialNumItems: 50 }
  );

  const inProgressMessages = useQuery(
    api.chat.getInProgressMessages,
    selectedThreadId ? { threadId: selectedThreadId } : "skip"
  );

  const handleNewChat = useCallback(() => {
    void createThread()
      .then(({ threadId }) => {
        setSelectedThreadId(threadId);
      })
      .catch((error) => {
        console.error("Error creating thread:", error);
        toast({
          title: "Error",
          description: "Failed to create new chat",
          variant: "destructive",
        });
      });
  }, [createThread, toast]);

  const handleSendMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedThreadId || !newMessage.trim()) return;

      const prompt = newMessage;
      setNewMessage("");
      // run async
      void (async () => {
        try {
          await startStreaming(newMessage);
        } catch (error) {
          setNewMessage(prompt);
          console.error("Error sending message:", error);
          toast({
            title: "Error",
            description: "Failed to send message",
            variant: "destructive",
          });
        }
      })();
    },
    [selectedThreadId, newMessage, startStreaming, toast]
  );

  return (
    <div className="flex h-screen w-full">
      {/* Sidebar */}
      <div className="w-64 min-w-64 border-r p-4 flex flex-col bg-gray-50">
        <Button className="mb-4 w-full" onClick={handleNewChat}>
          New Chat
        </Button>
        <div className="flex-1 overflow-y-auto space-y-2">
          {threads?.results.map((thread) => (
            <button
              key={thread._id}
              onClick={() => setSelectedThreadId(thread._id)}
              className={`w-full p-2 text-left rounded hover:bg-slate-100 ${
                selectedThreadId === thread._id ? "bg-slate-100" : ""
              }`}
            >
              <div className="truncate">
                {thread.title ||
                  new Date(thread._creationTime).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-[calc(100vh-4rem)]">
        {selectedThreadId ? (
          <>
            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="flex flex-col-reverse space-y-reverse space-y-4">
                {streamingText.text && (
                  <div key="streaming-text" className={`flex justify-start`}>
                    <div
                      className={`max-w-[80%] rounded-lg p-3 bg-gray-100 text-blue-600`}
                    >
                      <strong className="block mb-1">Assistant</strong>
                      <div>{streamingText.text}</div>
                    </div>
                  </div>
                )}
                {streamingText.error && (
                  <div>Error: {streamingText.error.message}</div>
                )}
                {[
                  ...(inProgressMessages || []),
                  ...(messages?.results || []),
                ]?.map((message, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      message.message?.role === "assistant"
                        ? "justify-start"
                        : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.message?.role === "assistant"
                          ? "bg-gray-100 text-blue-600"
                          : "bg-blue-500 text-white"
                      }`}
                    >
                      <strong className="block mb-1">
                        {message.message?.role === "assistant"
                          ? "Assistant"
                          : "You"}
                      </strong>
                      <div>{message.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="border-t p-4 bg-white">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 p-2 border rounded"
                />
                <Button type="submit" disabled={!newMessage.trim()}>
                  Send
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            Select a chat or start a new one
          </div>
        )}
      </div>
    </div>
  );
}

function useStreamingText(threadId: string | null) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const token = useAuthToken();

  const readStream = useMemo(
    () => async (prompt: string) => {
      if (!threadId) return;
      try {
        setText("");
        setLoading(true);
        setError(null);
        const response = await fetch(STREAM_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ prompt, threadId }),
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (!response.body) {
          throw new Error("No body");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          accumulatedText += decoder.decode(value);
          setText(accumulatedText);
        }
        setText("");
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") {
          setError(e);
        }
      } finally {
        setLoading(false);
      }
    },
    [threadId, token]
  );
  return [{ text, loading, error }, readStream] as const;
}
