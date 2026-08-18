import React, { useEffect, useRef } from 'react';
import { X, Command } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Tools',
      shortcuts: [
        { key: 'V', desc: 'Select / Move Tool' },
        { key: 'H', desc: 'Hand / Pan Tool' },
        { key: 'F', desc: 'Frame Tool & Presets' },
        { key: 'R', desc: 'Rectangle / Square' },
        { key: 'O', desc: 'Ellipse / Circle' },
        { key: 'L', desc: 'Line Tool' },
        { key: 'Shift + L', desc: 'Arrow Tool' },
        { key: 'T', desc: 'Text Tool' },
      ],
    },
    {
      title: 'Canvas Navigation',
      shortcuts: [
        { key: 'Space + Drag', desc: 'Pan canvas smoothly' },
        { key: 'Ctrl/Cmd + Wheel', desc: 'Zoom In / Out' },
        { key: 'Shift + 1', desc: 'Zoom to Fit' },
        { key: 'Shift + 0', desc: 'Zoom to 100%' },
        { key: 'Ctrl/Cmd + Alt + P', desc: 'Open Presentation Mode' },
      ],
    },
    {
      title: 'Transformations & Editing',
      shortcuts: [
        { key: 'Shift + Drag Handle', desc: 'Constrain 1:1 Aspect Ratio' },
        { key: 'Drag Inner Dot', desc: 'Adjust Corner Radius Directly' },
        { key: 'Ctrl/Cmd + D', desc: 'Duplicate Selected Layer' },
        { key: 'Ctrl/Cmd + C / V', desc: 'Copy / Paste Layers' },
        { key: 'Ctrl/Cmd + Shift + K', desc: 'Insert Image or Video' },
        { key: 'Ctrl/Cmd + Z', desc: 'Undo' },
        { key: 'Ctrl/Cmd + Y', desc: 'Redo' },
        { key: 'Delete / Backspace', desc: 'Delete Selected Layer' },
        { key: 'Arrow Keys', desc: 'Nudge 1px (Shift for 10px)' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-[#333333]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] bg-[#fafafa]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0d99ff]/10 text-[#0d99ff] flex items-center justify-center">
              <Command size={18} />
            </div>
            <div>
              <h3 id="shortcuts-title" className="text-sm font-semibold text-gray-900">Keyboard Shortcuts</h3>
              <p className="text-[11px] text-gray-500">Essential hotkeys for vector design workflows</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {group.title}
              </h4>
              <div className="space-y-1.5 bg-[#f8fafc] p-3 rounded-xl border border-[#e2e8f0]">
                {group.shortcuts.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-gray-700">{s.desc}</span>
                    <kbd className="px-2 py-0.5 bg-white border border-[#cbd5e1] rounded text-[11px] font-mono text-gray-800 shadow-xs font-semibold">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#e2e8f0] bg-[#fafafa] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0d99ff] hover:bg-[#0b85e0] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
