import { EmailCampaign } from '../../domain/types';
import { EmailConfigVariant } from './emailClient';

const campaignKey = (variant: EmailConfigVariant) => `${variant}_email_campaign_v1`;

/**
 * Guarda el envío masivo en localStorage tras cada correo para sobrevivir a recargas o cierres
 */
export function saveCampaign(variant: EmailConfigVariant, campaign: EmailCampaign): void {
  try {
    localStorage.setItem(campaignKey(variant), JSON.stringify(campaign));
  } catch (err) {
    console.warn('No se pudo guardar el progreso del envío en localStorage:', err);
  }
}

/**
 * Recupera el último envío masivo guardado, o null si no hay ninguno
 */
export function loadCampaign(variant: EmailConfigVariant): EmailCampaign | null {
  try {
    const raw = localStorage.getItem(campaignKey(variant));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmailCampaign;
    if (!parsed || !Array.isArray(parsed.recipients) || !parsed.records) return null;
    return parsed;
  } catch (err) {
    console.warn('Error leyendo el progreso del envío desde localStorage:', err);
    return null;
  }
}

export function clearCampaign(variant: EmailConfigVariant): void {
  try {
    localStorage.removeItem(campaignKey(variant));
  } catch (err) {
    console.warn('No se pudo borrar el progreso del envío de localStorage:', err);
  }
}
