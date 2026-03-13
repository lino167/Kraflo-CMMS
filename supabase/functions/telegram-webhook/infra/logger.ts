/**
 * Centralized logging module for the Telegram bot
 * Provides consistent log formatting and levels
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  userId?: number;
  chatId?: number;
  action?: string;
  osId?: number;
  correlationId?: string;
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(formatMessage('info', message, context));
  },

  warn(message: string, context?: LogContext) {
    console.warn(formatMessage('warn', message, context));
  },

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorInfo = error instanceof Error 
      ? { errorMessage: error.message, stack: error.stack?.substring(0, 200) }
      : { errorMessage: String(error) };
    console.error(formatMessage('error', message, { ...context, ...errorInfo }));
  },

  debug(message: string, context?: LogContext) {
    // Only log debug in development (you can add env check here)
    console.log(formatMessage('debug', message, context));
  },

  // Specialized log methods for common operations
  command(command: string, userId: number, chatId: number) {
    this.info(`Command received: ${command}`, { userId, chatId, action: 'command' });
  },

  osCreated(osId: number, userId: number) {
    this.info(`OS created successfully`, { osId, userId, action: 'os_created' });
  },

  osClosed(osId: number, userId: number) {
    this.info(`OS closed successfully`, { osId, userId, action: 'os_closed' });
  },

  stateChange(userId: number, fromState: string, toState: string) {
    this.debug(`State transition`, { userId, fromState, toState, action: 'state_change' });
  },

  iaQuery(userId: number, queryPreview: string) {
    this.info(`IA query received`, { userId, queryPreview: queryPreview.substring(0, 50), action: 'ia_query' });
  },
};
