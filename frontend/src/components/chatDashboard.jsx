import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MdDelete } from "react-icons/md";
import { useNavigate } from 'react-router-dom';
import { FaRegMessage } from "react-icons/fa6";
import { IoDocumentTextOutline } from "react-icons/io5";

import { Link } from 'react-router-dom';
import logo from '../assets/logo.svg';
import useFileStore from '../stores/fileStore';
import useAxiosPrivate from '../hooks/useAxiosPrivate';
import { ModalGeneralComponent } from './ui/ModalGeneralComponent';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

import useFetch from '../hooks/useFetch';
import Loading from './ui/Loading';
import { RiDeleteBin6Line } from "react-icons/ri";
import { FaRegFileAlt } from "react-icons/fa";
import { MdOutlinePlayCircle } from "react-icons/md";
import { HiXCircle } from "react-icons/hi";
import { useToast } from './Toast/ToastContext';

// Constants
const POLL_INTERVAL = 3000; // 3 seconds
const POLL_TIMEOUT = 120000; // 2 minutes

function ChatDashboard() {
  const axiosInstance = useAxiosPrivate();
  const navigateTo = useNavigate()
  const [isDragging, setIsDragging] = useState(false);
  const toast = useToast();

  const handleUpload = useFileStore((state) => state.handleUpload);
  const { data, error, isLoading, fetchData } = useFetch('/api/document/files')
  const [deletingIndex, setDeletingIndex] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Track file processing statuses: { fileId: { status, message, summary, questions, error, startTime } }
  const [fileStatuses, setFileStatuses] = useState({});
  // Store interval IDs for cleanup
  const pollIntervalsRef = useRef({});

  // Modal refs for programmatic control
  const uploadModalRef = useRef(null);
  const hcpModalRef = useRef(null);

  // Filter state
  const [selectedFileType, setSelectedFileType] = useState('ALL');

  const files = data

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await handleUpload(file, axiosInstance);

      // Close the modal
      uploadModalRef.current?.close();

      // Refresh file list
      await fetchData();

      // Show success toast
      toast.success(`"${file.name}" uploaded successfully!`, 'Upload Complete');

    } catch (error) {
      // An error occurred while uploading the file
      toast.error(
        error.response?.data?.detail || 'Failed to upload file. Please try again.',
        'Upload Failed'
      );
    } finally {
      setIsUploading(false);
      // Reset the input so the same file can be selected again
      e.target.value = '';
    }
  };


  const handleFileDelete = async (fileId, index) => {
    setDeletingIndex(index);
    try {
      await axiosInstance.delete(`/api/document/file/${fileId}`);

      // Stop any polling for this file
      stopPolling(fileId);

      // Remove from local status tracking
      setFileStatuses(prev => {
        const newStatuses = { ...prev };
        delete newStatuses[fileId];
        return newStatuses;
      });

      // Refresh file list
      await fetchData();

      toast.success('File deleted successfully', 'Deleted');
    } catch (error) {
      toast.error(
        error.response?.data?.detail || 'Failed to delete file. Please try again.',
        'Delete Failed'
      );
    } finally {
      setDeletingIndex(null);
    }
  };
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await handleUpload(file, axiosInstance);

      // Close the modal
      uploadModalRef.current?.close();

      // Refresh file list
      await fetchData();

      // Show success toast
      toast.success(`"${file.name}" uploaded successfully!`, 'Upload Complete');

    } catch (error) {
      // An error occurred while uploading the file
      toast.error(
        error.response?.data?.detail || 'Failed to upload file. Please try again.',
        'Upload Failed'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

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
    if (!files || isLoading) return;

    const checkInitialStatuses = async () => {
      const allFileIds = [];
      Object.values(files).forEach(fileList => {
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
  }, [files, isLoading]);

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
            fetchData();
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
  const handleFileProcess = async (fileId) => {
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
        fetchData();
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
    }
  };

  // Get display status for a file
  const getFileDisplayStatus = (file) => {
    const statusInfo = fileStatuses[file.id];

    // If we have a tracked status, use it
    if (statusInfo) {
      return statusInfo;
    }

    // Otherwise, derive from file.processed
    if (file.processed) {
      return { status: 'completed' };
    }

    return { status: 'pending' };
  };

  // Sort files: unprocessed first, then by upload date (newest first)
  const sortFiles = (fileList) => {
    return [...fileList].sort((a, b) => {
      const statusA = getFileDisplayStatus(a);
      const statusB = getFileDisplayStatus(b);

      // Unprocessed files first
      const isAProcessed = a.processed || statusA.status === 'completed';
      const isBProcessed = b.processed || statusB.status === 'completed';

      if (isAProcessed !== isBProcessed) {
        return isAProcessed ? 1 : -1; // Unprocessed first
      }

      // If both have same processed status, sort by date (newest first)
      const dateA = new Date(a.upload_date);
      const dateB = new Date(b.upload_date);
      return dateB - dateA;
    });
  };

  // Filter and organize files - memoized to prevent recalculation on every render
  const getFilteredAndSortedFiles = useMemo(() => {
    if (!files) return {};

    const filtered = {};

    Object.entries(files).forEach(([type, fileList]) => {
      // Apply file type filter
      if (selectedFileType === 'ALL' || type.toUpperCase() === selectedFileType) {
        // Sort files: unprocessed first
        filtered[type] = sortFiles(fileList);
      }
    });

    return filtered;
  }, [files, selectedFileType]);

  // Get available file types for filter buttons
  const getAvailableFileTypes = () => {
    if (!files) return [];
    return ['ALL', ...Object.keys(files).map(t => t.toUpperCase()).sort()];
  };

  /* const sortFilesByGroup = (files) => {
    const sortedFiles = {
      'Document ( doc, docx, pdf, txt )': []
    -- 'Spreadsheet ( csv, xls, xlsx )': [], 
     
    };

    // Group files by their types
    for (let fileType in files) {
      if (['doc', 'docx', 'pdf', 'txt'].includes(fileType)) {
        sortedFiles['Document ( doc, docx, pdf, txt )'].push(...files[fileType]);
      } else if (['csv', 'xls', 'xlsx'].includes(fileType)) {
        -- sortedFiles['Spreadsheet ( csv, xls, xlsx )'].push(...files[fileType]);
      } 
    }
    
    return sortedFiles;
  }; */

  return (
    <div className="flex flex-col bg-gradient-to-br from-slate-50 to-gray-100 min-h-screen">
      {/* Minimal Admin Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="container max-w-6xl mx-auto flex justify-between items-center py-4 px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center">
              <img className="h-[4rem] w-auto" src={logo} alt="Ask.N7" />
            </Link>
            <div className="h-8 w-px bg-slate-200"></div>
            <h1 className="text-lg font-semibold text-slate-700">Admin Dashboard</h1>
          </div>
          <Link
            to="/chat"
            className="text-sm px-4 py-2 text-primary hover:bg-primary/5 rounded-lg transition-colors"
          >
            ← Back to Chat
          </Link>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto px-6 py-8">
        {/* Header with stats and upload */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Knowledge Base</h2>
            <p className="text-gray-500">Manage documents for the shared knowledge base</p>
          </div>

          <ModalGeneralComponent
            ref={uploadModalRef}
            Button={(props) => (
              <button {...props} className="bg-primary py-2.5 text-sm px-5 font-medium text-white rounded-lg shadow-sm shadow-primary/30 hover:shadow-md hover:shadow-primary/30 transition-all">
                + Upload Document
              </button>
            )}
            header={
              <h3 className="text-md font-semibold text-gray-900">
                Upload Document
              </h3>
            }
            body={
              <div className="flex items-center p-1 justify-center w-full">
                <label
                  htmlFor="dropzone-file"
                  className={`${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'} flex flex-col items-center justify-center w-full h-[12rem] border-2 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg
                      className="w-10 h-10 mb-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-400">
                      PDF, TXT, CSV, MD (MAX 200MB)
                    </p>

                    {isUploading && (
                      <div className="mt-4 flex items-center gap-2">
                        <Loading />
                        <span className="text-sm text-gray-500">Uploading...</span>
                      </div>
                    )}
                  </div>
                  <input
                    onChange={handleFileChange}
                    disabled={isUploading}
                    id="dropzone-file"
                    type="file"
                    className="hidden"
                    accept=".pdf,.txt,.csv,.md"
                  />
                </label>
              </div>
            }
          />
        </div>

        {/* Filter pills */}
        {!isLoading && files && Object.keys(files).length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            {getAvailableFileTypes().map((fileType) => (
              <button
                key={fileType}
                onClick={() => setSelectedFileType(fileType)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedFileType === fileType
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
              >
                {fileType === 'ALL' ? 'All' : fileType}
              </button>
            ))}
          </div>
        )}

        {/* File List */}
        {isLoading ? <Loading padding={8} /> : (
          <div className="space-y-6">
            {Object.entries(getFilteredAndSortedFiles).map(([type, fileList]) => {
              // Count unprocessed files
              const unprocessedCount = fileList.filter(file => {
                const status = getFileDisplayStatus(file);
                return !file.processed && status.status !== 'completed';
              }).length;

              const processedCount = fileList.length - unprocessedCount;

              return (
                <div key={type} className='mb-4 '>
                  {/* Section Header */}
                  <div className='flex items-center justify-between mb-3 mt-[1rem] border-t-0 px-1'>
                    <div className='flex items-center gap-3'>
                      <h2 className='text-md font-semibold text-gray-600'>{type}</h2>
                      {unprocessedCount > 0 && (
                        <span className='px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium'>
                          {unprocessedCount} unprocessed
                        </span>
                      )}
                      {processedCount > 0 && (
                        <span className='px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium'>
                          {processedCount} ready
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className='flex flex-col gap-2 mb-2' id={type}>
                    {fileList.map((file, index) => {
                      const displayStatus = getFileDisplayStatus(file);
                      const isUnprocessed = !file.processed && displayStatus.status !== 'completed';

                      const readableSize = file.size >= 1024 * 1024
                        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                        : `${(file.size / 1024).toFixed(1)} KB`;

                      const uploadDate = new Date(file.upload_date).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      });

                      return (
                        <li
                          key={file.id}
                          className={`border rounded-sm2 flex justify-between items-center px-4 py-3 text-sm transition-all ${isUnprocessed
                            ? 'bg-amber-50/50 border-amber-200 shadow-sm'
                            : 'bg-white border-gray-200'
                            }`}
                        >
                          <div className='flex justify-center items-center gap-4'>
                            <span className={`w-9 h-9 flex justify-center items-center rounded-sm2 ${isUnprocessed
                              ? 'bg-amber-100'
                              : 'bg-primary/10'
                              }`}>
                              <IoDocumentTextOutline
                                size='19px'
                                color={isUnprocessed ? '#d97706' : 'primary/10'}
                              />
                            </span>
                            <div className='flex flex-col gap-2'>
                              <span className='font-bold text-gray-900'>{file.file_name}</span>
                              <div className='flex  items-center  gap-2'>
                                <span className={`h-4 w-9 text-center flex justify-center items-center rounded-md font-medium text-[10px] ${isUnprocessed
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-primary/10 text-primary'
                                  }`}>
                                  <span>{file.extention}</span>
                                </span>
                                <div className=' text-gray-400 text-[11px]'>
                                  {readableSize}  •  Uploaded on {uploadDate}
                                </div>
                              </div>
                            </div>

                          </div>

                          <div className='flex gap-2 items-center'>
                            {(() => {
                              const displayStatus = getFileDisplayStatus(file);
                              const status = displayStatus.status;
                              const isProcessing = status === 'processing';
                              const isCompleted = status === 'completed' || file.processed;
                              const isFailed = status === 'failed';
                              const isPending = status === 'pending' && !file.processed;

                              return (
                                <>
                                  {/* Status Badge */}
                                  {isProcessing && (
                                    <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium flex items-center gap-2 border border-amber-200 animate-pulse">
                                      <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Processing...
                                    </span>
                                  )}



                                  {isFailed && (
                                    <span className="px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-medium flex items-center gap-1.5 border border-red-200" title={displayStatus.error}>
                                      <HiXCircle className="text-sm" />
                                      Failed
                                    </span>
                                  )}

                                  {/* Process Button - Show only if not completed and not currently processing */}
                                  {!isCompleted && !isProcessing && (
                                    <button
                                      onClick={() => handleFileProcess(file.id)}
                                      className={`rounded-sm2 border px-3 py-2 flex items-center gap-2 transition-all duration-200 ${isFailed
                                        ? 'border-red-400 text-red-600 hover:bg-red-50'
                                        : isUnprocessed
                                          ? 'border-amber-400 text-amber-700 hover:bg-amber-50'
                                          : 'border-primary text-primary hover:bg-primary/5'
                                        }`}
                                      aria-label={isPending ? 'Process document' : isFailed ? 'Retry processing document' : 'Process document'}
                                    >
                                      {isPending && (
                                        <>
                                          <MdOutlinePlayCircle className='text-[1rem]' />
                                          <span>Process</span>
                                        </>
                                      )}
                                      {isFailed && (
                                        <>
                                          <MdOutlinePlayCircle className='text-[1rem]' />
                                          <span>Retry</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </>
                              );
                            })()}

                            {/* Success badge for processed files */}
                            {
                              file.processed && (
                                <span className="px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-medium flex items-center gap-1.5 border border-green-200">
                                  ✓ Ready
                                </span>
                              )
                            }

                            <button
                              onClick={() => handleFileDelete(file.id, index)}
                              className={`rounded-sm2 border px-3 py-2 transition-colors ${isUnprocessed
                                ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                                : 'border-primary text-primary hover:bg-primary/5'
                                }`}
                              aria-label={`Delete ${file.file_name}`}
                            >
                              {deletingIndex === index ? <Loading w_h='11' /> : <RiDeleteBin6Line className='text-[1rem]' />}
                            </button>
                          </div>

                        </li>
                      )
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatDashboard;

