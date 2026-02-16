'use client';

import { useState, useEffect, useCallback } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  onComplete?: () => void;
  cursor?: boolean;
  cursorClassName?: string;
}

export function TypewriterText({
  text,
  speed = 30,
  delay = 0,
  className = '',
  onComplete,
  cursor = true,
  cursorClassName = 'animate-pulse',
}: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showCursor, setShowCursor] = useState(cursor);

  const startTyping = useCallback(() => {
    setIsTyping(true);
    setDisplayText('');
    let currentIndex = 0;

    const typeChar = () => {
      if (currentIndex < text.length) {
        setDisplayText(text.slice(0, currentIndex + 1));
        currentIndex++;
        
        // Variable typing speed for more natural feel
        const variableSpeed = speed + (Math.random() * 20 - 10);
        setTimeout(typeChar, Math.max(10, variableSpeed));
      } else {
        setIsTyping(false);
        onComplete?.();
        // Hide cursor after a delay when done
        if (cursor) {
          setTimeout(() => setShowCursor(false), 1000);
        }
      }
    };

    typeChar();
  }, [text, speed, onComplete, cursor]);

  useEffect(() => {
    const timer = setTimeout(startTyping, delay);
    return () => clearTimeout(timer);
  }, [startTyping, delay]);

  // Reset cursor when text changes
  useEffect(() => {
    setShowCursor(cursor);
  }, [text, cursor]);

  return (
    <span className={className}>
      {displayText}
      {showCursor && (
        <span className={`inline-block w-2 h-4 bg-current ml-0.5 align-middle ${cursorClassName}`}>
          
        </span>
      )}
    </span>
  );
}

// Hook for managing a queue of typewriter messages (like a terminal)
interface QueuedMessage {
  id: string;
  text: string;
  type?: 'info' | 'success' | 'error' | 'warning';
}

export function useTypewriterQueue(maxMessages = 6) {
  const [messages, setMessages] = useState<QueuedMessage[]>([]);
  const [currentTypingId, setCurrentTypingId] = useState<string | null>(null);

  const addMessage = useCallback((text: string, type: QueuedMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setMessages((prev) => {
      const newMessages = [...prev, { id, text, type }];
      // Keep only recent messages
      return newMessages.slice(-maxMessages);
    });
    setCurrentTypingId(id);
    return id;
  }, [maxMessages]);

  const onMessageComplete = useCallback(() => {
    setCurrentTypingId(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentTypingId(null);
  }, []);

  return {
    messages,
    currentTypingId,
    addMessage,
    onMessageComplete,
    clearMessages,
  };
}

// Terminal-style event log component
interface TerminalEvent {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  timestamp?: Date;
}

interface TerminalLogProps {
  events: TerminalEvent[];
  maxHeight?: string;
  className?: string;
}

const eventStyles = {
  info: 'text-slate-300',
  success: 'text-emerald-300',
  error: 'text-rose-300',
  warning: 'text-amber-300',
};

const eventPrefixes = {
  info: '›',
  success: '✓',
  error: '✗',
  warning: '⚠',
};

export function TerminalLog({ events, maxHeight = '200px', className = '' }: TerminalLogProps) {
  const [typedEvents, setTypedEvents] = useState<Set<string>>(new Set());

  const handleComplete = useCallback((id: string) => {
    setTypedEvents((prev) => new Set(prev).add(id));
  }, []);

  return (
    <div
      className={`font-mono text-sm space-y-1.5 overflow-y-auto pr-2 ${className}`}
      style={{ maxHeight }}
    >
      {events.map((event, index) => {
        const isLatest = index === events.length - 1;
        const isTyped = typedEvents.has(event.id);
        const shouldType = isLatest && !isTyped;

        return (
          <div
            key={event.id}
            className={`flex items-start gap-2 ${eventStyles[event.type || 'info']}`}
          >
            <span className="select-none opacity-60 shrink-0">
              {eventPrefixes[event.type || 'info']}
            </span>
            {shouldType ? (
              <TypewriterText
                text={event.message}
                speed={25}
                onComplete={() => handleComplete(event.id)}
                cursor={false}
              />
            ) : (
              <span>{event.message}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
