import React, { useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import type { UserProfile } from '../types/bimtek';
import { GoogleSignInButton } from './GoogleSignInButton';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface PortalShellProps {
  user: UserProfile;
  navItems: NavItem[];
  activeNavId: string;
  onSelectNav: (id: string) => void;
  breadcrumbTitle: string;
  googleConnectedEmail: string | null;
  onConnectGoogle: () => void;
  connectingGoogle: boolean;
  onLogout: () => void;
  children: React.ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin Pengguna',
  pic: 'PIC Verifikasi',
  peserta: 'Peserta Bimtek',
};

export const PortalShell: React.FC<PortalShellProps> = ({
  user,
  navItems,
  activeNavId,
  onSelectNav,
  breadcrumbTitle,
  googleConnectedEmail,
  onConnectGoogle,
  connectingGoogle,
  onLogout,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200">
      <div>
        <div className="px-5 py-5 border-b border-slate-200">
          <div className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Portal Bimtek LPSE
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {ROLE_LABELS[user.role] || user.role}
          </p>
        </div>

        <nav className="px-3 py-4 space-y-1" aria-label="Menu Portal">
          {navItems.map((item) => {
            const isActive = item.id === activeNavId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectNav(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200 space-y-3">
        <div className="text-xs space-y-0.5">
          <div className="font-semibold text-slate-900 truncate">{user.fullName}</div>
          <div className="text-slate-500 truncate">{user.email}</div>
          {user.lpseLocation && (
            <div className="text-slate-500 truncate">{user.lpseLocation}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar Akun</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-8 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
              className="lg:hidden p-2 -ml-2 text-slate-700 hover:bg-slate-100 rounded-md"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="text-sm font-medium text-slate-500 truncate">
              <span className="text-slate-900 font-display font-semibold">
                {ROLE_LABELS[user.role] || 'Portal'}
              </span>
              <span className="mx-2 text-slate-300">/</span>
              <span className="text-slate-700">{breadcrumbTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {googleConnectedEmail ? (
              <span className="hidden sm:inline text-xs text-emerald-700 font-medium whitespace-nowrap">
                {user.role === 'peserta'
                  ? `Google Drive Terhubung (${googleConnectedEmail})`
                  : `Drive & Sheets Terhubung (${googleConnectedEmail})`}
              </span>
            ) : (
              <GoogleSignInButton
                onClick={onConnectGoogle}
                disabled={connectingGoogle}
                label={
                  connectingGoogle
                    ? 'Menghubungkan...'
                    : user.role === 'peserta'
                    ? 'Hubungkan Google Drive'
                    : 'Hubungkan Google Drive & Sheets'
                }
              />
            )}
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-8 py-6 max-w-[1240px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
