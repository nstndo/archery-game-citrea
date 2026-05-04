'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain, usePublicClient } from 'wagmi';
import { defineChain } from 'viem';

const CHAIN_CONFIG = {
  name: 'Citrea Testnet',
  id: 4114,
  rpc: 'https://rpc.mainnet.citrea.xyz',
  explorer: 'https://explorer.mainnet.citrea.xyz',
  currency: 'cBTC',
  contractAddress: "0x7a98360c0Eb052a2B3A98b06a6cd4069582ff84D" as `0x${string}`,
  gameTitle: "CITREA ARCHERY",
  domain: "https://citrea-archery-game.vercel.app"
};

const currentChain = defineChain({
  id: CHAIN_CONFIG.id,
  name: CHAIN_CONFIG.name,
  nativeCurrency: { name: CHAIN_CONFIG.currency, symbol: CHAIN_CONFIG.currency, decimals: 18 },
  rpcUrls: { default: { http: [CHAIN_CONFIG.rpc] } },
  blockExplorers: { default: { name: 'Explorer', url: CHAIN_CONFIG.explorer } },
});

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

// --- Types ---
interface Arrow { angle: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; rotation: number; rotSpeed: number; img: HTMLImageElement; size: number; }
interface LeaderboardEntry { address: string; level: number; tokenId: string; isCurrentUser: boolean; }

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();

  const { data: hash, isPending, writeContract, reset: resetContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Game state
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
  const assets = useRef({ target: null as HTMLImageElement | null, shardB: null as HTMLImageElement | null, shardAse: null as HTMLImageElement | null });

  // Assets loading
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const loadImg = (src: string) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = src;
      return img;
    };
    assets.current.target = loadImg(`${CHAIN_CONFIG.domain}/citrus.webp`);
    assets.current.shardB = loadImg(`${CHAIN_CONFIG.domain}/slice1.webp`);
    assets.current.shardAse = loadImg(`${CHAIN_CONFIG.domain}/slice2.webp`);
  }, []);

  const fetchLeaderboard = async () => {
    if (!publicClient) return;
    setIsLoadingLeaderboard(true);
    try {
      const data = await publicClient.readContract({
        address: CHAIN_CONFIG.contractAddress,
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

  // Canvas Game Engine (сокращено для фокуса на логике переноса)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let targetRadius = 90;
    const arrowLength = 65;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        screenDims.current = { width, height };
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        targetRadius = width < 380 ? 70 : 80;
      }
    });

    if (containerRef.current) resizeObserver.observe(containerRef.current);

    const loop = () => {
      const { width, height } = screenDims.current;
      if (width === 0 || height === 0) { animationFrameId = requestAnimationFrame(loop); return; }

      ctx.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height * 0.45;
      const startArrowY = height * 0.85;

      // Draw Target
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation.current);
      if (assets.current.target?.complete) {
        ctx.beginPath(); ctx.arc(0, 0, targetRadius, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(assets.current.target, -targetRadius, -targetRadius, targetRadius * 2, targetRadius * 2);
      } else {
        ctx.beginPath(); ctx.arc(0, 0, targetRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#f17c19'; ctx.fill();
      }
      ctx.restore();

      // Draw Stuck Arrows
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation.current);
      stuckArrows.current.forEach(a => {
          ctx.save();
          ctx.rotate(a.angle);
          ctx.translate(targetRadius, 0);
          ctx.fillStyle = currentTheme === 'dark' ? '#ffffff' : '#f17c19';
          ctx.fillRect(0, -1.5, arrowLength, 3);
          ctx.restore();
      });
      ctx.restore();

      // Game Logic
      if (gameState.current === 'playing') {
        rotation.current += currentSpeed.current;
        if (flyingArrow.current) {
          flyingArrow.current.y -= 40;
          if (flyingArrow.current.y <= centerY + targetRadius) {
            let hitAngle = (Math.PI / 2) - rotation.current;
            hitAngle = ((hitAngle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);

            const collision = stuckArrows.current.some(a => {
              let diff = Math.abs(a.angle - hitAngle);
              if (diff > Math.PI) diff = (Math.PI * 2) - diff;
              return diff < 0.15; // Толерантность столкновения
            });

            if (collision) {
              gameState.current = 'gameover';
              setIsGameOver(true);
            } else {
              stuckArrows.current.push({ angle: hitAngle });
              flyingArrow.current = null;
              arrowsLeftRef.current -= 1;
              setArrowsLeft(arrowsLeftRef.current);
              if (arrowsLeftRef.current <= 0) {
                gameState.current = 'paused';
                setIsLevelComplete(true);
              }
            }
          }
        }
      }

      if (flyingArrow.current) {
          ctx.fillStyle = currentTheme === 'dark' ? '#ffffff' : '#f17c19';
          ctx.fillRect(centerX - 1.5, flyingArrow.current.y, 3, arrowLength);
      } else if (arrowsLeftRef.current > 0 && gameState.current === 'playing') {
          ctx.fillStyle = currentTheme === 'dark' ? '#ffffff' : '#f17c19';
          ctx.fillRect(centerX - 1.5, startArrowY, 3, arrowLength);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [currentTheme]);

  // Actions
  const shoot = () => {
    if (gameState.current !== 'playing' || flyingArrow.current || arrowsLeftRef.current <= 0) return;
    flyingArrow.current = { y: screenDims.current.height * 0.85 };
  };

  const resetLevel = (lvl: number) => {
    if (resetContract) resetContract();
    setIsGameOver(false);
    setIsLevelComplete(false);
    setLevel(lvl);
    setArrowsLeft(10);
    arrowsLeftRef.current = 10;
    stuckArrows.current = [];
    flyingArrow.current = null;
    gameState.current = 'playing';
  };

  const handleMint = async () => {
    if (!isConnected) { setShowWalletModal(true); return; }
    if (chainId !== CHAIN_CONFIG.id) {
      await switchChain({ chainId: CHAIN_CONFIG.id });
      return;
    }
    writeContract({
      address: CHAIN_CONFIG.contractAddress,
      abi: CONTRACT_ABI,
      functionName: 'mintScore',
      args: [BigInt(level)],
    });
  };

  const toggleTheme = () => {
    setCurrentTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden max-w-[600px] mx-auto" onPointerDown={(e) => { if(!(e.target as HTMLElement).closest('button')) shoot(); }} style={{ touchAction: 'none', background: currentTheme === 'dark' ? '#000000' : '#ffffff' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* UI Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 backdrop-blur-md">
        <div className={`font-bold ${currentTheme === 'dark' ? 'text-white' : 'text-black'}`}>
          {CHAIN_CONFIG.gameTitle.split(' ')[0]} <span className="text-[#f17c19]">{CHAIN_CONFIG.gameTitle.split(' ')[1]}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleTheme} className="p-2 border rounded-full"> {currentTheme === 'dark' ? '☀️' : '🌙'} </button>
          <button onClick={() => isConnected ? disconnect() : setShowWalletModal(true)} className="px-4 py-2 bg-[#f17c19] text-white rounded-xl text-xs font-bold">
            {isConnected ? `${address?.slice(0,6)}...` : 'CONNECT'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-20 left-0 right-0 flex justify-center gap-4 z-10">
        <div className="bg-black/20 backdrop-blur-md p-2 px-4 rounded-2xl text-center">
            <div className="text-[10px] text-gray-400">LEVEL</div>
            <div className={`font-bold ${currentTheme === 'dark' ? 'text-white' : 'text-black'}`}>{level}</div>
        </div>
        <div className="bg-black/20 backdrop-blur-md p-2 px-4 rounded-2xl text-center">
            <div className="text-[10px] text-gray-400">ARROWS</div>
            <div className={`font-bold ${currentTheme === 'dark' ? 'text-white' : 'text-black'}`}>{arrowsLeft}</div>
        </div>
      </div>

      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-3xl w-full max-w-xs text-black">
            <h3 className="font-bold mb-4 text-center">CHOOSE WALLET</h3>
            <div className="flex flex-col gap-2">
              {connectors.map(c => (
                <button key={c.id} onClick={() => { connect({ connector: c }); setShowWalletModal(false); }} className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
                  {c.name}
                </button>
              ))}
              <button onClick={() => setShowWalletModal(false)} className="mt-2 text-sm text-gray-500">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over / Level Complete Modals */}
      {(isGameOver || isLevelComplete) && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 z-20">
          <div className="bg-white p-8 rounded-3xl w-full text-center text-black">
            <h2 className="text-2xl font-black mb-2">{isGameOver ? 'GAME OVER' : 'LEVEL COMPLETE!'}</h2>
            <div className="text-4xl font-bold text-[#f17c19] mb-6">{level}</div>
            
            {isGameOver ? (
              <div className="flex flex-col gap-3">
                <button onClick={handleMint} className="w-full py-4 bg-[#f17c19] text-white rounded-2xl font-bold">
                    {isPending ? 'MINTING...' : 'MINT SCORE NFT'}
                </button>
                <button onClick={() => resetLevel(1)} className="w-full py-4 bg-gray-100 rounded-2xl font-bold">TRY AGAIN</button>
              </div>
            ) : (
              <button onClick={() => resetLevel(level + 1)} className="w-full py-4 bg-[#f17c19] text-white rounded-2xl font-bold">NEXT LEVEL</button>
            )}
          </div>
        </div>
      )}

      {/* Footer Controls */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-6 z-10">
          <button onClick={() => { fetchLeaderboard(); setShowLeaderboard(true); }} className="text-2xl">🏆</button>
          <button onClick={() => setShowFaq(true)} className="text-2xl">❓</button>
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-3xl w-full max-w-sm text-black max-h-[80vh] flex flex-col">
                  <h3 className="font-bold mb-4">CHAMPIONS</h3>
                  <div className="overflow-y-auto flex-1">
                      {leaderboardData.map((item, i) => (
                          <div key={i} className={`flex justify-between p-3 border-b ${item.isCurrentUser ? 'bg-orange-50' : ''}`}>
                              <span>#{i+1} {item.address.slice(0,6)}...</span>
                              <span className="font-bold">LVL {item.level}</span>
                          </div>
                      ))}
                  </div>
                  <button onClick={() => setShowLeaderboard(false)} className="mt-4 p-3 bg-[#f17c19] text-white rounded-xl">CLOSE</button>
              </div>
          </div>
      )}
    </div>
  );
}
