import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, ListChecks, ArrowUpFromLine, ArrowDownToLine, Archive, Settings, Zap } from 'lucide-react';
import OrganizationPage from '@/pages/OrganizationPage';
import TeamPage from '@/pages/TeamPage';
import CustomFieldsPage from '@/pages/CustomFieldsPage';
import WebhooksPage from '@/pages/WebhooksPage';
import InboundWebhooksPage from '@/pages/InboundWebhooksPage';
import ArchiveReasonsPage from '@/pages/ArchiveReasonsPage';
import AutomationsPage from '@/pages/AutomationsPage';

const tabs = [
  { value: 'organization', label: 'Organização', icon: Building2 },
  { value: 'team', label: 'Equipe', icon: Users },
  { value: 'custom-fields', label: 'Campos Personalizados', icon: ListChecks },
  { value: 'automations', label: 'Automações', icon: Zap },
  { value: 'webhooks', label: 'Webhooks de Saída', icon: ArrowUpFromLine },
  { value: 'inbound-webhooks', label: 'Webhooks de Entrada', icon: ArrowDownToLine },
  { value: 'archive-reasons', label: 'Motivos de Arquivamento', icon: Archive },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'organization';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Configurações
        </h1>
        <p className="text-muted-foreground">Gerencie as configurações da sua organização.</p>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {tabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5 text-xs sm:text-sm">
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="organization"><OrganizationPage /></TabsContent>
        <TabsContent value="team"><TeamPage /></TabsContent>
        <TabsContent value="custom-fields"><CustomFieldsPage /></TabsContent>
        <TabsContent value="webhooks"><WebhooksPage /></TabsContent>
        <TabsContent value="inbound-webhooks"><InboundWebhooksPage /></TabsContent>
        <TabsContent value="archive-reasons"><ArchiveReasonsPage /></TabsContent>
      </Tabs>
    </div>
  );
}
