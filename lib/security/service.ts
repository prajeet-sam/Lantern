import { clearVault, createVault, getActiveKey, hasVault, lockVault, unlockVault, setActiveKey } from "@/lib/vault";

export interface SecurityService {
  getActiveKey(): CryptoKey | null;
  hasVault(): boolean;
  createVault(pin: string): Promise<CryptoKey | null>;
  unlockVault(pin: string): Promise<CryptoKey | null>;
  clearVault(): void;
  lockVault(): void;
  setActiveKey(key: CryptoKey | null): void;
}

export function createSecurityService(): SecurityService {
  return {
    getActiveKey,
    hasVault,
    createVault,
    unlockVault,
    clearVault,
    lockVault,
    setActiveKey,
  };
}

export const securityService = createSecurityService();
