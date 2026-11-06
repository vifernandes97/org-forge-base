import { FORMULARIO_ESPERA_MIN } from './boas-vindas.js';
import { FILAS, fila } from './fila.js';

/**
 * Formulário recebido (negócio novo ou reaberto): agenda a boas-vindas sem a
 * frase para daqui a FORMULARIO_ESPERA_MIN (docs/WHATSAPP.md §17). O job
 * decide tudo (conexão ligada, segmento, se o lead já escreveu). Não segura a
 * resposta ao formulário nem a derruba se a fila falhar.
 */
export function agendarBoasVindasFormulario(leadId: string): void {
  fila()
    .then((b) => b.send(FILAS.boasVindasFormulario, { leadId }, { singletonKey: leadId, startAfter: FORMULARIO_ESPERA_MIN * 60 }))
    .catch((e) => console.error('[canais] agendar boas-vindas do formulário', e));
}
