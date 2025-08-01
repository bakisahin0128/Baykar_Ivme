/* ==========================================================================
   DOSYA: src/providers/ChatViewProvider.ts (HATASI DÜZELTİLMİŞ)
   ========================================================================== */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EXTENSION_ID } from '../core/constants';
import { getNonce } from '../core/utils';
import { ApiServiceManager } from '../services/ApiServiceManager';
import { ConversationManager } from '../features/ConversationManager';
import { MessageHandler } from '../features/MessageHandler';
import { ContextManager } from '../features/ContextManager';
import { SettingsManager } from '../features/SettingsManager';
import { WebviewMessageHandler } from '../features/Handlers/WebviewMessage';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = `${EXTENSION_ID}.chatView`;
    private _view?: vscode.WebviewView;

    // Yöneticiler (Managers)
    private conversationManager: ConversationManager;
    private contextManager: ContextManager;
    private settingsManager: SettingsManager;
    
    // İşleyiciler (Handlers)
    private messageHandler?: MessageHandler; 
    private webviewMessageHandler?: WebviewMessageHandler;

    constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly apiManager: ApiServiceManager
    ) {
        this.conversationManager = new ConversationManager(_context);
        this.contextManager = new ContextManager();
        this.settingsManager = new SettingsManager();
    }
    
    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'webview-ui')]
        };
        
        this.messageHandler = new MessageHandler(this.conversationManager, this.apiManager, this.contextManager, webviewView.webview);
        this.webviewMessageHandler = new WebviewMessageHandler(
            this.messageHandler,
            this.conversationManager,
            this.contextManager,
            this.settingsManager,
            webviewView.webview
        );

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            await this.webviewMessageHandler?.handleMessage(data);
        });

        // HATA DÜZELTMESİ: 'onDidBecomeVisible' -> 'onDidChangeVisibility' olarak değiştirildi.
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.webviewMessageHandler?.handleMessage({ type: 'requestContextSize' });
            }
        });
    }
    
    public setActiveContext(uri: vscode.Uri, selection: vscode.Selection, text: string) {
        if (this._view) {
            this.contextManager.setEditorContext(uri, selection, text, this._view.webview);
        }
    }
    
    private _getHtmlForWebview(webview: vscode.Webview): string {
        const toUri = (filePath: string) => webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'webview-ui', filePath));
        const htmlPath = path.join(this._context.extensionUri.fsPath, 'webview-ui', 'chat.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        const nonce = getNonce();

        return htmlContent
            .replace(/{{cspSource}}/g, webview.cspSource)
            .replace(/{{nonce}}/g, nonce)
            .replace(/{{chat_css_uri}}/g, toUri('css/chat.css').toString())
            .replace(/{{chat_js_uri}}/g, toUri('js/core/app.js').toString()) 
            .replace(/{{ai_icon_uri}}/g, toUri('assets/baykar-icon.svg').toString())
            .replace(/{{user_icon_uri}}/g, toUri('assets/BaykarLogo.svg').toString())
            .replace(/{{logo_uri}}/g, toUri('assets/BaykarLogo.svg').toString())
            .replace(/{{send_icon_uri}}/g, toUri('assets/baykar-icon.svg').toString())
            .replace(/{{attach_icon_uri}}/g, toUri('assets/attach.svg').toString())
            .replace(/{{settings_icon_uri}}/g, toUri('assets/settings-icon.svg').toString())
            .replace(/{{feedback_icon_uri}}/g, toUri('assets/feedback-icon.svg').toString())
            .replace(/{{history_icon_uri}}/g, toUri('assets/history-icon.svg').toString())
            .replace(/{{new_chat_icon_uri}}/g, toUri('assets/new-chat-icon.svg').toString());
    
    
    }
}