import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getInviteByToken, acceptInvite, type InviteInfo } from '@/services/invites';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/brand/BrandLogo';

const REASON_MSG: Record<string, string> = {
  not_found: 'Convite não encontrado.',
  revoked: 'Este link de convite foi revogado.',
  expired: 'Este link de convite expirou.',
  exhausted: 'Este link de convite atingiu o número máximo de usos.',
};

const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietário', admin: 'Administrador', member: 'Membro', viewer: 'Visualizador',
};

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setActiveOrg, refetch } = useOrganization();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    if (!token) return;
    getInviteByToken(token)
      .then(setInfo)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      navigate(`/login?invite=${token}`);
      return;
    }
    try {
      setAccepting(true);
      const res = await acceptInvite(token!);
      await refetch();
      setActiveOrg(res.organization_id);
      toast.success(res.already_member ? 'Você já é membro desta organização.' : 'Bem-vindo à organização!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao aceitar convite');
    } finally {
      setAccepting(false);
    }
  };

  // Auto-accept once user is authenticated and invite is valid
  useEffect(() => {
    if (!autoTried && !loading && !authLoading && info?.valid && user && !accepting) {
      setAutoTried(true);
      handleAccept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTried, loading, authLoading, info, user, accepting]);

  if (!token) return <Navigate to="/" replace />;

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <BrandLogo variant="horizontal" className="mx-auto h-12 w-auto" />
          </div>
          <CardTitle className="text-2xl">Convite para organização</CardTitle>
          {info?.valid ? (
            <CardDescription>
              Você foi convidado para participar de <strong>{info.organization_name}</strong>
            </CardDescription>
          ) : (
            <CardDescription>{REASON_MSG[info?.reason || 'not_found']}</CardDescription>
          )}
        </CardHeader>

        {info?.valid && (
          <CardContent className="space-y-2 text-center">
            <div className="text-sm text-muted-foreground">Você entrará como:</div>
            <Badge variant="secondary" className="text-sm">{ROLE_LABEL[info.role!]}</Badge>
          </CardContent>
        )}

        <CardFooter className="flex flex-col gap-2">
          {info?.valid ? (
            <>
              {!user && (
                <p className="text-sm text-muted-foreground text-center">
                  Faça login ou crie uma conta para aceitar o convite.
                </p>
              )}
              <Button onClick={handleAccept} className="w-full" disabled={accepting}>
                {accepting ? 'Processando...' : user ? 'Aceitar convite' : 'Entrar para aceitar'}
              </Button>
              {!user && (
                <Button variant="outline" className="w-full" onClick={() => navigate(`/register?invite=${token}`)}>
                  Criar conta
                </Button>
              )}
            </>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
              Voltar
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
