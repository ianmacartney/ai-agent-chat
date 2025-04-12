import { Authenticated, Unauthenticated } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "./components/ui/toaster";
import { ChatInterface } from "./ChatInterface";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm p-4 flex justify-between items-center border-b">
        <h2 className="text-xl font-semibold accent-text">AI Chat</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 flex">
        <Authenticated>
          <ChatInterface />
        </Authenticated>
        <Unauthenticated>
          <div className="w-full flex items-center justify-center p-8">
            <div className="w-full max-w-md">
              <div className="text-center mb-8">
                <h1 className="text-5xl font-bold accent-text mb-4">AI Chat</h1>
                <p className="text-xl text-slate-600">Sign in to get started</p>
              </div>
              <SignInForm />
            </div>
          </div>
        </Unauthenticated>
      </main>
      <Toaster />
    </div>
  );
}
