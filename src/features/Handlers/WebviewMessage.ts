/* ==========================================================================
   DOSYA: src/features/Handlers/WebviewMessageHandler.ts (HATASI DÜZELTİLMİŞ)
   ========================================================================== */

import * as vscode from 'vscode';
import { MessageHandler } from '../MessageHandler';
import { ConversationManager } from '../ConversationManager';
import { ContextManager } from '../ContextManager';
import { SettingsManager } from '../SettingsManager';

export class WebviewMessageHandler {
    constructor(
        private messageHandler: MessageHandler,
        private conversationManager: ConversationManager,
        private contextManager: ContextManager,
        private settingsManager: SettingsManager,
        private webview: vscode.Webview
    ) {}

    public async handleMessage(data: any) {
        switch (data.type) {
            case 'askAI':
                await this.messageHandler.handleAskAi(data.payload);
                this.sendContextSize();
                break;
            
            case 'approveChange':
                await this.messageHandler.handleApproveChange(data.payload);
                this.sendContextSize();
                break;

            case 'requestContextSize':
                this.sendContextSize();
                break;

            case 'newChat':
                this.handleNewChat();
                break;

            case 'requestHistory':
                this.sendHistory();
                break;

            case 'switchChat':
                this.switchChat(data.payload.conversationId);
                break;

            case 'deleteChat':
                this.deleteChat(data.payload.conversationId);
                break;
            
            case 'requestFileUpload': 
                await this.contextManager.addFilesToContext(this.webview); 
                this.sendContextSize();
                break;
            
            case 'removeFileContext': 
                this.contextManager.removeFileContext(data.payload.fileName, this.webview);
                this.sendContextSize();
                break;
            
            case 'clearFileContext':
                this.contextManager.clearAll(this.webview);
                this.sendContextSize();
                break;
            
            case 'requestConfig': 
                this.settingsManager.sendConfigToWebview(this.webview); 
                break;
            
            case 'saveSettings': 
                await this.settingsManager.saveSettings(data.payload); 
                break;
        }
    }

    private sendContextSize() {
        const conversationSize = this.conversationManager.getActiveConversationSize();
        const filesSize = this.contextManager.getUploadedFilesSize();
        this.webview.postMessage({
            type: 'updateContextSize',
            payload: { conversationSize, filesSize }
        });
    }

    private handleNewChat() {
        this.contextManager.clearAll(this.webview, false);
        this.conversationManager.createNew();
        this.webview.postMessage({ type: 'clearChat' });
        this.sendContextSize();
    }

    private sendHistory() {
        const historySummary = this.conversationManager.getHistorySummary();
        this.webview.postMessage({ type: 'loadHistory', payload: historySummary });
    }

    private switchChat(conversationId: string) {
        this.contextManager.clearAll(this.webview, false);
        const conversation = this.conversationManager.switchConversation(conversationId);
        if (conversation) {
            this.webview.postMessage({ type: 'loadConversation', payload: conversation.messages });
        }
        this.sendContextSize();
    }

    // HATA DÜZELTMESİ: `nextConversation`'ın null olma ihtimali kontrol ediliyor.
    private deleteChat(conversationId: string) {
        const nextConversation = this.conversationManager.deleteConversation(conversationId);
        
        if (nextConversation) {
            // Silme sonrası yüklenecek bir sonraki konuşma varsa, onu yükle.
            this.webview.postMessage({ type: 'loadConversation', payload: nextConversation.messages });
        } else {
            // Yüklenecek başka konuşma kalmadıysa, temiz bir başlangıç yap.
            this.handleNewChat();
        }
       
        this.sendHistory();
        this.sendContextSize();
    }
}