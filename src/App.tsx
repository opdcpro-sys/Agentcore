import React, { useState, useEffect } from 'react';
import { RefreshCcw, Shield, Activity, Power, Users, Key, TerminalSquare, Cpu, HardDrive, Zap, Github, FolderArchive, Download } from 'lucide-react';
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
