/**
 * Logger utility for mcpGraph
 * 
 * All logging goes to stderr to avoid interfering with MCP server
 * communication which uses stdout.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  args?: unknown[];
}

interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  startCollection(): void;
  stopCollection(): LogEntry[];
}

class LogCollector {
  private entries: LogEntry[] = [];

  addEntry(level: string, message: string, timestamp: string, args?: unknown[]): void {
    this.entries.push({
      level,
      message,
      timestamp,
      args: args && args.length > 0 ? args : undefined,
    });
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}

class ConsoleLogger implements Logger {
  private collector: LogCollector | null = null;

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = this.formatMessage(level, message);
    const logFn = level === 'error' ? console.error : console.warn;
    
    // Always log to stderr
    if (args.length > 0) {
      logFn(formattedMessage, ...args);
    } else {
      logFn(formattedMessage);
    }

    // Also collect if collection is active
    if (this.collector) {
      this.collector.addEntry(level, message, timestamp, args.length > 0 ? args : undefined);
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

  startCollection(): void {
    this.collector = new LogCollector();
  }

  stopCollection(): LogEntry[] {
    if (!this.collector) {
      return [];
    }
    const entries = this.collector.getEntries();
    this.collector = null;
    return entries;
  }
}

// Export a singleton logger instance
export const logger = new ConsoleLogger();

