export interface SlashCommandItem {
  command: string;
  description: string;
}

export interface SlashCommandQueryParams {
  ak: string;
  partnerAccount: string;
}

export interface SlashCommandQuerySuccess {
  code: 200;
  errormsg?: string;
  data: SlashCommandItem[];
}

export interface SlashCommandQueryError {
  code: number;
  message?: string;
}

export interface SlashCommandStoreContext {
  partnerAccount: string;
  isPcMiniApp: boolean;
}

export interface SlashCommandStoreValue {
  partnerAccount: string;
  expiresAt: number;
  commands: SlashCommandItem[];
}
