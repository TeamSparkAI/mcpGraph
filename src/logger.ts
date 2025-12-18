/**
 * Logger utility for mcpGraph
 * 
 * All logging goes to stderr to avoid interfering with MCP server
 * communication which uses stdout.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

class ConsoleLogger implements Logger {
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage(level, message);
    const logFn = level === 'error' ? console.error : console.warn;
    
    if (args.length > 0) {
      logFn(formattedMessage, ...args);
    } else {
      logFn(formattedMessage);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }
}

// Export a singleton logger instance
export const logger = new ConsoleLogger();

