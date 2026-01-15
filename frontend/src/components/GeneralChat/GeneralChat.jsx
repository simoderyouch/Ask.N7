import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useFetch from "../../hooks/useFetch";
import Loading from "../ui/Loading";
import useAxiosPrivate from "../../hooks/useAxiosPrivate";
import { HiOutlineSparkles } from "react-icons/hi";
import { useToast } from "../Toast/ToastContext";
import { useTypingAnimation } from "../../hooks/useTypingAnimation";
import { useFileHelpers } from "../../hooks/useFileHelpers";

import { GeneralChatMessages } from "./GeneralChatMessages";
import { GeneralChatInput } from "./GeneralChatInput";

// Constants
const POLL_INTERVAL = 3000; // 3 seconds
const POLL_TIMEOUT = 120000; // 2 minutes

function GeneralChat({ sessionId, onSessionUpdate, onCreateSession }) {
  const {
    data: filesData,
    error: filesError,
    isLoading: filesIsLoading,
    fetchData: fetchFiles,
  } = useFetch('/api/document/files');

  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [language, setLanguage] = useState("Auto-detect");
  const [model, setModel] = useState("Mistral");
  const [messages, setMessages] = useState([]);

  const [processing, setProcessing] = useState({});
  const chatEndRef = useRef(null);
  const axiosInstance = useAxiosPrivate();
  const toast = useToast();

  // Use custom hooks
  const { allFiles, processedFiles, unprocessedFiles } = useFileHelpers(filesData);
  const { currentIndex, showingLetters, setShowingLetters } = useTypingAnimation(
    messages.length > 0 && !messages[messages.length - 1]?.is_user_message, // isActive
    messages,
    10, // baseDelay
    5,  // delayRange
    5,  // baseIncrement
    4   // incrementRange
  );

  // Track file processing statuses: { fileId: { status, message, error, startTime } }
  const [fileStatuses, setFileStatuses] = useState({});
  // Store interval IDs for cleanup
  const pollIntervalsRef = useRef({});

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(pollIntervalsRef.current).forEach(intervalId => {
        clearInterval(intervalId);
      });
    };
  }, []);

  // Check initial statuses when files load (for files that might be processing)
  useEffect(() => {
    if (!filesData || filesIsLoading) return;

    const checkInitialStatuses = async () => {
      const allFileIds = [];
      Object.values(filesData).forEach(fileList => {
        fileList.forEach(file => {
          // Only check files that aren't already marked as processed
          if (!file.processed) {
            allFileIds.push(file.id);
          }
        });
      });

      // Check status for unprocessed files
      for (const fileId of allFileIds) {
        try {
          const response = await axiosInstance.get(`/api/document/process/status/${fileId}`);
          const statusData = response.data;

          // If file is currently processing, start polling
          if (statusData.status === 'processing') {
            setFileStatuses(prev => ({
              ...prev,
              [fileId]: { ...statusData, startTime: Date.now() }
            }));
            startPolling(fileId);
          }
        } catch (error) {
          // Ignore errors for initial check
        }
      }
    };

    checkInitialStatuses();
  }, [filesData, filesIsLoading, axiosInstance]);

  // Load messages from session when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    const loadSessionMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const response = await axiosInstance.get(`/api/general-chat/sessions/${sessionId}`);
        const sessionData = response.data;

        // Transform messages to the format expected by the chat component
        const formattedMessages = sessionData.messages.map(msg => ({
          message: msg.content,
          is_user_message: msg.is_user_message,
          create_at: msg.created_at,
          documents_used: msg.documents_used
        }));

        setMessages(formattedMessages);
      } catch (error) {
        console.error('Failed to load session messages:', error);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadSessionMessages();
  }, [sessionId, axiosInstance]);

  // Fetch files on mount
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // All processed files are included
  const includedFiles = processedFiles;



  const handleSubmit = async (question_p = "") => {
    const activeFilesCount = includedFiles.length;

    if (activeFilesCount === 0) {
      alert("Please add at least one document to the knowledge base first.");
      return;
    }

    const finalQuestion = question_p.trim() || question.trim();
    if (!finalQuestion) {
      alert("Please enter a question.");
      return;
    }

    // Determine which session ID to use
    let targetSessionId = sessionId;

    // If no session exists, create one first
    if (!targetSessionId && onCreateSession) {
      targetSessionId = await onCreateSession();
      if (!targetSessionId) {
        alert("Failed to create chat session.");
        return;
      }
    }

    if (!targetSessionId) {
      return; // No session and can't create one
    }

    setShowingLetters(false);
    setIsLoading(true);
    const currentTime = new Date();
    const formattedTime = currentTime.toISOString();

    // Optimistically add user message
    setMessages([
      ...messages,
      { message: finalQuestion, is_user_message: true, create_at: formattedTime },
    ]);

    setQuestion("");

    try {
      // Use session-based API with the target session ID
      const response = await axiosInstance.post(`/api/general-chat/sessions/${targetSessionId}/messages`, {
        content: finalQuestion,
        language: language,
        model: model,
      });

      const aiResponse = response.data.ai_response;

      const newMessage = {
        message: aiResponse.content,
        is_user_message: false,
        create_at: aiResponse.created_at,
        documents_used: aiResponse.documents_used,
      };

      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setShowingLetters(true); // Trigger typing animation

      // Notify parent to refresh session list (for updated title/timestamp)
      if (onSessionUpdate) {
        onSessionUpdate();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || "An error occurred. Please try again.";
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          message: errorMessage,
          is_user_message: false,
          create_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const location = useLocation();
  const navigate = useNavigate();
  const hasHandledPendingRef = useRef(false);

  // Handle pending question from landing page
  useEffect(() => {
    if (filesIsLoading) return;
    if (hasHandledPendingRef.current) return;

    const stateQuestion = location.state?.question;
    const pendingQuestion = localStorage.getItem('pendingQuestion');
    const questionToAsk = stateQuestion || pendingQuestion;

    if (questionToAsk) {
      hasHandledPendingRef.current = true; // Mark as handled immediately to prevent double submission

      if (pendingQuestion) {
        localStorage.removeItem('pendingQuestion');
      }

      // Clear location state so recent question doesn't persist across new chats
      if (stateQuestion) {
        navigate(location.pathname, { replace: true, state: {} });
      }

      // Small timeout to ensure everything is ready
      setTimeout(() => {
        handleSubmit(questionToAsk);
      }, 100);
    }
  }, [filesIsLoading, location.state, handleSubmit, location.pathname, navigate]);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Poll status for a specific file
  const pollStatus = async (fileId) => {
    try {
      const response = await axiosInstance.get(`/api/document/process/status/${fileId}`);
      const statusData = response.data;

      setFileStatuses(prev => {
        const currentStatus = prev[fileId] || {};
        const startTime = currentStatus.startTime || Date.now();
        const wasProcessing = currentStatus.status === 'processing';

        // Check for timeout
        if (Date.now() - startTime > POLL_TIMEOUT) {
          stopPolling(fileId);
          toast.error('Processing timed out. Please try again.', 'Timeout');
          return {
            ...prev,
            [fileId]: {
              ...statusData,
              status: 'failed',
              error: 'Processing timed out. Please try again.',
              startTime
            }
          };
        }

        // Stop polling if completed or failed
        if (statusData.status === 'completed' || statusData.status === 'failed') {
          stopPolling(fileId);
          // Refresh file list to get updated processed status
          if (statusData.status === 'completed') {
            fetchFiles();
            // Only show toast if it was previously processing (not on initial load)
            if (wasProcessing) {
              toast.success('Document processed successfully! Ready to chat.', 'Complete');
            }
          } else if (statusData.status === 'failed' && wasProcessing) {
            toast.error(statusData.error || 'Processing failed. Please try again.', 'Failed');
          }
        }

        return {
          ...prev,
          [fileId]: { ...statusData, startTime }
        };
      });

      return statusData;
    } catch (error) {
      return null;
    }
  };

  // Stop polling for a file
  const stopPolling = (fileId) => {
    if (pollIntervalsRef.current[fileId]) {
      clearInterval(pollIntervalsRef.current[fileId]);
      delete pollIntervalsRef.current[fileId];
    }
  };

  // Start polling for a file
  const startPolling = (fileId) => {
    // Clear any existing polling for this file
    stopPolling(fileId);

    // Start new polling interval
    pollIntervalsRef.current[fileId] = setInterval(() => {
      pollStatus(fileId);
    }, POLL_INTERVAL);
  };

  // Handle file processing
  const handleProcessFile = async (fileId) => {
    try {
      // Set initial processing state
      setFileStatuses(prev => ({
        ...prev,
        [fileId]: {
          status: 'processing',
          message: 'Starting processing...',
          startTime: Date.now()
        }
      }));

      setProcessing(prev => ({ ...prev, [fileId]: true }));
      toast.info('Processing started. This may take a few moments...', 'Processing');

      // Call the process endpoint
      const response = await axiosInstance.get(`/api/document/process/${fileId}`);
      const result = response.data;

      if (result.status === 'completed') {
        // Already completed
        setFileStatuses(prev => ({
          ...prev,
          [fileId]: { ...result, startTime: prev[fileId]?.startTime }
        }));
        await fetchFiles();
        toast.success('Document processed successfully!', 'Complete');
      } else if (result.status === 'processing' || result.status === 'started' || result.status === 'pending') {
        // Start polling
        setFileStatuses(prev => ({
          ...prev,
          [fileId]: {
            ...result,
            status: 'processing',
            message: result.message || 'Processing document...',
            startTime: prev[fileId]?.startTime
          }
        }));
        startPolling(fileId);
        // Do an immediate status check
        await pollStatus(fileId);
      }
    } catch (error) {
      setFileStatuses(prev => ({
        ...prev,
        [fileId]: {
          status: 'failed',
          error: error.response?.data?.detail || 'Failed to start processing'
        }
      }));
      toast.error(
        error.response?.data?.detail || 'Failed to start processing. Please try again.',
        'Processing Failed'
      );
    } finally {
      setProcessing(prev => ({ ...prev, [fileId]: false }));
    }
  };



  if (filesIsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loading padding={3} />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Chat panel - full width without sidebar */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}


        {/* Messages */}
        <GeneralChatMessages
          messages={messages}
          isLoading={isLoading}
          showingLetters={showingLetters}
          currentIndex={currentIndex}
          chatEndRef={chatEndRef}
          onSuggestionClick={handleSubmit}
        />

        {/* Input */}
        <GeneralChatInput
          question={question}
          setQuestion={setQuestion}
          isLoading={isLoading}
          includedFilesCount={processedFiles.length}
          onSubmit={() => handleSubmit()}
          onKeyPress={handleKeyPress}
        />
      </div>
    </div>
  );
}

export default GeneralChat;
