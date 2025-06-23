export interface McpMessage {
    jsonrpc: string;
    id?: string;
    method: string;
    params?: any;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}
