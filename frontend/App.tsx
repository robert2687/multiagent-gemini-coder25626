import React, { useState, useRef, useEffect } from 'react';
import { Message, UserProfile, UserSettings } from './types';
import { processCodingRequest } from './services/gemini';
import { ChatMessage } from './components/ChatMessage';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { Send, Terminal, Loader2, Sparkles, Bot, ShieldCheck, PlayCircle, Code, LayoutTemplate, Smartphone, Settings as SettingsIcon, User as UserIcon, MessageSquare } from 'lucide-react';

const QUICK_PROMPTS = [
  {
    icon: Code,
    title: "Scaffold VS Solution",
    prompt: "Generate a complete Visual Studio solution with backend services, frontend client, and shared libraries. Include build scripts, CI config, and minimal dependencies. Outline the plan, then produce the solution tree and key files."
  },
  {
    icon: LayoutTemplate,
    title: "Web App Structure",
    prompt: "Generate a complete web application structure with REST/GraphQL API, frontend UI, authentication (sign up, sign in), user profile, settings persistence, and deployment manifests."
  },
  {
    icon: Smartphone,
    title: "Android App",
    prompt: "Generate an Android project with UI layers, data layer, authentication flows (sign up, sign in), profile and settings screens, and sample backend integration."
  }
];

export default function App() {
  const [currentView, setCurrentView] = useState<'chat' | 'profile' | 'settings'>('chat');
  
  const [userProfile, setUserProfile] = useState<UserProfile>({
    displayName: 'Alex Developer',
    email: 'alex@example.com',
    bio: 'Full-stack engineer exploring AI agents.',
  });

  const [userSettings, setUserSettings] = useState<UserSettings>({
    temperature: 0.2,
    responseStyle: 'concise',
    emailNotifications: true,
    pushNotifications: false,
    theme: 'dark'
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Hello! I am **gemini coder**, a senior full-stack AI engineer backed by a multi-agent system. I can generate, refactor, debug, and explain code across modern programming languages. I support full project scaffolding (Web, Android, Visual Studio), user flows (auth, profiles), and more.\n\nDescribe your task, and my team (Coder, Reviewer, Runner) will plan, implement, review, and test the solution.',
      timestamp: Date.now(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (currentView === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, currentView]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && currentView === 'chat') {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input, currentView]);

  const handleSubmit = async (e?: React.FormEvent, overrideInput?: string) => {
    e?.preventDefault();
    const textToSubmit = overrideInput || input;
    
    if (!textToSubmit.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSubmit.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const workflowData = await processCodingRequest(
        userMessage.content, 
        userSettings.temperature, 
        userSettings.responseStyle
      );
      
      const systemMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: 'Workflow completed.',
        workflowData: workflowData,
        timestamp: Date.now(),
      };
      
      setMessages((prev) => [...prev, systemMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: error instanceof Error ? error.message : 'An unknown error occurred while processing your request.',
        isError: true,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`flex flex-col h-full font-sans ${userSettings.theme === 'light' ? 'bg-gray-50' : 'bg-gray-950'}`}>
      {/* Header */}
      <header className={`flex-shrink-0 border-b z-10 backdrop-blur-md ${userSettings.theme === 'light' ? 'bg-white/80 border-gray-200' : 'bg-gray-950/80 border-gray-800'}`}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('chat')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Terminal className="text-white" size={20} />
            </div>
            <div>
              <h1 className={`text-lg font-bold tracking-tight flex items-center gap-2 ${userSettings.theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                Gemini Coder <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] uppercase tracking-wider border border-blue-500/20">Multi-Agent</span>
              </h1>
              <p className={`text-xs hidden sm:block ${userSettings.theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>Coder • Reviewer • Runner</p>
            </div>
          </div>
          <div className={`flex items-center gap-4 text-sm ${userSettings.theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
            <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${userSettings.theme === 'light' ? 'bg-gray-100 border-gray-200' : 'bg-gray-900 border-gray-800'}`}>
              <Sparkles size={14} className="text-yellow-500" />
              <span>Powered by Gemini 2.5 Flash</span>
            </div>
            <div className={`h-6 w-px mx-2 hidden md:block ${userSettings.theme === 'light' ? 'bg-gray-300' : 'bg-gray-800'}`}></div>
            <nav className={`flex items-center gap-1 p-1 rounded-xl border ${userSettings.theme === 'light' ? 'bg-gray-100 border-gray-200' : 'bg-gray-900/50 border-gray-800'}`}>
              <button 
                onClick={() => setCurrentView('chat')} 
                className={`p-2 rounded-lg transition-colors ${currentView === 'chat' ? (userSettings.theme === 'light' ? 'bg-white text-blue-600 shadow-sm' : 'bg-gray-800 text-blue-400 shadow-sm') : (userSettings.theme === 'light' ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-200' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50')}`} 
                title="Chat"
              >
                <MessageSquare size={18} />
              </button>
              <button 
                onClick={() => setCurrentView('profile')} 
                className={`p-2 rounded-lg transition-colors ${currentView === 'profile' ? (userSettings.theme === 'light' ? 'bg-white text-blue-600 shadow-sm' : 'bg-gray-800 text-blue-400 shadow-sm') : (userSettings.theme === 'light' ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-200' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50')}`} 
                title="Profile"
              >
                <UserIcon size={18} />
              </button>
              <button 
                onClick={() => setCurrentView('settings')} 
                className={`p-2 rounded-lg transition-colors ${currentView === 'settings' ? (userSettings.theme === 'light' ? 'bg-white text-blue-600 shadow-sm' : 'bg-gray-800 text-blue-400 shadow-sm') : (userSettings.theme === 'light' ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-200' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50')}`} 
                title="Settings"
              >
                <SettingsIcon size={18} />
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {currentView === 'chat' && (
        <>
          <main className="flex-1 overflow-y-auto custom-scrollbar relative">
            <div className="pb-32">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {/* Quick Prompts (Only show when chat is empty) */}
              {messages.length === 1 && (
                <div className="max-w-5xl mx-auto px-4 mt-2 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-14">
                    {QUICK_PROMPTS.map((qp) => {
                      const Icon = qp.icon;
                      return (
                        <button
                          key={qp.title}
                          onClick={() => handleSubmit(undefined, qp.prompt)}
                          className={`text-left p-4 rounded-xl border transition-all group ${userSettings.theme === 'light' ? 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md' : 'bg-gray-900/30 border-gray-800 hover:bg-gray-800 hover:border-gray-700'}`}
                        >
                          <div className={`flex items-center gap-2 mb-2 transition-colors ${userSettings.theme === 'light' ? 'text-gray-800 group-hover:text-blue-600' : 'text-gray-300 group-hover:text-blue-400'}`}>
                            <Icon size={18} />
                            <span className="font-medium text-sm">{qp.title}</span>
                          </div>
                          <p className={`text-xs line-clamp-3 leading-relaxed ${userSettings.theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
                            {qp.prompt}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {isLoading && (
                <div className={`py-8 border-y ${userSettings.theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-gray-900/30 border-gray-800/50'}`}>
                  <div className="max-w-5xl mx-auto px-4 flex gap-6">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-900/20 animate-pulse">
                        <Bot size={18} className="text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 text-blue-500 font-medium">
                        <Loader2 size={18} className="animate-spin" />
                        <span>Orchestrating Agents...</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs animate-pulse ${userSettings.theme === 'light' ? 'bg-gray-200 text-gray-600' : 'bg-gray-800 text-gray-400'}`} style={{ animationDelay: '0ms' }}>
                          <Terminal size={12} /> Coder planning & drafting
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs animate-pulse ${userSettings.theme === 'light' ? 'bg-gray-200 text-gray-600' : 'bg-gray-800 text-gray-400'}`} style={{ animationDelay: '300ms' }}>
                          <ShieldCheck size={12} /> Reviewer analyzing
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs animate-pulse ${userSettings.theme === 'light' ? 'bg-gray-200 text-gray-600' : 'bg-gray-800 text-gray-400'}`} style={{ animationDelay: '600ms' }}>
                          <PlayCircle size={12} /> Runner testing
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* Input Area */}
          <div className={`absolute bottom-0 left-0 right-0 pt-10 pb-6 px-4 bg-gradient-to-t ${userSettings.theme === 'light' ? 'from-gray-50 via-gray-50 to-transparent' : 'from-gray-950 via-gray-950 to-transparent'}`}>
            <div className="max-w-4xl mx-auto">
              <form 
                onSubmit={handleSubmit}
                className={`relative border rounded-2xl shadow-2xl focus-within:ring-1 transition-all ${userSettings.theme === 'light' ? 'bg-white border-gray-300 shadow-gray-200/50 focus-within:border-blue-500 focus-within:ring-blue-500' : 'bg-gray-900 border-gray-700 shadow-black/50 focus-within:border-blue-500/50 focus-within:ring-blue-500/50'}`}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe a feature to build, a bug to fix, or paste code to refactor..."
                  className={`w-full max-h-[200px] bg-transparent p-4 pr-14 resize-none focus:outline-none text-base leading-relaxed custom-scrollbar rounded-2xl ${userSettings.theme === 'light' ? 'text-gray-900 placeholder-gray-400' : 'text-gray-100 placeholder-gray-500'}`}
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-3 bottom-3 p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors flex items-center justify-center"
                >
                  <Send size={18} className={isLoading ? 'opacity-0' : 'opacity-100'} />
                  {isLoading && <Loader2 size={18} className="absolute animate-spin" />}
                </button>
              </form>
              <div className={`text-center mt-3 text-xs ${userSettings.theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
                Press <kbd className={`px-1.5 py-0.5 rounded border font-sans ${userSettings.theme === 'light' ? 'bg-gray-100 border-gray-300' : 'bg-gray-800 border-gray-700'}`}>Enter</kbd> to send, <kbd className={`px-1.5 py-0.5 rounded border font-sans ${userSettings.theme === 'light' ? 'bg-gray-100 border-gray-300' : 'bg-gray-800 border-gray-700'}`}>Shift + Enter</kbd> for new line.
              </div>
            </div>
          </div>
        </>
      )}

      {currentView === 'profile' && (
        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          <ProfileView profile={userProfile} onSave={setUserProfile} theme={userSettings.theme} />
        </main>
      )}

      {currentView === 'settings' && (
        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          <SettingsView settings={userSettings} onSave={setUserSettings} />
        </main>
      )}

      {/* Global Styles for Scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${userSettings.theme === 'light' ? '#D1D5DB' : '#374151'};
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${userSettings.theme === 'light' ? '#9CA3AF' : '#4B5563'};
        }
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}} />
    </div>
  );
}