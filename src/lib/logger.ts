const EMOJI_MAP = {
  pixel: '🖱️',
  history: '📝',
  state: '🔄',
  ai: '🎨',
  tool: '✨',
  warn: '⚠️',
  error: '❌',
} as const;

type LogCategory = keyof typeof EMOJI_MAP;

const isDebugEnabled = () => {
  try {
    return localStorage.getItem('debug') === 'true' || 
           import.meta.env.DEV; // Always on in dev mode
  } catch {
    return import.meta.env.DEV;
  }
};

const log = (category: LogCategory, action: string, data?: any) => {
  if (!isDebugEnabled()) return;
  
  const emoji = EMOJI_MAP[category];
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  
  console.log(`${emoji} [${timestamp}] ${action}:`, data || '');
};

export const logger = {
  pixel: (action: string, data?: any) => log('pixel', action, data),
  history: (action: string, data?: any) => log('history', action, data),
  state: (action: string, data?: any) => log('state', action, data),
  ai: (action: string, data?: any) => log('ai', action, data),
  tool: (action: string, data?: any) => log('tool', action, data),
  warn: (action: string, data?: any) => log('warn', action, data),
  error: (action: string, data?: any) => log('error', action, data),
};
