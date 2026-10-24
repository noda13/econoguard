import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { UserProfile } from '../lib/types/profile';

const STORAGE_KEY = 'econoguard-profile';

interface UserProfileContextValue {
  profile: UserProfile | null;
  setProfile: (profile: UserProfile) => void;
  clearProfile: () => void;
  isConfigured: boolean;
}

const UserProfileContext = createContext<UserProfileContextValue>({
  profile: null,
  setProfile: () => {},
  clearProfile: () => {},
  isConfigured: false,
});

const ALLOCATION_KEYS = [
  'domestic_equity', 'developed_equity', 'emerging_equity',
  'domestic_bond', 'developed_bond', 'emerging_bond',
  'domestic_reit', 'developed_reit', 'cash',
] as const;

function isValidProfile(obj: unknown): obj is UserProfile {
  if (obj === null || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;

  if (typeof p.age !== 'number' || !Number.isFinite(p.age) || p.age < 20 || p.age > 80) return false;

  if (p.sensitivity !== 'sensitive' && p.sensitivity !== 'standard' && p.sensitivity !== 'relaxed') return false;

  if (p.allocation === null || typeof p.allocation !== 'object') return false;
  const alloc = p.allocation as Record<string, unknown>;
  for (const key of ALLOCATION_KEYS) {
    const value = alloc[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) return false;
  }

  // Reject allocations that don't sum to ~100 (tolerance ±1 for rounding)
  const sum = ALLOCATION_KEYS.reduce((acc, key) => acc + (alloc[key] as number), 0);
  if (Math.abs(sum - 100) > 1) return false;

  return true;
}

function loadProfile(): UserProfile | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isValidProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(loadProfile);

  const setProfile = useCallback((p: UserProfile) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      // Persistence is best-effort (private mode, quota); in-memory state still applies.
    }
    setProfileState(p);
  }, []);

  const clearProfile = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Persistence is best-effort; in-memory state still applies.
    }
    setProfileState(null);
  }, []);

  const value = useMemo<UserProfileContextValue>(
    () => ({ profile, setProfile, clearProfile, isConfigured: profile !== null }),
    [profile, setProfile, clearProfile],
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
