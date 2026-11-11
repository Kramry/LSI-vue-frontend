<script setup>
import { ref } from 'vue'
import { apiPost } from '../services/api'

const open = ref(false)
const sending = ref(false)
const draft = ref('')
const conversationId = ref(0)
const messages = ref([{ role: 'assistant', text: 'Hello! Ask about English lessons, vocabulary, FAQs, or SmartTrack.' }])

async function sendMessage() {
  const message = draft.value.trim()
  if (!message || sending.value) return
  messages.value.push({ role: 'user', text: message })
  draft.value = ''
  sending.value = true
  const replyIndex = messages.value.push({ role: 'assistant', text: 'Thinking…', pending: true }) - 1
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila'
    const response = await apiPost('/ai/chat', {
      message,
      conversation_id: conversationId.value,
      timezone
    })
    let payload = response
    while (payload?.data && typeof payload.data === 'object') payload = payload.data
    if (typeof payload?.answer !== 'string' || !payload.answer.trim()) {
      throw new Error('The assistant returned an empty answer. Please try again.')
    }
    conversationId.value = payload.conversation_id ?? conversationId.value
    messages.value[replyIndex].text = payload.answer.trim()
    messages.value[replyIndex].messageId = payload.message_id
    messages.value[replyIndex].pending = false
  } catch (error) {
    messages.value[replyIndex].text = error?.message || 'The assistant is unavailable right now. Please try again.'
    messages.value[replyIndex].pending = false
    messages.value[replyIndex].failed = true
  } finally {
    sending.value = false
  }
}

async function sendFeedback(message, rating) {
  try {
    await apiPost('/ai/feedback', { message_id: message.messageId, rating })
    message.feedbackSaved = true
  } catch {
    message.feedbackError = true
  }
}
</script>

<template>
  <aside class="ai-assistant">
    <button class="ai-launcher" type="button" :aria-expanded="open" aria-controls="ai-chat-panel" @click="open = !open">
      <span aria-hidden="true">✦</span> Ask LSI Assistant
    </button>
    <section v-if="open" id="ai-chat-panel" class="ai-panel" aria-label="LSI SmartTrack AI Assistant">
      <header class="ai-panel-header">
        <div><strong>LSI SmartTrack AI</strong><small>Training and institutional help</small></div>
        <button type="button" aria-label="Close assistant" @click="open = false">×</button>
      </header>
      <div class="ai-messages" aria-live="polite">
        <template v-for="(message, index) in messages" :key="index">
          <p class="ai-message" :class="message.role">{{ message.text }}</p>
          <div v-if="message.messageId" class="ai-feedback">
            <template v-if="!message.feedbackSaved">
              <button type="button" :disabled="message.feedbackError" @click="sendFeedback(message, 'helpful')">Helpful</button>
              <button type="button" :disabled="message.feedbackError" @click="sendFeedback(message, 'not_helpful')">Not helpful</button>
            </template>
            <small v-else>Thanks for your feedback.</small>
            <small v-if="message.feedbackError">Feedback could not be saved.</small>
          </div>
        </template>
      </div>
      <form class="ai-compose" @submit.prevent="sendMessage">
        <label class="sr-only" for="ai-assistant-message">Your question</label>
        <textarea id="ai-assistant-message" v-model="draft" rows="2" maxlength="4000" placeholder="Type your question…" required></textarea>
        <button class="ai-send" type="submit" :disabled="sending || !draft.trim()">{{ sending ? '…' : 'Send' }}</button>
      </form>
      <p class="ai-disclaimer">AI answers can make mistakes. Check official LSI sources for important decisions.</p>
    </section>
  </aside>
</template>

<style scoped>
.ai-assistant{position:fixed;z-index:80;right:22px;bottom:20px;font-family:inherit}.ai-launcher{border:0;border-radius:999px;padding:13px 18px;color:#fff;background:#173a60;box-shadow:0 8px 28px #10243b40;font:inherit;font-weight:700;cursor:pointer}.ai-panel{position:absolute;right:0;bottom:62px;width:min(380px,calc(100vw - 30px));height:min(520px,calc(100vh - 110px));display:flex;flex-direction:column;overflow:hidden;border:1px solid #dbe4ef;border-radius:16px;background:#fff;box-shadow:0 18px 48px #10243b35}.ai-panel-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;color:#fff;background:#173a60}.ai-panel-header div{display:grid;gap:3px}.ai-panel-header small{opacity:.8}.ai-panel-header button{border:0;color:#fff;background:none;font-size:24px;cursor:pointer}.ai-messages{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}.ai-message{max-width:88%;margin:0;padding:10px 12px;border-radius:12px;background:#f1f5f9;white-space:pre-wrap;overflow-wrap:anywhere}.ai-message.user{align-self:flex-end;background:#e4effa}.ai-message.assistant{align-self:flex-start}.ai-compose{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e2e8f0}.ai-compose textarea{flex:1;min-width:0;resize:vertical;border:1px solid #cbd5e1;border-radius:8px;padding:9px;font:inherit}.ai-send{align-self:flex-end;padding:9px 13px;border:0;border-radius:8px;color:#fff;background:#2a68a3;font-weight:700;cursor:pointer}.ai-send:disabled{opacity:.55;cursor:wait}.ai-feedback{display:flex;gap:6px;padding-left:5px}.ai-feedback button{border:0;background:transparent;color:#315d85;font-size:12px;cursor:pointer}.ai-feedback small{color:#64748b;font-size:11px}.ai-disclaimer{margin:0;padding:0 12px 10px;color:#64748b;font-size:11px}@media(max-width:479px){.ai-assistant{right:12px;bottom:12px}}
</style>
