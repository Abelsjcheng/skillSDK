import type { WeAgentDetails } from './bridge';

export type BrainType = 'internal' | 'custom';

export interface InternalAssistantOption {
  name: string;
  icon?: string;
  bizRobotId: string;
}

export interface DefaultAvatarOption {
  id: string;
  image: string;
}

export interface DigitalTwinFormData {
  avatarType: 'default' | 'custom';
  avatarId?: string;
  avatarFile?: File;
  name: string;
  description: string;
  brainType: BrainType;
  bizRobotId?: string;
}

export interface DigitalTwinBasicInfoPayload {
  avatarType: 'default' | 'custom';
  avatarId?: string;
  name: string;
  icon: string;
  description: string;
}

export interface CreateAssistantRouteState {
  draft?: DigitalTwinBasicInfoPayload;
}

export interface EditAssistantRouteState {
  source?: 'assistantDetail' | 'external';
  detail?: WeAgentDetails | null;
}

export interface DigitalTwinBrainPayload {
  digitalTwintype: BrainType;
  bizRobotId?: string;
}

export interface AgentTypeListResult {
  content?: unknown;
  data?: unknown;
}

export interface CreateDigitalTwinParams {
  name: string;
  icon: string;
  description: string;
  weCrewType: 0 | 1;
  bizRobotId?: string;
}

export interface UploadTinyImageResult {
  isOk: boolean;
  tinyImageUrl: string;
}

export interface GetFilePathResult {
  filePath: string;
}
