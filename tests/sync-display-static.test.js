const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');

assert(html.includes('function getSyncDisplayTime(meta)'), 'sync display helper must exist');
assert(
  html.includes('meta?.lastAttemptAt || meta?.cacheInfo?.lastCacheUpdate || meta?.capturedAt || meta?.updatedAt'),
  'sync display must prefer latest check time before source data time'
);
assert(html.includes('function getSourceDataTime(meta)'), 'source data time helper must exist');
assert(html.includes('</strong> 检查 · '), 'sync strip should label latest workflow check');
assert(!html.includes('</strong> 同步 · '), 'sync strip should not call stale source data time the sync time');

console.log('sync display static checks passed');
