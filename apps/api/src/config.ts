import { resolve } from 'node:path';
import { homedir } from 'node:os';

export interface AppConfig {
  port: number;
  host: string;
  dbPath: string;
  defaultProvider: string;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 4000),
    host: process.env.HOST ?? '127.0.0.1',
    dbPath: resolve(process.env.PROJECTGRAF_DB ?? `${homedir()}/.projectgraf/projectgraf.db`),
    defaultProvider: process.env.PROJECTGRAF_PROVIDER ?? 'ollama',
  };
}
