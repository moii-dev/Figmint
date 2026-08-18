import React, { useEffect, useState } from 'react';
import { CanvasProvider, useCanvas } from './context/CanvasContext';
import { Dashboard } from './components/Dashboard';
import { Navbar } from './components/Navbar';
import { LeftSidebar } from './components/LeftSidebar';
import { Canvas } from './components/Canvas';
import { RightSidebar } from './components/RightSidebar';
import { ShortcutsModal } from './components/ShortcutsModal';
import { PresentationMode } from './components/PresentationMode';

const AppContent: React.FC = () => {
  const { viewMode, isLeftSidebarOpen, setIsLeftSidebarOpen, zoomToFit } = useCanvas();
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  useEffect(() => {
    if (viewMode === 'editor' && window.matchMedia('(max-width: 1279px)').matches) {
      setIsLeftSidebarOpen(false);
      setIsRightSidebarOpen(false);
      const timer = window.setTimeout(zoomToFit, 80);
      return () => window.clearTimeout(timer);
    }
  }, [setIsLeftSidebarOpen, viewMode, zoomToFit]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault();
        setIsShortcutsOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (viewMode === 'dashboard') {
    return <Dashboard />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f5f5f5] text-[#333333] overflow-hidden font-sans select-none">
      {/* Top Figma Navigation / Toolbar */}
      <Navbar
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        isInspectorOpen={isRightSidebarOpen}
        onToggleInspector={() => setIsRightSidebarOpen((open) => !open)}
      />

      {/* Main Workspace: Left Layers Sidebar | Center Infinite Canvas | Right Inspector */}
      <main className="flex-1 flex overflow-hidden relative">
        <LeftSidebar />
        <Canvas />
        <RightSidebar
          isOpen={isRightSidebarOpen}
          onClose={() => setIsRightSidebarOpen(false)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
        />
        {(isLeftSidebarOpen || isRightSidebarOpen) && (
          <button
            type="button"
            aria-label="Close side panels"
            onClick={() => {
              setIsLeftSidebarOpen(false);
              setIsRightSidebarOpen(false);
            }}
            className="absolute inset-0 z-20 bg-black/15 xl:hidden"
          />
        )}
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
