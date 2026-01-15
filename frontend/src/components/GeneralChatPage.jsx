import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import GeneralChatComponent from './GeneralChat/GeneralChat';
import logo from '../assets/logo.svg';
import useAuthStore from '../stores/authStore';
import useAxiosPrivate from '../hooks/useAxiosPrivate';
import { GoSignOut, GoChevronDown } from 'react-icons/go';
import { HiOutlinePlus, HiOutlineChat, HiOutlineTrash, HiOutlineMenuAlt2 } from 'react-icons/hi';

function GeneralChatPage() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [userDropMenu, setUserDropMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const dropdownRef = useRef(null);
  const axiosInstance = useAxiosPrivate();
  const location = useLocation();

  // Key to force GeneralChat remount on session change
  const [chatKey, setChatKey] = useState(0);

  const handleLogout = () => {
    logout();
    setUserDropMenu(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUserDropMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch chat sessions
  const fetchSessions = useCallback(async () => {
    try {
      setIsLoadingSessions(true);
      const response = await axiosInstance.get('/api/general-chat/sessions');
      setSessions(response.data);

      const pendingQ = location.state?.question || localStorage.getItem('pendingQuestion');

      // If no active session and sessions exist, select the first one
      // UNLESS there is a pending question, in which case we want a NEW session (Id null)
      if (!activeSessionId && response.data.length > 0 && !pendingQ) {
        setActiveSessionId(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [axiosInstance, activeSessionId, location.state]);

  useEffect(() => {
    fetchSessions();
  }, []);

  // Create new chat session - returns the new session ID
  const createNewSession = async () => {
    try {
      const response = await axiosInstance.post('/api/general-chat/sessions', { title: "New Chat" });
      const newSession = response.data;
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setChatKey(prev => prev + 1); // Force chat remount
      return newSession.id; // Return the ID for immediate use
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    }
  };

  // Delete a session
  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;

    try {
      await axiosInstance.delete(`/api/general-chat/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));

      // If we deleted the active session, switch to another
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
          setChatKey(prev => prev + 1);
        } else {
          setActiveSessionId(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  // Switch to a session
  const switchSession = (sessionId) => {
    if (sessionId !== activeSessionId) {
      setActiveSessionId(sessionId);
      setChatKey(prev => prev + 1); // Force chat remount to load new messages
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 bg-white border-r border-slate-200 flex flex-col overflow-hidden`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-100">
          <Link to="/" className="flex p-2 border-b border-gray-300 justify-center items-center">
            <img
              className="h-20 w-auto"
              src={logo}
              alt="Ask.N7 Logo"
            />
          </Link>
          <button
            onClick={createNewSession}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            <HiOutlinePlus className="text-lg" />
            New Chat
          </button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingSessions ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No conversations yet
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => switchSession(session.id)}
                  className={`group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all ${activeSessionId === session.id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-slate-50'
                    }`}
                >
                  <HiOutlineChat className={`text-lg flex-shrink-0 ${activeSessionId === session.id ? 'text-primary' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${activeSessionId === session.id ? 'text-primary' : 'text-gray-700'}`}>
                      {session.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(session.updated_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                  >
                    <HiOutlineTrash className="text-sm" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100 text-xs text-center text-gray-400">
          {sessions.length} conversation{sessions.length !== 1 ? 's' : ''}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
          <nav className="flex justify-between items-center py-3 px-4">
            <div className="flex items-center gap-3">
              {/* Sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-slate-100 text-gray-500"
              >
                <HiOutlineMenuAlt2 className="text-xl" />
              </button>

              {/* Logo */}

            </div>

            {/* User Dropdown */}
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all duration-200"
                  onClick={() => setUserDropMenu(!userDropMenu)}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-semibold text-sm">
                    {user.first_name?.[0]?.toUpperCase() || user.user_name?.[0]?.toUpperCase()}
                  </div>
                  <GoChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${userDropMenu ? 'rotate-180' : ''}`} />
                </button>

                {userDropMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-100 shadow-xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b">
                      <p className="font-medium text-gray-900">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                      >
                        <GoSignOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </nav>
        </header>

        {/* Chat Area */}
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full w-full mx-auto">
            <GeneralChatComponent
              key={chatKey}
              sessionId={activeSessionId}
              onSessionUpdate={fetchSessions}
              onCreateSession={createNewSession}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default GeneralChatPage;



