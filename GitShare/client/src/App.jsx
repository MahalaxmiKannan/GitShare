import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import EditorWorkspace from './components/EditorWorkspace';
import { API_URL as BACKEND_URL, SOCKET_URL } from '../config.js';
import {
  Terminal,
  Users,
  MessageSquare,
  Layers,
  Wifi,
  Github,
  Code,
  Sparkles,
  Plus,
  ArrowRight,
  Shield,
  Activity,
  UserPlus,
  Sun,
  Moon
} from 'lucide-react';

function App() {
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);

  // Room state
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const favicon = document.getElementById('favicon');
    if (favicon) {
      favicon.href = theme === 'light' ? '/assets/logo-light.png' : '/assets/logo-dark.png';
    }
  }, [theme]);

  // Parse room ID invitation from URL path on mount
  const [inviteRoomId, setInviteRoomId] = useState('');
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/room\/([A-Za-z0-9]+)$/);
    if (match) {
      const targetRoom = match[1].toUpperCase();
      localStorage.setItem('pendingRoomId', targetRoom);
      setInviteRoomId(targetRoom);
      setRoomId(targetRoom);
    }
  }, []);

  // App activity logs
  const [logs, setLogs] = useState([
    { id: 1, type: 'info', text: 'Vite & React initialized successfully.', time: 'Just now' }
  ]);

  // Code editor state
  const [code, setCode] = useState(`// GitShare Collaborative Coding Room
// Try editing this code or highlight lines to collaborate!

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

// Example usage
const peakIndex = findPeakElement([1, 2, 3, 1]);`);

  // Add system logs
  const addLog = (text, type = 'info') => {
    setLogs(prev => [
      { id: Date.now(), type, text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
      ...prev.slice(0, 14) // keep last 15 logs
    ]);
  };

  // Check backend server status
  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/status`);
        if (res.ok) {
          setBackendStatus('online');
          addLog('Backend API connected successfully.', 'success');
        } else {
          setBackendStatus('error');
          addLog('Backend API returned an error status.', 'error');
        }
      } catch (err) {
        setBackendStatus('offline');
        addLog('Backend API connection failed. Ensure server is running.', 'error');
      }
    };

    checkServer();
    // Poll server every 10 seconds
    const interval = setInterval(checkServer, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch logged in user on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/auth/user`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setUsername(data.user.username);
            addLog(`Authenticated as GitHub user: ${data.user.username}`, 'success');
          }
        }
      } catch (err) {
        console.error('Error fetching authenticated user:', err);
      }
    };
    fetchUser();
  }, []);

  // Connect to Socket.io
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      autoConnect: true,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      setSocketStatus('connected');
      addLog(`Socket.io client connected. Socket ID: ${newSocket.id}`, 'success');
    });

    newSocket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') {
        setSocketStatus('disconnected');
        addLog('Socket.io client disconnected.', 'warning');
      } else {
        setSocketStatus('reconnecting');
        addLog(`Socket.io connection lost (${reason}). Reconnecting...`, 'warning');
      }
      setActiveUsers([]);
    });

    newSocket.on('connect_error', () => {
      setSocketStatus('reconnecting');
      addLog('Socket.io connection error. Reconnecting...', 'warning');
    });

    newSocket.io.on('reconnect_attempt', (attempt) => {
      setSocketStatus('reconnecting');
      addLog(`Attempting to reconnect to WebSocket (attempt ${attempt})...`, 'warning');
    });

    newSocket.io.on('reconnect', () => {
      setSocketStatus('connected');
      addLog('WebSocket client successfully reconnected.', 'success');
    });

    newSocket.io.on('reconnect_failed', () => {
      setSocketStatus('error');
      addLog('WebSocket reconnection failed.', 'error');
    });

    newSocket.on('user-joined', ({ username, socketId }) => {
      addLog(`User "${username}" joined room (${socketId.substring(0, 6)}...)`, 'info');
      setActiveUsers(prev => [...prev, { username, socketId }]);
    });

    newSocket.on('user-left', ({ socketId }) => {
      addLog(`User disconnected from room.`, 'info');
      setActiveUsers(prev => prev.filter(u => u.socketId !== socketId));
    });



    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Auto-join pending room if credentials and socket are ready
  useEffect(() => {
    const pending = localStorage.getItem('pendingRoomId');
    if (pending && socket && socketStatus === 'connected') {
      const upperPending = pending.toUpperCase();
      if (user) {
        const nameToUse = user.username;
        socket.emit('join-room', { roomId: upperPending, username: nameToUse });
        setJoinedRoom(upperPending);
        setRoomId(upperPending);
        setActiveUsers([{ username: nameToUse, socketId: socket.id }]);
        addLog(`Auto-joined room "${upperPending}" as GitHub user "${nameToUse}"`, 'success');
        localStorage.removeItem('pendingRoomId');
        setInviteRoomId('');
        window.history.pushState(null, '', `/room/${upperPending}`);
      }
    }
  }, [user, socket, socketStatus]);

  // Actions
  const handleRoomIdChange = (val) => {
    if (val.includes('/room/')) {
      const parts = val.split('/room/');
      const code = parts[parts.length - 1].trim();
      const cleanedCode = code.split('?')[0].split('#')[0];
      setRoomId(cleanedCode.toUpperCase());
    } else {
      setRoomId(val.toUpperCase());
    }
  };

  const handleCreateRoomAndJoin = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      addLog('Please enter a username to create a room.', 'error');
      return;
    }
    const randomId = Math.random().toString(36).substring(2, 9).toUpperCase();
    setRoomId(randomId);

    if (socket && socketStatus === 'connected') {
      socket.emit('join-room', { roomId: randomId, username });
      setJoinedRoom(randomId);
      setActiveUsers([{ username, socketId: socket.id }]);
      addLog(`Created and joined room "${randomId}" as user "${username}"`, 'success');
      localStorage.removeItem('pendingRoomId');
      setInviteRoomId('');
      window.history.pushState(null, '', `/room/${randomId}`);
    } else {
      addLog('Cannot create room: socket is not connected.', 'error');
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!username.trim() || !roomId.trim()) {
      addLog('Please enter a username and Room ID to join.', 'error');
      return;
    }

    if (socket && socketStatus === 'connected') {
      socket.emit('join-room', { roomId, username });
      setJoinedRoom(roomId);
      setActiveUsers([{ username, socketId: socket.id }]);
      addLog(`Successfully joined room "${roomId}" as user "${username}"`, 'success');
      localStorage.removeItem('pendingRoomId');
      setInviteRoomId('');
      window.history.pushState(null, '', `/room/${roomId}`);
    } else {
      addLog('Cannot join room: socket is not connected.', 'error');
    }
  };

  const handleEditorChange = (value) => {
    setCode(value);
  };

  const handleLeaveRoom = () => {
    if (socket && joinedRoom) {
      socket.emit('leave-room', { roomId: joinedRoom });
      setJoinedRoom(null);
      setActiveUsers([]);
      addLog('Left the collaborative room.', 'info');
      window.history.pushState(null, '', '/');
    }
  };

  return (
    <div className={`min-h-screen bg-[#070a13] text-slate-100 flex flex-col selection:bg-blue-500/30 selection:text-blue-200 theme-${theme} transition-colors duration-200`}>
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-[#0b101f]/70 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {theme === 'light' ? (
            <img src="/assets/logo-light.png" alt="GitShare logo" className="w-8 h-8 object-contain" />
          ) : (
            <img src="/assets/logo-dark.png" alt="GitShare logo" className="w-8 h-8 object-contain" />
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              GitShare
            </h1>
            <p className="text-xs text-slate-500">Real-Time Pair Programming</p>
          </div>
        </div>

        {/* Connectivity Badges */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/40 border border-slate-700/50 text-xs">
            <span className="text-slate-400 font-medium">API Server:</span>
            <span className="flex items-center gap-1.5 font-semibold">
              <span className={`w-2.5 h-2.5 rounded-full ${backendStatus === 'online' ? 'bg-emerald-500 shadow-md shadow-emerald-500/30 animate-pulse' :
                  backendStatus === 'connecting' ? 'bg-amber-500' : 'bg-rose-500'
                }`} />
              {backendStatus.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/40 border border-slate-700/50 text-xs">
            <span className="text-slate-400 font-medium">WebSocket:</span>
            <span className="flex items-center gap-1.5 font-semibold">
              <span className={`w-2.5 h-2.5 rounded-full ${
                socketStatus === 'connected' ? 'bg-emerald-500 shadow-md shadow-emerald-500/30 animate-pulse' :
                socketStatus === 'reconnecting' ? 'bg-amber-500 animate-pulse' :
                socketStatus === 'disconnected' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
              {socketStatus === 'reconnecting' ? 'RECONNECTING...' : socketStatus.toUpperCase()}
            </span>
          </div>

          {!joinedRoom && (
            <button
              onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
              className="p-1.5 bg-slate-800/40 hover:bg-slate-700/50 rounded-xl border border-slate-700/50 text-slate-300 hover:text-white transition duration-150 cursor-pointer active:scale-95 flex items-center justify-center h-8 w-8"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-400" />
              )}
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              {user.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-8 h-8 rounded-full border border-blue-500/30"
                />
              )}
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-200">{user.username}</span>
                <span className="text-[10px] text-slate-500">GitHub Member</span>
              </div>
              <a
                href={`${BACKEND_URL}/auth/logout`}
                className="ml-2 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/20 text-xs font-medium transition duration-200"
              >
                Logout
              </a>
            </div>
          ) : (
            <a
              href={`${BACKEND_URL}/auth/github`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition duration-200 text-xs font-semibold text-slate-300 border border-slate-700/60"
            >
              <Github className="w-4 h-4" />
              GitHub Login
            </a>
          )}
        </div>
      </header>

      {/* Main Workspace Layout */}
      {joinedRoom ? (
        <EditorWorkspace
          socket={socket}
          theme={theme}
          user={user}
          username={username}
          roomId={joinedRoom}
          code={code}
          onChangeCode={handleEditorChange}
          onLeaveRoom={handleLeaveRoom}
        />
      ) : (
        <main className="flex-1 p-6 flex flex-col gap-10 max-w-5xl mx-auto w-full justify-center">
          
          {/* Headline / Title */}
          <div className="text-center flex flex-col gap-3 mt-6">
            <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              Real-Time Pair Programming, Reimagined
            </h2>
            <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
              Collaborate in real-time, share files from GitHub, sync editor views, and write peer reviews with line-pinned comments.
            </p>
          </div>

          {/* Setup Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start w-full">
            
            {/* CARD 1: Create a Room */}
            <div className="bg-[#0b101f] border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-5 hover:border-slate-700/80 transition duration-300">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600/10 p-2.5 rounded-xl border border-blue-500/20 text-blue-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Create a New Room</h3>
                  <p className="text-xs text-slate-500">Start a new coding workspace instantly</p>
                </div>
              </div>

              <form onSubmit={handleCreateRoomAndJoin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Your Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#131929] border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition duration-200"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition duration-200 text-sm flex items-center justify-center gap-2 group cursor-pointer"
                >
                  Create & Join Workspace
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>

            {/* CARD 2: Join a Room */}
            <div className="bg-[#0b101f] border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-5 hover:border-slate-700/80 transition duration-300 relative">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600/10 p-2.5 rounded-xl border border-indigo-500/20 text-indigo-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Join an Existing Room</h3>
                  <p className="text-xs text-slate-500">Enter a code or paste the shared link</p>
                </div>
              </div>

              <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
                {inviteRoomId && (
                  <div className="bg-indigo-950/50 border border-indigo-500/35 text-indigo-300 text-xs p-3.5 rounded-xl mb-1 flex flex-col gap-1">
                    <span className="font-semibold text-indigo-200 flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-indigo-400 animate-pulse" /> Invited to Room
                    </span>
                    <span>Enter your username below to automatically join room <strong className="text-white bg-indigo-900/60 px-1.5 py-0.5 rounded border border-indigo-700/50">{inviteRoomId}</strong>.</span>
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">Your Username</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[#131929] border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition duration-200"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">Room ID or Invite Link</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter ID (e.g. 18FL6KP) or paste link..."
                      value={roomId}
                      onChange={(e) => handleRoomIdChange(e.target.value)}
                      className="w-full bg-[#131929] border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition duration-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition duration-200 text-sm flex items-center justify-center gap-2 group cursor-pointer"
                >
                  Join Collaboration Room
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>

          </div>

          {/* Features Grid below setup boxes */}
          <div className="flex flex-col gap-6 mt-4">
            <div className="text-center">
              <span className="text-xs font-bold tracking-wider text-indigo-400 uppercase bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-900/30">
                Core Collaboration Features
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="bg-[#0b101f]/45 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3 hover:border-slate-850 transition duration-150">
                <div className="bg-indigo-950/60 p-2.5 rounded-xl border border-indigo-900/40 text-indigo-400 w-fit">
                  <Github className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">GitHub Sync Bridge</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Authenticate securely via GitHub OAuth to browse repositories and load files directly into the shared editor session.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-[#0b101f]/45 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3 hover:border-slate-850 transition duration-150">
                <div className="bg-indigo-950/60 p-2.5 rounded-xl border border-indigo-900/40 text-indigo-400 w-fit">
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">Real-Time Ghost Cursors</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  See where peer programmers are typing, highlighting, and navigating with colored visual remote cursors and dynamic labels.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-[#0b101f]/45 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3 hover:border-slate-850 transition duration-150">
                <div className="bg-indigo-950/60 p-2.5 rounded-xl border border-indigo-900/40 text-indigo-400 w-fit">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">Line-Pinned Reviews</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Attach specific review notes and comments directly to line numbers that sync across all screens, powered by MongoDB persistence.
                </p>
              </div>
            </div>
          </div>

        </main>
      )}
    </div>
  );
}

export default App;
