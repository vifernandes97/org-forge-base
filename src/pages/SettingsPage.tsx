import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Building2, Users, ListChecks, ArrowUpFromLine, ArrowDownToLine, Archive, Settings, Tag, ListTodo, CalendarCheck, GitBranch, MessageCircle, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import OrganizationPage from '@/pages/OrganizationPage';
import FunnelsPage from '@/pages/FunnelsPage';
import TeamPage from '@/pages/TeamPage';
import CustomFieldsPage from '@/pages/CustomFieldsPage';
import WebhooksPage from '@/pages/WebhooksPage';
import InboundWebhooksPage from '@/pages/InboundWebhooksPage';
import ArchiveReasonsPage from '@/pages/ArchiveReasonsPage';
import SegmentsPage from '@/pages/SegmentsPage';
import TaskTypesPage from '@/pages/TaskTypesPage';
import OrbiSettingsPage from '@/pages/OrbiSettingsPage';
import WhatsAppPage from '@/pages/WhatsAppPage';
import AiSettingsPage from '@/pages/AiSettingsPage';

const tabs = [
  { value: 'organization', label: 'Organização', hint: 'Nome, identificador e logo', icon: Building2 },
  { value: 'funnels', label: 'Funis', hint: 'Etapas e SLAs dos funis de venda', icon: GitBranch },
  { value: 'team', label: 'Equipe', hint: 'Membros, papéis e convites', icon: Users },
  { value: 'custom-fields', label: 'Campos Personalizados', hint: 'Campos extras dos negócios', icon: ListChecks },
  { value: 'webhooks', label: 'Webhooks de Saída', hint: 'Avisos enviados a outros sistemas', icon: ArrowUpFromLine },
  { value: 'inbound-webhooks', label: 'Webhooks de Entrada', hint: 'Leads recebidos de outros sistemas', icon: ArrowDownToLine },
  { value: 'archive-reasons', label: 'Motivos de Arquivamento', hint: 'Opções ao arquivar um negócio', icon: Archive },
  { value: 'segments', label: 'Segmentos', hint: 'Lista de segmentos das empresas', icon: Tag },
  { value: 'task-types', label: 'Tipos de Tarefa', hint: 'Tipos e subtipos das tarefas', icon: ListTodo },
  { value: 'orbi', label: 'Orbi', hint: 'Reuniões confirmadas no Orbi', icon: CalendarCheck },
  { value: 'whatsapp', label: 'WhatsApp', hint: 'Números conectados e conversas', icon: MessageCircle },
  { value: 'ai', label: 'Inteligência Artificial', hint: 'Provedores, modelos e transcrição', icon: Sparkles },
];

/**
 * Desktop: one page with tabs. Phones (below md): /settings is a section list and
 * /settings?tab=x opens that section full screen with a back button.
 */
export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tabParam = searchParams.get('tab');
  const currentTab = tabParam || 'organization';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  // Came from the section list: go back in history so the phone's back gesture stays consistent.
  const backToList = () => {
    if ((location.state as { fromList?: boolean } | null)?.fromList) navigate(-1);
    else navigate('/settings', { replace: true });
  };

  return (
    <div className="space-y-6">
      {!tabParam && (
        <nav className="space-y-4 md:hidden" aria-label="Seções das configurações">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {tabs.map(tab => (
              <li key={tab.value}>
                <Link
                  to={`/settings?tab=${tab.value}`}
                  state={{ fromList: true }}
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-accent"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <tab.icon className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{tab.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{tab.hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {tabParam && (
        <Button variant="ghost" size="sm" className="-ml-2 -mb-2 gap-1 px-2 text-muted-foreground md:hidden" onClick={backToList}>
          <ChevronLeft className="h-4 w-4" /> Configurações
        </Button>
      )}

      <div className="hidden md:block">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Configurações
        </h1>
        <p className="text-muted-foreground">Gerencie as configurações da sua organização.</p>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className={tabParam ? undefined : 'hidden md:block'}>
        <TabsList className="hidden h-auto flex-wrap gap-1 md:flex">
          {tabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5 text-sm">
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="organization"><OrganizationPage /></TabsContent>
        <TabsContent value="funnels"><FunnelsPage /></TabsContent>
        <TabsContent value="team"><TeamPage /></TabsContent>
        <TabsContent value="custom-fields"><CustomFieldsPage /></TabsContent>
        <TabsContent value="webhooks"><WebhooksPage /></TabsContent>
        <TabsContent value="inbound-webhooks"><InboundWebhooksPage /></TabsContent>
        <TabsContent value="archive-reasons"><ArchiveReasonsPage /></TabsContent>
        <TabsContent value="segments"><SegmentsPage /></TabsContent>
        <TabsContent value="task-types"><TaskTypesPage /></TabsContent>
        <TabsContent value="orbi"><OrbiSettingsPage /></TabsContent>
        <TabsContent value="whatsapp"><WhatsAppPage /></TabsContent>
        <TabsContent value="ai"><AiSettingsPage /></TabsContent>
      </Tabs>
    </div>
  );
}
