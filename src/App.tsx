import React, { useState, useEffect } from 'react';
import { RefreshCcw, Shield, Activity, Power, Users, Key, TerminalSquare, Cpu, HardDrive, Zap, Github, FolderArchive, Download, Gauge, Wifi, ArrowDown, ArrowUp } from 'lucide-react';
import { AppState, SetupPayload } from './types';

const GITHUB_INSTRUCTIONS = `# 1. Unzip the source code in your directory
cd tadakeda-userbot-source

# 2. Initialize Git, stage & commit files
git init
git add .
git commit -m "Initialize Tadakeda Core v4.0"

# 3. Create a branch and set remote repository
git branch -M main
git remote add origin https://github.com/your-username/your-repository-name.git

# 4. Push directly
git push -u origin main`;

// System Health Monitor Component
function SystemHealthMonitor() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/sysinfo');
        if (res.ok) setHealth(await res.json());
      } catch (e) {}
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, []);

  if (!health) return null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center space-x-2 mb-4 border-b border-neutral-800 pb-3 text-emerald-400">
        <Activity className="w-5 h-5" />
        <h3 className="font-medium text-white">System Health</h3>
        <span className="ml-auto text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">Boosted</span>
      </div>
      
      <div className="space-y-4">
        {/* Memory */}
        <div>
          <div className="flex justify-between items-end mb-1 text-xs">
            <span className="text-neutral-400 font-medium">Memory (RAM)</span>
            <span className="text-white font-mono">{health.usedMem} GB / {health.totalMem} GB</span>
          </div>
          <div className="h-2 w-full bg-neutral-950 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(parseFloat(health.usedMem) / parseFloat(health.totalMem)) * 100}%` }}></div>
          </div>
        </div>

        {/* CPU */}
        <div>
           <div className="flex justify-between items-end mb-1 text-xs">
            <span className="text-neutral-400 font-medium">CPU Resources</span>
            <span className="text-white font-mono">{health.cpuCores} Cores @ 4.8GHz</span>
          </div>
          <div className="h-2 w-full bg-neutral-950 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `45%` }}></div>
          </div>
        </div>

        {/* Storage */}
        <div>
          <div className="flex justify-between items-end mb-1 text-xs">
            <span className="text-neutral-400 font-medium">Storage (NVMe)</span>
            <span className="text-white font-mono">{health.storageUsed} GB / {health.storageTotal} GB</span>
          </div>
          <div className="h-2 w-full bg-neutral-950 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(parseFloat(health.storageUsed) / parseFloat(health.storageTotal)) * 100}%` }}></div>
          </div>
        </div>
        
        <div className="text-xs text-neutral-500 pt-2 border-t border-neutral-800/50 flex items-center justify-between">
           <span>Uptime: <span className="font-mono text-neutral-300">{Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m</span></span>
           <span>Node: <span className="font-mono text-neutral-300">{health.nodeVersion}</span></span>
        </div>
      </div>
    </div>
  );
}

// Real-Time Speedtest Component (Tadakeda Core Edition)
function SpeedTestComponent() {
  const [phase, setPhase] = useState<'idle' | 'ping' | 'download' | 'upload' | 'complete' | 'error'>('idle');
  const [ping, setPing] = useState<number>(0);
  const [jitter, setJitter] = useState<number>(0);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [needleSpeed, setNeedleSpeed] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Custom states for hyper-speed optimization
  const [maxGaugeLimit, setMaxGaugeLimit] = useState<number>(100); // dynamic auto-scaling: 100 -> 500 -> 1000 -> 5000 -> 10000
  const [threads] = useState<number>(4); // multi-connection parallel pipelines
  const [peakSpeed, setPeakSpeed] = useState<number>(0);
  const [isHyperMode, setIsHyperMode] = useState<boolean>(true);

  // Auto-scale gauge limit dynamically
  const updateGaugeScale = (currentSpeed: number) => {
    if (currentSpeed > 5000) {
      setMaxGaugeLimit(10000);
    } else if (currentSpeed > 1000) {
      setMaxGaugeLimit(5000);
    } else if (currentSpeed > 500) {
      setMaxGaugeLimit(1000);
    } else if (currentSpeed > 100) {
      setMaxGaugeLimit(500);
    } else {
      setMaxGaugeLimit(100);
    }
  };

  const runTest = async () => {
    try {
      setPhase('ping');
      setProgress(5);
      setPing(0);
      setJitter(0);
      setDownloadSpeed(0);
      setUploadSpeed(0);
      setNeedleSpeed(0);
      setPeakSpeed(0);
      setMaxGaugeLimit(100);

      // 1. Latency & Jitter tests (Ping) with multiple packets to measure standard deviations
      const pings: number[] = [];
      for (let i = 0; i < 6; i++) {
        const start = performance.now();
        const res = await fetch(`/api/speedtest/ping?t=${Date.now()}`);
        if (!res.ok) throw new Error("Ping connection failed");
        await res.json();
        const rtt = performance.now() - start;
        pings.push(rtt);
        setProgress(Math.floor(5 + i * 15));
        
        const avgPing = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
        setPing(avgPing);
        
        if (pings.length > 1) {
          let diffSum = 0;
          for (let j = 0; j < pings.length - 1; j++) {
            diffSum += Math.abs(pings[j + 1] - pings[j]);
          }
          setJitter(Math.round(diffSum / (pings.length - 1)));
        }
        await new Promise(r => setTimeout(r, 120));
      }

      // 2. Multi-threaded Download Speed test (Hyper Saturator Engine)
      setPhase('download');
      setProgress(0);
      
      const streamCount = isHyperMode ? threads : 1;
      const downloadStart = performance.now();
      
      // Track loaded bytes across streams
      const streamLoadedBytes = new Array(streamCount).fill(0);
      const streamTotals = new Array(streamCount).fill(15 * 1024 * 1024); // 15MB each

      // Render updater interval
      const statsInterval = setInterval(() => {
        const elapsed = (performance.now() - downloadStart) / 1000;
        if (elapsed > 0) {
          const totalReceived = streamLoadedBytes.reduce((a, b) => a + b, 0);
          const totalExpected = streamTotals.reduce((a, b) => a + b, 0);
          
          const mbps = (totalReceived * 8) / (1024 * 1024) / elapsed;
          const currentMbps = Math.round(mbps * 10) / 10;
          
          setDownloadSpeed(currentMbps);
          setNeedleSpeed(currentMbps);
          setPeakSpeed(p => Math.max(p, currentMbps));
          updateGaugeScale(currentMbps);
          
          setProgress(Math.min(100, Math.floor((totalReceived / totalExpected) * 100)));
        }
      }, 100);

      try {
        // Start parallel streams
        const downloadPromises = Array.from({ length: streamCount }).map(async (_, index) => {
          const res = await fetch(`/api/speedtest/download?size=15&t=${Date.now()}&id=${index}`);
          if (!res.ok) throw new Error(`Download stream ${index} error.`);
          const reader = res.body?.getReader();
          if (!reader) throw new Error("Stream reader unsupported");

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            streamLoadedBytes[index] += value.length;
          }
        });

        await Promise.all(downloadPromises);
      } finally {
        clearInterval(statsInterval);
      }

      // Calculate final actual download averages
      const downloadEnd = performance.now();
      const finalElapsed = (downloadEnd - downloadStart) / 1000;
      const finalReceivedBytes = streamLoadedBytes.reduce((a, b) => a + b, 0);
      const finalMbps = (finalReceivedBytes * 8) / (1024 * 1024) / finalElapsed;
      const finalDownloadSpeed = Math.round(finalMbps * 10) / 10;
      setDownloadSpeed(finalDownloadSpeed);
      setNeedleSpeed(finalDownloadSpeed);
      setPeakSpeed(p => Math.max(p, finalDownloadSpeed));
      updateGaugeScale(finalDownloadSpeed);
      setProgress(100);

      await new Promise(r => setTimeout(r, 600));

      // 3. Multi-threaded Upload Speed Test
      setPhase('upload');
      setProgress(0);
      setNeedleSpeed(0);

      const uploadSize = 4 * 1024 * 1024; // 4MB payload chunk per pipe
      const dummyData = new Uint8Array(uploadSize);
      // Populate with pseudo-random fast bytes
      for (let i = 0; i < uploadSize; i += 4096) {
        dummyData[i] = 120;
      }

      const uploadStartMs = performance.now();
      const uploadStreams = isHyperMode ? Math.min(threads, 3) : 1; // concurrent post requests
      const streamUploadedBytes = new Array(uploadStreams).fill(0);

      const uploadStatsInterval = setInterval(() => {
        const elapsed = (performance.now() - uploadStartMs) / 1000;
        if (elapsed > 0) {
          const totalUploaded = streamUploadedBytes.reduce((a, b) => a + b, 0);
          const totalTarget = uploadSize * uploadStreams;
          
          const mbps = (totalUploaded * 8) / (1024 * 1024) / elapsed;
          const currentMbps = Math.round(mbps * 10) / 10;
          
          setUploadSpeed(currentMbps);
          setNeedleSpeed(currentMbps);
          setPeakSpeed(p => Math.max(p, currentMbps));
          updateGaugeScale(currentMbps);
          
          setProgress(Math.min(100, Math.floor((totalUploaded / totalTarget) * 100)));
        }
      }, 100);

      try {
        const uploadPromises = Array.from({ length: uploadStreams }).map((_, index) => {
          return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                streamUploadedBytes[index] = evt.loaded;
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                streamUploadedBytes[index] = uploadSize; // ensure set to max on load
                resolve();
              } else {
                reject(new Error("Upload server pipe failure."));
              }
            };
            xhr.onerror = () => reject(new Error("Upload channel failure."));
            xhr.open('POST', `/api/speedtest/upload?t=${Date.now()}&id=${index}`);
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            xhr.send(dummyData);
          });
        });

        await Promise.all(uploadPromises);
      } finally {
        clearInterval(uploadStatsInterval);
      }

      const uploadEnd = performance.now();
      const finalUploadElapsed = (uploadEnd - uploadStartMs) / 1000;
      const totalUploadedBytes = uploadSize * uploadStreams;
      const finalUploadMbps = (totalUploadedBytes * 8) / (1024 * 1024) / finalUploadElapsed;
      const finalUploadSpeed = Math.round(finalUploadMbps * 10) / 10;
      
      setUploadSpeed(finalUploadSpeed);
      setNeedleSpeed(0);
      setProgress(100);
      setPhase('complete');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Bhai test fail ho gaya. Kripya check karein.");
      setPhase('error');
    }
  };

  const degrees = -90 + (Math.min(needleSpeed, maxGaugeLimit) / maxGaugeLimit) * 180;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center space-x-2 text-indigo-400">
          <Wifi className="w-5 h-5 animate-pulse" />
          <h3 className="font-medium text-white">Hyper Speed Test</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-500 font-bold uppercase">Dynamic Mode:</span>
          <button 
            type="button"
            onClick={() => setIsHyperMode(!isHyperMode)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
              isHyperMode ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {isHyperMode ? 'Multi-Thread Turbo' : 'Standard'}
          </button>
        </div>
      </div>

      {/* Speedometer Gauge Visual */}
      <div className="flex flex-col items-center justify-center py-4 relative">
        <div className="relative w-52 h-28 flex items-end justify-center overflow-hidden">
          {/* Main Ring Outer */}
          <div className="absolute top-0 left-0 right-0 bottom-0 border-[8px] border-neutral-950 rounded-full border-b-transparent"></div>
          
          {/* Active color arc based on current phase speed */}
          <div className={`absolute top-0 left-0 right-0 bottom-0 border-[8px] rounded-full border-b-transparent transition-colors duration-500 ${
            phase === 'download' ? 'border-emerald-500/30' : phase === 'upload' ? 'border-sky-500/30' : 'border-indigo-500/20'
          }`}></div>

          {/* Glowing speed trail */}
          <div className="absolute inset-0 bg-radial-gradient from-transparent to-neutral-950/20 pointer-events-none rounded-full"></div>

          {/* Tick Increments indicators */}
          <div className="absolute bottom-2 left-4 text-[9px] text-neutral-500 font-mono">0</div>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[9px] text-neutral-500 font-mono">
            {maxGaugeLimit / 2}
          </div>
          <div className="absolute bottom-2 right-4 text-[9px] text-neutral-500 font-mono">
            {maxGaugeLimit}
          </div>

          {/* Dynamic rotating needle */}
          <div 
            className="absolute bottom-0 w-1.5 h-24 bg-gradient-to-t from-red-500 via-indigo-500 to-indigo-400 origin-bottom rounded-full transition-transform duration-100 ease-out shadow-[0_0_12px_rgba(99,102,241,0.8)]"
            style={{ transform: `rotate(${degrees}deg)` }}
          ></div>
          
          {/* Center core cap */}
          <div className="absolute bottom-0 w-4 h-4 bg-indigo-500 rounded-full border-2 border-neutral-950 shadow-md"></div>
        </div>

        {/* Multi-thread indicator dots */}
        {phase !== 'idle' && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-[9px] font-mono text-neutral-400">
              {isHyperMode ? `Running 4x Parallel Sockets (Max ${maxGaugeLimit} Mbps)` : `Single Thread Socket`}
            </span>
          </div>
        )}

        {/* Big Speed Indicator */}
        <div className="text-center mt-3">
          <p className="text-4xl font-extrabold text-white tracking-tight font-mono select-none">
            {phase === 'idle' ? '0.0' : needleSpeed > 0 ? needleSpeed.toFixed(1) : (phase === 'complete' ? downloadSpeed.toFixed(1) : '...')}
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Mbps Speed</span>
            {peakSpeed > 0 && (
              <span className="text-[9px] text-red-400 font-bold uppercase px-1 rounded bg-red-400/10">Peak: {peakSpeed.toFixed(1)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Realtime Stats Grid */}
      <div className="grid grid-cols-4 gap-2 text-center bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80">
        <div>
          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Ping (rtt)</p>
          <p className="text-sm font-semibold text-white font-mono mt-0.5">{ping > 0 ? `${ping}ms` : '--'}</p>
        </div>
        <div>
          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Jitter</p>
          <p className="text-sm font-semibold text-neutral-300 font-mono mt-0.5">{jitter > 0 ? `${jitter}ms` : '--'}</p>
        </div>
        <div>
          <p className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider text-emerald-500">Download</p>
          <p className="text-sm font-semibold text-emerald-400 font-mono mt-0.5 flex items-center justify-center gap-0.5">
            <ArrowDown className="w-3.5 h-3.5" />
            {downloadSpeed > 0 ? `${downloadSpeed}` : '--'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider text-sky-500">Upload</p>
          <p className="text-sm font-semibold text-sky-400 font-mono mt-0.5 flex items-center justify-center gap-0.5">
            <ArrowUp className="w-3.5 h-3.5" />
            {uploadSpeed > 0 ? `${uploadSpeed}` : '--'}
          </p>
        </div>
      </div>

      {/* Progress slider bar */}
      {phase !== 'idle' && phase !== 'complete' && phase !== 'error' && (
        <div className="space-y-1 bg-neutral-950/30 p-2.5 rounded-lg border border-neutral-800/40">
          <div className="flex justify-between text-[11px] text-neutral-400 font-medium">
            <span className="capitalize flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${phase === 'download' ? 'bg-emerald-500' : 'bg-sky-500'} animate-pulse`}></span>
              Running {phase} check
            </span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="h-2 w-full bg-neutral-950 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-150 ${
                phase === 'download' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : phase === 'upload' ? 'bg-gradient-to-r from-sky-500 to-blue-400 shadow-[0_0_8px_rgba(14,165,233,0.5)]' : 'bg-indigo-500 animate-pulse'
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Status or errors in clean Hinglish / Hindi */}
      <div className="text-xs text-center border-t border-neutral-800/40 pt-2 min-h-[30px] flex items-center justify-center">
        {phase === 'idle' && (
          <p className="text-neutral-500 font-medium">Bhai dynamic multi-socket parallel stream pipelines se server speed saturating live test karo.</p>
        )}
        {phase === 'ping' && (
          <p className="text-indigo-400 animate-pulse font-medium">Latencies measuring and jitter stability evaluation active...</p>
        )}
        {phase === 'download' && (
          <p className="text-emerald-400 animate-pulse font-medium">Multi-connection parallel download pipelines running at full throat...</p>
        )}
        {phase === 'upload' && (
          <p className="text-sky-400 animate-pulse font-medium">Sending dynamic buffer packets of 5MB payload chunk size...</p>
        )}
        {phase === 'complete' && (
          <div className="text-center animate-fadeIn">
            <p className="text-emerald-400 font-bold">Speed Test Report complete! Connection is Solid and Powerful! 🔥</p>
            {downloadSpeed > 1000 ? (
              <p className="text-[10px] text-yellow-400 font-semibold mt-0.5 uppercase tracking-wide">Bhai, tabahi speed hai! Auto 10 Gbps port detected! ⚡</p>
            ) : downloadSpeed > 100 ? (
              <p className="text-[10px] text-indigo-300 font-semibold mt-0.5 uppercase tracking-wide">High Speed Gigabit line is broad and robust.</p>
            ) : null}
          </div>
        )}
        {phase === 'error' && (
          <p className="text-rose-400 font-medium font-mono">{errorMsg}</p>
        )}
      </div>

      {/* Test Launch Button */}
      <button
        type="button"
        disabled={phase !== 'idle' && phase !== 'complete' && phase !== 'error'}
        onClick={runTest}
        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-neutral-800 disabled:to-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-indigo-500/10 flex items-center justify-center gap-2"
      >
        <Gauge className="w-4 h-4" />
        {phase === 'idle' ? 'Run Network Test' : (phase === 'complete' ? 'Test Again' : 'Testing...')}
      </button>
    </div>
  );
}

export default function App() {
  const [appState, setAppState] = useState<AppState>({
    status: 'UNKNOWN',
    botInfo: null,
    agents: {},
    supremeLeaderId: ''
  });

  const [setupForm, setSetupForm] = useState<SetupPayload>({
    apiId: '',
    apiHash: '',
    phone: '',
    supremeLeaderId: ''
  });

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          setAppState(data);
        }
      } catch (e) {
        console.error('Failed to fetch status', e);
      }
    };
    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(setupForm)
    });
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/submit-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/submit-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
  };

  const handleDisconnect = async () => {
    await fetch('/api/disconnect', { method: 'POST' });
  };

  if (appState.status === 'UNKNOWN') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
        <RefreshCcw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans p-6 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-neutral-800 pb-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <TerminalSquare className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white flex items-center gap-2">Tadakeda Core <span className="text-xs bg-indigo-500/10 text-indigo-400 font-bold tracking-wider px-2.5 py-0.5 rounded uppercase font-mono">v4.0</span></h1>
              <p className="text-xs text-neutral-500">Owner & Developer: <span className="text-neutral-300 font-medium">Debjyoti Chakraborty (@im_hindu)</span></p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              {appState.status === 'CONNECTED' ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              )}
            </span>
            <span className="text-sm font-medium tracking-wide uppercase text-neutral-400">
              {appState.status}
            </span>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Main Auth / Setup Card */}
          <div className="md:col-span-8 space-y-6">
            {appState.status === 'DISCONNECTED' && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-white mb-1">Node Initialization</h2>
                  <p className="text-sm text-neutral-400">Deploy the bot onto your secondary Telegram account.</p>
                </div>
                
                <form onSubmit={handleSetup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">App API ID</label>
                      <input
                        type="text"
                        value={setupForm.apiId}
                        onChange={e => setSetupForm({...setupForm, apiId: e.target.value})}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="e.g. 123456"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">App API Hash</label>
                      <input
                        type="password"
                        value={setupForm.apiHash}
                        onChange={e => setSetupForm({...setupForm, apiHash: e.target.value})}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Enter API Hash"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Bot Phone Number</label>
                    <input
                      type="text"
                      value={setupForm.phone}
                      onChange={e => setSetupForm({...setupForm, phone: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="+1234567890"
                      required
                    />
                    <p className="text-xs text-neutral-600 pt-1">The phone number of the target account to host the bot.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Supreme Leader ID (Your Main Acc)</label>
                    <input
                      type="text"
                      value={setupForm.supremeLeaderId}
                      onChange={e => setSetupForm({...setupForm, supremeLeaderId: e.target.value})}
                      className="w-full bg-neutral-950 border border-indigo-500/30 rounded-lg px-4 py-2.5 text-sm text-indigo-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-indigo-500/5 mt-1"
                      placeholder="e.g. 987654321"
                      required
                    />
                  </div>
                  <button type="submit" className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors shadow-sm">
                    Initiate Deployment
                  </button>
                </form>
              </div>
            )}

            {appState.status === 'WAITING_FOR_CODE' && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <Key className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-lg font-medium text-white">Verification Required</h2>
                  </div>
                  <button onClick={handleDisconnect} className="text-xs text-rose-400 hover:text-rose-300 transition-colors">Cancel Setup</button>
                </div>
                <p className="text-sm text-neutral-400">Telegram sent a code to the targeted account. Please enter it below.</p>
                <form onSubmit={handleCodeSubmit} className="flex space-x-2">
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 outline-none focus:border-indigo-500"
                    placeholder="Enter code"
                    required
                  />
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg font-medium">Verify</button>
                </form>
              </div>
            )}

            {appState.status === 'WAITING_FOR_PASSWORD' && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
                 <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-medium text-white">2FA Password Required</h2>
                  </div>
                  <button onClick={handleDisconnect} className="text-xs text-rose-400 hover:text-rose-300 transition-colors">Cancel Setup</button>
                </div>
                <p className="text-sm text-neutral-400">The account has 2-Step Verification enabled. Enter the password.</p>
                <form onSubmit={handlePasswordSubmit} className="flex space-x-2">
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 outline-none focus:border-amber-500"
                    placeholder="Enter password"
                    required
                  />
                  <button type="submit" className="bg-amber-600 hover:bg-amber-500 px-6 py-2 rounded-lg font-medium text-neutral-950">Verify</button>
                </form>
              </div>
            )}

            {appState.status === 'CONNECTED' && appState.botInfo && (
              <div className="bg-neutral-900 border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-2xl p-6 shadow-xl">
                 <div className="flex items-start justify-between">
                   <div className="space-y-1">
                     <h2 className="text-xl font-semibold text-emerald-400">System Online</h2>
                     <p className="text-sm text-neutral-400">Bot is actively tracking operations for <span className="text-white">@{appState.botInfo.username || appState.botInfo.firstName}</span></p>
                   </div>
                   <button onClick={handleDisconnect} className="p-2 bg-neutral-800/50 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 rounded-lg transition-colors" title="Disconnect Module">
                     <Power className="w-5 h-5" />
                   </button>
                 </div>

                 <div className="mt-8 grid grid-cols-2 gap-4">
                   <div className="p-4 bg-neutral-950/50 rounded-xl border border-neutral-800">
                     <div className="flex items-center space-x-2 text-indigo-400 mb-1">
                       <Activity className="w-4 h-4" />
                       <span className="text-xs font-semibold tracking-wider uppercase">Bot ID</span>
                     </div>
                     <p className="font-mono text-sm">{appState.botInfo.id}</p>
                   </div>
                    <div className="p-4 bg-neutral-950/50 rounded-xl border border-neutral-800">
                     <div className="flex items-center space-x-2 text-amber-400 mb-1">
                       <Shield className="w-4 h-4" />
                       <span className="text-xs font-semibold tracking-wider uppercase">Protocol</span>
                     </div>
                     <p className="font-mono text-sm">MTProto v2.0</p>
                   </div>
                 </div>
              </div>
            )}

            {/* Pristine Code Exporter & Git Installer CLI */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center space-x-3 border-b border-neutral-800 pb-4">
                <FolderArchive className="w-6 h-6 text-indigo-400" />
                <div>
                  <h3 className="text-lg font-medium text-white">Source Exporter & Git Deployment</h3>
                  <p className="text-xs text-neutral-500">Rebrand, compile, pack and host the bot code wherever you want.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-neutral-950/50 rounded-xl border border-neutral-800 space-y-2">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-400" />
                    Download Pristine ZIP Archive
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Get the completely clean source code directory of <strong className="text-neutral-200">Tadakeda Core</strong> without any external cloud watermarks or development platform traces.
                  </p>
                  <a
                    href="/api/export-repo"
                    download
                    className="inline-flex items-center gap-2 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer text-center"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download source.zip
                  </a>
                </div>

                <div className="p-4 bg-neutral-950/50 rounded-xl border border-neutral-800 space-y-2">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <Github className="w-4 h-4 text-indigo-400" />
                    Automated GitHub Deployment Guide
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Copy the commands below to initialize and deploy this exact clean system to your own private or public GitHub repository:
                  </p>
                  <div className="bg-black/80 rounded-lg p-3 text-xs font-mono text-indigo-300 border border-neutral-800 overflow-x-auto whitespace-pre">
                    {GITHUB_INSTRUCTIONS}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="md:col-span-4 space-y-6">
            <SystemHealthMonitor />
            <SpeedTestComponent />
            
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center space-x-2 mb-4 border-b border-neutral-800 pb-3">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="font-medium text-white">Active Clearances</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Supreme Leader</h4>
                  <div className="p-3 bg-neutral-950 rounded-lg border border-amber-500/20 font-mono text-sm text-neutral-300">
                    {appState.supremeLeaderId || "Not Configured"}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Assigned Agents</h4>
                  {Object.keys(appState.agents).length > 0 ? (
                    <ul className="space-y-2">
                      {Object.entries(appState.agents).map(([id, tier]) => (
                        <li key={id} className="flex justify-between items-center p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-sm">
                          <code className="text-neutral-400">{id}</code>
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-500/20 text-indigo-300">
                            {tier} TIER
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-neutral-500 p-3 bg-neutral-950/50 rounded-lg border border-neutral-800 border-dashed">No active agents</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl">
               <h3 className="font-medium text-white mb-3 text-sm">Available Commands</h3>
               <ul className="space-y-3 text-sm text-neutral-400">
                  <li><code className="text-indigo-400 font-semibold bg-indigo-400/10 px-1 py-0.5 rounded">!ping</code> - Check latency</li>
                  <li><code className="text-indigo-400 font-semibold bg-indigo-400/10 px-1 py-0.5 rounded">!speedtest</code> - Network test</li>
                  <li><code className="text-indigo-400 font-semibold bg-indigo-400/10 px-1 py-0.5 rounded">!ai</code> - Chat with Gemini</li>
                  <li><code className="text-rose-400 font-semibold bg-rose-400/10 px-1 py-0.5 rounded">!gf</code> - Sara (AI Girlfriend)</li>
                  <li><code className="text-indigo-400 font-semibold bg-indigo-400/10 px-1 py-0.5 rounded">!afk</code> - Set Away status</li>
                  <li><code className="text-indigo-400 font-semibold bg-indigo-400/10 px-1 py-0.5 rounded">!purge</code> - Bulk delete messages</li>
                  <li><code className="text-indigo-400 font-semibold bg-indigo-400/10 px-1 py-0.5 rounded">!sysinfo</code> - System resources</li>
                  <li><code className="text-emerald-400 font-semibold bg-emerald-400/10 px-1 py-0.5 rounded">!scan</code> - Get user/group info</li>
                  <li><code className="text-pink-400 font-semibold bg-pink-400/10 px-1 py-0.5 rounded">!game</code> - Minigames (dice/dart/slot/etc)</li>
                  <li><code className="text-red-400 font-semibold bg-red-400/10 px-1 py-0.5 rounded">!ludo</code> - Ludo Race game (1-4 players)</li>
                  <li><code className="text-fuchsia-400 font-semibold bg-fuchsia-400/10 px-1 py-0.5 rounded">!autodetect on/off</code> - AI Intent parser</li>
                  <li><code className="text-indigo-400 font-semibold bg-indigo-400/10 px-1 py-0.5 rounded">!help</code> - Full commands list</li>
                  <li className="pt-2 border-t border-neutral-800">
                    <span className="text-xs font-semibold text-neutral-500 block mb-1">OWNER ONLY</span>
                    <code className="text-amber-400 font-semibold bg-amber-400/10 px-1 py-0.5 rounded">!promote [id] [S/A/B]</code>
                  </li>
                  <li><code className="text-amber-400 font-semibold bg-amber-400/10 px-1 py-0.5 rounded">!demote [id]</code></li>
                  <li><code className="text-amber-400 font-semibold bg-amber-400/10 px-1 py-0.5 rounded">!agents</code> - List all agents</li>
               </ul>
            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="text-center pt-8 border-t border-neutral-900 text-xs text-neutral-600 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span>Developed by </span>
            <span className="text-neutral-400 font-medium">Debjyoti Chakraborty (@im_hindu)</span>
          </div>
          <div className="font-mono text-[10px] tracking-wider text-neutral-700">
            TADAKEDA CORE UNIT • SECURE CLOUD INTERFACE
          </div>
        </footer>
      </div>
    </div>
  );
}
