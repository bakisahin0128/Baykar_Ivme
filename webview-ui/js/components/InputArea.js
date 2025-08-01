/* ==========================================================================
   INPUT AREA BİLEŞENİ
   Kullanıcı girişi, karakter sayacı, buton durumları ve olayları yönetir.
   ========================================================================== */

import * as DOM from '../utils/dom.js';
import * as VsCode from '../services/vscode.js';
import { getState, setAiResponding } from '../core/state.js';
import { addUserMessage } from './ChatView.js';

function handleSendMessage() {
    if (getState().isUiBlocked) return;
    const text = DOM.input.value;
    if (text.trim() === '') return;

    addUserMessage(text);
    DOM.input.value = '';
    
    autoResize();
    recalculateTotalAndUpdateUI();

    VsCode.postMessage('askAI', text);
    setAiResponding(true);
}

// --- Public Fonksiyonlar ---

export function init() {
    DOM.sendButton.addEventListener('click', handleSendMessage);

    DOM.input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    });

    DOM.input.addEventListener('input', () => {
        autoResize();
        recalculateTotalAndUpdateUI();
    });

    DOM.attachFileButton.addEventListener('click', () => {
        if (getState().isUiBlocked) return;
        VsCode.postMessage('requestFileUpload');
    });
}

export function autoResize() {
    DOM.input.style.height = 'auto';
    DOM.input.style.height = `${DOM.input.scrollHeight}px`;
}

export function recalculateTotalAndUpdateUI() {
    const { conversationSize, filesSize, CONTEXT_LIMIT } = getState();
    const promptSize = DOM.input.value.length;
    let totalSize = conversationSize + filesSize + promptSize;

    if (totalSize > CONTEXT_LIMIT) {
        const overage = totalSize - CONTEXT_LIMIT;
        DOM.input.value = DOM.input.value.slice(0, DOM.input.value.length - overage);
        totalSize = conversationSize + filesSize + DOM.input.value.length;
    }

    const isLimitExceeded = totalSize >= CONTEXT_LIMIT;
    
    DOM.characterCounter.textContent = `${totalSize} / ${CONTEXT_LIMIT}`;
    DOM.characterCounter.classList.toggle('limit-exceeded', isLimitExceeded);
    
    updateInputAndButtonState(isLimitExceeded);
}

export function updateInputAndButtonState(limitExceeded = false) {
    const { isUiBlocked } = getState();

    DOM.input.disabled = isUiBlocked;

    const canSend = !isUiBlocked && DOM.input.value.trim().length > 0 && !limitExceeded;
    DOM.sendButton.disabled = !canSend;
    DOM.sendButton.style.opacity = canSend ? '1' : '0.5';
    DOM.sendButton.style.cursor = canSend ? 'pointer' : 'not-allowed';

    const canAttach = !isUiBlocked && !limitExceeded;
    DOM.attachFileButton.disabled = !canAttach;
    DOM.attachFileButton.style.opacity = canAttach ? '1' : '0.5';
    DOM.attachFileButton.style.cursor = canAttach ? 'pointer' : 'not-allowed';

    setPlaceholder();
}

export function setPlaceholder(text = null) {
    const { isAiResponding, isDiffViewActive } = getState();
    if (text) {
        DOM.input.placeholder = text;
        return;
    }

    if (isAiResponding) {
        DOM.input.placeholder = 'İvme yanıtlıyor, lütfen bekleyin...';
    } else if (isDiffViewActive) {
        DOM.input.placeholder = 'Lütfen önerilen değişikliği onaylayın veya reddedin.';
    } else {
        const fileTags = DOM.fileContextArea.querySelectorAll('.file-tag');
        DOM.input.placeholder = fileTags.length > 0
            ? `${fileTags.length} dosya hakkında bir talimat girin...`
            : 'Bir soru sorun veya dosya ekleyin...';
    }
}

export function focus() {
    DOM.input.focus();
}