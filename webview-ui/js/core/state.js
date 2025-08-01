/* ==========================================================================
   GLOBAL DURUM (STATE) YÖNETİM MODÜLÜ (GÜNCELLENMİŞ)
   Uygulama genelindeki tüm değişkenleri ve durumları yönetir.
   YENİ GÜNCELLEME: `resetChatState` fonksiyonu, tüm ilgili durumları
                    eksiksiz olarak sıfırlayacak şekilde güçlendirildi.
   ========================================================================== */

import * as DOM from '../utils/dom.js';
import { updateInputAndButtonState, setPlaceholder } from '../components/InputArea.js';

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
    setPlaceholder(); // Yanıt durumuna göre placeholder'ı güncelle
    updateInputAndButtonState();
}

export function setDiffViewActive(value) {
    isDiffViewActive = value;
    setPlaceholder(); // Diff durumuna göre placeholder'ı güncelle
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

// GÜNCELLEME: Bu fonksiyon artık daha kapsamlı.
export function resetChatState() {
    conversationSize = 0;
    filesSize = 0;
    isAiResponding = false;
    isDiffViewActive = false;
    // Diğer UI durumlarını da sıfırla
    DOM.fileContextArea.innerHTML = ''; // Dosya etiketlerini temizle
    updateInputAndButtonState();
    setPlaceholder();
}