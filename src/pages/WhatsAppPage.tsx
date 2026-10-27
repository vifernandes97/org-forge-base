import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, MessageCircle, Plus, QrCode, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useFunnels } from '@/hooks/useFunnels';
import {
  connectChannel, useChannelChats, useChannelConnections, useCreateChannelConnection, useDeleteChannelConnection,
  useRefreshChannel, useUpdateChannelConnection,
} from '@/hooks/useChannels';
import type { ChannelConnection, ChannelStatus, ChatStatus } from '@/services/channels';

const STATUS: Record<ChannelStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  connected: { label: 'Conectado', variant: 'default' },
  qr: { label: 'Aguardando QR', variant: 'outline' },
  pending: { label: 'Conectando', variant: 'outline' },
  disconnected: { label: 'Desconectado', variant: 'secondary' },
  error: { label: 'Erro', variant: 'destructive' },
};

const CHAT_STATUS: Record<ChatStatus, string> = {
  linked: 'Vinculada',
  unmatched: 'Sem contato',
  pending: 'Procurando',
  ignored: 'Ignorada',
};

const MATCHED_BY: Record<string, string> = { phone: 'telefone', phone_multiple: 'telefone (vários contatos)', name: 'nome' };

function formatarTelefone(d: string | null) {
  if (!d) return null;
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${d}`;
}

function QrDialog({ connection, onClose }: { connection: ChannelConnection | null; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    if (!connection) return;
    setQr(null); setPairing(null); setErro(null); setConectado(false);
    let vivo = true;
    // O QR do WhatsApp expira em ~40 s; pede de novo enquanto não conecta.
    const buscar = async () => {
      try {
        const r = await connectChannel(connection.id);
        if (!vivo) return;
        if (r.status === 'connected') { setConectado(true); return; }
        setQr(r.qrCode); setPairing(r.pairingCode); setErro(null);
      } catch (e) {
        if (vivo) setErro((e as Error).message);
      }
    };
    buscar();
    const t = setInterval(buscar, 20_000);
    return () => { vivo = false; clearInterval(t); };
  }, [connection]);

  // O status de verdade chega pelo webhook (connection.update); a lista recarrega a cada 15 s.
  const { data: conexoes } = useChannelConnections();
  const atual = conexoes?.find(c => c.id === connection?.id);
  const pronto = conectado || atual?.status === 'connected';

  return (
    <Dialog open={!!connection} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar {connection?.display_name}</DialogTitle>
          <DialogDescription>No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho, e aponte para o código.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3">
          {pronto ? (
            <p className="text-sm font-medium text-green-600">Conectado{atual?.phone_number ? ` · ${formatarTelefone(atual.phone_number)}` : ''}.</p>
          ) : erro ? (
            <p className="text-sm text-destructive">{erro}</p>
          ) : qr ? (
            <>
              <img src={qr} alt="QR code do WhatsApp" className="h-64 w-64 rounded-md border bg-white p-2" />
              {pairing && <p className="text-xs text-muted-foreground">Ou use o código <span className="font-mono">{pairing}</span></p>}
            </>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{pronto ? 'Fechar' : 'Cancelar'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaConexaoDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string, existing: boolean) => void }) {
  const { organization } = useOrganization();
  const { data: funnels } = useFunnels();
  const create = useCreateChannelConnection();
  const [nome, setNome] = useState('');
  const [modo, setModo] = useState<'new' | 'existing'>('new');
  const [instancia, setInstancia] = useState('');
  const [funil, setFunil] = useState('__default__');

  useEffect(() => {
    if (open) { setNome(''); setModo('new'); setInstancia(''); setFunil('__default__'); }
  }, [open]);

  const salvar = async () => {
    if (!organization) return;
    try {
      const r = await create.mutateAsync({
        organization_id: organization.id,
        display_name: nome.trim(),
        existing: modo === 'existing',
        instance_name: modo === 'existing' ? instancia.trim() : undefined,
        funnel_id: funil === '__default__' ? null : funil,
      });
      toast.success('Conexão criada');
      onCreated(r.id, modo === 'existing');
    } catch (e) {
      toast.error('Não foi possível criar', { description: (e as Error).message });
    }
  };

  const valido = nome.trim() && (modo === 'new' || instancia.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conexão de WhatsApp</DialogTitle>
          <DialogDescription>As conversas privadas do número (enviadas e recebidas) passam a ser lidas e ligadas aos negócios.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wa-nome">Nome</Label>
            <Input id="wa-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Comercial — Vinícius" />
          </div>
          <RadioGroup value={modo} onValueChange={v => setModo(v as 'new' | 'existing')} className="space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <RadioGroupItem value="new" className="mt-0.5" />
              <span><span className="font-medium">Conectar um número</span><span className="block text-muted-foreground">Cria a instância e mostra o QR code.</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <RadioGroupItem value="existing" className="mt-0.5" />
              <span><span className="font-medium">Usar instância que já existe na Evolution</span><span className="block text-muted-foreground">O número já está conectado; só ligamos o webhook.</span></span>
            </label>
          </RadioGroup>
          {modo === 'existing' && (
            <div className="space-y-2">
              <Label htmlFor="wa-inst">Nome da instância</Label>
              <Input id="wa-inst" value={instancia} onChange={e => setInstancia(e.target.value)} placeholder="minha-instancia" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Funil dos negócios novos</Label>
            <Select value={funil} onValueChange={setFunil}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Funil padrão</SelectItem>
                {(funnels || []).map((f: { id: string; name: string }) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!valido || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConexaoCard({ con, canManage, onQr }: { con: ChannelConnection; canManage: boolean; onQr: () => void }) {
  const update = useUpdateChannelConnection();
  const refresh = useRefreshChannel();
  const remove = useDeleteChannelConnection();
  const st = STATUS[con.status] ?? STATUS.pending;

  const atualizar = () => refresh.mutate(con.id, {
    onSuccess: r => toast.success(`Status: ${STATUS[r.status]?.label ?? r.status}`),
    onError: e => toast.error('Falha ao consultar a Evolution', { description: e.message }),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="truncate text-base">{con.display_name}</CardTitle>
          {canManage && (
            <Switch checked={con.is_active} aria-label={con.is_active ? 'Desativar' : 'Ativar'}
              onCheckedChange={v => update.mutate({ id: con.id, is_active: v }, { onError: e => toast.error(e.message) })} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={st.variant}>{st.label}</Badge>
          {!con.is_active && <Badge variant="secondary">Pausada</Badge>}
          {con.phone_number && <span className="text-muted-foreground">{formatarTelefone(con.phone_number)}</span>}
        </div>
        {con.status === 'error' && con.status_detail && <p className="text-xs text-destructive">{con.status_detail}</p>}
        <div className="text-xs text-muted-foreground">
          Instância <span className="font-mono">{con.instance_name}</span>
          {con.last_event_at && <> · último evento {formatDistanceToNow(new Date(con.last_event_at), { addSuffix: true, locale: ptBR })}</>}
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {con.status !== 'connected' && (
              <Button size="sm" onClick={onQr}><QrCode className="mr-2 h-4 w-4" />Conectar</Button>
            )}
            <Button size="sm" variant="outline" onClick={atualizar} disabled={refresh.isPending}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refresh.isPending ? 'animate-spin' : ''}`} />Atualizar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Remover</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover {con.display_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {con.managed
                      ? 'O número é desconectado e a instância apagada na Evolution. '
                      : 'A instância continua na Evolution; só deixamos de receber as mensagens. '}
                    As conversas e mensagens guardadas desta conexão são apagadas do CRM. Notas já criadas nos negócios ficam.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove.mutate(con.id, {
                    onSuccess: () => toast.success('Conexão removida'),
                    onError: e => toast.error(e.message),
                  })}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Conversas() {
  const [filtro, setFiltro] = useState<ChatStatus | 'all'>('all');
  const { data: chats, isLoading } = useChannelChats(filtro === 'all' ? null : filtro);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">Conversas recentes</CardTitle>
        <Select value={filtro} onValueChange={v => setFiltro(v as ChatStatus | 'all')}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="linked">Vinculadas</SelectItem>
            <SelectItem value="unmatched">Sem contato</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-24" /></div>
        ) : !chats?.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conversa</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead className="text-right">Msgs</TableHead>
                <TableHead>Última</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chats.map(ch => (
                <TableRow key={ch.id}>
                  <TableCell>
                    <div className="font-medium">{ch.push_name || formatarTelefone(ch.phone_digits) || 'Número oculto'}</div>
                    {ch.push_name && <div className="text-xs text-muted-foreground">{formatarTelefone(ch.phone_digits) ?? 'Número oculto'}</div>}
                  </TableCell>
                  <TableCell>
                    {ch.status === 'linked' && ch.contact ? (
                      <div className="text-sm">
                        <Link className="hover:underline" to={`/contacts?contact=${ch.contact.id}`}>{ch.contact.name || 'Contato'}</Link>
                        {ch.lead && <> · <Link className="hover:underline" to={`?tab=whatsapp&lead=${ch.lead.id}`}>{ch.lead.company?.trade_name || ch.lead.name || 'Negócio'}</Link></>}
                        {ch.matched_by && <div className="text-xs text-muted-foreground">por {MATCHED_BY[ch.matched_by] ?? ch.matched_by}{!ch.lead && ' · sem negócio aberto'}</div>}
                      </div>
                    ) : (
                      <Badge variant="secondary">{CHAT_STATUS[ch.status]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{ch.message_count}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {ch.last_message_at ? formatDistanceToNow(new Date(ch.last_message_at), { addSuffix: true, locale: ptBR }) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function WhatsAppPage() {
  const { isOwner, isAdmin } = useOrganization();
  const canManage = isOwner || isAdmin;
  const { data: conexoes, isLoading } = useChannelConnections();
  const [nova, setNova] = useState(false);
  const [qrDe, setQrDe] = useState<ChannelConnection | null>(null);

  const criada = (id: string, existing: boolean) => {
    setNova(false);
    // Número novo: já abre o QR. A lista ainda não tem a linha; monta o mínimo.
    if (!existing) setQrDe({ id, display_name: 'o número' } as ChannelConnection);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp</h1>
          <p className="text-muted-foreground">Números conectados e conversas ligadas aos contatos e negócios.</p>
        </div>
        {canManage && <Button onClick={() => setNova(true)}><Plus className="mr-2 h-4 w-4" />Nova conexão</Button>}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
      ) : !conexoes?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">Nenhum número conectado</h3>
            <p className="mb-4 text-muted-foreground">Conecte um WhatsApp para ler as conversas e ligá-las aos negócios.</p>
            {canManage && <Button onClick={() => setNova(true)}><Plus className="mr-2 h-4 w-4" />Conectar número</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {conexoes.map(con => <ConexaoCard key={con.id} con={con} canManage={canManage} onQr={() => setQrDe(con)} />)}
        </div>
      )}

      {!!conexoes?.length && <Conversas />}

      <NovaConexaoDialog open={nova} onOpenChange={setNova} onCreated={criada} />
      <QrDialog connection={qrDe} onClose={() => setQrDe(null)} />
    </div>
  );
}
