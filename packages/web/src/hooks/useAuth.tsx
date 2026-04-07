import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { login as apiLogin, getMe, getToken, clearToken, setToken } from '../lib/api';

interface User {
    sub: string;
    email: string;
    role: string;
    tenantId: string;
    isSuperAdmin: boolean;
}

interface AuthCtx {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
    user: null,
    loading: true,
    login: async () => { },
    logout: () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = getToken();
        if (!token) {
            setLoading(false);
            return;
        }
        getMe().then((data) => setUser({
            sub: data.id,
            email: data.email,
            role: data.role,
            tenantId: data.tenantId,
            isSuperAdmin: data.isSuperAdmin === true,
        })).catch(() => clearToken()).finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (email: string, password: string, tenantSlug?: string) => {
        await apiLogin(email, password, tenantSlug);
        const me = await getMe();
        setUser({
            sub: me.id,
            email: me.email,
            role: me.role,
            tenantId: me.tenantId,
            isSuperAdmin: me.isSuperAdmin === true,
        });
    }, []);

    const logout = useCallback(() => {
        clearToken();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
