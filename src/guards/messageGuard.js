const DEFAULT_TTL_MS = 120000; // دقيقتان لتتبع رسائل البوت الصادرة
const DEFAULT_MAX_APPEND_AGE_SEC = 60; // تجاهل رسائل المزامنة الأقدم من 60 ثانية

export function createMessageGuard({
  ttlMs = DEFAULT_TTL_MS,
  maxAppendAgeSec = DEFAULT_MAX_APPEND_AGE_SEC
} = {}) {
  const outgoingMessageIds = new Map();

  function cleanupExpired(now = Date.now()) {
    for (const [id, createdAt] of outgoingMessageIds) {
      if (now - createdAt > ttlMs) {
        outgoingMessageIds.delete(id);
      }
    }
  }

  function registerOutgoing(messageId, now = Date.now()) {
    if (!messageId) return;
    cleanupExpired(now);
    outgoingMessageIds.set(messageId, now);
  }

  function unregisterOutgoing(messageId) {
    if (!messageId) return;
    outgoingMessageIds.delete(messageId);
  }

  function hasOutgoing(messageId) {
    return Boolean(messageId && outgoingMessageIds.has(messageId));
  }

  function evaluateUpsert({ upsertType, message, nowMs = Date.now() }) {
    if (!message || !message.key) {
      return { allow: false, reason: 'EMPTY_OR_NO_KEY' };
    }

    const msgId = message.key.id;
    const isFromMe = Boolean(message.key.fromMe);
    const remoteJid = message.key.remoteJid;

    // 1. استثناء رسائل البوت الصادرة عند رجوع حدث append الخاص بها (منع الحلقة)
    if (upsertType === 'append' && isFromMe && hasOutgoing(msgId)) {
      unregisterOutgoing(msgId);
      return { allow: false, reason: 'BOT_SELF_APPEND_IGNORED' };
    }

    // 2. قبول notify فقط، أو append إذا كانت صادرة من نفس الحساب (المالك)
    if (upsertType !== 'notify') {
      if (!(upsertType === 'append' && isFromMe)) {
        return { allow: false, reason: 'UNSUPPORTED_UPSERT_TYPE' };
      }
      // تجاهل رسائل المزامنة التاريخية القديمة
      const nowSec = Math.floor(nowMs / 1000);
      const msgTs = Number(message.messageTimestamp || 0);
      if (msgTs > 0 && nowSec - msgTs > maxAppendAgeSec) {
        return { allow: false, reason: 'STALE_APPEND_HISTORY' };
      }
    }

    // 3. تجاهل تحديثات الحالة
    if (remoteJid === 'status@broadcast') {
      return { allow: false, reason: 'STATUS_BROADCAST_IGNORED' };
    }

    return { allow: true, reason: 'ALLOWED' };
  }

  return {
    registerOutgoing,
    unregisterOutgoing,
    hasOutgoing,
    evaluateUpsert,
    _store: outgoingMessageIds
  };
}
