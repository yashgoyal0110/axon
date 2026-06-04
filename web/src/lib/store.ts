import { create } from 'zustand';
import { get, post, tokens } from './api';
import type { Profile, Session, SessionOrg, SessionUser } from './types';

interface AuthState {
  user: SessionUser | null;
  organization: SessionOrg | null;
  organizations: Profile['organizations'];
  status: 'loading' | 'authenticated' | 'anonymous';

  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; name: string; password: string; organizationName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  setProfile: (profileValue: Profile) => void;
}

export const useAuth = create<AuthState>((set, getState) => ({
  user: null,
  organization: null,
  organizations: [],
  status: 'loading',

  setProfile: (profileValue) =>
    set({
      user: profileValue.user,
      organization: profileValue.organization,
      organizations: profileValue.organizations,
      status: 'authenticated',
    }),

  login: async (email, password) => {
    const session = await post<Session>('/auth/login', { email, password }, { auth: false });
    tokens.set(session.accessToken, session.refreshToken);
    getState().setProfile(session);
  },

  register: async (input) => {
    const session = await post<Session>('/auth/register', input, { auth: false });
    tokens.set(session.accessToken, session.refreshToken);
    getState().setProfile(session);
  },

    logout: async () => {
        const refreshToken = tokens.refresh;
        tokens.clear();
        set({ user: null, organization: null, organizations: [], status: 'anonymous' });
        // Best effort - the local session is already gone either way.
        await post('/auth/logout', { refreshToken }, { auth: false }).catch(() => undefined);
    },

    hydrate: async () => {
        if (!tokens.access && !tokens.refresh) {
            set({ status: 'anonymous' });
            return;
        }
        try {
            const profileValue = await get<Profile>('/auth/me');
            getState().setProfile(profileValue);
        } catch {
            tokens.clear();
            set({ user: null, organization: null, organizations: [], status: 'anonymous' });
        }
    },

    switchOrg: async (orgId) => {
        const session = await post<Session>(`/auth/switch-org/${orgId}`);
        tokens.set(session.accessToken, session.refreshToken);
    getState().setProfile(session);
  },
}));

/** Ranked permission check - ADMIN satisfies an AGENT requirement. */
const RANK: Record<string, number> = { VIEWER: 0, AGENT: 1, ADMIN: 2, OWNER: 3 };

export function useCan(required: 'VIEWER' | 'AGENT' | 'ADMIN' | 'OWNER'): boolean {
  const role = useAuth((s) => s.organization?.role);
  if (!role) return false;
  return (RANK[role] ?? -1) >= RANK[required];
}


// NOTE: temporary scaffolding while wiring this up
// console.log("[debug] render", props);
// TODO: drop the debug logging above