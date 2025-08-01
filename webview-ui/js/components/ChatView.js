/* ==========================================================================
   CHAT VIEW BİLEŞENİ (ŞABLON KULLANIMLI VE GÜNCELLENMİŞ)
   ========================================================================== */

import * as DOM from '../utils/dom.js';
import { getState, setAiResponding, incrementConversationSize, setContextSize, resetChatState } from '../core/state.js';
import { postMessage } from '../services/vscode.js';
import { recalculateTotalAndUpdateUI, setPlaceholder, focus as focusInput } from './InputArea.js';
import * as DiffView from './DiffView.js';

// --- Private Fonksiyonlar ---

function createMessageElement(role, content) {
    if (DOM.welcomeContainer.classList.contains('hidden') === false) {
        DOM.welcomeContainer.classList.add('hidden');
        DOM.chatContainer.classList.remove('hidden');
    }

    const messageTemplate = document.getElementById('message-template');
    const messageClone = messageTemplate.content.cloneNode(true);

    const messageElement = messageClone.querySelector('.message');
    messageElement.classList.add(`${role}-message`, 'fade-in');
    
    const avatarIcon = messageClone.querySelector('.avatar-icon');
    avatarIcon.src = role === 'user' ? DOM.USER_ICON_URI : DOM.AI_ICON_URI;

    const contentElement = messageClone.querySelector('.message-content');
    contentElement.innerHTML = content;
    
    DOM.chatContainer.appendChild(messageClone);
    DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
    
    return messageElement;
}


function showAiLoadingIndicator() {
    if (document.getElementById('ai-loading-placeholder')) return;
    const messageElement = createMessageElement('assistant', '');
    messageElement.id = 'ai-loading-placeholder';
    
    const avatarWrapper = messageElement.querySelector('.avatar-wrapper');
    avatarWrapper.classList.add('loading');
    
    const contentDiv = messageElement.querySelector('.message-content');
    contentDiv.innerHTML = `<i>${DOM.i18n.thinking}</i>`;
}

function addCopyButtonsToCodeBlocks(element) {
    element.querySelectorAll('pre:not(.copy-button-added)').forEach(preElement => {
        const container = document.createElement('div');
        container.className = 'code-block-container';

        const parent = preElement.parentNode;
        if(parent) parent.replaceChild(container, preElement);
        container.appendChild(preElement);
        
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = 'Kopyala';
        copyButton.addEventListener('click', () => {
            const codeToCopy = preElement.querySelector('code').textContent;
            navigator.clipboard.writeText(codeToCopy).then(() => {
                copyButton.textContent = 'Kopyalandı!';
                setTimeout(() => { copyButton.textContent = 'Kopyala'; }, 2000);
            });
        });
        container.appendChild(copyButton);
        preElement.classList.add('copy-button-added');
    });
}

// --- Animasyon Efektleri (Değişiklik yok) ---

async function runTextDiffusionEffect(element, originalText) {
    return new Promise(resolve => {
        let step = 0;
        const maxSteps = 10, speed = 40;
        element.classList.add('diffusing-paragraph');
        const getRandomChar = () => String.fromCharCode(Math.floor(Math.random() * (94 - 33 + 1)) + 33);
        
        if (originalText.trim() === '') return resolve();

        const interval = setInterval(() => {
            if (step >= maxSteps) {
                clearInterval(interval);
                element.innerHTML = marked.parse(originalText);
                element.classList.remove('diffusing-paragraph');
                setTimeout(resolve, 100);
                return;
            }
            element.textContent = Array.from(originalText, c => /\s/.test(c) ? c : getRandomChar()).join('');
            step++;
        }, speed);
    });
}

async function runCodeDiffusionEffect(codeElement, rawCode) {
    const lines = rawCode.split('\n');
    for (const line of lines) {
        const lineDiv = document.createElement('div');
        codeElement.appendChild(lineDiv);
        await runDiffusionEffectForLine(lineDiv, line);
    }
    codeElement.textContent = rawCode;
    hljs.highlightElement(codeElement);
}

function runDiffusionEffectForLine(element, originalLine) {
    return new Promise(resolve => {
        let step = 0;
        const maxSteps = 8, speed = 30;
        const getRandomChar = () => String.fromCharCode(Math.floor(Math.random() * (94 - 33 + 1)) + 33);
        if (originalLine.trim() === '') {
            element.textContent = originalLine;
            return resolve();
        }
        const interval = setInterval(() => {
            if (step >= maxSteps) {
                clearInterval(interval);
                element.textContent = originalLine;
                setTimeout(resolve, 10);
                return;
            }
            element.textContent = Array.from(originalLine, c => /\s/.test(c) ? c : getRandomChar()).join('');
            step++;
        }, speed);
    });
}

async function runStreamingEffect(element, originalText, isCode) {
    return new Promise(resolve => {
        let i = 0;
        const speed = isCode ? 10 : 20;
        let buffer = '';
        function type() {
            if (i < originalText.length) {
                buffer += originalText.charAt(i);
                element.textContent = buffer;
                i++;
                DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
                setTimeout(type, speed);
            } else {
                if (!isCode) {
                    element.innerHTML = marked.parse(originalText);
                } else {
                    hljs.highlightElement(element);
                }
                resolve();
            }
        }
        type();
    });
}

// --- Public Fonksiyonlar ---

export function init() {
    // Bu bileşen için başlangıçta çalışacak bir kod varsa buraya eklenebilir.
}

export function addUserMessage(text) {
    const p = document.createElement('p');
    p.textContent = text;
    createMessageElement('user', p.outerHTML);
    incrementConversationSize(text.length); 
    recalculateTotalAndUpdateUI();
    showAiLoadingIndicator();
}

/**
 * YENİ FONKSİYON: Arayüze, AI bekleme durumunu tetiklemeden sistemsel
 * bir mesaj ekler (örneğin "Değişiklik onaylandı").
 * @param {string} text Gösterilecek metin.
 */
export function addSystemMessage(text) {
    const p = document.createElement('p');
    p.innerHTML = `<i>${text}</i>`; // Metni italik yaparak sistemsel olduğunu belirtelim.
    createMessageElement('assistant', p.outerHTML);
    // Burada AI state'ini değiştirecek veya sayaçları güncelleyecek bir kod YOKTUR.
    // Bu sadece görsel bir eklemedir.
}


export async function showAiResponse(responseText) {
    const loadingElement = document.getElementById('ai-loading-placeholder');
    if (!loadingElement) return;

    loadingElement.querySelector('.avatar-wrapper')?.classList.remove('loading');
    const contentElement = loadingElement.querySelector('.message-content');
    contentElement.innerHTML = '';
    loadingElement.id = '';

    const chunks = responseText.split(/(```[\s\S]*?```)/g).filter(Boolean);
    const { currentAnimationEffect } = getState();

    for (const chunk of chunks) {
        const isCode = chunk.startsWith('```');

        if (isCode) {
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            pre.appendChild(code);
            contentElement.appendChild(pre);
            
            const langMatch = chunk.match(/```(\w*)\n/);
            const lang = langMatch ? langMatch[1] : 'plaintext';
            code.className = `language-${lang} hljs`;
            const rawCode = chunk.replace(/```\w*\n/, '').replace(/```$/, '');
            
            if (currentAnimationEffect === 'diffusion') {
                await runCodeDiffusionEffect(code, rawCode);
            } else {
                await runStreamingEffect(code, rawCode, true);
            }
        } else { 
            const paragraphs = chunk.split(/\n{2,}/g).filter(p => p.trim() !== '');
            for(const paraText of paragraphs) {
                const paraElement = document.createElement('p');
                contentElement.appendChild(paraElement);
                if (currentAnimationEffect === 'diffusion') {
                    await runTextDiffusionEffect(paraElement, paraText.trim());
                } else {
                    await runStreamingEffect(paraElement, paraText.trim(), false);
                }
            }
        }
        DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
    }
    
    // Tüm animasyonlar bittikten sonra kod bloklarını işle
    addCopyButtonsToCodeBlocks(contentElement);
    
    setAiResponding(false);
    recalculateTotalAndUpdateUI();
    focusInput();
    postMessage('requestContextSize');
}

// GÜNCELLEME: Bu fonksiyon artık arayüzü tamamen sıfırlıyor.
export function clear() {
    DOM.chatContainer.innerHTML = '';
    DOM.chatContainer.classList.add('hidden');
    DOM.welcomeContainer.classList.remove('hidden');
    
    // Arka plan durumunu sıfırlamak için state fonksiyonunu çağır
    resetChatState();
    
    // Diğer bileşenleri de sıfırla
    DiffView.hide();
    setPlaceholder(); // Placeholder'ı varsayılan haline getir
    recalculateTotalAndUpdateUI(); // Karakter sayacını sıfırla
}

export function load(messages) {
    // Önce ekranı tamamen temizle
    clear();
    
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    if (conversationMessages.length > 0) {
        DOM.welcomeContainer.classList.add('hidden');
        DOM.chatContainer.classList.remove('hidden');
        
        let newConversationSize = 0;
        conversationMessages.forEach(msg => {
            const content = (msg.role === 'assistant') ? marked.parse(msg.content) : `<p>${msg.content}</p>`;
            createMessageElement(msg.role, content);
            newConversationSize += msg.content.length;
        });
        
        // GÜNCELLEME: Sadece `conversationSize`'ı güncelle, `filesSize`'ı koru.
        setContextSize(newConversationSize, getState().filesSize);
        addCopyButtonsToCodeBlocks(DOM.chatContainer);

    } else {
        // Eğer yüklenecek mesaj yoksa, sohbet boyutunu sıfırla.
        setContextSize(0, getState().filesSize);
    }
    
    // Her durumda UI'ı ve sayacı güncelle.
    recalculateTotalAndUpdateUI();
    focusInput();
}