import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_EMAIL_CONFIG,
  DEFAULT_MAIL_CONFIG,
  loadEmailConfigFromStorage,
  saveEmailConfigToStorage,
} from '../src/infra/email/emailClient';
import { loadSendLog, recordSentEmail } from '../src/infra/email/sendLog';
import { clearCampaign, loadCampaign, saveCampaign } from '../src/infra/email/campaignStorage';
import { clearDriveBatch, loadDriveBatch, saveDriveBatch } from '../src/infra/drive/driveBatchStorage';
import { DAILY_WINDOW_MS } from '../src/domain/email';
import { DriveBatch } from '../src/domain/drive';
import { EmailCampaign } from '../src/domain/types';

/** localStorage en memoria; `failWrites` simula el almacenamiento lleno o bloqueado. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    failWrites: false,
    getItem: (key: string) => data.get(key) ?? null,
    setItem(key: string, value: string) {
      if (this.failWrites) throw new Error('QuotaExceededError');
      data.set(key, value);
    },
    removeItem: (key: string) => void data.delete(key),
  };
}

let storage: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Configuración del correo guardada', () => {
  it('sin nada guardado devuelve la configuración por defecto de cada servicio', () => {
    expect(loadEmailConfigFromStorage()).toEqual(DEFAULT_EMAIL_CONFIG);
    expect(loadEmailConfigFromStorage('mail')).toEqual(DEFAULT_MAIL_CONFIG);
  });

  it('guarda certificados y correos simples por separado', () => {
    saveEmailConfigToStorage({ senderName: 'A', subject: 'Cert', htmlBody: 'x' });
    saveEmailConfigToStorage({ senderName: 'B', subject: 'Mail', htmlBody: 'y' }, 'mail');
    expect(loadEmailConfigFromStorage().subject).toBe('Cert');
    expect(loadEmailConfigFromStorage('mail').subject).toBe('Mail');
  });

  it('completa con los valores por defecto los campos que falten', () => {
    storage.data.set('cert_email_config_v2', JSON.stringify({ subject: 'Solo asunto' }));
    expect(loadEmailConfigFromStorage()).toEqual({ ...DEFAULT_EMAIL_CONFIG, subject: 'Solo asunto' });
  });

  it('migra la configuración v1 y cambia el HTML antiguo por defecto por el texto nuevo', () => {
    storage.data.set(
      'cert_email_config_v1',
      JSON.stringify({
        subject: 'Asunto viejo',
        htmlBody: '<p>Hola <strong>{nombre}</strong>,</p><p>Texto</p><p>Comité Organizador</p>',
      })
    );
    const migrated = loadEmailConfigFromStorage();
    expect(migrated.subject).toBe('Asunto viejo');
    expect(migrated.htmlBody).toBe(DEFAULT_EMAIL_CONFIG.htmlBody);
    expect(JSON.parse(storage.data.get('cert_email_config_v2')!)).toEqual(migrated);
  });

  it('al migrar conserva un mensaje v1 escrito por el usuario', () => {
    storage.data.set('cert_email_config_v1', JSON.stringify({ subject: 'S', htmlBody: 'Mi mensaje propio' }));
    expect(loadEmailConfigFromStorage().htmlBody).toBe('Mi mensaje propio');
  });

  it('con datos corruptos o sin poder escribir, sigue con la configuración por defecto', () => {
    storage.data.set('cert_email_config_v2', '{no es json');
    storage.data.set('mail_email_config_v1', '{no es json');
    expect(loadEmailConfigFromStorage()).toEqual(DEFAULT_EMAIL_CONFIG);
    expect(loadEmailConfigFromStorage('mail')).toEqual(DEFAULT_MAIL_CONFIG);
    storage.failWrites = true;
    expect(() => saveEmailConfigToStorage(DEFAULT_EMAIL_CONFIG)).not.toThrow();
  });
});

describe('Registro de envíos (cupo diario)', () => {
  it('acumula los envíos y descarta los de hace más de 24 h', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    expect(recordSentEmail()).toHaveLength(1);
    vi.setSystemTime(new Date('2026-11-16T22:00:00Z'));
    expect(recordSentEmail()).toHaveLength(2);

    vi.setSystemTime(new Date('2026-11-17T10:00:01Z'));
    expect(loadSendLog()).toHaveLength(1);
    vi.setSystemTime(new Date('2026-11-17T22:00:01Z'));
    expect(loadSendLog()).toEqual([]);
  });

  it('ignora entradas que no son marcas de tiempo', () => {
    const now = Date.now();
    storage.data.set('email_send_log_v1', JSON.stringify([now, 'x', null, now - DAILY_WINDOW_MS - 1]));
    expect(loadSendLog()).toEqual([now]);
  });

  it('con datos corruptos empieza de cero, y si no puede guardar igual cuenta el envío', () => {
    storage.data.set('email_send_log_v1', '{"no":"es una lista"}');
    expect(loadSendLog()).toEqual([]);
    storage.failWrites = true;
    expect(recordSentEmail()).toHaveLength(1);
  });
});

describe('Envío masivo guardado', () => {
  const campaign: EmailCampaign = {
    id: 'camp_1',
    startedAt: '2026-11-16T10:00:00.000Z',
    updatedAt: '2026-11-16T10:05:00.000Z',
    subject: 'Hola',
    recipients: [{ id: 'a', rowNumber: 1, name: 'Ana', email: 'a@uni.pe', extra: {}, issues: [] }],
    records: { a: { recipientId: 'a', name: 'Ana', email: 'a@uni.pe', status: 'sent' } },
  };

  it('guarda y recupera el envío de cada servicio por separado', () => {
    saveCampaign('certificates', campaign);
    expect(loadCampaign('certificates')).toEqual(campaign);
    expect(loadCampaign('mail')).toBeNull();
    clearCampaign('certificates');
    expect(loadCampaign('certificates')).toBeNull();
  });

  it('descarta un envío guardado corrupto o incompleto', () => {
    for (const raw of ['{roto', 'null', '{}', '{"recipients":"x","records":{}}', '{"recipients":[]}']) {
      storage.data.set('mail_email_campaign_v1', raw);
      expect(loadCampaign('mail')).toBeNull();
    }
  });

  it('no falla si el almacenamiento está lleno', () => {
    storage.failWrites = true;
    expect(() => saveCampaign('mail', campaign)).not.toThrow();
  });
});

describe('Subida a Drive guardada', () => {
  const batch: DriveBatch = {
    batchKey: 'tpl::a,b',
    folderId: 'folder-1',
    folderName: 'Certificados',
    fileIds: { a: 'id-a', b: 'id-b' },
    uploaded: ['a'],
    createdAt: '2026-11-16T10:00:00.000Z',
  };

  it('recupera la subida solo para el mismo lote', () => {
    saveDriveBatch(batch);
    expect(loadDriveBatch('tpl::a,b')).toEqual(batch);
    expect(loadDriveBatch('tpl::a,b,c')).toBeNull();
    clearDriveBatch();
    expect(loadDriveBatch('tpl::a,b')).toBeNull();
  });

  it('descarta datos corruptos o sin carpeta, y repara la lista de subidos', () => {
    storage.data.set('certificates_drive_batch_v1', '{roto');
    expect(loadDriveBatch('tpl::a,b')).toBeNull();
    storage.data.set('certificates_drive_batch_v1', JSON.stringify({ ...batch, folderId: '' }));
    expect(loadDriveBatch('tpl::a,b')).toBeNull();
    storage.data.set('certificates_drive_batch_v1', JSON.stringify({ ...batch, uploaded: 'a' }));
    expect(loadDriveBatch('tpl::a,b')?.uploaded).toEqual([]);
  });
});
