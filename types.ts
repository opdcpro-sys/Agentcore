export interface AppState {
  status: 'UNKNOWN' | 'DISCONNECTED' | 'WAITING_FOR_CODE' | 'WAITING_FOR_PASSWORD' | 'CONNECTED';
  botInfo: { id: string, username: string, firstName: string } | null;
  agents: Record<string, string>;
  supremeLeaderId: string;
}

export interface SetupPayload {
  apiId: string;
  apiHash: string;
  phone: string;
  supremeLeaderId: string;
}
