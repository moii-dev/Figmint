import React, { useState } from 'react';
import { CanvasProvider, useCanvas } from './context/CanvasContext';
import { Dashboard } from './components/Dashboard';
import { Navbar } from './components/Navbar';
import { LeftSidebar } from './components/LeftSidebar';
import { Canvas } from './components/Canvas';
import { RightSidebar } from './components/RightSidebar';
import { ShortcutsModal } from './components/ShortcutsModal';
import { PresentationMode } from './components/PresentationMode';

const AppContent: React.FC = () => {
  const { viewMode } = useCanvas();
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  if (viewMode === 'dashboard') {
    return <Dashboard />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f5f5f5] text-[#333333] overflow-hidden font-sans select-none">
      {/* Top Figma Navigation / Toolbar */}
      <Navbar onOpenShortcuts={() => setIsShortcutsOpen(true)} />

      {/* Main Workspace: Left Layers Sidebar | Center Infinite Canvas | Right Inspector */}
      <main className="flex-1 flex overflow-hidden relative">
        <LeftSidebar />
        <Canvas />
        <RightSidebar onOpenShortcuts={() => setIsShortcutsOpen(true)} />
      </main>

      {/* Presentation / Prototype Preview Modal */}
      <PresentationMode />

      {/* Keyboard Shortcuts Dialog */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <CanvasProvider>
      <AppContent />
    </CanvasProvider>
  );
}
