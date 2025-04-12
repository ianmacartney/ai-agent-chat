import { useCallback, useState } from "react";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "./components/ui/button";
import { useToast } from "./hooks/use-toast";

export function ChatInterface() {
  const { toast } = useToast();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");

  const createThread = useMutation(api.chat.createThread);
  const sendMessage = useAction(api.chat.sendMessage);

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
          await sendMessage({
            threadId: selectedThreadId,
            prompt: newMessage,
          });
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
    [selectedThreadId, newMessage, sendMessage, toast]
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
                selectedThreadId === thread.threadId ? "bg-slate-100" : ""
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
                {inProgressMessages?.map((message) => (
                  <div
                    key={message._id}
                    className={`flex ${
                      message.message?.role === "assistant"
                        ? "justify-start"
                        : "justify-end"
                    }`}
                  >
                    {message.text}
                  </div>
                ))}
                {messages?.results.map((message, i) => (
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
