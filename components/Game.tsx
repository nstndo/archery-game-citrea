'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain, usePublicClient } from 'wagmi';
import { base } from 'viem/chains';
import { useMiniKit } from '@coinbase/onchainkit/minikit';

const BUILDER_CODE = 'bc_lm1dh28q';

function createDataSuffix(code: string): `0x${string}` {
  const cleanCode = code.replace('bc_', '');
  const encoder = new TextEncoder();
  const bytes = encoder.encode(cleanCode);
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex}` as `0x${string}`;
}

const DATA_SUFFIX = createDataSuffix(BUILDER_CODE);

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

const CONTRACT_ADDRESS = "0x432F699F1D35fD49b8B1afc0eA9FAE62F45aDADB";

interface Arrow {
  angle: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  rotation: number;
  rotSpeed: number;
  img: HTMLImageElement;
  size: number;
}

interface LeaderboardEntry {
  address: string;
  level: number;
  tokenId: string;
  isCurrentUser: boolean;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { isFrameReady, setFrameReady, context } = useMiniKit();

  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();

  const { data: hash, isPending, writeContract, reset: resetContract } = useWriteContract();
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
  const [shouldMint, setShouldMint] = useState(false);

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
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

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

  useEffect(() => {
    if (shouldMint && chainId === base.id && isConnected) {
      setShouldMint(false);
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'mintScore',
        args: [BigInt(level)],
        chainId: base.id,
        dataSuffix: DATA_SUFFIX,
      });
    }
  }, [chainId, shouldMint, isConnected, level, writeContract]);

  const fetchUsersByAddresses = async (addresses: string[]) => {
  const NEYNAR_API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
  
  if (!NEYNAR_API_KEY || addresses.length === 0) return {};

  try {
    const addressesParam = addresses.join(',');
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addressesParam}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'api_key': NEYNAR_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.error('Neynar API error:', response.status);
      return {};
    }

    const data = await response.json();
    
    const userMap: Record<string, { username: string; displayName: string; pfpUrl: string }> = {};
    
    Object.entries(data).forEach(([address, users]: [string, any]) => {
      if (users && users.length > 0) {
        const user = users[0];
        userMap[address.toLowerCase()] = {
          username: user.username,
          displayName: user.display_name || user.username,
          pfpUrl: user.pfp_url
        };
      }
    });
    
    return userMap;
  } catch (e) {
    console.error('Failed to fetch Farcaster users', e);
    return {};
  }
};

  const fetchLeaderboard = async () => {
  if (!publicClient) return;

  setIsLoadingLeaderboard(true);
  setLeaderboardData([]);

  try {
    const data = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'getLeaderboard',
    }) as any[];

    const addresses = data.map(item => item.wallet);
    
    const userMap = await fetchUsersByAddresses(addresses);

    const formatted: LeaderboardEntry[] = data.map((item) => {
      const addr = item.wallet.toLowerCase();
      const userData = userMap[addr];
      
      return {
        address: item.wallet,
        level: Number(item.maxLevel),
        tokenId: item.tokenId.toString(),
        isCurrentUser: address ? addr === address.toLowerCase() : false,
        username: userData?.username,
        displayName: userData?.displayName,
        pfpUrl: userData?.pfpUrl
      };
    });

    formatted.sort((a, b) => b.level - a.level);
    setLeaderboardData(formatted);
  } catch (e) {
    console.error("Fetch leaderboard error", e);
  } finally {
    setIsLoadingLeaderboard(false);
  }
};

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
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        targetRadius = width < 380 ? 70 : 80;
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    const drawArrow = (x: number, y: number, angle?: number, isStuck = false) => {
      ctx.save();
      const color = currentTheme === 'dark' ? '#ffffff' : '#f17c19';
      ctx.fillStyle = color;
      ctx.shadowColor = currentTheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgb(248, 99, 6)';
      ctx.shadowBlur = 8;

      if (isStuck) {
        ctx.rotate(angle || 0);
        ctx.translate(targetRadius, 0);
        ctx.beginPath();
        ctx.roundRect(0, -1.5, arrowLength, 3, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(12, -7);
        ctx.lineTo(8, 0);
        ctx.lineTo(12, 7);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        const tailX = arrowLength;
        ctx.moveTo(tailX - 14, 0);
        ctx.lineTo(tailX, -8);
        ctx.lineTo(tailX + 2, -8);
        ctx.lineTo(tailX - 4, 0);
        ctx.lineTo(tailX + 2, 8);
        ctx.lineTo(tailX, 8);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.roundRect(-1.5, 0, 3, arrowLength, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(-7, 12);
        ctx.lineTo(0, 8);
        ctx.lineTo(7, 12);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        const tailY = arrowLength;
        ctx.moveTo(0, tailY - 14);
        ctx.lineTo(-8, tailY);
        ctx.lineTo(-8, tailY + 2);
        ctx.lineTo(0, tailY - 4);
        ctx.lineTo(8, tailY + 2);
        ctx.lineTo(8, tailY);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    };

    const spawnHitParticles = (x: number, y: number) => {
      const bImg = currentTheme === 'dark' ? assets.current.shardB : assets.current.shardB_Blue;
      const aseImg = currentTheme === 'dark' ? assets.current.shardAse : assets.current.shardAse_Blue;
      if (bImg) particles.current.push(createParticle(x, y, bImg, 24));
      if (aseImg) {
        for (let i = 0; i < 3; i++) particles.current.push(createParticle(x, y, aseImg, 18));
      }
    };

    const createParticle = (x: number, y: number, img: HTMLImageElement, size: number): Particle => ({
      x, y,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 1) * 12,
      life: 1.0,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      img,
      size
    });

    const updateAndDrawParticles = () => {
      for (let i = particles.current.length - 1; i >= 0; i--) {
        let p = particles.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.5;
        p.rotation += p.rotSpeed;
        p.life -= 0.02;
        if (p.life <= 0) particles.current.splice(i, 1);
      }

      particles.current.forEach(p => {
        if (p.img.complete) {
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });
    };

    const loop = () => {
      const { width, height } = screenDims.current;
      if (width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height * 0.45;
      const startArrowY = height * 0.85;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation.current);
      if (assets.current.target && assets.current.target.complete) {
        ctx.beginPath();
        ctx.arc(0, 0, targetRadius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(assets.current.target, -targetRadius, -targetRadius, targetRadius * 2, targetRadius * 2);
        ctx.beginPath();
        ctx.arc(0, 0, targetRadius, 0, Math.PI * 2);
        ctx.strokeStyle = currentTheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,255,0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, targetRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#f17c19';
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation.current);
      stuckArrows.current.forEach(a => drawArrow(0, 0, a.angle, true));
      ctx.restore();

      updateAndDrawParticles();

      if (gameState.current === 'playing') {
        rotationChangeTimer.current--;
        if (rotationChangeTimer.current <= 0) {
          rotationChangeTimer.current = 60 + Math.random() * 120;
          const maxSpeed = 0.05 + (level * 0.005);
          const dir = Math.random() > 0.5 ? 1 : -1;
          targetSpeed.current = Math.random() < 0.2 ? 0.01 * dir : (0.02 + Math.random() * maxSpeed) * dir;
        }
        currentSpeed.current += (targetSpeed.current - currentSpeed.current) * 0.03;
        rotation.current += currentSpeed.current;

        if (flyingArrow.current) {
          flyingArrow.current.y -= 40;
          const impactY = centerY + targetRadius;
          if (flyingArrow.current.y <= impactY) {
            flyingArrow.current.y = impactY;
            let hitAngle = (Math.PI / 2) - rotation.current;
            hitAngle = hitAngle % (Math.PI * 2);
            if (hitAngle < 0) hitAngle += Math.PI * 2;

            const collision = stuckArrows.current.some(a => {
              let diff = Math.abs(a.angle - hitAngle);
              if (diff > Math.PI) diff = (Math.PI * 2) - diff;
              return diff < 0.04;
            });

            if (collision) {
              gameState.current = 'gameover';
              setTimeout(() => setIsGameOver(true), 50);
            } else {
              stuckArrows.current.push({ angle: hitAngle });
              flyingArrow.current = null;
              spawnHitParticles(centerX, impactY);
              arrowsLeftRef.current -= 1;
              setArrowsLeft(arrowsLeftRef.current);

              if (arrowsLeftRef.current <= 0) {
                setTimeout(() => {
                gameState.current = 'paused';
                setIsLevelComplete(true);
                }, 50);
              }
            }
          }
        }
      }

      if (flyingArrow.current) {
        drawArrow(centerX, flyingArrow.current.y);
      } else if (arrowsLeftRef.current > 0 && gameState.current === 'playing') {
        drawArrow(centerX, startArrowY);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (containerRef.current) resizeObserver.unobserve(containerRef.current);
      cancelAnimationFrame(animationFrameId);
    };
  }, [currentTheme, context, address]);

  const shoot = () => {
    if (gameState.current !== 'playing' || flyingArrow.current || arrowsLeftRef.current <= 0) return;
    const h = screenDims.current.height;
    flyingArrow.current = { y: h * 0.85 };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (isGameOver || isLevelComplete || target.closest('button') || target.closest('.modal-card') || target.closest('.top-bar') || target.closest('.game-stats')) {
      return;
    }
    e.preventDefault();
    shoot();
  };

  const resetLevel = (lvl: number) => {
    if (resetContract) resetContract();
    
    setIsGameOver(false);
    setIsLevelComplete(false);
    
    setTimeout(() => {
      setLevel(lvl);
      setArrowsLeft(10);
      arrowsLeftRef.current = 10;
      stuckArrows.current = [];
      flyingArrow.current = null;
      particles.current = [];
      gameState.current = 'playing';
    }, 100);
  };

  const toggleTheme = () => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setCurrentTheme(newTheme);
    if (newTheme === 'dark') document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  };

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
      return;
    }

    const isFarcasterMiniApp = context?.client?.clientFid;

    if (isFarcasterMiniApp) {
      const farcasterConnector = connectors.find((c) => c.id === 'farcaster');
      const connector = farcasterConnector || connectors[0];
      if (connector) connect({ connector });
    } else {
      setShowWalletModal(true);
    }
  };

  const connectWithWallet = (connectorId: string) => {
    const connector = connectors.find((c) => c.id === connectorId);
    if (connector) {
      connect({ connector });
      setShowWalletModal(false);
    }
  };

  const closeModal = () => {
    setShowFaq(false);
    setShowLeaderboard(false);
    if (gameState.current === 'paused') gameState.current = 'playing';
  };

  const openModal = (type: 'faq' | 'leaderboard') => {
    gameState.current = 'paused';
    if (type === 'faq') setShowFaq(true);
    if (type === 'leaderboard') {
      setShowLeaderboard(true);
      fetchLeaderboard();
    }
  };

  const handleMint = async () => {
    if (!isConnected) {
      handleConnect();
      return;
    }

    let actualChainId = chainId;
    
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        actualChainId = parseInt(chainIdHex, 16);
      } catch (e) {
        console.error('Failed to get chain from wallet', e);
      }
    }

    if (actualChainId !== base.id) {
      try {
        await switchChain({ chainId: base.id });
        setShouldMint(true);
      } catch (error) {
        console.error("Failed to switch to Base chain", error);
        setShouldMint(false);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
          alert("Chain switch was rejected. Please switch to Base network manually.");
        } else {
          alert("Please switch to Base network in your wallet");
        }
      }
      return;
    }

    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'mintScore',
        args: [BigInt(level)],
        chainId: base.id,
        dataSuffix: DATA_SUFFIX,
      });
    } catch (error) {
      console.error("Write contract failed", error);
    }
  };

  const handleShare = async () => {
    const text = `I just reached Level ${level} in Citrea Archery! 🎯\n\nCan you beat my score?`;
    const url = 'https://citrea-archery-game.vercel.app';

    if (isFrameReady && context) {
      try {
        const { default: sdk } = await import('@farcaster/miniapp-sdk');
        if (sdk.actions?.composeCast) {
          await sdk.actions.composeCast({
            text,
            embeds: [url]
          });
          return;
        }
      } catch (e) {
        console.error("SDK composeCast failed", e);
      }
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Base Archery',
          text: text,
          url: url
        });
      } catch (err) {
        console.log('Share cancelled', err);
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      const shareText = `${text}\n${url}`;
      try {
        await navigator.clipboard.writeText(shareText);
        alert('Link copied to clipboard!');
      } catch (err) {
        console.error('Copy failed', err);
      }
    }
  };

  const renderProfile = () => {
    if (context?.user) {
      return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border max-w-[140px] ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200' : 'bg-white/10 border-white/20'}`}>
          {context.user.pfpUrl && (
            <img 
              src={context.user.pfpUrl} 
              alt="pfp" 
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className={`text-sm font-medium truncate font-orbitron ${currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {context.user.username}
          </span>
        </div>
      );
    }

    if (isConnected && address) {
      return (
        <button
          onClick={() => disconnect()}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all active:scale-95 max-w-[140px] hover:opacity-70 font-orbitron ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200 text-gray-900' : 'bg-white/10 border-white/20 text-white'}`}
        >
          <span className="text-sm font-medium">
            {address.slice(0, 4)}...{address.slice(-4)}
          </span>
        </button>
      );
    }

    return (
      <button
        onClick={handleConnect}
        className="px-4 py-2 rounded-2xl bg-[#0000ff] text-white text-sm font-bold uppercase tracking-wider active:scale-95 transition-transform font-orbitron"
      >
        CONNECT
      </button>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden max-w-[600px] mx-auto"
      onPointerDown={handlePointerDown}
      style={{ 
        touchAction: 'none',
        background: currentTheme === 'dark' 
          ? 'linear-gradient(180deg, #000000 0%, #1a1a2e 100%)'
          : 'linear-gradient(180deg, #ffffff 0%, #e8f4ff 100%)'
      }}
    >
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />

      <div className="absolute inset-0 pointer-events-none flex flex-col" style={{ zIndex: 10 }}>
        {/* Top Bar */}
        <div className={`top-bar flex justify-between items-center px-4 py-4 pt-[calc(15px+env(safe-area-inset-top))] backdrop-blur-md border-b transition-colors duration-300 flex-shrink-0 pointer-events-auto ${currentTheme === 'light' ? 'bg-white/85 border-blue-600/10' : 'bg-[#000020]/85 border-white/10'}`}>
          <div className={`font-orbitron font-black text-lg flex items-center gap-2 uppercase tracking-wide flex-shrink-0 ${currentTheme === 'dark' ? 'text-white' : 'text-black'}`}>
            CITREA <span className="text-[#f17c19]">ARCHERY</span>
          </div>
          <div className="flex gap-2 items-center flex-shrink-0 min-w-0">
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-500/10 transition-colors flex items-center justify-center">
              {currentTheme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-sun"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
            </button>
            {renderProfile()}
          </div>
        </div>

        {/* Stats Overlay */}
        <div className="game-stats pointer-events-auto flex items-center justify-center gap-3 px-4 mt-3">
          <button
            onClick={() => openModal('leaderboard')}
            className={`w-10 h-10 rounded-full flex justify-center items-center backdrop-blur-sm border active:scale-90 transition-transform ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200 text-blue-600' : 'bg-black/50 border-white/10 text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          </button>
          <div className={`flex flex-col items-center justify-center px-6 py-2 rounded-2xl backdrop-blur-sm border min-w-[140px] ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200' : 'bg-black/50 border-white/10'}`}>
            <div className={`text-sm font-bold font-orbitron ${currentTheme === 'dark' ? 'text-white' : 'text-[#000000]'}`}>
              LEVEL {level}
            </div>
            <div className={`text-xs font-bold font-orbitron ${currentTheme === 'dark' ? 'text-white/70' : 'text-[#f17c19]/70'}`}>
              {arrowsLeft} ARROWS
            </div>
          </div>
          <button
            onClick={() => openModal('faq')}
            className={`w-10 h-10 rounded-full flex justify-center items-center backdrop-blur-sm border active:scale-90 transition-transform ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200 text-blue-600' : 'bg-black/50 border-white/10 text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-help-circle"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
        </div>

<div className="flex-1 pointer-events-auto flex items-center justify-center p-4">
  {showWalletModal && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
        <h2 className="text-2xl font-black font-orbitron text-center mb-4">CONNECT WALLET</h2>
        <div className="space-y-3">
          {connectors
            .filter(c => ['coinbaseWalletSDK', 'walletConnect', 'injected'].includes(c.id))
            .map((connector) => (
              <button
                key={connector.id}
                onClick={() => connectWithWallet(connector.id)}
                className={`w-full p-4 rounded-xl font-bold font-orbitron transition-all ${
                  currentTheme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {connector.name}
              </button>
            ))}
        </div>
        <button
          onClick={() => setShowWalletModal(false)}
          className="w-full mt-4 p-3 rounded-xl font-bold font-orbitron bg-[#0000ff] text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  )}

  {!showLeaderboard && !showFaq && (
    <>
{isGameOver && (
  <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
    <h2 className="text-3xl font-black font-orbitron text-center mb-2">GAME OVER</h2>
    <p className="text-center mb-4 opacity-70 font-orbitron">You hit another arrow!</p>
    <div className="text-center mb-6 p-6 rounded-2xl border border-white/2">
      <div className="text-sm opacity-70 mb-1 font-orbitron">LEVEL REACHED</div>
      <div className="text-6xl font-black font-orbitron text-[#f17c19]">{level}</div>
    </div>
    
    <div className="flex gap-3 mb-3">
      <button
        onClick={handleMint}
        disabled={isPending || isConfirming || isConfirmed}
        className="flex-1 p-4 rounded-2xl font-bold font-orbitron text-base uppercase tracking-widest bg-[#f17c19] text-white shadow-lg shadow-blue-600/30 active:scale-98 transition-transform disabled:opacity-50"
      >
        {isPending ? 'CONFIRMING...' : isConfirming ? 'MINTING...' : isConfirmed ? 'MINTED!' : 'MINT NFT'}
      </button>
      
      <button
        onClick={handleShare}
        className="flex-1 p-4 rounded-2xl font-bold font-orbitron text-base uppercase tracking-widest bg-[#f17c19] text-white shadow-lg shadow-blue-600/30 active:scale-98 transition-transform"
      >
        SHARE
      </button>
    </div>
    
    <button
      onClick={() => resetLevel(1)}
      className={`w-full p-4 rounded-2xl font-bold font-orbitron text-base uppercase tracking-widest border active:scale-98 transition-transform ${currentTheme === 'light' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-white/5 text-gray-400 border-white/10'}`}
    >
      TRY AGAIN
    </button>
  </div>
)}

      {isLevelComplete && (
        <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
          <h2 className="text-3xl font-black font-orbitron text-center mb-2">LEVEL COMPLETE!</h2>
          <p className="text-center mb-6 opacity-70 font-orbitron">Great shot! Ready for the next challenge?</p>
          <button
            onClick={() => resetLevel(level + 1)}
            className="w-full p-4 rounded-2xl font-bold font-orbitron text-base uppercase tracking-widest bg-[#f17c19] text-white shadow-lg shadow-blue-600/30 active:scale-98 transition-transform"
          >
            NEXT LEVEL
          </button>
        </div>
      )}
    </>
  )}
</div>

{/* Separate layer for FAQ and Leaderboard - always on top */}
{showFaq && (
  <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-auto" style={{ zIndex: 20 }}>
    <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <h2 className="text-2xl font-black font-orbitron text-center mb-4">GAME RULES</h2>
      <div className="space-y-4 mb-6 font-orbitron">
        <div>
          <h3 className="font-bold mb-1">HOW TO PLAY?</h3>
          <p className="text-sm opacity-70">Tap anywhere to shoot. Fill the target without hitting other arrows.</p>
        </div>
        <div>
          <h3 className="font-bold mb-1">WHAT ARE NFTS?</h3>
          <p className="text-sm opacity-70">Your high score can be minted as a unique NFT on the Citrea Mainnet. Free. Just gas fee.</p>
        </div>
        <div>
          <h3 className="font-bold mb-1">IS IT SAFE?</h3>
          <p className="text-sm opacity-70">I did my best! The verified <a href="https://basescan.org/token/0x432f699f1d35fd49b8b1afc0ea9fae62f45adadb" target="_blank" className="text-[#0000ff]">contract address</a> is available for viewing on Basescan.</p>
        </div>
      </div>
      <button
        onClick={closeModal}
        className="w-full p-4 rounded-xl font-bold font-orbitron bg-[#0000ff] text-white"
      >
        CLOSE
      </button>
    </div>
  </div>
)}

{showLeaderboard && (
  <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-auto" style={{ zIndex: 20 }}>
    <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <h2 className="text-2xl font-black font-orbitron text-center mb-4">LEADERBOARD</h2>
      {isLoadingLeaderboard ? (
        <div className="text-center py-8 font-orbitron">LOADING...</div>
      ) : leaderboardData.length > 0 ? (
        <div className="space-y-2 max-h-96 overflow-y-auto">
            {leaderboardData.map((item, i) => (
                <div
                key={i}
                className={`flex items-center justify-between p-3 rounded-xl ${item.isCurrentUser ? 'bg-blue-500/20 border-2 border-blue-500' : currentTheme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}
                >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="font-bold font-orbitron text-lg w-12 flex-shrink-0">#{i + 1}</span>
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium font-orbitron truncate">
                        {item.isCurrentUser && context?.user?.username
                        ? context.user.username
                        : item.displayName || item.username || `${item.address.slice(0, 6)}...${item.address.slice(-4)}`
                        }
                    </span>
                    <span className="text-xs opacity-70 font-orbitron">Token ID: {item.tokenId}</span>
                </div>
                </div>
                <div className="font-black font-orbitron text-base flex-shrink-0 ml-2">
                <span className="text-sm opacity-70">LVL</span> {item.level}
                </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="text-center py-8 opacity-50 font-orbitron">No champions yet.</div>
      )}
      <div className="flex gap-2 mt-4">
        <button
          onClick={fetchLeaderboard}
          className={`flex-1 p-3 rounded-xl font-bold font-orbitron ${currentTheme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}
        >
          Refresh
        </button>
        <button
          onClick={closeModal}
          className="flex-1 p-3 rounded-xl font-bold font-orbitron bg-[#0000ff] text-white"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  );
}