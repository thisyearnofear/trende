'use client';

import { useState, useEffect } from 'react';
import { Terminal, Bot, Shield, Zap } from 'lucide-react';
import { Card, Button } from './DesignSystem';
import { useTheme } from './ThemeProvider';

const BOOT_SEQUENCE = [
  "INITIALIZING ANALYSIS ENGINE...",
  "LOADING INTELLIGENCE MODELS...",
  "CONNECTING DATA SOURCES...",
  "VERIFYING INTEGRITY CHECKS...",
  "CALIBRATING MARKET SENTIMENT...",
  "PREPARING INSIGHTS LAYER...",
  "SYSTEMS READY...",
  "TRENDE ONLINE."
];

export function Onboarding() {
  const { isSoft } = useTheme();
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const visited = window.localStorage.getItem('trende_onboarding_complete');
    return !visited;
  });
  const [bootStep, setBootStep] = useState(0);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (bootStep < BOOT_SEQUENCE.length) {
      const timeout = setTimeout(() => {
        setBootStep(prev => prev + 1);
      }, 400); // Faster boot sequence
      return () => clearTimeout(timeout);
    } else {
      setTimeout(() => setShowContent(true), 500);
    }
  }, [isOpen, bootStep]);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('trende_onboarding_complete', 'true');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 overflow-y-auto">
      <Card accent="cyan" className="w-full max-w-lg p-0 overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-300 my-auto">
        {/* Terminal Header */}
        <div className="bg-[var(--text-primary)] text-[var(--bg-primary)] p-3 flex items-center justify-between border-b-2 border-[var(--accent-cyan)]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            <span className="text-xs font-black font-mono tracking-wider">BOOT_SEQUENCE.EXE</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--bg-primary)]/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--bg-primary)]/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--bg-primary)]" />
          </div>
        </div>

        <div className="p-6 bg-[var(--bg-primary)]">
          {!showContent ? (
            <div className="space-y-2 font-mono text-xs sm:text-sm">
              {BOOT_SEQUENCE.slice(0, bootStep + 1).map((line, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-[var(--accent-cyan)]">{'>'}</span>
                  <span className={i === bootStep ? "animate-pulse" : "opacity-70"}>
                    {line}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center">
                <div
                  className={`w-16 h-16 mx-auto mb-4 flex items-center justify-center ${isSoft ? 'rounded-full' : ''}`}
                  style={{ 
                    backgroundColor: 'var(--accent-cyan)', 
                    boxShadow: isSoft ? 'var(--soft-shadow-out)' : '4px 4px 0px 0px var(--shadow-color)' 
                  }}
                >
                  <Bot className="w-8 h-8 text-[var(--bg-primary)]" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Trende Agent</h2>
                <p className="text-[var(--text-secondary)] font-mono text-sm">
                  Source-Backed Market Intelligence
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className={`flex items-start gap-3 p-2.5 sm:p-3 border-2 transition-colors ${isSoft ? 'soft-ui-out border-0' : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-cyan)]'}`} style={{ boxShadow: isSoft ? 'var(--soft-shadow-out)' : '3px 3px 0px 0px var(--shadow-color)' }}>
                  <div className="mt-0.5 sm:mt-1"><Zap className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-amber)]" /></div>
                  <div>
                    <h4 className="font-black text-xs sm:text-sm uppercase tracking-wide">Multiple AI Models</h4>
                    <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] font-mono mt-0.5 sm:mt-1">Cross-checks analysis across different AI systems to reduce bias and improve accuracy.</p>
                  </div>
                </div>

                <div className={`flex items-start gap-3 p-2.5 sm:p-3 border-2 transition-colors ${isSoft ? 'soft-ui-out border-0' : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-cyan)]'}`} style={{ boxShadow: isSoft ? 'var(--soft-shadow-out)' : '3px 3px 0px 0px var(--shadow-color)' }}>
                  <div className="mt-0.5 sm:mt-1"><Shield className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-emerald)]" /></div>
                  <div>
                    <h4 className="font-black text-xs sm:text-sm uppercase tracking-wide">Runtime Verification</h4>
                    <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] font-mono mt-0.5 sm:mt-1">Every report includes a server-side proof trail and traceable sources, so the result can be checked later.</p>
                  </div>
                </div>

                <div className={`flex items-start gap-3 p-2.5 sm:p-3 border-2 transition-colors ${isSoft ? 'soft-ui-out border-0' : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-cyan)]'}`} style={{ boxShadow: isSoft ? 'var(--soft-shadow-out)' : '3px 3px 0px 0px var(--shadow-color)' }}>
                  <div className="mt-0.5 sm:mt-1"><Bot className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-cyan)]" /></div>
                  <div>
                    <h4 className="font-black text-xs sm:text-sm uppercase tracking-wide">Automated Research</h4>
                    <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] font-mono mt-0.5 sm:mt-1">Scans social media, forums, and blockchain in minutes. No manual work required.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleClose} variant="primary" className="w-full h-10 sm:h-12 text-xs sm:text-sm font-black tracking-widest">
                  ENTER CONTROL ROOM
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
