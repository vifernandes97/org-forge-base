# Lê a planilha de organizações ativas da Oniplataforma (CSV) e gera o JSON
# por empresa usado por 2026-10-27-clientes-sucesso.sql: telefone normalizado
# (+55 quando vem só DDD + número), contato 1 = gestor (com o e-mail da
# planilha), contatos 2 a 6 sem e-mail.
#   python3 -I 2026-10-27-clientes-sucesso.py planilha.csv clientes.json
# Depois: cruzar com o CRM (prévia), preencher company_id/cliente/valor/nota
# e só então rodar o SQL.
import csv, json, re, sys
rows=list(csv.DictReader(open(sys.argv[1], encoding='utf-8')))
def tel(t):
    d=re.sub(r'\D','',t or '')
    if not d: return None
    if len(d) in (10,11): d='55'+d
    return '+'+d
out=[]
for i,r in enumerate(rows,1):
    contatos=[]
    nome1=r['Contato'].strip()
    contatos.append({'n':1,'nome':nome1,'tel':tel(r['Telefone']),'email':r['E-mail'].strip().lower() or None})
    for k in range(2,7):
        n=(r.get(f'Contato {k}') or '').strip(); t=tel(r.get(f'Telefone {k}'))
        if n or t: contatos.append({'n':k,'nome':n,'tel':t,'email':None})
    out.append({'i':i,'empresa':r['Empresa'].strip(),'cnpj':re.sub(r'\D','',r['CNPJ']) or None,'status':r['Status'],'plano':r['Plano'],
      'valor':float(r['Valor mensal']) if r['Valor mensal'] else 0,'cidade':r['Cidade/UF'],'cadastro':r['Cadastro'],'org_id':r['ID org'],
      'admin':r['Admin mais antigo'].strip(),'admin_email':r['E-mail admin'].strip().lower(),'contatos':contatos})
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False,indent=1)
print(len(out))
