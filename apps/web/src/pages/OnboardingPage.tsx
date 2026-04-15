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
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">DoTask</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.displayName}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Bienvenido a DoTask
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Para comenzar, crea un espacio de trabajo o únete a uno existente.
            </p>
          </div>

          <div className="rounded-xl bg-white shadow-lg">
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('create')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'create'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Crear espacio
              </button>
              <button
                onClick={() => setActiveTab('join')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'join'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
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
                      className="block text-sm font-medium text-gray-700"
                    >
                      Nombre del espacio de trabajo
                    </label>
                    <input
                      id="ws-name"
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Mi equipo"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  {createWs.isError && (
                    <p className="text-sm text-red-600">
                      {(createWs.error as Error).message}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={createWs.isPending || !workspaceName.trim()}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createWs.isPending ? 'Creando...' : 'Crear espacio de trabajo'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <label
                      htmlFor="invite-code"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Código de invitación
                    </label>
                    <input
                      id="invite-code"
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="Pega el código aquí"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  {acceptInv.isError && (
                    <p className="text-sm text-red-600">
                      {(acceptInv.error as Error).message}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={acceptInv.isPending || !inviteCode.trim()}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
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
