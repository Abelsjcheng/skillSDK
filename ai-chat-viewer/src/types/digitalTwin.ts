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


