import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { I18nProvider } from './i18n';
import { Layout } from './components/Layout';
import { SettingsLayout } from './components/SettingsLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { SetupWizardPage } from './pages/SetupWizardPage';
import { DashboardPage } from './pages/DashboardPage';
import { ChatPage } from './pages/ChatPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { DocumentDetailPage } from './pages/DocumentDetailPage';
import { SearchPage } from './pages/SearchPage';
import {
    SettingsOverviewPage, SettingsUsersPage, SettingsModelsPage,
    SettingsLanguagePage, SettingsRagPage, SettingsDomainsPage, SettingsSecurityPage,
} from './pages/settings';
import { ModelsPage } from './pages/ModelsPage';
import { MedicalPage } from './pages/MedicalPage';
import { DomainsPage } from './pages/DomainsPage';
import { DomainDetailPage } from './pages/DomainDetailPage';
import { DomainWorkspacePage } from './pages/DomainWorkspacePage';
import { MLPage } from './pages/MLPage';
import { MCPPage } from './pages/MCPPage';
import { PluginPage } from './pages/PluginPage';
import { EmbedChatPage } from './pages/EmbedChatPage';
import { AgentsPage } from './pages/AgentsPage';
import { ChannelsPage } from './pages/ChannelsPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { SkillMarketplacePage } from './pages/SkillMarketplacePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AdminPage } from './pages/AdminPage';
import { PromptLabPage } from './pages/PromptLabPage';
import { AgentBuilderPage } from './pages/AgentBuilderPage';
import { DevDocsPage } from './pages/DevDocsPage';
import { SystemLogsPage } from './pages/SystemLogsPage';
import { ToastContainer } from './components/ToastContainer';
import { getSetupStatus } from './lib/api';

function ProtectedRoutes() {
    const { user, loading } = useAuth();
    const [setupChecked, setSetupChecked] = useState(false);
    const [setupCompleted, setSetupCompleted] = useState(true);

    useEffect(() => {
        if (!user) return;
        getSetupStatus()
            .then((s) => setSetupCompleted(s.completed))
            .catch(() => setSetupCompleted(true))
            .finally(() => setSetupChecked(true));
    }, [user]);

    if (loading) return <div className="flex items-center justify-center h-screen" style={{ background: 'var(--color-bg)' }}><div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>;
    if (!user) return <LoginPage />;
    if (!setupChecked) return <div className="flex items-center justify-center h-screen" style={{ background: 'var(--color-bg)' }}><div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>;
    if (!setupCompleted) return <SetupWizardPage onComplete={() => setSetupCompleted(true)} />;

    return (
        <Routes>
            <Route element={<ErrorBoundary><Layout /></ErrorBoundary>}>
                <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
                <Route path="chat" element={<ErrorBoundary><ChatPage /></ErrorBoundary>} />
                <Route path="knowledge" element={<ErrorBoundary><KnowledgePage /></ErrorBoundary>} />
                <Route path="knowledge/:id" element={<ErrorBoundary><DocumentDetailPage /></ErrorBoundary>} />
                <Route path="search" element={<ErrorBoundary><SearchPage /></ErrorBoundary>} />
                <Route path="models" element={<ErrorBoundary><ModelsPage /></ErrorBoundary>} />
                <Route path="medical" element={<ErrorBoundary><MedicalPage /></ErrorBoundary>} />
                <Route path="domains" element={<ErrorBoundary><DomainsPage /></ErrorBoundary>} />
                <Route path="domains/:id" element={<ErrorBoundary><DomainDetailPage /></ErrorBoundary>} />
                <Route path="domains/:id/workspace" element={<ErrorBoundary><DomainWorkspacePage /></ErrorBoundary>} />
                <Route path="ml" element={<ErrorBoundary><MLPage /></ErrorBoundary>} />
                <Route path="mcp" element={<ErrorBoundary><MCPPage /></ErrorBoundary>} />
                <Route path="agents" element={<ErrorBoundary><AgentsPage /></ErrorBoundary>} />
                <Route path="channels" element={<ErrorBoundary><ChannelsPage /></ErrorBoundary>} />
                <Route path="workflows" element={<ErrorBoundary><WorkflowsPage /></ErrorBoundary>} />
                <Route path="marketplace" element={<ErrorBoundary><SkillMarketplacePage /></ErrorBoundary>} />
                <Route path="analytics" element={<ErrorBoundary><AnalyticsPage /></ErrorBoundary>} />
                <Route path="admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
                <Route path="prompt-lab" element={<ErrorBoundary><PromptLabPage /></ErrorBoundary>} />
                <Route path="agent-builder" element={<ErrorBoundary><AgentBuilderPage /></ErrorBoundary>} />
                <Route path="dev-docs" element={<ErrorBoundary><DevDocsPage /></ErrorBoundary>} />
                <Route path="logs" element={<ErrorBoundary><SystemLogsPage /></ErrorBoundary>} />
                <Route path="plugins/:pluginId/*" element={<PluginPage />} />
                <Route path="settings" element={<SettingsLayout />}>
                    <Route index element={<SettingsOverviewPage />} />
                    <Route path="users" element={<SettingsUsersPage />} />
                    <Route path="models" element={<SettingsModelsPage />} />
                    <Route path="language" element={<SettingsLanguagePage />} />
                    <Route path="rag" element={<SettingsRagPage />} />
                    <Route path="domains" element={<SettingsDomainsPage />} />
                    <Route path="security" element={<SettingsSecurityPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}

export function App() {
    return (
        <BrowserRouter>
            <I18nProvider>
                <AuthProvider>
                    <Routes>
                        {/* Embed route — no sidebar, auto-login via token */}
                        <Route path="/embed/chat" element={<EmbedChatPage />} />
                        {/* All other routes — with auth + sidebar layout */}
                        <Route path="/*" element={<ProtectedRoutes />} />
                    </Routes>
                    <ToastContainer />
                </AuthProvider>
            </I18nProvider>
        </BrowserRouter>
    );
}
