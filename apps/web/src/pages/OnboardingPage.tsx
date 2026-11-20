import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCreateWorkspace, useAcceptInvitation } from '../hooks/useWorkspaces';

export default function OnboardingPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  const createWs = useCreateWorkspace();
  const acceptInv = useAcceptInvitation();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    await createWs.mutateAsync(workspaceName.trim());
    navigate('/', { replace: true });
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    await acceptInv.mutateAsync(inviteCode.trim());
    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-ink">DoTask</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">{user?.displayName}</span>
            <button
              onClick={logout}
              className="text-sm text-muted hover:text-ink"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-ink">
              Bienvenido a DoTask
            </h2>
            <p className="mt-2 text-sm text-muted">
              Para comenzar, crea un espacio de trabajo o únete a uno existente.
            </p>
          </div>

          <div className="rounded-xl bg-surface shadow-lg">
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('create')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'create'
                    ? 'border-b-2 border-brand text-brand'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Crear espacio
              </button>
              <button
                onClick={() => setActiveTab('join')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'join'
                    ? 'border-b-2 border-brand text-brand'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Unirme con código
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'create' ? (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label
                      htmlFor="ws-name"
                      className="block text-sm font-medium text-muted"
                    >
                      Nombre del espacio de trabajo
                    </label>
                    <input
                      id="ws-name"
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Mi equipo"
                      className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      autoFocus
                    />
                  </div>
                  {createWs.isError && (
                    <p className="text-sm text-danger">
                      {(createWs.error as Error).message}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={createWs.isPending || !workspaceName.trim()}
                    className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-strong disabled:opacity-50"
                  >
                    {createWs.isPending ? 'Creando...' : 'Crear espacio de trabajo'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <label
                      htmlFor="invite-code"
                      className="block text-sm font-medium text-muted"
                    >
                      Código de invitación
                    </label>
                    <input
                      id="invite-code"
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="Pega el código aquí"
                      className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      autoFocus
                    />
                  </div>
                  {acceptInv.isError && (
                    <p className="text-sm text-danger">
                      {(acceptInv.error as Error).message}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={acceptInv.isPending || !inviteCode.trim()}
                    className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-strong disabled:opacity-50"
                  >
                    {acceptInv.isPending ? 'Uniéndome...' : 'Unirme al espacio'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
