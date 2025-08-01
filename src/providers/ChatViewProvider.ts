/* ==========================================================================
   DOSYA: src/providers/ChatViewProvider.ts (REFAKTÖR EDİLMİŞ)
   
   SORUMLULUK: Webview'i oluşturur, tüm yöneticileri (manager) ve
   işleyicileri (handler) başlatır, gelen mesajları merkezi
   WebviewMessageHandler'a yönlendirir ve HTML'i oluşturur.
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
import { WebviewMessageHandler } from '../features/Handlers/WebviewMessage'; // YENİ

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
        
        // İşleyicileri, webview nesnesi oluşturulduktan sonra başlatıyoruz.
        this.messageHandler = new MessageHandler(this.conversationManager, this.apiManager, this.contextManager, webviewView.webview);
        this.webviewMessageHandler = new WebviewMessageHandler(
            this.messageHandler,
            this.conversationManager,
            this.contextManager,
            this.settingsManager,
            webviewView.webview
        );

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // İlk açılışta bağlam boyutunu gönder
        this.webviewMessageHandler.handleMessage({ type: 'requestContextSize' });

        // Gelen tüm mesajları merkezi işleyiciye yönlendir
        webviewView.webview.onDidReceiveMessage(async (data) => {
            await this.webviewMessageHandler?.handleMessage(data);
        });

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                const activeConv = this.conversationManager.getActive();
                if (activeConv) {
                    this._view?.webview.postMessage({ type: 'loadConversation', payload: activeConv.messages });
                }
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
            // YENİ YOL: Artık core/app.js'i işaret ediyor.
            .replace(/{{chat_js_uri}}/g, toUri('js/core/app.js').toString()) 
            .replace(/{{ai_icon_uri}}/g, toUri('assets/baykar-icon.svg').toString())
            .replace(/{{user_icon_uri}}/g, toUri('assets/BaykarLogo.svg').toString())
            .replace(/{{logo_uri}}/g, toUri('assets/BaykarLogo.svg').toString())
            .replace(/{{send_icon_uri}}/g, toUri('assets/baykar-icon.svg').toString())
            .replace(/{{attach_icon_uri}}/g, toUri('assets/attach.svg').toString());
    }
}