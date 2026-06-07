/**
 * 从原站 GitHub Pages 拉取实时足球数据
 *
 * 数据源: https://chen-1119.github.io/football-predict/data/
 *
 * 缓存策略:
 *   - matches-current.json → 直接覆盖 (当前赛事，始终最新)
 *   - matches-history.json → 追加合并 (保留本地已有的历史数据，新增原站新数据)
 *   - sync-meta.json → 直接覆盖 (元数据，始终最新)
 *
 * 为什么追加历史数据?
 *   原站可能下掉旧的历史数据，但我们本地需要保留所有历史记录
 *   用于近期战绩、交锋历史、历史赛果页面等
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SOURCE_BASE = 'https://chen-1119.github.io/football-predict/data';

// 从远程拉取 JSON (带重试)
async function fetchJson(filename, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const url = `${SOURCE_BASE}/${filename}?v=${Date.now()}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
        },
        timeout: 30000,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    } catch (err) {
      if (i < retries - 1) {
        console.log(`    重试 ${i + 2}/${retries}...`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
}

// 写入文件
function writeJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  const size = JSON.stringify(data).length;
  const count = Array.isArray(data) ? data.length + ' 条' : '对象';
  console.log(`  ✅ ${filename} (${count}, ${(size / 1024).toFixed(1)}KB)`);
}

// 读取本地文件 (不存在则返回空)
function readLocal(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// 合并历史数据: 本地已有的 + 远程新拉取的，按 id 去重
function mergeHistory(localData, remoteData) {
  if (!localData || !Array.isArray(localData)) return remoteData;
  if (!remoteData || !Array.isArray(remoteData)) return localData;

  const merged = new Map();

  // 先放本地数据 (保留所有已有记录)
  localData.forEach(m => {
    if (m.id) merged.set(m.id, m);
  });

  // 再放远程数据 (覆盖同 id 的，新增不同的)
  let updated = 0;
  let added = 0;
  remoteData.forEach(m => {
    if (!m.id) return;
    if (merged.has(m.id)) {
      // 远程有更新 (比如比分从 null 变成实际比分)
      const existing = merged.get(m.id);
      const remoteScore = m.scoreHome !== null && m.scoreHome !== undefined;
      const localScore = existing.scoreHome !== null && existing.scoreHome !== undefined;
      if (remoteScore && !localScore) {
        // 远程有比分而本地没有，更新
        merged.set(m.id, m);
        updated++;
      }
    } else {
      // 新增记录
      merged.set(m.id, m);
      added++;
    }
  });

  console.log(`  历史合并: 本地 ${localData.length} 条 + 远程 ${remoteData.length} 条 → 合并后 ${merged.size} 条 (新增 ${added}, 更新 ${updated})`);

  // 转为数组，按时间倒序排列
  return [...merged.values()].sort((a, b) => {
    const ta = new Date(a.kickoffTime || 0).getTime();
    const tb = new Date(b.kickoffTime || 0).getTime();
    return tb - ta;
  });
}

async function main() {
  console.log('=== 足球数据同步 ===');
  console.log('数据源:', SOURCE_BASE);
  console.log('时间:', new Date().toISOString());
  console.log('');

  // 确保目录存在
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let success = 0;
  let failed = 0;

  // 1. matches-current.json → 直接覆盖
  try {
    console.log('[1/3] 拉取当前赛事...');
    const current = await fetchJson('matches-current.json');
    writeJson('matches-current.json', current);
    success++;
  } catch (err) {
    console.error(`  ❌ matches-current.json 失败:`, err.message);
    failed++;
  }

  // 2. matches-history.json → 追加合并
  try {
    console.log('[2/3] 拉取历史赛事 (追加合并)...');
    const remoteHistory = await fetchJson('matches-history.json');
    const localHistory = readLocal('matches-history.json');
    const merged = mergeHistory(localHistory, remoteHistory);
    writeJson('matches-history.json', merged);
    success++;
  } catch (err) {
    console.error(`  ❌ matches-history.json 失败:`, err.message);
    failed++;
  }

  // 3. sync-meta.json → 直接覆盖
  try {
    console.log('[3/3] 拉取同步元数据...');
    const meta = await fetchJson('sync-meta.json');
    meta.lastAttemptAt = new Date().toISOString();
    meta.refreshPolicy = {
      ...(meta.refreshPolicy || {}),
      workflowMinutes: 30,
      pagePollSeconds: 30,
    };
    // 更新本地元数据，补充缓存统计
    const localHistory = readLocal('matches-history.json');
    if (localHistory) {
      meta.cacheInfo = {
        localHistoryCount: localHistory.length,
        lastCacheUpdate: new Date().toISOString(),
      };
    }
    writeJson('sync-meta.json', meta);
    success++;
  } catch (err) {
    console.error(`  ❌ sync-meta.json 失败:`, err.message);
    failed++;
  }

  console.log('');
  console.log(`同步完成: ${success} 成功, ${failed} 失败`);

  if (failed === 3) {
    console.log('⚠️  所有文件同步失败，保留现有数据');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('同步失败:', err);
  process.exit(1);
});
