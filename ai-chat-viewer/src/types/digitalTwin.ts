export type BrainType = 'internal' | 'custom';

export interface InternalAssistantOption {
  id: string;
  label: string;
  icon?: string;
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
  internalAssistantId?: string;
}

export interface DigitalTwinBasicInfoPayload {
  name: string;
  icon: string;
  description: string;
}

export interface DigitalTwinBrainPayload {
  digitalTwintype: BrainType;
  internalAssistantId?: string;
}

export interface CreateDigitalTwinParams extends DigitalTwinBasicInfoPayload {
  digitalTwintype: BrainType;
  agent?: string;
}


