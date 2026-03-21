"use client";

import { motion } from "framer-motion";
import { Activity, Radar, Sparkles } from "lucide-react";
import { usePrefersReducedMotion } from "./Motion";

interface RunFlowDividerProps {
  stage: "dispatch" | "processing";
  progress: number;
  elapsedSeconds: number;
  profileId?: string | null;
}

const COPY_BY_PROFILE: Record<string, {
  dispatch: { title: string; body: string; icon: typeof Sparkles };
  processing: { title: string; body: string; icon: typeof Sparkles };
}> = {
  "alpha-hunter": {
    dispatch: {
      title: "Alpha Sweep Dispatch",
      body: "Narrative momentum lanes are warming up for broad signal capture.",
      icon: Sparkles,
    },
    processing: {
      title: "Momentum Stream",
      body: "High-velocity evidence is being clustered, filtered, and scored in real time.",
      icon: Radar,
    },
  },
  "due-diligence": {
    dispatch: {
      title: "Due Diligence Dispatch",
      body: "Deep verification lanes are enabled for technical and provenance-heavy analysis.",
      icon: Activity,
    },
    processing: {
      title: "Verification Stream",
      body: "Cross-source validation and contradiction checks are running before final synthesis.",
      icon: Radar,
    },
  },
  "market-intel": {
    dispatch: {
      title: "Market Intel Dispatch",
      body: "Macro and micro signal lanes are aligned for cross-platform market context.",
      icon: Sparkles,
    },
    processing: {
      title: "Market Signal Stream",
      body: "Price context, narrative shifts, and model consensus are being reconciled live.",
      icon: Radar,
    },
  },
  default: {
    dispatch: {
      title: "Agent Dispatch",
      body: "Mission parameters are locked and execution lanes are warming up.",
      icon: Sparkles,
    },
    processing: {
      title: "Live Mission Stream",
      body: "Cross-source harvest, model consensus, and proof updates are streaming below.",
      icon: Radar,
    },
  },
};

export function RunFlowDivider({ stage, progress, elapsedSeconds, profileId }: RunFlowDividerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const config = (COPY_BY_PROFILE[profileId || ""] || COPY_BY_PROFILE.default)[stage];
  const Icon = config.icon;

  return (
    <div className="relative py-2 sm:py-3">
      <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
        className="relative mx-auto max-w-3xl"
      >
        <div className="glass rounded-xl border border-white/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-cyan-300">{config.title}</p>
              <p className="text-xs text-[var(--text-secondary)]">{config.body}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-white/60">
            <Activity className="w-3.5 h-3.5 text-emerald-300" />
            <span>{progress}%</span>
            <span className="text-white/30">•</span>
            <span>{elapsedSeconds}s elapsed</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
