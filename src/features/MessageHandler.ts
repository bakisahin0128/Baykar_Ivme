/* ==========================================================================
   DOSYA: src/features/MessageHandler.ts (REFAKTÖR EDİLMİŞ)
   
   SORUMLULUK: Webview'den gelen 'askAI' komutunu işler. Standart sohbeti
   yönetir veya karmaşık etkileşimleri (dosya/seçim) InteractionHandler'a
   delege eder.
   ========================================================================== */

import * as vscode from 'vscode';
import { ApiServiceManager } from '../services/ApiServiceManager';
import { ConversationManager } from './ConversationManager';
import { InteractionHandler } from './Handlers/Interaction';
import { ContextManager } from './ContextManager';
import { ChatMessage, ApproveChangeArgs, DiffData } from '../types/index';
import { EXTENSION_ID, SETTINGS_KEYS } from '../core/constants';

export class MessageHandler {
    private interactionHandler: InteractionHandler;

    constructor(
        private conversationManager: ConversationManager,
        private apiManager: ApiServiceManager,
        private contextManager: ContextManager,
        private webview: vscode.Webview
    ) {
        this.interactionHandler = new InteractionHandler(conversationManager, apiManager, webview);
    }

    /**
     * Kullanıcıdan gelen ana mesajı alır ve bağlama göre ilgili
     * işleyiciye yönlendirir.
     */
    public async handleAskAi(userMessage: string) {
        if (this.contextManager.uploadedFileContexts.length > 0) {
            // Dosya etkileşimi
            await this.interactionHandler.handle(userMessage, {
                type: 'file',
                files: this.contextManager.uploadedFileContexts
            });
        } else if (this.contextManager.activeContextText && this.contextManager.activeEditorUri && this.contextManager.activeSelection) {
            // Seçili kod etkileşimi
            await this.interactionHandler.handle(userMessage, {
                type: 'selection',
                code: this.contextManager.activeContextText,
                uri: this.contextManager.activeEditorUri,
                selection: this.contextManager.activeSelection
            });
            this.contextManager.clearAll(this.webview);
        } else {
            // Standart sohbet
            await this.handleStandardChat(userMessage);
        }
    }

    /**
     * Standart, bağlamsız sohbet mesajlarını yönetir.
     */
    public async handleStandardChat(userMessage: string) {
        this.conversationManager.addMessage('user', userMessage);

        try {
            const activeConversation = this.conversationManager.getActive();
            if (!activeConversation) throw new Error("Aktif konuşma bulunamadı.");

            const config = vscode.workspace.getConfiguration(EXTENSION_ID);
            const historyLimit = config.get<number>(SETTINGS_KEYS.conversationHistoryLimit, 2);
            
            const systemPrompt = activeConversation.messages.find(m => m.role === 'system');
            const currentMessages = activeConversation.messages.filter(m => m.role !== 'system');
            const limitedMessages = currentMessages.slice(-(historyLimit * 2 + 1));
            const messagesForApi: ChatMessage[] = systemPrompt ? [systemPrompt, ...limitedMessages] : limitedMessages;
            
            const aiResponse = await this.apiManager.generateChatContent(messagesForApi);
            this.conversationManager.addMessage('assistant', aiResponse);
            this.webview.postMessage({ type: 'addResponse', payload: aiResponse });

        } catch (error: any) {
            console.error("Chat API Error:", error);
            this.conversationManager.removeLastMessage();
            const errorMessage = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu.";
            this.webview.postMessage({ type: 'addResponse', payload: `**Hata:** ${errorMessage}` });
        }
    }
    
    /**
     * Kullanıcının önerilen bir değişikliği onaylamasını işler.
     */
    public async handleApproveChange(args: ApproveChangeArgs) {
        const { diff } = args;
        try {
            if (diff.context.type === 'file' && diff.context.fileUri) {
                const uri = vscode.Uri.parse(diff.context.fileUri);
                const writeData = Buffer.from(diff.modifiedCode, 'utf8');
                await vscode.workspace.fs.writeFile(uri, writeData);
                vscode.window.showInformationMessage(`'${vscode.workspace.asRelativePath(uri)}' dosyası başarıyla güncellendi.`);
            } else if (diff.context.type === 'selection' && diff.context.selection) {
                const uri = vscode.Uri.parse(diff.context.selection.uri);
                const rangeArray = diff.context.selection.range;
                const selection = new vscode.Selection(new vscode.Position(rangeArray[0], rangeArray[1]), new vscode.Position(rangeArray[2], rangeArray[3]));
                const edit = new vscode.WorkspaceEdit();
                edit.replace(uri, selection, diff.modifiedCode);
                await vscode.workspace.applyEdit(edit);
                vscode.window.showInformationMessage('Kodunuz başarıyla güncellendi!');
            }
            this.webview.postMessage({ type: 'changeApproved' });
        } catch (error) {
            console.error('Değişiklik uygulanırken hata oluştu:', error);
            const errorMessage = "Değişiklik uygulanırken bir hata oluştu. Lütfen tekrar deneyin.";
            vscode.window.showErrorMessage(errorMessage);
            this.webview.postMessage({ type: 'addResponse', payload: errorMessage });
        }
    }
}