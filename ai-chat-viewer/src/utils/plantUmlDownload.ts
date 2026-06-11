import type { PlantUmlDownloadPayload } from '../types/plantUml';
import { downloadFileWithPedestal } from './pcFileDownload';

export async function downloadPlantUmlImage(payload: PlantUmlDownloadPayload): Promise<void> {
  await downloadFileWithPedestal(payload);
}
