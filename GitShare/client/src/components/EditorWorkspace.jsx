import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { BACKEND_URL } from '../../config.js';
import {
  Users,
  MessageSquare,
  Shield,
  LogOut,
  Code,
  Send,
  Plus,
  Wifi,
  ChevronDown,
  Github,
  Folder,
  FileCode,
  ArrowLeft,
  X,
  Loader2,
  Upload,
  LayoutDashboard
} from 'lucide-react';

const LANGUAGE_TEMPLATES = {
  javascript: `// JavaScript Code
function findPeakElement(nums) {
    let left = 0;
    let right = nums.length - 1;
    
    while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (nums[mid] > nums[mid + 1]) {
            right = mid;
        } else {
            left = mid + 1;
        }
    }
    return left;
}

const peakIndex = findPeakElement([1, 2, 3, 1]);`,
  python: `# Python Code
def find_peak_element(nums):
    left = 0
    right = len(nums) - 1
    
    while left < right:
        mid = (left + right) // 2
        if nums[mid] > nums[mid + 1]:
            right = mid
        else:
            left = mid + 1
    return left

print("Peak index is:", find_peak_element([1, 2, 3, 1]))`,
  cpp: `// C++ Code
#include <iostream>
#include <vector>

int findPeakElement(const std::vector<int>& nums) {
    int left = 0;
    int right = nums.size() - 1;
    
    while (left < right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] > nums[mid + 1]) {
            right = mid;
        } else {
            left = mid + 1;
        }
    }
    return left;
}

int main() {
    std::vector<int> nums = {1, 2, 3, 1};
    std::cout << "Peak index is: " << findPeakElement(nums) << std::endl;
    return 0;
}`,
  java: `// Java Code
import java.util.*;

public class Solution {
    public static int findPeakElement(int[] nums) {
        int left = 0;
        int right = nums.length - 1;
        
        while (left < right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] > nums[mid + 1]) {
                right = mid;
            } else {
                left = mid + 1;
            }
        }
        return left;
    }

    public static void main(String[] args) {
        int[] nums = {1, 2, 3, 1};
        System.out.println("Peak index is: " + findPeakElement(nums));
    }
}`
};

const FILE_NAMES = {
  javascript: 'solution.js',
  python: 'solution.py',
  cpp: 'solution.cpp',
  java: 'Solution.java'
};

function EditorWorkspace({
  socket,
  theme,
  user,
  username,
  roomId,
  code: initialCode,
  onChangeCode,
  onLeaveRoom
}) {
  const [language, setLanguage] = useState('javascript');
  const [activeFileName, setActiveFileName] = useState('');
  const [openFiles, setOpenFiles] = useState([]);
  const [code, setCode] = useState('');
  const [comments, setComments] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const [connected, setConnected] = useState(false);

  // Comment Inputs
  const [newCommentLine, setNewCommentLine] = useState(1);
  const [newCommentText, setNewCommentText] = useState('');

  // GitHub Explorer State
  const [showFileModal, setShowFileModal] = useState(false);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [contents, setContents] = useState([]);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState(null);

  const socketRef = useRef(null);
  const targetRoomId = (roomId || 'MAHA0904').toUpperCase();

  const codeChangeTimeoutRef = useRef(null);
  const cursorMoveTimeoutRef = useRef(null);
  const pendingCodeChangeRef = useRef(null);
  const pendingCursorMoveRef = useRef(null);

  // Remote cursor presence state
  const [remoteCursors, setRemoteCursors] = useState({});
  const [showToast, setShowToast] = useState(false);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);

  const COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
    '#f43f5e', '#06b6d4', '#84cc16', '#a855f7', '#d946ef'
  ];

  const [localSocketId, setLocalSocketId] = useState(socket ? socket.id : '');
  const activeRepoRef = useRef(activeRepo);
  const activeFilePathRef = useRef(activeFilePath);
  const currentUsernameRef = useRef(user ? user.username : (username || 'Anonymous'));

  // Keep local socket ID synchronized
  useEffect(() => {
    if (!socket) return;
    setLocalSocketId(socket.id || '');
    const interval = setInterval(() => {
      if (socket.id && socket.id !== localSocketId) {
        setLocalSocketId(socket.id);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [socket, localSocketId]);

  const [activeRepo, setActiveRepo] = useState('');
  const [activeFilePath, setActiveFilePath] = useState('');
  const [roomCreator, setRoomCreator] = useState('');

  // Commit Modal States
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState('Update code via GitShare');
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitStatus, setCommitStatus] = useState(null);

  // Add File Modal States
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [newFileNameInput, setNewFileNameInput] = useState('');
  const [addFileError, setAddFileError] = useState('');

  // Dropdown states
  const [showAddFileDropdown, setShowAddFileDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Comments Sidebar State
  const [showCommentsSidebar, setShowCommentsSidebar] = useState(false);
  const [showWorkspaceSidebar, setShowWorkspaceSidebar] = useState(false);

  // Resizable columns
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(320);
  // Ref to the always-present overlay div — manipulated directly to avoid React render lag
  const overlayRef = useRef(null);
  // Track current widths in refs so closure-captured handlers always have fresh values
  const leftWidthRef = useRef(280);
  const rightWidthRef = useRef(320);
  useEffect(() => { leftWidthRef.current = leftWidth; }, [leftWidth]);
  useEffect(() => { rightWidthRef.current = rightWidth; }, [rightWidth]);

  const startResize = (side, e) => {
    e.preventDefault();
    const overlay = overlayRef.current;
    if (!overlay) return;

    const startX = e.clientX;
    const startW = side === 'left' ? leftWidthRef.current : rightWidthRef.current;

    // Show overlay synchronously — blocks Monaco iframe BEFORE first mousemove
    overlay.style.display = 'block';

    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      if (side === 'left') {
        const w = Math.max(180, Math.min(500, startW + delta));
        setLeftWidth(w);
        leftWidthRef.current = w;
      } else {
        const w = Math.max(200, Math.min(600, startW - delta));
        setRightWidth(w);
        rightWidthRef.current = w;
      }
    };

    const onUp = () => {
      overlay.style.display = 'none';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startResizeLeft = (e) => startResize('left', e);
  const startResizeRight = (e) => startResize('right', e);

  const hasOpenFiles = openFiles.length > 0;
  const showMobileSidebar = showWorkspaceSidebar && typeof window !== 'undefined' && window.innerWidth < 768;

  const openFilesRef = useRef(openFiles);
  useEffect(() => {
    openFilesRef.current = openFiles;
  }, [openFiles]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowAddFileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const codeRef = useRef(code);
  const activeFileNameRef = useRef(activeFileName);
  const languageRef = useRef(language);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    activeFileNameRef.current = activeFileName;
  }, [activeFileName]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    activeRepoRef.current = activeRepo;
  }, [activeRepo]);

  useEffect(() => {
    activeFilePathRef.current = activeFilePath;
  }, [activeFilePath]);

  useEffect(() => {
    currentUsernameRef.current = user ? user.username : (username || 'Anonymous');
  }, [user, username]);

  const emitPendingCodeChange = () => {
    if (!pendingCodeChangeRef.current || !socketRef.current || !socketRef.current.connected) {
      return false;
    }

    socketRef.current.emit('code-change', pendingCodeChangeRef.current);
    pendingCodeChangeRef.current = null;
    return true;
  };

  const emitPendingCursorMove = () => {
    if (!pendingCursorMoveRef.current || !socketRef.current || !socketRef.current.connected) {
      return false;
    }

    socketRef.current.emit('cursor-move', pendingCursorMoveRef.current);
    pendingCursorMoveRef.current = null;
    return true;
  };

  const scheduleCodeChange = (payload) => {
    pendingCodeChangeRef.current = payload;
    if (codeChangeTimeoutRef.current) {
      clearTimeout(codeChangeTimeoutRef.current);
    }

    codeChangeTimeoutRef.current = setTimeout(() => {
      codeChangeTimeoutRef.current = null;
      emitPendingCodeChange();
    }, 300);
  };

  const scheduleCursorMove = (payload) => {
    pendingCursorMoveRef.current = payload;
    if (cursorMoveTimeoutRef.current) {
      clearTimeout(cursorMoveTimeoutRef.current);
    }

    cursorMoveTimeoutRef.current = setTimeout(() => {
      cursorMoveTimeoutRef.current = null;
      emitPendingCursorMove();
    }, 300);
  };

  const flushQueuedSocketEvents = () => {
    emitPendingCodeChange();
    emitPendingCursorMove();
  };

  useEffect(() => {
    return () => {
      if (codeChangeTimeoutRef.current) {
        clearTimeout(codeChangeTimeoutRef.current);
      }
      if (cursorMoveTimeoutRef.current) {
        clearTimeout(cursorMoveTimeoutRef.current);
      }
      flushQueuedSocketEvents();
    };
  }, []);

  // 1. Fetch comments from MongoDB on mount
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/comments/${targetRoomId}`);
        if (res.ok) {
          const data = await res.json();
          setComments(data);
        }
      } catch (err) {
        console.error('Error fetching comments from database:', err);
      }
    };
    fetchComments();
  }, [targetRoomId]);

  // 2. Setup Socket.io event listeners
  useEffect(() => {
    if (!socket) return;
    socketRef.current = socket;
    setConnected(socket.connected);
    setLocalSocketId(socket.id);

    const onConnect = () => {
      setConnected(true);
      setLocalSocketId(socket.id);

      const currentUsername = user ? user.username : (username || 'Anonymous');
      const avatarUrl = user ? user.avatarUrl : null;
      socket.emit('join-room', {
        roomId: targetRoomId,
        username: currentUsername,
        avatarUrl
      });
      flushQueuedSocketEvents();
    };

    const onDisconnect = () => {
      setConnected(false);
      setRemoteCursors({});
      setRoomUsers([]);
      setRoomCreator('');
    };

    const onCodeChange = (data) => {
      if (data && typeof data === 'object' && data.code !== undefined) {
        const targetName = data.fileName || 'solution.js';
        const targetLang = data.language || 'javascript';

        setOpenFiles(prev => {
          const fileExists = prev.some(f => f.name === targetName);
          if (fileExists) {
            return prev.map(f => f.name === targetName ? {
              ...f,
              code: data.code,
              language: targetLang,
              activeRepo: data.activeRepo || f.activeRepo,
              activeFilePath: data.activeFilePath || f.activeFilePath
            } : f);
          } else {
            return [...prev, {
              name: targetName,
              code: data.code,
              originalCode: data.code,
              language: targetLang,
              activeRepo: data.activeRepo || '',
              activeFilePath: data.activeFilePath || ''
            }];
          }
        });

        // If the changed file is the current active file, update the active editor state
        if (targetName === activeFileNameRef.current) {
          setCode(data.code);
          setLanguage(targetLang);
          if (data.activeRepo !== undefined) setActiveRepo(data.activeRepo);
          if (data.activeFilePath !== undefined) setActiveFilePath(data.activeFilePath);
        }

        if (onChangeCode) {
          onChangeCode(data.code);
        }
      } else {
        setCode(data);
        setOpenFiles(prev => prev.map(f => f.name === activeFileNameRef.current ? { ...f, code: data } : f));
        if (onChangeCode) {
          onChangeCode(data);
        }
      }
    };

    const onRoomUsers = (data) => {
      if (Array.isArray(data)) {
        setRoomUsers(data);
      } else if (data && data.users) {
        setRoomUsers(data.users);
        setRoomCreator(data.creator || '');
      }
      if (socket.id) {
        setLocalSocketId(socket.id);
      }
    };

    const onNewComment = (comment) => {
      setComments(prev => {
        const isDuplicate = prev.some(c =>
          (comment._id && c._id === comment._id) ||
          (comment.id && c.id === comment.id)
        );
        if (isDuplicate) {
          return prev;
        }
        return [comment, ...prev];
      });
    };

    const onCursorMove = ({ socketId, range, username, fileName }) => {
      setRemoteCursors(prev => ({
        ...prev,
        [socketId]: { range, username, fileName }
      }));
    };

    const onDeleteFile = (data) => {
      if (data && data.fileName) {
        setOpenFiles(prev => {
          const remaining = prev.filter(f => f.name !== data.fileName);
          if (remaining.length === 0) return prev; // don't delete if it's the last one

          // If active file is the one being deleted, switch active file
          if (activeFileNameRef.current === data.fileName) {
            const nextFile = remaining[0];
            setActiveFileName(nextFile.name);
            setCode(nextFile.code);
            setLanguage(nextFile.language);
            setActiveRepo(nextFile.activeRepo || '');
            setActiveFilePath(nextFile.activeFilePath || '');
            if (onChangeCode) {
              onChangeCode(nextFile.code);
            }
          }
          return remaining;
        });
      }
    };

    const onUserLeft = ({ socketId }) => {
      setRemoteCursors(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    const onUserJoined = ({ socketId, username: joinedUser }) => {
      // Broadcast all open files to the joined socket/room
      openFilesRef.current.forEach(file => {
        socket.emit('code-change', {
          roomId: targetRoomId,
          code: file.code,
          fileName: file.name,
          language: file.language,
          activeRepo: file.activeRepo || '',
          activeFilePath: file.activeFilePath || ''
        });
      });
    };

    // Register listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('code-change', onCodeChange);
    socket.on('room-users', onRoomUsers);
    socket.on('new-comment', onNewComment);
    socket.on('cursor-move', onCursorMove);
    socket.on('delete-file', onDeleteFile);
    socket.on('user-left', onUserLeft);
    socket.on('user-joined', onUserJoined);

    // If socket is already connected when mounting, emit join-room immediately
    if (socket.connected) {
      const currentUsername = user ? user.username : (username || 'Anonymous');
      const avatarUrl = user ? user.avatarUrl : null;
      socket.emit('join-room', {
        roomId: targetRoomId,
        username: currentUsername,
        avatarUrl
      });
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('code-change', onCodeChange);
      socket.off('room-users', onRoomUsers);
      socket.off('new-comment', onNewComment);
      socket.off('cursor-move', onCursorMove);
      socket.off('delete-file', onDeleteFile);
      socket.off('user-left', onUserLeft);
      socket.off('user-joined', onUserJoined);
    };
  }, [socket, targetRoomId, user, username]);

  // Update Monaco decorations for remote cursors
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const newDecorations = [];

    Object.entries(remoteCursors).forEach(([socketId, cursorData]) => {
      // Only show cursor if the user is currently in the active users list
      const userExists = roomUsers.some(u => u.socketId === socketId);
      if (!userExists) return;

      const { range, fileName } = cursorData;
      if (!range) return;

      // Only show decoration if the user is on the same file!
      if (fileName && fileName !== activeFileName) return;

      // 1. Remote cursor indicator tag
      newDecorations.push({
        range: new monaco.Range(range.lineNumber, range.column, range.lineNumber, range.column),
        options: {
          className: `remote-cursor-${socketId}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      });

      // 2. Active line highlight
      newDecorations.push({
        range: new monaco.Range(range.lineNumber, 1, range.lineNumber, 1),
        options: {
          isWholeLine: true,
          className: `remote-highlight-${socketId}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      });
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [remoteCursors, roomUsers, activeFileName]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.onDidChangeCursorPosition((e) => {
      scheduleCursorMove({
        roomId: targetRoomId,
        range: {
          lineNumber: e.position.lineNumber,
          column: e.position.column
        },
        username: currentUsernameRef.current,
        fileName: activeFileNameRef.current
      });
    });
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/room/${targetRoomId}`;
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      })
      .catch((err) => {
        console.error('Failed to copy: ', err);
      });
  };

  // Fetch GitHub repos
  const fetchGitHubRepos = async () => {
    setGitLoading(true);
    setGitError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/github/repos`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
      } else {
        const errData = await res.json();
        // Check for specific error statuses to show friendly messages
        if (res.status === 401) {
          setGitError('Access Denied: Please log in with GitHub to access repositories.');
        } else if (res.status === 403) {
          setGitError('GitHub API Rate Limit Exceeded. Please try again later.');
        } else {
          setGitError(errData.error || 'Failed to fetch repositories.');
        }
      }
    } catch (err) {
      setGitError('Access Denied: Unable to connect to GitHub service.');
    } finally {
      setGitLoading(false);
    }
  };

  // Fetch directory contents
  const fetchRepoContents = async (repoName, path = '') => {
    setGitLoading(true);
    setGitError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/github/contents?repo=${repoName}&path=${path}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setContents(data);
        setSelectedRepo(repoName);
        setCurrentPath(path);
      } else {
        const errData = await res.json();
        if (res.status === 403) {
          setGitError('Access Denied: Rate limit hit or repository permissions missing.');
        } else {
          setGitError(errData.error || 'Failed to load repository contents.');
        }
      }
    } catch (err) {
      setGitError('Error retrieving file structure.');
    } finally {
      setGitLoading(false);
    }
  };

  // Open file raw content
  const openGitHubFile = async (repoName, filePath) => {
    setGitLoading(true);
    setGitError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/github/file-content?repo=${repoName}&path=${filePath}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();

        // Auto-detect language
        let newLang = 'javascript';
        if (filePath.endsWith('.py')) newLang = 'python';
        else if (filePath.endsWith('.cpp') || filePath.endsWith('.h')) newLang = 'cpp';
        else if (filePath.endsWith('.java')) newLang = 'java';

        const filename = filePath.split('/').pop() || filePath;

        // Save existing active file content first, then add/update openFiles
        setOpenFiles(prev => {
          const updated = prev.map(f => f.name === activeFileNameRef.current ? { ...f, code: codeRef.current } : f);
          const exists = updated.some(f => f.name === filename);
          if (exists) {
            return updated.map(f => f.name === filename ? {
              name: filename,
              code: data.content,
              originalCode: data.content,
              language: newLang,
              activeRepo: repoName,
              activeFilePath: filePath
            } : f);
          } else {
            return [...updated, {
              name: filename,
              code: data.content,
              originalCode: data.content,
              language: newLang,
              activeRepo: repoName,
              activeFilePath: filePath
            }];
          }
        });

        setActiveFileName(filename);
        setLanguage(newLang);
        setCode(data.content);
        setActiveRepo(repoName);
        setActiveFilePath(filePath);

        // Notify other clients via socket
        if (onChangeCode) {
          onChangeCode(data.content);
        }
        scheduleCodeChange({
          roomId: targetRoomId,
          code: data.content,
          fileName: filename,
          language: newLang,
          activeRepo: repoName,
          activeFilePath: filePath
        });

        setShowFileModal(false);
      } else {
        const errData = await res.json();
        setGitError(errData.error || 'Failed to download file.');
      }
    } catch (err) {
      setGitError('Access Denied: Unable to fetch file contents.');
    } finally {
      setGitLoading(false);
    }
  };

  // Handle modal click
  const handleOpenExplore = () => {
    setShowFileModal(true);
    fetchGitHubRepos();
  };

  const handleLanguageChange = (e) => {
    const selectedLang = e.target.value;
    setLanguage(selectedLang);

    if (!activeFileName) {
      setCode(LANGUAGE_TEMPLATES[selectedLang]);
      return;
    }

    // Auto-rename file extension if the file was a default file
    let newFileName = activeFileName;
    if (activeFileName === 'solution.js' && selectedLang === 'python') newFileName = 'solution.py';
    else if (activeFileName === 'solution.js' && selectedLang === 'cpp') newFileName = 'solution.cpp';
    else if (activeFileName === 'solution.js' && selectedLang === 'java') newFileName = 'Solution.java';
    else if (activeFileName === 'solution.py' && selectedLang === 'javascript') newFileName = 'solution.js';
    else if (activeFileName === 'solution.py' && selectedLang === 'cpp') newFileName = 'solution.cpp';
    else if (activeFileName === 'solution.py' && selectedLang === 'java') newFileName = 'Solution.java';
    else if (activeFileName === 'solution.cpp' && selectedLang === 'javascript') newFileName = 'solution.js';
    else if (activeFileName === 'solution.cpp' && selectedLang === 'python') newFileName = 'solution.py';
    else if (activeFileName === 'solution.cpp' && selectedLang === 'java') newFileName = 'Solution.java';
    else if (activeFileName === 'Solution.java' && selectedLang === 'javascript') newFileName = 'solution.js';
    else if (activeFileName === 'Solution.java' && selectedLang === 'python') newFileName = 'solution.py';
    else if (activeFileName === 'Solution.java' && selectedLang === 'cpp') newFileName = 'solution.cpp';

    if (newFileName !== activeFileName) {
      setActiveFileName(newFileName);
    }

    const template = LANGUAGE_TEMPLATES[selectedLang];
    setCode(template);
    if (onChangeCode) {
      onChangeCode(template);
    }

    setOpenFiles(prev => prev.map(f => f.name === activeFileName ? { ...f, name: newFileName, code: template, originalCode: template, language: selectedLang } : f));

    scheduleCodeChange({
      roomId: targetRoomId,
      code: template,
      language: selectedLang,
      fileName: newFileName
    });
  };

  const handleEditorChange = (value) => {
    setCode(value);
    if (onChangeCode) {
      onChangeCode(value);
    }
    setOpenFiles(prev => prev.map(f => f.name === activeFileNameRef.current ? { ...f, code: value } : f));
    scheduleCodeChange({
      roomId: targetRoomId,
      code: value,
      fileName: activeFileNameRef.current,
      language: languageRef.current,
      activeRepo: activeRepoRef.current,
      activeFilePath: activeFilePathRef.current
    });
  };

  const handleSwitchFile = (fileName) => {
    if (fileName === activeFileName) return;

    const targetFile = openFiles.find(f => f.name === fileName);
    if (targetFile) {
      setActiveFileName(targetFile.name);
      setCode(targetFile.code);
      setLanguage(targetFile.language);
      setActiveRepo(targetFile.activeRepo || '');
      setActiveFilePath(targetFile.activeFilePath || '');
      if (onChangeCode) {
        onChangeCode(targetFile.code);
      }

      scheduleCursorMove({
        roomId: targetRoomId,
        range: {
          lineNumber: 1,
          column: 1
        },
        username: currentUsernameRef.current,
        fileName: targetFile.name
      });
    }
  };

  const handleCloseFile = (fileName) => {
    setOpenFiles(prev => {
      const remaining = prev.filter(f => f.name !== fileName);

      if (remaining.length === 0) {
        setActiveFileName('');
        setCode('');
        setLanguage('javascript');
        setActiveRepo('');
        setActiveFilePath('');
        if (onChangeCode) {
          onChangeCode('');
        }
        return remaining;
      }

      if (activeFileName === fileName) {
        const nextFile = remaining[0];
        setActiveFileName(nextFile.name);
        setCode(nextFile.code);
        setLanguage(nextFile.language);
        setActiveRepo(nextFile.activeRepo || '');
        setActiveFilePath(nextFile.activeFilePath || '');
        if (onChangeCode) {
          onChangeCode(nextFile.code);
        }
      }
      return remaining;
    });

    if (socketRef.current) {
      socketRef.current.emit('delete-file', { roomId: targetRoomId, fileName });
    }
  };

  const handleCreateFileSubmit = (e) => {
    e.preventDefault();
    const fileName = newFileNameInput.trim();
    if (!fileName) return;

    if (!/^[a-zA-Z0-9_\-\.]+$/.test(fileName)) {
      setAddFileError('Invalid file name. Only alphanumeric, dots, hyphens, and underscores are allowed.');
      return;
    }

    const fileExists = openFiles.some(f => f.name.toLowerCase() === fileName.toLowerCase());
    if (fileExists) {
      setAddFileError('A file with this name already exists.');
      return;
    }

    const ext = fileName.split('.').pop().toLowerCase();
    let fileLang = 'javascript';
    if (ext === 'py') fileLang = 'python';
    else if (ext === 'cpp' || ext === 'h') fileLang = 'cpp';
    else if (ext === 'java') fileLang = 'java';

    const template = LANGUAGE_TEMPLATES[fileLang] || `// ${fileName}\n`;

    const newFile = {
      name: fileName,
      code: template,
      originalCode: template,
      language: fileLang
    };

    setOpenFiles(prev => {
      const updated = prev.map(f => f.name === activeFileName ? { ...f, code } : f);
      return [...updated, newFile];
    });

    setActiveFileName(fileName);
    setCode(template);
    setLanguage(fileLang);
    setActiveRepo('');
    setActiveFilePath('');
    if (onChangeCode) {
      onChangeCode(template);
    }

    scheduleCodeChange({
      roomId: targetRoomId,
      code: template,
      fileName: fileName,
      language: fileLang
    });

    setNewFileNameInput('');
    setShowAddFileModal(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileContent = event.target.result;
      const fileName = file.name;

      // Validate that the filename does not already exist
      const fileExists = openFiles.some(f => f.name.toLowerCase() === fileName.toLowerCase());
      if (fileExists) {
        alert('A file with this name already exists in the workspace.');
        return;
      }

      // Deduce language from extension
      const ext = fileName.split('.').pop().toLowerCase();
      let fileLang = 'javascript';
      if (ext === 'py') fileLang = 'python';
      else if (ext === 'cpp' || ext === 'h') fileLang = 'cpp';
      else if (ext === 'java') fileLang = 'java';

      const newFile = {
        name: fileName,
        code: fileContent,
        originalCode: fileContent,
        language: fileLang
      };

      setOpenFiles(prev => {
        const updated = prev.map(f => f.name === activeFileName ? { ...f, code } : f);
        return [...updated, newFile];
      });

      setActiveFileName(fileName);
      setCode(fileContent);
      setLanguage(fileLang);
      setActiveRepo('');
      setActiveFilePath('');
      if (onChangeCode) {
        onChangeCode(fileContent);
      }

      scheduleCodeChange({
        roomId: targetRoomId,
        code: fileContent,
        fileName: fileName,
        language: fileLang
      });
    };
    reader.readAsText(file);
    e.target.value = '';
    setShowAddFileDropdown(false);
  };

  const handleCommentClick = (comment) => {
    if (comment.fileName && comment.fileName !== activeFileNameRef.current) {
      // Save current code first
      setOpenFiles(prev => prev.map(f => f.name === activeFileNameRef.current ? { ...f, code: codeRef.current } : f));

      // Switch tab
      const targetFile = openFilesRef.current.find(f => f.name === comment.fileName);
      if (targetFile) {
        setActiveFileName(targetFile.name);
        setCode(targetFile.code);
        setLanguage(targetFile.language);
        setActiveRepo(targetFile.activeRepo || '');
        setActiveFilePath(targetFile.activeFilePath || '');
        if (onChangeCode) {
          onChangeCode(targetFile.code);
        }
      }
    }

    // Jump cursor to the line with a brief timeout
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.revealLineInCenter(comment.lineNumber);
        editorRef.current.setPosition({ lineNumber: comment.lineNumber, column: 1 });
        editorRef.current.focus();
      }
    }, 50);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const currentUsername = user ? user.username : (username || 'Anonymous');
    const currentUserId = user ? user._id : null;

    const commentData = {
      roomId: targetRoomId,
      userId: currentUserId,
      username: currentUsername,
      lineNumber: parseInt(newCommentLine, 10) || 1,
      text: newCommentText.trim(),
      fileName: activeFileName || FILE_NAMES[language]
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commentData)
      });

      if (res.ok) {
        const savedComment = await res.json();
        setComments(prev => [savedComment, ...prev]);

        if (socketRef.current) {
          socketRef.current.emit('new-comment', { roomId: targetRoomId, comment: savedComment });
        }

        setNewCommentText('');
      }
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  const handleFolderBack = () => {
    if (!currentPath) {
      // Go back to repo list
      setSelectedRepo(null);
      setContents([]);
    } else {
      // Go up one level
      const parts = currentPath.split('/');
      parts.pop();
      const parentPath = parts.join('/');
      fetchRepoContents(selectedRepo, parentPath);
    }
  };

  const currentUsername = user ? user.username : (username || 'Anonymous');
  const isCreator = currentUsername === roomCreator;

  const activeFile = openFiles.find(f => f.name === activeFileName);
  const hasChanges = activeFile && activeFile.code !== activeFile.originalCode;

  const handleCommitToGitHub = async (e) => {
    e.preventDefault();
    if (!activeRepo || !activeFilePath) return;

    setCommitLoading(true);
    setCommitStatus(null);

    try {
      const res = await fetch(`${BACKEND_URL}/github/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repo: activeRepo,
          path: activeFilePath,
          code: code,
          message: commitMessage.trim()
        }),
        credentials: 'include'
      });

      if (res.ok) {
        setCommitStatus({ success: true, text: 'Changes successfully committed and pushed to GitHub!' });
        setOpenFiles(prev => prev.map(f => f.name === activeFileNameRef.current ? { ...f, originalCode: codeRef.current } : f));
        setTimeout(() => {
          setShowCommitModal(false);
          setCommitStatus(null);
        }, 2000);
      } else {
        const errData = await res.json();
        setCommitStatus({ success: false, text: errData.error || 'Failed to commit changes.' });
      }
    } catch (err) {
      setCommitStatus({ success: false, text: 'Network connection failed.' });
    } finally {
      setCommitLoading(false);
    }
  };

  return (
    <div className={`flex-1 flex overflow-hidden bg-[#1e1e1e] h-[calc(100vh-73px)] text-slate-200 theme-${theme} relative`}>

      {/* Mobile / split-screen workspace toggle */}
      <button
        onClick={() => setShowWorkspaceSidebar(prev => !prev)}
        className="md:hidden fixed top-3 left-3 z-[90] flex items-center justify-center w-9 h-9 rounded-xl bg-[#1e1e1e] border border-[#2d2d2d] text-slate-300 hover:text-white hover:bg-[#252526] shadow-lg transition cursor-pointer"
        title={showWorkspaceSidebar ? 'Hide Workspace' : 'Show Workspace'}
      >
        <LayoutDashboard className="w-4.5 h-4.5" />
      </button>

      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[85] md:hidden"
          onClick={() => setShowWorkspaceSidebar(false)}
        >
          <aside
            style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }}
            className="absolute left-0 top-0 bottom-0 bg-[#181818] border-r border-[#2d2d2d] flex flex-col flex-shrink-0 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[#2d2d2d] bg-[#1a1a1a] flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">
                Collab Workspace
              </span>
              <button
                onClick={() => setShowWorkspaceSidebar(false)}
                className="p-1 rounded-lg bg-[#252526] hover:bg-[#333333] text-slate-400 hover:text-white transition cursor-pointer"
                title="Close Workspace"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 border-b border-[#2d2d2d] bg-[#1a1a1a]">
              <button
                onClick={handleCopyInviteLink}
                title="Click to copy invite link"
                className="flex items-center justify-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold bg-indigo-950/50 hover:bg-indigo-900/65 border border-indigo-900/40 text-indigo-300 hover:text-white rounded-lg cursor-pointer transition active:scale-95 duration-150 w-full"
              >
                Room: {targetRoomId}
              </button>
              <p className="text-[11px] text-slate-500 mt-2">Real-time developer playground</p>

              {user ? (
                <div className="flex flex-col gap-2 mt-3.5">
                  <button
                    onClick={handleOpenExplore}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-3 rounded-lg text-xs transition duration-200 cursor-pointer shadow-lg shadow-indigo-600/10"
                  >
                    <Github className="w-4 h-4" />
                    Import GitHub File
                  </button>

                  {isCreator && activeRepo && activeFilePath && (
                    <button
                      onClick={() => {
                        setCommitStatus(null);
                        setShowCommitModal(true);
                      }}
                      className={`w-full flex items-center justify-center gap-2 font-semibold py-2 px-3 rounded-lg text-xs transition duration-200 cursor-pointer border ${
                        hasChanges
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/10 border-emerald-500/20'
                          : 'bg-slate-700/80 hover:bg-slate-700 text-slate-300 border-slate-600/40 hover:text-white'
                      }`}
                      title={hasChanges ? "Commit Changes to GitHub" : "No changes to commit"}
                    >
                      <Github className="w-4 h-4" />
                      Commit Changes
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 italic mt-2.5 text-center bg-[#202020]/40 border border-[#2d2d2d]/30 py-1.5 rounded-lg">
                  Sign in with GitHub to import repos
                </div>
              )}
            </div>

            <div className="p-4 border-b border-[#2d2d2d] bg-[#1c1c1c]">
              <div className="text-xs text-slate-400 font-semibold mb-3">Your Profile</div>
              {user ? (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#222222] border border-[#2d2d2d]">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-10 h-10 rounded-full border border-blue-500/20"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-white">{user.username}</div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      GitHub Authenticated
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#222222] border border-[#2d2d2d]">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm">
                    {(username || 'G').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-white">{username || 'Guest'}</div>
                    <div className="text-[10px] text-amber-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Temporary User (Local)
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Active Collaborators ({roomUsers.filter(u => u.socketId !== (localSocketId || socket?.id)).length})</span>
              </div>

              <div className="flex flex-col gap-2">
                {roomUsers
                  .filter(collaborator => collaborator.socketId !== (localSocketId || socket?.id))
                  .map((collaborator, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-[#202020]/40 hover:bg-[#202020]/80 transition duration-150 border border-[#2a2a2a]/30"
                    >
                      <div className="relative">
                        {collaborator.avatarUrl ? (
                          <img
                            src={collaborator.avatarUrl}
                            alt={collaborator.username}
                            className="w-8 h-8 rounded-full border border-blue-500/10"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-900/30 flex items-center justify-center text-xs font-semibold">
                            {collaborator.username.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#181818] rounded-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-300 truncate">
                          {collaborator.username}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Peer Collaborator
                        </div>
                      </div>
                    </div>
                  ))}
                {roomUsers.filter(u => u.socketId !== (localSocketId || socket?.id)).length === 0 && (
                  <div className="text-xs text-slate-500 italic text-center py-4">
                    No peers joined yet.
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[#2d2d2d] bg-[#1a1a1a]">
              <button
                onClick={onLeaveRoom}
                className="w-full flex items-center justify-center gap-2 bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 border border-rose-900/30 hover:border-rose-900/50 py-2.5 rounded-xl transition duration-200 text-xs font-semibold cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Leave Coding Room
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* DRAG OVERLAY — always in DOM, shown/hidden via ref to avoid React render lag.
           position:fixed + inset:0 physically covers Monaco iframe so it can't steal mouse events. */}
      <div
        ref={overlayRef}
        style={{
          display: 'none',
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          cursor: 'col-resize',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      />

      {/* LEFT SIDEBAR: Active Collaborators */}
      <aside 
        style={{ width: `${leftWidth}px`, minWidth: `${leftWidth}px`, maxWidth: `${leftWidth}px` }}
        className="hidden md:flex bg-[#181818] border-r border-[#2d2d2d] flex-col flex-shrink-0"
      >

        {/* Room Header Info */}
        <div className="p-4 border-b border-[#2d2d2d] bg-[#1a1a1a]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">
              Collab Workspace
            </span>
            <button
              onClick={handleCopyInviteLink}
              title="Click to copy invite link"
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold bg-indigo-950/50 hover:bg-indigo-900/65 border border-indigo-900/40 text-indigo-300 hover:text-white rounded-lg cursor-pointer transition active:scale-95 duration-150"
            >
              Room: {targetRoomId}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Real-time developer playground</p>

          {/* GitHub Import Trigger */}
          {user ? (
            <div className="flex flex-col gap-2 mt-3.5">
              <button
                onClick={handleOpenExplore}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-3 rounded-lg text-xs transition duration-200 cursor-pointer shadow-lg shadow-indigo-600/10"
              >
                <Github className="w-4 h-4" />
                Import GitHub File
              </button>

              {isCreator && activeRepo && activeFilePath && (
                <button
                  onClick={() => {
                    setCommitStatus(null);
                    setShowCommitModal(true);
                  }}
                  className={`w-full flex items-center justify-center gap-2 font-semibold py-2 px-3 rounded-lg text-xs transition duration-200 cursor-pointer border ${
                    hasChanges
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/10 border-emerald-500/20'
                      : 'bg-slate-700/80 hover:bg-slate-700 text-slate-300 border-slate-600/40 hover:text-white'
                  }`}
                  title={hasChanges ? "Commit Changes to GitHub" : "No changes to commit"}
                >
                  <Github className="w-4 h-4" />
                  Commit Changes
                </button>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 italic mt-2.5 text-center bg-[#202020]/40 border border-[#2d2d2d]/30 py-1.5 rounded-lg">
              Sign in with GitHub to import repos
            </div>
          )}
        </div>

        {/* Current Logged-in User Profile */}
        <div className="p-4 border-b border-[#2d2d2d] bg-[#1c1c1c]">
          <div className="text-xs text-slate-400 font-semibold mb-3">Your Profile</div>
          {user ? (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#222222] border border-[#2d2d2d]">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-10 h-10 rounded-full border border-blue-500/20"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate text-white">{user.username}</div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  GitHub Authenticated
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#222222] border border-[#2d2d2d]">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm">
                {(username || 'G').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate text-white">{username || 'Guest'}</div>
                <div className="text-[10px] text-amber-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Temporary User (Local)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Collaborators List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Active Collaborators ({roomUsers.filter(u => u.socketId !== (localSocketId || socket?.id)).length})</span>
          </div>

          <div className="flex flex-col gap-2">
            {roomUsers
              .filter(collaborator => collaborator.socketId !== (localSocketId || socket?.id))
              .map((collaborator, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-[#202020]/40 hover:bg-[#202020]/80 transition duration-150 border border-[#2a2a2a]/30"
                >
                  <div className="relative">
                    {collaborator.avatarUrl ? (
                      <img
                        src={collaborator.avatarUrl}
                        alt={collaborator.username}
                        className="w-8 h-8 rounded-full border border-blue-500/10"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-900/30 flex items-center justify-center text-xs font-semibold">
                        {collaborator.username.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#181818] rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-300 truncate">
                      {collaborator.username}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Peer Collaborator
                    </div>
                  </div>
                </div>
              ))}
            {roomUsers.filter(u => u.socketId !== (localSocketId || socket?.id)).length === 0 && (
              <div className="text-xs text-slate-500 italic text-center py-4">
                No peers joined yet.
              </div>
            )}
          </div>
        </div>

        {/* Leave Room Actions */}
        <div className="p-4 border-t border-[#2d2d2d] bg-[#1a1a1a]">
          <button
            onClick={onLeaveRoom}
            className="w-full flex items-center justify-center gap-2 bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 border border-rose-900/30 hover:border-rose-900/50 py-2.5 rounded-xl transition duration-200 text-xs font-semibold cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Leave Coding Room
          </button>
        </div>
      </aside>

      {/* LEFT RESIZE HANDLE */}
      <div
        className="hidden md:flex self-stretch relative z-30 items-center justify-center cursor-col-resize flex-shrink-0 select-none group"
        style={{ width: '12px', minWidth: '12px', alignSelf: 'stretch' }}
        onMouseDown={startResizeLeft}
      >
        <div className="w-[3px] h-full rounded-full bg-[#2d2d2d] group-hover:bg-indigo-500 group-active:bg-indigo-400 transition-all duration-150" />
      </div>

      {/* CENTER PANEL: Code Editor */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] overflow-hidden">

        {/* Editor Toolbar Header */}
        <div className="h-12 bg-[#252526] border-b border-[#2d2d2d] px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 max-w-[75%] h-full">
            <div className="flex gap-1.5 mr-3 flex-shrink-0">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>

            {hasOpenFiles ? (
              <>
                <div className="flex items-center gap-1 overflow-x-auto h-full pt-1.5 scrollbar-none">
                  {openFiles.map((file) => {
                    const isActive = file.name === activeFileName;
                    return (
                      <div
                        key={file.name}
                        onClick={() => handleSwitchFile(file.name)}
                        className={`text-xs font-mono flex items-center gap-1.5 px-3 h-10 border border-b-0 rounded-t-lg transition-colors cursor-pointer select-none translate-y-[2px] flex-shrink-0 ${isActive
                            ? 'bg-[#1e1e1e] border-[#2d2d2d] text-slate-300'
                            : 'bg-[#202020] border-transparent text-slate-500 hover:text-slate-300 hover:bg-[#252526]'
                          }`}
                      >
                        <Code className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-600'}`} />
                        <span>{file.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseFile(file.name);
                          }}
                          className="ml-1.5 p-0.5 rounded-full hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer border-0 bg-transparent"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="relative flex-shrink-0 mt-[2px] z-[80]" ref={dropdownRef}>
                  <input
                    type="file"
                    id="file-upload-input"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <button
                    onClick={() => setShowAddFileDropdown(prev => !prev)}
                    title="Add / Import File"
                    className="add-file-tab-btn p-1.5 ml-1 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-slate-400 hover:text-slate-200 border border-[#2d2d2d] transition-colors cursor-pointer flex items-center justify-center h-[30px] w-[30px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {showAddFileDropdown && (
                    <div className="absolute top-9 left-1 mt-1 w-48 bg-[#1c1c1c] border border-[#2d2d2d] rounded-xl shadow-2xl py-1.5 z-[120] pointer-events-auto flex flex-col popup-dropdown">
                      <button
                        onClick={() => {
                          setShowAddFileModal(true);
                          setShowAddFileDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-[#252526] border-0 bg-transparent flex items-center gap-2 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-400" />
                        Create New File
                      </button>
                      <button
                        onClick={() => {
                          document.getElementById('file-upload-input').click();
                          setShowAddFileDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-[#252526] border-0 bg-transparent flex items-center gap-2 transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-indigo-400" />
                        Upload from Computer
                      </button>
                      {user ? (
                        <button
                          onClick={() => {
                            handleOpenExplore();
                            setShowAddFileDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-[#252526] border-0 bg-transparent flex items-center gap-2 transition cursor-pointer"
                        >
                          <Github className="w-3.5 h-3.5 text-emerald-400" />
                          Import from GitHub
                        </button>
                      ) : (
                        <div className="px-3 py-2 text-[10px] text-slate-500 italic border-t border-[#2d2d2d]/30 mt-1">
                          Sign in with GitHub to import
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  onClick={() => setShowAddFileModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create File
                </button>
                <button
                  onClick={() => document.getElementById('file-upload-input').click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-slate-300 text-xs font-semibold border border-[#2d2d2d] transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  Upload File
                </button>
                {user ? (
                  <button
                    onClick={handleOpenExplore}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-slate-300 text-xs font-semibold border border-[#2d2d2d] transition cursor-pointer"
                  >
                    <Github className="w-3.5 h-3.5 text-emerald-400" />
                    Import from GitHub
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1b1b1b] text-slate-500 text-xs font-semibold border border-[#2d2d2d] cursor-not-allowed"
                  >
                    <Github className="w-3.5 h-3.5 text-slate-500" />
                    Import from GitHub
                  </button>
                )}
                <input
                  type="file"
                  id="file-upload-input"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            )}
          </div>

          {hasOpenFiles && (
            <div className="flex items-center gap-3">
              {isCreator && (
                <button
                  onClick={() => {
                    setCommitStatus(null);
                    setShowCommitModal(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-lg transition cursor-pointer ${
                    activeRepo && activeFilePath && hasChanges
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/10 border border-emerald-500/20'
                      : 'bg-slate-700/80 hover:bg-slate-700 text-slate-300 border border-slate-600/40 hover:text-white'
                  }`}
                  title={
                    !activeRepo || !activeFilePath
                      ? "Notice: Import a GitHub file to enable committing"
                      : hasChanges
                        ? "Commit Changes to GitHub (Uncommitted changes present)"
                        : "No changes to commit"
                  }
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>Commit Changes</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                <label className="text-[11px] font-medium text-slate-400">Language:</label>
                <div className="relative">
                  <select
                    value={language}
                    onChange={handleLanguageChange}
                    className="appearance-none bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-300 font-medium focus:outline-none focus:border-blue-500 transition duration-150 cursor-pointer"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Monaco Editor Container */}
        <div className="flex-1 relative bg-[#1e1e1e] overflow-hidden w-full">
          {hasOpenFiles ? (
            <Editor
              height="100%"
              language={language}
              theme={theme === 'light' ? 'light' : 'vs-dark'}
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                fontFamily: 'Consolas, "Fira Code", monospace',
                fontSize: 14,
                minimap: { enabled: false },
                scrollbar: {
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8,
                },
                automaticLayout: true,
                padding: { top: 12 },
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                lineHeight: 22,
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center p-6">
              <div className="w-full max-w-2xl rounded-3xl border border-[#2d2d2d] bg-[#181818] shadow-2xl p-8 md:p-10 text-center flex flex-col gap-6">
                <div className="flex items-center justify-center gap-2 text-slate-400 text-[11px] font-semibold uppercase tracking-[0.3em]">
                  <Code className="w-4 h-4 text-blue-400" />
                  Start Here
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-bold text-white">No file is open yet</h2>
                  <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                    Create a new file, upload one from your computer, or import directly from GitHub to begin editing in the room.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setShowAddFileModal(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 text-sm font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Create File
                  </button>
                  <button
                    onClick={() => document.getElementById('file-upload-input').click()}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#202020] hover:bg-[#252526] text-slate-200 py-3 px-4 text-sm font-semibold border border-[#2d2d2d] transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-indigo-400" />
                    Upload File
                  </button>
                  {user ? (
                    <button
                      onClick={handleOpenExplore}
                      className="flex items-center justify-center gap-2 rounded-xl bg-[#202020] hover:bg-[#252526] text-slate-200 py-3 px-4 text-sm font-semibold border border-[#2d2d2d] transition cursor-pointer"
                    >
                      <Github className="w-4 h-4 text-emerald-400" />
                      Import from GitHub
                    </button>
                  ) : (
                    <button
                      disabled
                      className="flex items-center justify-center gap-2 rounded-xl bg-[#1b1b1b] text-slate-500 py-3 px-4 text-sm font-semibold border border-[#2d2d2d] cursor-not-allowed"
                    >
                      <Github className="w-4 h-4 text-slate-500" />
                      Import from GitHub
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  id="file-upload-input"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Status Bar */}
        <div className="h-7 bg-[#007acc] text-white px-4 flex items-center justify-between text-[11px] font-medium flex-shrink-0 select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Wifi className="w-3.5 h-3.5 animate-pulse" />
              {connected ? 'Live Synced' : 'Offline Mode'}
            </span>
            <span className="text-blue-100">|</span>
            <span>Room: {targetRoomId}</span>
          </div>

          <div className="flex items-center gap-3">
            <span>Spaces: 4</span>
            <span>UTF-8</span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Writable
            </span>
          </div>
        </div>
      </main>

      {/* RIGHT RESIZE HANDLE */}
      {showCommentsSidebar && (
        <div
          className="flex self-stretch relative z-30 items-center justify-center cursor-col-resize flex-shrink-0 select-none group"
          style={{ width: '12px', minWidth: '12px', alignSelf: 'stretch' }}
          onMouseDown={startResizeRight}
        >
          <div className="w-[3px] h-full rounded-full bg-[#2d2d2d] group-hover:bg-indigo-500 group-active:bg-indigo-400 transition-all duration-150" />
        </div>
      )}

      {/* RIGHT SIDEBAR: Pinned Comments */}
      {showCommentsSidebar && (
        <aside 
          style={{ width: `${rightWidth}px`, minWidth: `${rightWidth}px`, maxWidth: `${rightWidth}px` }}
          className="bg-[#181818] border-l border-[#2d2d2d] flex flex-col flex-shrink-0"
        >

          {/* Comments Title */}
          <div className="p-4 border-b border-[#2d2d2d] bg-[#1a1a1a] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <MessageSquare className="w-4.5 h-4.5 text-indigo-400" />
              <span>Pinned Comments ({comments.length})</span>
            </div>
            <button
              onClick={() => setShowCommentsSidebar(false)}
              className="p-1 hover:bg-[#252526] text-slate-400 hover:text-white rounded transition cursor-pointer border-0 bg-transparent"
              title="Close sidebar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add Pinned Comment Form */}
          <div className="p-4 border-b border-[#2d2d2d] bg-[#1c1c1c]">
            <form onSubmit={handleAddComment} className="flex flex-col gap-3">
              <div className="text-[11px] font-semibold text-slate-400">Add Code Comment</div>

              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500">Line Number</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newCommentLine}
                    onChange={(e) => setNewCommentLine(e.target.value)}
                    className="w-full bg-[#252526] border border-[#2d2d2d] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500">Message</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type a review note..."
                    required
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="w-full bg-[#252526] border border-[#2d2d2d] rounded-lg pl-3 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="absolute right-1 top-1 p-1 bg-indigo-600 hover:bg-indigo-500 rounded-md transition duration-150 text-white cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Comments Feed */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
            {comments.map((comment) => (
              <div
                key={comment._id || comment.id}
                onClick={() => handleCommentClick(comment)}
                className="bg-[#202020] border border-[#2d2d2d] rounded-xl p-3.5 shadow-md hover:border-[#383838] cursor-pointer transition duration-150 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {comment.avatarUrl ? (
                      <img
                        src={comment.avatarUrl}
                        alt={comment.username}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 font-bold flex items-center justify-center text-[10px]">
                        {comment.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-slate-200">{comment.username}</span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {comment.fileName && (
                      <span className="text-[9px] font-mono text-slate-400">
                        {comment.fileName}
                      </span>
                    )}
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-blue-950/80 border border-blue-900/30 text-blue-300 rounded-full">
                      Line {comment.lineNumber}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-normal bg-[#181818]/60 p-2 rounded-lg border border-[#2a2a2a]/20">
                  {comment.text}
                </p>

                <div className="text-[9px] text-slate-500 text-right">
                  {comment.createdAt ? new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </div>
              </div>
            ))}

            {comments.length === 0 && (
              <div className="text-xs text-slate-500 italic text-center py-6">
                No comments pinned yet. Set a line number and leave a note above to review code!
              </div>
            )}
          </div>
        </aside>
      )}

      {/* GITHUB FILE EXPLORER MODAL */}
      {showFileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-2xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col shadow-2xl relative">

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#2d2d2d] mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Github className="w-5 h-5 text-indigo-400" />
                {selectedRepo ? 'Browse Files' : 'Import GitHub Repository'}
              </h3>
              <button
                onClick={() => setShowFileModal(false)}
                className="p-1.5 bg-[#252526] hover:bg-[#333333] text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message Banner */}
            {gitError && (
              <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-xl mb-4 flex items-start justify-between">
                <span>⚠️ {gitError}</span>
                <button onClick={() => setGitError(null)} className="text-rose-400 hover:text-white font-bold ml-2">×</button>
              </div>
            )}

            {/* Modal Body / Loading State */}
            {gitLoading && (
              <div className="flex-1 flex flex-col items-center justify-center py-16 gap-4">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-12 h-12 rounded-full border-2 border-indigo-500/20 animate-ping" />
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin relative z-10" />
                </div>
                <span className="text-xs text-indigo-300 font-semibold tracking-wide animate-pulse">Retrieving repository files...</span>
              </div>
            )}

            {/* Repo List View */}
            {!gitLoading && !selectedRepo && (
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                {repos.length === 0 ? (
                  <div className="text-xs text-slate-500 italic text-center py-8">
                    No repositories found or access token expired.
                  </div>
                ) : (
                  repos.map(repo => (
                    <button
                      key={repo.id}
                      onClick={() => fetchRepoContents(repo.fullName)}
                      className="w-full text-left p-3.5 rounded-xl bg-[#222] hover:bg-[#282828] border border-[#2d2d2d]/60 hover:border-[#383838] transition flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                          {repo.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {repo.description || 'No description provided.'}
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${repo.private
                          ? 'bg-amber-950/60 border border-amber-900/30 text-amber-300'
                          : 'bg-emerald-950/60 border border-emerald-900/30 text-emerald-300'
                        }`}>
                        {repo.private ? 'Private' : 'Public'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Folder Browser View */}
            {!gitLoading && selectedRepo && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Explorer Breadcrumbs / Back button */}
                <div className="flex items-center gap-2 mb-3 bg-[#222] p-2 rounded-xl border border-[#2d2d2d]">
                  <button
                    onClick={handleFolderBack}
                    className="flex items-center gap-1 text-[10px] font-semibold bg-[#2a2a2a] hover:bg-[#333] border border-[#3a3a3a] text-slate-300 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <span className="text-[11px] text-slate-400 font-mono truncate">
                    {selectedRepo}/{currentPath}
                  </span>
                </div>

                {/* Directory Contents */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
                  {contents.length === 0 ? (
                    <div className="text-xs text-slate-500 italic text-center py-8">
                      This folder is empty.
                    </div>
                  ) : (
                    contents.map((item, index) => {
                      const isFolder = item.type === 'dir';
                      const isSupportedFile = item.name.endsWith('.js') || item.name.endsWith('.py') || item.name.endsWith('.cpp') || item.name.endsWith('.h') || item.name.endsWith('.java') || item.name.endsWith('.txt') || item.name.endsWith('.json') || item.name.endsWith('.md');

                      return (
                        <button
                          key={index}
                          onClick={() => isFolder ? fetchRepoContents(selectedRepo, item.path) : openGitHubFile(selectedRepo, item.path)}
                          disabled={!isFolder && !isSupportedFile}
                          className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition flex items-center justify-between cursor-pointer ${isFolder
                              ? 'bg-[#222]/30 hover:bg-[#222]/70 border-[#2d2d2d]/30 hover:border-[#383838]'
                              : isSupportedFile
                                ? 'bg-transparent hover:bg-[#252526] border-transparent hover:border-[#2d2d2d]'
                                : 'opacity-40 border-transparent cursor-not-allowed'
                            }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isFolder ? (
                              <Folder className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                            ) : (
                              <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            )}
                            <span className="text-xs text-slate-200 font-medium truncate">{item.name}</span>
                          </div>

                          {!isFolder && isSupportedFile && (
                            <span className="text-[9px] text-slate-500">
                              {(item.size / 1024).toFixed(1)} KB
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic style tag for remote cursors and theme overrides */}
      <style>{`
        ${roomUsers.map((collab, index) => {
        const color = COLORS[index % COLORS.length];
        return `
            .remote-cursor-${collab.socketId} {
              border-left: 2px solid ${color} !important;
              margin-left: -1px;
              position: relative;
            }
            .remote-cursor-${collab.socketId}::after {
              content: '${collab.username}';
              position: absolute;
              top: -16px;
              left: 0;
              background: ${color};
              color: white;
              font-size: 9px;
              font-weight: bold;
              padding: 0px 4.5px;
              border-radius: 2px;
              white-space: nowrap;
              pointer-events: none;
              font-family: system-ui, -apple-system, sans-serif;
              z-index: 10;
              opacity: 0.9;
              height: 14px;
              line-height: 14px;
            }
            .remote-highlight-${collab.socketId} {
              background: ${color}1a !important;
            }
          `;
      }).join('\n')}

        /* Light theme overrides */
        .theme-light {
          background: #f1f5f9 !important;
          color: #1e293b !important;
        }
        .theme-light aside {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #1e293b !important;
        }
        .theme-light aside > div {
          border-color: #cbd5e1 !important;
        }
        .theme-light aside .bg-\\[\\#1a1a1a\\] {
          background: #f8fafc !important;
        }
        .theme-light aside .bg-\\[\\#1c1c1c\\] {
          background: #f1f5f9 !important;
        }
        .theme-light aside .bg-\\[\\#202020\\]\\/40 {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
        }
        .theme-light aside .bg-\\[\\#202020\\]\\/40:hover {
          background: #f1f5f9 !important;
        }
        .theme-light aside .text-slate-300 {
          color: #1e293b !important;
        }
        .theme-light aside .text-slate-400 {
          color: #475569 !important;
        }
        .theme-light aside .text-slate-500 {
          color: #64748b !important;
        }
        .theme-light aside .bg-\\[\\#222222\\] {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
        }
        .theme-light aside .text-white {
          color: #0f172a !important;
        }
        .theme-light main {
          background: #ffffff !important;
          color: #0f172a !important;
        }
        .theme-light main > div:first-child {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
        }
        .theme-light main select {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #1e293b !important;
        }
        .theme-light main button {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #1e293b !important;
        }
        .theme-light main button:hover {
          background: #f8fafc !important;
        }
        .theme-light .font-mono {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #1e293b !important;
        }
        .theme-light .bg-\\[\\#1e1e1e\\] {
          background: #ffffff !important;
        }
        .theme-light form input {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #1e293b !important;
        }
        .theme-light form input::placeholder {
          color: #94a3b8 !important;
        }
        .theme-light .bg-\\[\\#202020\\] {
          background: #ffffff !important;
          border-color: #e2e8f0 !important;
        }
        .theme-light .bg-\\[\\#181818\\]\\/60 {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
          color: #334155 !important;
        }
        .theme-light .bg-\\[\\#252526\\] {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
          color: #1e293b !important;
        }
        .theme-light .border-b {
          border-color: #cbd5e1 !important;
        }
        .theme-light .border-r {
          border-color: #cbd5e1 !important;
        }
        .theme-light .border-l {
          border-color: #cbd5e1 !important;
        }
        .theme-light .border-t {
          border-color: #cbd5e1 !important;
        }
        .theme-light .text-slate-200 {
          color: #1e293b !important;
        }
        .theme-light .bg-indigo-950\\/60 {
          background: #e0e7ff !important;
          color: #3730a3 !important;
          border-color: #c7d2fe !important;
        }
        .theme-light .text-indigo-300 {
          color: #3730a3 !important;
        }
        /* Resize handle global drag overlay - prevents iframe/editor from stealing events */
        body.resizing-active * {
          cursor: col-resize !important;
          user-select: none !important;
        }
        body.resizing-active iframe {
          pointer-events: none !important;
        }
      `}</style>

      {/* Copy Invite Link Toast Notification */}
      {showToast && (
        <div className="fixed bottom-12 right-6 z-50 flex items-center gap-2 bg-[#0b101f]/95 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl shadow-lg shadow-emerald-950/20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-semibold">Invite link copied to clipboard!</span>
        </div>
      )}

      {/* COMMIT TO GITHUB MODAL */}
      {showCommitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#2d2d2d] mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Github className="w-5 h-5 text-emerald-400" />
                Commit to GitHub
              </h3>
              <button
                onClick={() => setShowCommitModal(false)}
                className="p-1.5 bg-[#252526] hover:bg-[#333333] text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Commit Form or Import Guidance */}
            {(!activeRepo || !activeFilePath) ? (
              <div className="flex flex-col gap-3 py-4 text-center">
                <p className="text-sm text-slate-200 font-semibold">
                  No active GitHub file loaded
                </p>
                <p className="text-xs text-slate-450 leading-relaxed max-w-xs mx-auto">
                  To commit code, please first log in with GitHub, click <strong className="text-indigo-400">Import GitHub File</strong> in the left panel, and open a repository file.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCommitModal(false)}
                  className="mt-4 w-full py-2.5 bg-[#252526] hover:bg-[#333] border border-[#2d2d2d] text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleCommitToGitHub} className="flex flex-col gap-4">
                <div className="text-xs text-slate-400 flex flex-col gap-1 bg-[#222]/30 p-3 rounded-xl border border-[#2d2d2d]/45">
                  <div><span className="font-semibold text-slate-300">Repo:</span> {activeRepo}</div>
                  <div className="mt-1"><span className="font-semibold text-slate-300">File Path:</span> {activeFilePath}</div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Commit Message</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Update index.js via GitShare"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full bg-[#252526] border border-[#2d2d2d] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                {commitStatus && (
                  <div className={`text-xs p-3 rounded-xl border flex items-center gap-2 ${commitStatus.success
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-950/40 border-rose-500/30 text-rose-400'
                    }`}>
                    <span>{commitStatus.success ? '✅' : '⚠️'} {commitStatus.text}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCommitModal(false)}
                    className="px-4 py-2 bg-[#252526] hover:bg-[#333] border border-[#2d2d2d] text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={commitLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-2"
                  >
                    {commitLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {commitLoading ? 'Pushing...' : 'Commit & Push'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CREATE NEW FILE MODAL */}
      {showAddFileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowAddFileModal(false);
                setNewFileNameInput('');
                setAddFileError('');
              }}
              className="absolute right-4 top-4 p-1.5 bg-[#252526] hover:bg-[#333333] text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Create New File
            </h3>

            <form onSubmit={handleCreateFileSubmit}>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">File Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. utils.js, test.py, style.css"
                    value={newFileNameInput}
                    onChange={(e) => {
                      setNewFileNameInput(e.target.value);
                      setAddFileError('');
                    }}
                    className="w-full bg-[#252526] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  {addFileError && (
                    <span className="text-[10px] text-rose-500 mt-1 block">
                      {addFileError}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-semibold transition cursor-pointer mt-2"
                >
                  Create File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Comment Toggle Button in Bottom Right */}
        <button
          onClick={() => setShowCommentsSidebar(prev => !prev)}
          title={showCommentsSidebar ? "Hide Comments" : "Open Comments"}
        className="fixed bottom-12 right-6 z-40 p-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl transition duration-200 cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95 border border-indigo-500/20 shadow-lg shadow-indigo-600/30"
      >
        <MessageSquare className="w-5 h-5 text-white" />
        {comments.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center border border-[#1e1e1e]">
            {comments.length}
          </span>
        )}
      </button>

    </div>
  );
}

export default EditorWorkspace;
