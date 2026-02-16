'use client';

import { useState, useEffect } from 'react';
import { Terminal, Bot, Shield, Zap, X } from 'lucide-react';
import { Card, Button } from './DesignSystem';

const BOOT_SEQUENCE = [
  "INITIALIZING SECURE ENCLAVE...",
  "ESTABLISHING TEE CONNECTION...",
  "VERIFYING EIGENCOMPUTE SIGNATURES...",
  "LOADING CONSENSUS MODELS [VENICE, GPT-4o, LLAMA]...",
  "SYNCING MONAD TESTNET RPC...",
  "TRENDE AGENT ONLINE."
];

export function Onboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [bootStep, setBootStep] = useState(0);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Check if user has visited before
    const visited = localStorage.getItem('trende_onboarding_complete');
    if (!visited) {
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (bootStep < BOOT_SEQUENCE.length) {
      const timeout = setTimeout(() => {
        setBootStep(prev => prev + 1);
      }, 600); // Fast boot
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
      <Card accent="cyan" className="w-full max-w-lg p-0 overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-300">
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
                  className="w-16 h-16 mx-auto mb-4 flex items-center justify-center animate-bounce"
                  style={{ backgroundColor: 'var(--accent-cyan)', boxShadow: '4px 4px 0px 0px var(--shadow-color)' }}
                >
                  <Bot className="w-8 h-8 text-[var(--bg-primary)]" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Trende Agent</h2>
                <p className="text-[var(--text-secondary)] font-mono text-sm">
                  The Sovereign AI Oracle for the Monad Economy.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 border-2 border-[var(--border-color)] hover:border-[var(--accent-cyan)] transition-colors">
                  <div className="mt-1"><Zap className="w-4 h-4 text-[var(--accent-amber)]" /></div>
                  <div>
                    <h4 className="font-bold text-sm uppercase">Research</h4>
                    <p className="text-xs text-[var(--text-muted)] font-mono">Agent autonomously scrapes Twitter, TikTok, and News.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 border-2 border-[var(--border-color)] hover:border-[var(--accent-cyan)] transition-colors">
                  <div className="mt-1"><Shield className="w-4 h-4 text-[var(--accent-emerald)]" /></div>
                  <div>
                    <h4 className="font-bold text-sm uppercase">Attest</h4>
                    <p className="text-xs text-[var(--text-muted)] font-mono">Findings are signed in an EigenCompute TEE Enclave.</p>
                  </div>
                </div>
              </div>

              <Button onClick={handleClose} variant="primary" className="w-full h-12 text-sm font-black tracking-widest">
                ENTER CONTROL ROOM
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
