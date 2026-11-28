import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMessageGuard } from '../src/guards/messageGuard.js';

const indexContent = fs.readFileSync('index.js', 'utf8');
assert.ok(
  indexContent.includes('createMessageGuard') && indexContent.includes('messageGuard.evaluateUpsert'),
  'فشل: index.js لا يستخدم وحدة الحماية المشتركة بعد'
);
assert.ok(
  !indexContent.includes('leonOutgoingMessageIds'),
  'فشل: لا تزال هناك بقايا للمتغير القديم في index.js'
);

const guard = createMessageGuard({ ttlMs: 120000, maxAppendAgeSec: 60 });
const nowMs = 1700000000000;
const nowSec = Math.floor(nowMs / 1000);

guard.registerOutgoing('BOT_OUT_1', nowMs);
const resBotEcho = guard.evaluateUpsert({
  upsertType: 'append',
  nowMs,
  message: {
    key: { id: 'BOT_OUT_1', remoteJid: '966591718655@s.whatsapp.net', fromMe: true },
    messageTimestamp: nowSec,
    message: { conversation: 'Pong!' }
  }
});
assert.equal(resBotEcho.allow, false);
assert.equal(resBotEcho.reason, 'BOT_SELF_APPEND_IGNORED');
assert.equal(guard.hasOutgoing('BOT_OUT_1'), false);

const resOwnerCmd = guard.evaluateUpsert({
  upsertType: 'append',
  nowMs,
  message: {
    key: { id: 'OWNER_PING_1', remoteJid: '966591718655@s.whatsapp.net', fromMe: true },
    messageTimestamp: nowSec,
    message: { conversation: '!ping' }
  }
});
assert.equal(resOwnerCmd.allow, true);
assert.equal(resOwnerCmd.reason, 'ALLOWED');

const resStaleAppend = guard.evaluateUpsert({
  upsertType: 'append',
  nowMs,
  message: {
    key: { id: 'OLD_SYNC_1', remoteJid: '966591718655@s.whatsapp.net', fromMe: true },
    messageTimestamp: nowSec - 120,
    message: { conversation: '!ping' }
  }
});
assert.equal(resStaleAppend.allow, false);
assert.equal(resStaleAppend.reason, 'STALE_APPEND_HISTORY');

guard.registerOutgoing('FAILED_MSG_1', nowMs);
assert.equal(guard.hasOutgoing('FAILED_MSG_1'), true);
guard.unregisterOutgoing('FAILED_MSG_1');
assert.equal(guard.hasOutgoing('FAILED_MSG_1'), false);

const resNotify = guard.evaluateUpsert({
  upsertType: 'notify',
  nowMs,
  message: {
    key: { id: 'USER_MSG_1', remoteJid: '966511111111@s.whatsapp.net', fromMe: false },
    messageTimestamp: nowSec,
    message: { conversation: '!menu' }
  }
});
assert.equal(resNotify.allow, true);

console.log('ALL_REAL_INDEX_AND_GUARD_TESTS_PASSED');
