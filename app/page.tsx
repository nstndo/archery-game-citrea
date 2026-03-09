'use client';

import dynamic from 'next/dynamic';

// Dynamically import the Game component to disable Server Side Rendering (SSR)
// This is necessary because the game logic relies heavily on window and canvas
const Game = dynamic(() => import('@/components/Game'), { ssr: false });

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-0 m-0 overflow-hidden bg-white dark:bg-[#000010]">
      {/* Game Container */}
      <Game />
    </main>
  );
}