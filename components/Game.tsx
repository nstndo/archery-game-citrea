'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  useAccount, 
  useConnect, 
  useDisconnect, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useChainId, 
  useSwitchChain, 
  usePublicClient,
  useConfig
} from 'wagmi';
import { config, citrea } from './Providers'; 
import { encodeFunctionData } from 'viem';
import { sendTransaction } from '@wagmi/core';

// --- CONFIG ---
const CONTRACT_ADDRESS = "0x7a98360c0Eb052a2B3A98b06a6cd4069582ff84D";
const EXPLORER_URL = "https://explorer.mainnet.citrea.xyz";

const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "level", type: "uint256" }],
    name: "mintScore",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "getLeaderboard",
    outputs: [
      {
        components: [
          { internalType: "address", name: "wallet", type: "address" },
          { internalType: "uint256", name: "maxLevel", type: "uint256" },
          { internalType: "uint256", name: "tokenId", type: "uint256" }
        ],
        internalType: "struct ArcheryScore.PlayerStats[]",
        name: "",
        type: "tuple[]"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

interface Arrow { angle: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; rotation: number; rotSpeed: number; img: HTMLImageElement; size: number; }
interface LeaderboardEntry { address: string; level: number; tokenId: string; isCurrentUser: boolean; }

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();

  const { data: hash, isPending, reset: resetContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [level, setLevel] = useState(1);
  const [arrowsLeft, setArrowsLeft] = useState(10);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLevelComplete, setIsLevelComplete] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('light');
  const [showWalletModal, setShowWalletModal] = useState(false);

  const gameState = useRef<'playing' | 'gameover' | 'level_complete' | 'paused'>('playing');
  const stuckArrows = useRef<Arrow[]>([]);
  const flyingArrow = useRef<{ y: number } | null>(null);
  const particles = useRef<Particle[]>([]);
  const arrowsLeftRef = useRef(10);
  const rotation = useRef(0);
  const currentSpeed = useRef(0.04);
  const targetSpeed = useRef(0.04);
  const rotationChangeTimer = useRef(0);
  const screenDims = useRef({ width: 0, height: 0 });
  const assets = useRef({
    target: null as HTMLImageElement | null,
    shardB: null as HTMLImageElement | null,
    shardAse: null as HTMLImageElement | null,
    shardB_Blue: null as HTMLImageElement | null,
    shardAse_Blue: null as HTMLImageElement | null,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const loadImg = (src: string) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = src;
      return img;
    };
    assets.current.target = loadImg('https://citrea-archery-game.vercel.app/citrus.webp');
    assets.current.shardB = loadImg('https://citrea-archery-game.vercel.app/slice1.webp');
    assets.current.shardAse = loadImg('https://citrea-archery-game.vercel.app/slice2.webp');
    assets.current.shardB_Blue = loadImg('https://citrea-archery-game.vercel.app/slice1.webp');
    assets.current.shardAse_Blue = loadImg('https://citrea-archery-game.vercel.app/slice2.webp');
  }, []);

  const fetchLeaderboard = async () => {
    if (!publicClient) return;
    setIsLoadingLeaderboard(true);
    try {
      const data = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getLeaderboard',
      }) as any[];

      const formatted: LeaderboardEntry[] = data.map((item) => ({
        address: item.wallet,
        level: Number(item.maxLevel),
        tokenId: item.tokenId.toString(),
        isCurrentUser: address ? item.wallet.toLowerCase() === address.toLowerCase() : false,
      }));

      formatted.sort((a, b) => b.level - a.level);
      setLeaderboardData(formatted);
    } catch (e) {
      console.error("Fetch leaderboard error", e);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const resetLevel = (lvl: number) => {
    if (resetContract) resetContract();
    setIsGameOver(false); setIsLevelComplete(false);
    setTimeout(() => {
      setLevel(lvl); setArrowsLeft(10); arrowsLeftRef.current = 10;
      stuckArrows.current = []; flyingArrow.current = null; particles.current = [];
      gameState.current = 'playing';
    }, 100);
  };

  const handleMint = async () => {
    if (!isConnected) {
      setShowWalletModal(true);
      return;
    }

    try {
      let currentChain = chainId;

      if (currentChain !== citrea.id) {
        const switched = await switchChainAsync({ chainId: citrea.id });
        currentChain = switched.id;

        if (currentChain !== citrea.id) {
          alert("Switch network to Citrea");
          return;
        }
      }

      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'mintScore',
        args: [BigInt(level)],
      });

      const hash = await sendTransaction(config, {
        to: CONTRACT_ADDRESS,
        data,
        chainId: citrea.id,
      });

      console.log("TX sent:", hash);

    } catch (error: any) {
      console.error(error);
      alert(error.shortMessage || "Mint failed");
    }
  };

  const handleShare = async () => {
    const text = `I just reached Level ${level} in Citrea Archery! 🎯\n\nCan you beat my score?\n\n`;
    const url = 'https://citrea-archery-game.vercel.app';
    const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Citrea Archery',
          text: text,
          url: url
        });
        return; 
      } catch (err) {
        console.log('System share cancelled or failed', err);
      }
    }

    window.open(xUrl, '_blank', 'noopener,noreferrer');
  };

  const renderProfile = () => {
    if (isConnected && address) {
      return (
        <button onClick={() => disconnect()} className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all active:scale-95 max-w-[140px] hover:opacity-70 font-orbitron ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200 text-gray-900' : 'bg-white/10 border-white/20 text-white'}`}>
          <span className="text-sm font-medium">{address.slice(0, 4)}...{address.slice(-4)}</span>
        </button>
      );
    }
    return (
      <button onClick={() => setShowWalletModal(true)} className="px-4 py-2 rounded-2xl bg-[#f17c19] text-white text-sm font-bold uppercase tracking-wider active:scale-95 transition-transform font-orbitron">CONNECT</button>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden max-w-[600px] mx-auto" onPointerDown={handlePointerDown}
      style={{ touchAction: 'none', background: currentTheme === 'dark' ? 'linear-gradient(180deg, #000000 0%, #1a1a2e 100%)' : 'linear-gradient(180deg, #ffffff 0%, #e8f4ff 100%)' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }} />

      <div className="absolute inset-0 pointer-events-none flex flex-col" style={{ zIndex: 10 }}>
        {/* Top Bar */}
        <div className={`top-bar flex justify-between items-center px-4 py-4 pt-[calc(15px+env(safe-area-inset-top))] backdrop-blur-md border-b transition-colors duration-300 flex-shrink-0 pointer-events-auto ${currentTheme === 'light' ? 'bg-white/85 border-blue-600/10' : 'bg-[#000020]/85 border-white/10'}`}>
          <div className={`font-orbitron font-black text-lg flex items-center gap-2 uppercase tracking-wide flex-shrink-0 ${currentTheme === 'dark' ? 'text-white' : 'text-black'}`}>
            CITREA <span className="text-[#f17c19]">ARCHERY</span>
          </div>
          <div className="flex gap-2 items-center flex-shrink-0 min-w-0">
            <button onClick={() => setCurrentTheme(t => t === 'dark' ? 'light' : 'dark')} className="p-2 rounded-full hover:bg-gray-500/10 transition-colors flex items-center justify-center">
              {currentTheme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
            </button>
            {renderProfile()}
          </div>
        </div>

        {/* Stats Overlay */}
        <div className="game-stats pointer-events-auto flex items-center justify-center gap-3 px-4 mt-3">
          <button onClick={() => { gameState.current = 'paused'; setShowLeaderboard(true); fetchLeaderboard(); }} className={`w-10 h-10 rounded-full flex justify-center items-center backdrop-blur-sm border active:scale-90 transition-transform ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200 text-blue-600' : 'bg-black/50 border-white/10 text-white'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          </button>
          <div className={`flex flex-col items-center justify-center px-6 py-2 rounded-2xl backdrop-blur-sm border min-w-[140px] ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200' : 'bg-black/50 border-white/10'}`}>
            <div className={`text-sm font-bold font-orbitron ${currentTheme === 'dark' ? 'text-white' : 'text-[#000000]'}`}>LEVEL {level}</div>
            <div className={`text-xs font-bold font-orbitron ${currentTheme === 'dark' ? 'text-white/70' : 'text-[#f17c19]/70'}`}>{arrowsLeft} ARROWS</div>
          </div>
          <button onClick={() => { gameState.current = 'paused'; setShowFaq(true); }} className={`w-10 h-10 rounded-full flex justify-center items-center backdrop-blur-sm border active:scale-90 transition-transform ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200 text-blue-600' : 'bg-black/50 border-white/10 text-white'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
        </div>

        <div className="flex-1 pointer-events-auto flex items-center justify-center p-4">
          {showWalletModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
                <h2 className="text-2xl font-black font-orbitron text-center mb-4 uppercase">CONNECT WALLET</h2>
                <div className="space-y-3">
                  {connectors.reduce((acc: any[], connector) => {
                    if (connector.id === 'injected') {
                      if (!acc.find(c => c.id === 'injected')) acc.push(connector);
                    } else if (connector.id === 'walletConnect') {
                      acc.push(connector);
                    }
                    return acc;
                  }, []).map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => {
                        connect({ connector });
                        setShowWalletModal(false);
                      }}
                      className={`w-full p-4 rounded-xl font-bold font-orbitron transition-all ${
                        currentTheme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {connector.id === 'injected' 
                        ? 'Browser Wallet (Rabby, MM, etc.)' 
                        : 'WalletConnect'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="w-full mt-4 p-3 rounded-xl font-bold font-orbitron bg-[#f17c19] text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showLeaderboard && !showFaq && isGameOver && (
            <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
              <h2 className="text-3xl font-black font-orbitron text-center mb-2">GAME OVER</h2>
              <p className="text-center mb-4 opacity-70 font-orbitron">You hit another arrow!</p>
              <div className="text-center mb-6 p-6 rounded-2xl border border-white/2">
                <div className="text-sm opacity-70 mb-1 font-orbitron">LEVEL REACHED</div>
                <div className="text-6xl font-black font-orbitron text-[#f17c19]">{level}</div>
              </div>
              <div className="flex gap-3 mb-3">
                <button onClick={handleMint} disabled={isPending || isConfirming || isConfirmed} className="flex-1 p-4 rounded-2xl font-bold font-orbitron text-base uppercase bg-[#f17c19] text-white disabled:opacity-50 tracking-widest">{isPending ? 'CONFIRMING...' : isConfirming ? 'MINTING...' : isConfirmed ? 'MINTED!' : 'MINT NFT'}</button>
                <button onClick={handleShare} className="flex-1 p-4 rounded-2xl font-bold font-orbitron text-base uppercase bg-[#f17c19] text-white tracking-widest">SHARE</button>
              </div>
              <button onClick={() => resetLevel(1)} className={`w-full p-4 rounded-2xl font-bold font-orbitron text-base uppercase border ${currentTheme === 'light' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-white/5 text-gray-400 border-white/10'}`}>TRY AGAIN</button>
            </div>
          )}

          {!showLeaderboard && !showFaq && isLevelComplete && (
            <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
              <h2 className="text-3xl font-black font-orbitron text-center mb-2">LEVEL COMPLETE!</h2>
              <p className="text-center mb-6 opacity-70 font-orbitron">Great shot! Ready for the next challenge?</p>
              <button onClick={() => resetLevel(level + 1)} className="w-full p-4 rounded-2xl font-bold font-orbitron text-base uppercase bg-[#f17c19] text-white">NEXT LEVEL</button>
            </div>
          )}
        </div>

        {showFaq && (
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-auto" style={{ zIndex: 20 }}>
            <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
              <h2 className="text-2xl font-black font-orbitron text-center mb-4">GAME RULES</h2>
              <div className="space-y-4 mb-6 font-orbitron">
                <div><h3 className="font-bold mb-1 uppercase">How to play?</h3><p className="text-sm opacity-70">Tap anywhere to shoot. Fill the target without hitting other arrows.</p></div>
                <div><h3 className="font-bold mb-1 uppercase">What are NFTs?</h3><p className="text-sm opacity-70">Your high score can be minted as a unique NFT on the Citrea Mainnet. Free. Just gas fee.</p></div>
                <div><h3 className="font-bold mb-1 uppercase">Is it safe?</h3><p className="text-sm opacity-70">I did my best! The verified contract address is available for viewing on <a href="https://repo.sourcify.dev/4114/0x7a98360c0Eb052a2B3A98b06a6cd4069582ff84D" target="_blank" className="text-[#f17c19]">Sourcify</a> and <a href="https://explorer.mainnet.citrea.xyz/address/0x7a98360c0Eb052a2B3A98b06a6cd4069582ff84D" target="_blank" className="text-[#f17c19]">Citrea explorer</a>.</p></div>
              </div>
              <button onClick={() => { setShowFaq(false); gameState.current = 'playing'; }} className="w-full p-4 rounded-xl font-bold font-orbitron bg-[#f17c19] text-white uppercase">Close</button>
            </div>
          </div>
        )}

        {showLeaderboard && (
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-auto" style={{ zIndex: 20 }}>
            <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
              <h2 className="text-2xl font-black font-orbitron text-center mb-4 uppercase">Leaderboard</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {isLoadingLeaderboard ? <div className="text-center font-orbitron">LOADING...</div> : 
                  leaderboardData.length > 0 ? leaderboardData.map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${item.isCurrentUser ? 'bg-blue-500/20 border-2 border-blue-500' : currentTheme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold font-orbitron">#{i+1} {item.address.slice(0,6)}...{item.address.slice(-4)}</span>
                        <span className="text-xs opacity-70 font-orbitron">Token ID: {item.tokenId}</span>
                      </div>
                      <div className="font-black font-orbitron text-base flex-shrink-0 ml-2 uppercase"><span className="text-sm opacity-70">Lvl</span> {item.level}</div>
                    </div>
                  )) : <div className="text-center py-8 opacity-50 font-orbitron">No champions yet.</div>
                }
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={fetchLeaderboard} className={`flex-1 p-3 rounded-xl font-bold font-orbitron ${currentTheme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>Refresh</button>
                <button onClick={() => { setShowLeaderboard(false); gameState.current = 'playing'; }} className="flex-1 p-3 rounded-xl font-bold font-orbitron bg-[#f17c19] text-white">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
