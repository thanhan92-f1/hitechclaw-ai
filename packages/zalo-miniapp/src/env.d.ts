/// <reference types="vite/client" />

declare module 'zmp-sdk' {
  export function getAccessToken(): Promise<string>;
  export function getUserInfo(options: {
    success: (data: { userInfo: ZaloUserInfo }) => void;
    fail: (err: unknown) => void;
  }): void;
  export function configAppView(options: { headerColor?: string; headerTextColor?: string; actionBarHidden?: boolean }): void;
  export function closeApp(): void;

  export interface ZaloUserInfo {
    id: string;
    name: string;
    avatar: string;
    isSensitive: boolean;
    idByOA?: string;
  }
}

declare module 'zmp-ui' {
  import type { FC, ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

  export const App: FC<{ children?: ReactNode }>;
  export const Page: FC<{ children?: ReactNode; className?: string }>;
  export const Box: FC<{ children?: ReactNode; className?: string; style?: React.CSSProperties; flex?: boolean; flexDirection?: string; alignItems?: string; justifyContent?: string; p?: number; m?: number; mt?: number; mb?: number; ml?: number; mr?: number }>;
  export const Text: FC<{ children?: ReactNode; className?: string; size?: string; bold?: boolean }>;
  export const Button: FC<ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode; className?: string; size?: 'small' | 'medium' | 'large'; variant?: 'primary' | 'secondary' | 'tertiary'; loading?: boolean; fullWidth?: boolean }>;
  export const Input: FC<InputHTMLAttributes<HTMLInputElement> & { className?: string; label?: string; clearable?: boolean }>;
  export const Avatar: FC<{ src?: string; size?: number; className?: string }>;
  export const Icon: FC<{ icon?: string; size?: number; className?: string }>;
  export const Spinner: FC<{ size?: 'small' | 'medium' | 'large'; className?: string }>;
  export const BottomNavigation: FC<{ children?: ReactNode; activeKey?: string; onChange?: (key: string) => void }>;
  export namespace BottomNavigation {
    export const Item: FC<{ key?: string; label?: string; icon?: ReactNode; activeIcon?: ReactNode }>;
  }
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TENANT_SLUG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
