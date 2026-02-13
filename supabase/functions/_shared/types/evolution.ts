

export interface DbEvolutionInstance {
    id: string;
    name: string;
    instance_name: string;
    api_url: string;
    api_token: string;
    is_active: boolean;
    created_at?: string;
}

export interface EvolutionInstance {
    name: string;
    instanceName: string;
    token: string;
    status: 'open' | 'connecting' | 'close' | 'refused';
    qrcode?: string;
    settings?: EvolutionSettings;
}

export interface EvolutionSettings {
    reject_call: boolean;
    msg_call: string;
    groups_ignore: boolean;
    always_online: boolean;
    read_messages: boolean;
    read_status: boolean;
    sync_full_history: boolean;
}

export interface SendMessagePayload {
    number: string;
    textMessage?: string;
    options?: {
        delay?: number;
        presence?: 'composing' | 'recording';
        linkPreview?: boolean;
        mentions?: boolean;
        quoted?: any;
    };
    mediaMessage?: {
        mediatype: 'image' | 'video' | 'document' | 'audio';
        caption?: string;
        media: string; // url or base64
        fileName?: string;
    };
}

export interface WebhookConfig {
    url: string;
    webhook_by_events: boolean;
    webhook_base64: boolean;
    events: string[];
}

export interface WebhookPayload {
    event: string;
    instance: string;
    data: any;
    destination?: string;
    date_time?: string;
    sender?: string;
    apikey?: string;
}
