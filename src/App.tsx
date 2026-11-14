import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Download,
  LayoutDashboard,
  SlidersHorizontal,
  UserCog,
  Users,
} from 'lucide-react';
import { AuthPortal } from './components/AuthPortal';
import { PortalShell, type NavItem } from './components/PortalShell';
import { ProfileSettings } from './components/ProfileSettings';
import { AdminAgendas } from './components/admin/AdminAgendas';
import { AdminAturData } from './components/admin/AdminAturData';
import { AdminBeranda } from './components/admin/AdminBeranda';
import { AdminDownloadData } from './components/admin/AdminDownloadData';
import { AdminMonitoring } from './components/admin/AdminMonitoring';
import { AdminUsers } from './components/admin/AdminUsers';
import { PesertaAgendas } from './components/peserta/PesertaAgendas';
import { RuangBimtek } from './components/peserta/RuangBimtek';
import { PicPortal } from './components/pic/PicPortal';
import { apiFetch, setSessionBearerToken } from './lib/api';
import {
  getWorkspaceAccessToken,
  getWorkspaceEmail,
  googleWorkspaceSignIn,
  googleWorkspaceSignOut,
  initWorkspaceAuth,
} from './lib/firebase';
import type { UserProfile } from './types/bimtek';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [activeNav, setActiveNav] = useState<string>('');
  const [selectedRoomAgendaId, setSelectedRoomAgendaId] = useState<number | null>(null);

  // Google Workspace OAuth access token state (strictly in-memory via firebase.ts)
  const [googleConnectedEmail, setGoogleConnectedEmail] = useState<string | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const syncDefaultNav = (u: UserProfile) => {
    if (u.role === 'admin') setActiveNav('beranda');
    else if (u.role === 'pic') setActiveNav('pic_accounts');
    else setActiveNav('peserta_agendas');
  };

  useEffect(() => {
    let mounted = true;
    const unsub = initWorkspaceAuth(
      (fbUser) => {
        if (mounted) {
          setGoogleConnectedEmail(fbUser.email || getWorkspaceEmail());
        }
      },
      () => {
        if (mounted && !getWorkspaceAccessToken()) {
          setGoogleConnectedEmail(null);
        }
      }
    );

    apiFetch<{ user: UserProfile | null }>('/api/auth/me')
      .then((res) => {
        if (!mounted) return;
        if (res.user) {
          setUser(res.user);
          syncDefaultNav(res.user);
        }
      })
      .catch((err) => {
        console.error('Session check failed:', err);
      })
      .finally(() => {
        if (mounted) setBootstrapping(false);
      });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const handleAuthSuccess = (loggedInUser: UserProfile, sessionToken?: string) => {
    if (sessionToken) {
      setSessionBearerToken(sessionToken);
    }
    setUser(loggedInUser);
    setSelectedRoomAgendaId(null);
    syncDefaultNav(loggedInUser);
  };

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const result = await googleWorkspaceSignIn();
      setGoogleConnectedEmail(result.user.email || 'Akun Google');
    } catch (err) {
      console.error('Google Workspace sign-in error:', err);
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleGooglePortalLogin = async () => {
    const result = await googleWorkspaceSignIn();
    setGoogleConnectedEmail(result.user.email || 'Akun Google');
    const authRes = await apiFetch<{ user: UserProfile; sessionToken: string }>(
      '/api/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({ idToken: result.idToken }),
      }
    );
    handleAuthSuccess(authRes.user, authRes.sessionToken);
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    try {
      await googleWorkspaceSignOut();
    } catch {
      // ignore
    }
    setSessionBearerToken(null);
    setGoogleConnectedEmail(null);
    setUser(null);
    setSelectedRoomAgendaId(null);
    setActiveNav('');
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">
          Memuat Portal Bimtek LPSE...
        </div>
      </div>
    );
  }

  if (!user || (user.role === 'peserta' && user.accountStatus !== 'approved')) {
    return (
      <AuthPortal
        pendingUser={user}
        onAuthSuccess={handleAuthSuccess}
        onGoogleLogin={handleGooglePortalLogin}
        onLogout={handleLogout}
      />
    );
  }

  let navItems: NavItem[] = [];
  let breadcrumbTitle = '';

  if (user.role === 'admin') {
    navItems = [
      { id: 'beranda', label: 'Beranda', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'monitoring', label: 'Kelas Berjalan', icon: <ClipboardList className="w-4 h-4" /> },
      { id: 'agenda', label: 'Daftar Agenda', icon: <Calendar className="w-4 h-4" /> },
      { id: 'user', label: 'Daftar User', icon: <Users className="w-4 h-4" /> },
      { id: 'atur', label: 'Atur Data', icon: <SlidersHorizontal className="w-4 h-4" /> },
      { id: 'download', label: 'Download Data', icon: <Download className="w-4 h-4" /> },
    ];
    breadcrumbTitle =
      navItems.find((i) => i.id === activeNav)?.label || 'Beranda';
  } else if (user.role === 'pic') {
    navItems = [
      { id: 'pic_accounts', label: 'Daftar User', icon: <Users className="w-4 h-4" /> },
      {
        id: 'pic_bimtek',
        label: 'Persetujuan Bimtek',
        icon: <ClipboardCheck className="w-4 h-4" />,
      },
      {
        id: 'pic_profile',
        label: 'Update Data',
        icon: <UserCog className="w-4 h-4" />,
      },
    ];
    breadcrumbTitle =
      navItems.find((i) => i.id === activeNav)?.label || 'Daftar User';
  } else {
    navItems = [
      {
        id: 'peserta_agendas',
        label: 'Agenda & Ruang Bimtek',
        icon: <BookOpen className="w-4 h-4" />,
      },
      {
        id: 'peserta_profile',
        label: 'Update Data',
        icon: <UserCog className="w-4 h-4" />,
      },
    ];
    breadcrumbTitle = selectedRoomAgendaId
      ? 'Ruang Bimtek'
      : activeNav === 'peserta_profile'
      ? 'Update Data'
      : 'Daftar Agenda';
  }

  return (
    <PortalShell
      user={user}
      navItems={navItems}
      activeNavId={activeNav}
      onSelectNav={(id) => {
        setActiveNav(id);
        setSelectedRoomAgendaId(null);
      }}
      breadcrumbTitle={breadcrumbTitle}
      googleConnectedEmail={googleConnectedEmail}
      onConnectGoogle={handleConnectGoogle}
      connectingGoogle={connectingGoogle}
      onLogout={handleLogout}
    >
      {user.role === 'admin' && (
        <>
          {activeNav === 'beranda' && (
            <AdminBeranda
              googleConnected={Boolean(googleConnectedEmail)}
              onConnectGoogle={handleConnectGoogle}
            />
          )}
          {activeNav === 'monitoring' && <AdminMonitoring />}
          {activeNav === 'agenda' && <AdminAgendas />}
          {activeNav === 'user' && (
            <AdminUsers
              currentUserId={user.id}
              onCurrentUserUpdated={(updated) => setUser(updated)}
            />
          )}
          {activeNav === 'atur' && <AdminAturData />}
          {activeNav === 'download' && <AdminDownloadData />}
        </>
      )}

      {user.role === 'pic' && (
        <>
          {activeNav === 'pic_profile' ? (
            <ProfileSettings user={user} onUserUpdated={(u) => setUser(u)} />
          ) : (
            <PicPortal
              initialTab={activeNav === 'pic_bimtek' ? 'bimtek' : 'accounts'}
            />
          )}
        </>
      )}

      {user.role === 'peserta' && (
        <>
          {activeNav === 'peserta_profile' ? (
            <ProfileSettings user={user} onUserUpdated={(u) => setUser(u)} />
          ) : selectedRoomAgendaId !== null ? (
            <RuangBimtek
              agendaId={selectedRoomAgendaId}
              googleConnected={Boolean(googleConnectedEmail)}
              onConnectGoogle={handleConnectGoogle}
              onBack={() => setSelectedRoomAgendaId(null)}
            />
          ) : (
            <PesertaAgendas onEnterRoom={(id) => setSelectedRoomAgendaId(id)} />
          )}
        </>
      )}
    </PortalShell>
  );
}
