import type {
  PlantUmlRenderResult,
  PlantUmlRenderResponse,
} from '../types/plantUml';

export const PLANTUML_RENDER_PATH = '/api/skill/plantuml/render';

function isEnglishLanguage(): boolean {
  const language = (
    typeof document !== 'undefined'
      ? document.documentElement.lang
      : typeof navigator !== 'undefined'
        ? navigator.language
        : ''
  ).toLowerCase();
  return language.startsWith('en');
}

export function pickPlantUmlServerMessage(response: Partial<PlantUmlRenderResponse>): string {
  const record = response as Partial<PlantUmlRenderResponse> & {
    messageCn?: string;
    errormsg?: string;
    message?: string;
  };
  const primary = isEnglishLanguage() ? response.messageEn : response.messgaeCn;
  const fallback = isEnglishLanguage() ? response.messgaeCn : response.messageEn;
  return primary
    || fallback
    || record.messageCn
    || record.errormsg
    || record.message
    || 'PlantUML render failed';
}

export function normalizePlantUmlRenderResult(
  response: Partial<PlantUmlRenderResponse> | PlantUmlRenderResult,
): PlantUmlRenderResult {
  if ('code' in response && response.code !== '0') {
    throw Object.assign(new Error(pickPlantUmlServerMessage(response)), {
      code: response.code,
    });
  }

  const record = response as Partial<PlantUmlRenderResponse> & Partial<PlantUmlRenderResult>;
  const image = record.data?.image ?? record.image;
  if (typeof image !== 'string' || image.trim() === '') {
    throw new Error('PlantUML image is empty');
  }

  return { image };
}
