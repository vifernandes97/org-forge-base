import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

// Onde as mídias baixadas ficam. Hoje: disco (MEDIA_DIR — na VPS, um Volume
// do Easypanel montado no crm-app; o disco do container some a cada deploy).
// Sem MEDIA_DIR, nada é guardado: a transcrição baixa o áudio de novo da
// Evolution quando precisa. Um bucket (R2/S3) entra como outro driver.

export interface MediaStore {
  readonly nome: string;
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /** Apaga os meses anteriores a `mes` (AAAA-MM); devolve quantos meses saíram. */
  purgeBefore(mes: string): Promise<number>;
}

class Disco implements MediaStore {
  readonly nome = 'disk';
  constructor(private raiz: string) {}

  private caminho(key: string) {
    const p = resolve(this.raiz, key);
    if (!p.startsWith(resolve(this.raiz) + '/')) throw new Error('Chave de mídia inválida');
    return p;
  }

  async put(key: string, data: Buffer) {
    const p = this.caminho(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  async get(key: string) {
    try {
      return await readFile(this.caminho(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async delete(key: string) {
    await rm(this.caminho(key), { force: true });
  }

  async purgeBefore(mes: string) {
    let n = 0;
    const orgs = await readdir(this.raiz, { withFileTypes: true }).catch(() => []);
    for (const org of orgs.filter((d) => d.isDirectory())) {
      for (const m of await readdir(join(this.raiz, org.name))) {
        if (/^\d{4}-\d{2}$/.test(m) && m < mes) {
          await rm(join(this.raiz, org.name, m), { recursive: true, force: true });
          n++;
        }
      }
    }
    return n;
  }
}

let store: MediaStore | null | undefined;

/** Nulo quando não há onde guardar (MEDIA_DIR ausente). */
export function armazenamento(): MediaStore | null {
  if (store !== undefined) return store;
  const dir = process.env.MEDIA_DIR;
  return (store = dir ? new Disco(dir) : null);
}

const EXTENSOES: Record<string, string> = {
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/webm': 'webm',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
};

export function extensao(mimetype: string): string {
  return EXTENSOES[mimetype.split(';')[0].trim().toLowerCase()] ?? 'bin';
}

/** organização/AAAA-MM/mensagem.ext — por organização para apagar tudo de uma de uma vez. */
export function chaveDaMidia(organizationId: string, messageId: string, sentAt: Date, mimetype: string) {
  const mes = sentAt.toISOString().slice(0, 7);
  return join(organizationId, mes, `${messageId}.${extensao(mimetype)}`);
}
