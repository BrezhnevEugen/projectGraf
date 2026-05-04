interface ProjectGrafBridge {
  isElectron: true;
  selectDirectory(): Promise<string | null>;
}

declare global {
  interface Window {
    projectgraf?: ProjectGrafBridge;
  }
}

export const isElectron = (): boolean => Boolean(window.projectgraf?.isElectron);

export async function selectDirectory(): Promise<string | null> {
  if (!window.projectgraf) return null;
  return window.projectgraf.selectDirectory();
}

export {};
