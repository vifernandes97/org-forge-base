import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTeamMembers, useInviteMember, useUpdateMemberRole, useRemoveMember } from '@/hooks/useTeam';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, UserPlus, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { OrgRole } from '@/types';
import { InviteLinkDialog } from '@/components/team/InviteLinkDialog';
import { InviteLinksList } from '@/components/team/InviteLinksList';
import { InviteAuditLog } from '@/components/team/InviteAuditLog';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
  viewer: 'Visualizador',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  member: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

export default function TeamPage() {
  const { user } = useAuth();
  const { isOwner, isAdmin } = useOrganization();
  const { data: members, isLoading } = useTeamMembers();
  const invite = useInviteMember();
  const updateRole = useUpdateMemberRole();
  const remove = useRemoveMember();
  const canManage = isOwner || isAdmin;

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('member');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await invite.mutateAsync({ email: email.trim(), role });
      toast.success('Membro adicionado com sucesso!');
      setEmail('');
      setRole('member');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao convidar membro');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: OrgRole) => {
    try {
      await updateRole.mutateAsync({ memberId, role: newRole });
      toast.success('Role atualizada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar role');
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      await remove.mutateAsync(memberId);
      toast.success('Membro removido.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover membro');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Equipe</h1>
        {canManage && (
          <Button onClick={() => setLinkDialogOpen(true)} variant="outline">
            <Link2 className="h-4 w-4 mr-2" />
            Gerar link de convite
          </Button>
        )}
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Membros</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membro</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [1, 2, 3].map(i => (
                    <TableRow key={i}>
                      <TableCell><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-24" /></div></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                      {canManage && <TableCell><Skeleton className="h-8 w-8" /></TableCell>}
                    </TableRow>
                  ))
                ) : members?.map(member => {
                  const isCurrentUser = member.user_id === user?.id;
                  const isMemberOwner = member.role === 'owner';
                  const canEditRole = canManage && !isCurrentUser && !isMemberOwner;
                  const canRemove = canManage && !isCurrentUser && !isMemberOwner;

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {member.profile?.full_name?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{member.profile?.full_name || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{member.profile?.email || member.invited_email || '—'}</TableCell>
                      <TableCell>
                        {canEditRole ? (
                          <Select value={member.role} onValueChange={(v) => handleRoleChange(member.id, v as OrgRole)}>
                            <SelectTrigger className="w-[140px] h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="member">Membro</SelectItem>
                              <SelectItem value="viewer">Visualizador</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary" className={ROLE_COLORS[member.role]}>
                            {ROLE_LABELS[member.role]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(member.accepted_at || member.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.accepted_at ? 'default' : 'outline'}>
                          {member.accepted_at ? 'Ativo' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          {canRemove && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Remover membro">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {member.profile?.full_name} será removido da organização. Esta ação pode ser revertida convidando-o novamente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRemove(member.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Invite Form */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Adicionar membro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="invite-email">E-mail</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="usuario@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="w-full sm:w-[160px] space-y-1">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={role} onValueChange={v => setRole(v as OrgRole)}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={invite.isPending}>
                  {invite.isPending ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {canManage && <InviteLinksList />}
      {canManage && <InviteAuditLog />}

      <InviteLinkDialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen} />
    </div>
  );
}
