/* ==========================================================================
   GLOBAL DURUM (STATE) YÖNETİM MODÜLÜ
   Uygulama genelindeki tüm değişkenleri ve durumları yönetir.
   ========================================================================== */

import * as DOM from '../utils/dom.js';
import { updateInputAndButtonState } from '../components/InputArea.js';

// --- Arayüz Durumları ---
let isAiResponding = false;
let isDiffViewActive = false;
let currentAnimationEffect = localStorage.getItem('animationEffect') || 'diffusion';

// --- Karakter Sayacı ve Limit Durumu ---
const CONTEXT_LIMIT = 10000;
let conversationSize = 0;
let filesSize = 0;

// --- State Getters (Durumları Okuma) ---
export const getState = () => ({
    isAiResponding,
    isDiffViewActive,
    isUiBlocked: isAiResponding || isDiffViewActive,
    currentAnimationEffect,
    CONTEXT_LIMIT,
    conversationSize,
    filesSize
});

// --- State Setters (Durumları Güncelleme) ---

export function setAiResponding(value) {
    isAiResponding = value;
    updateInputAndButtonState();
}

export function setDiffViewActive(value) {
    isDiffViewActive = value;
    updateInputAndButtonState();
}

export function toggleAnimationEffect() {
    currentAnimationEffect = DOM.effectToggleSwitch.checked ? 'diffusion' : 'streaming';
    localStorage.setItem('animationEffect', currentAnimationEffect);
}

export function setContextSize(newConversationSize, newFilesSize) {
    conversationSize = newConversationSize;
    filesSize = newFilesSize;
}

export function incrementConversationSize(size) {
    conversationSize += size;
}

export function resetConversationSize() {
    conversationSize = 0;
}

export function resetFilesSize() {
    filesSize = 0;
}

export function resetChatState() {
    conversationSize = 0;
    filesSize = 0;
    isAiResponding = false;
    isDiffViewActive = false;
}