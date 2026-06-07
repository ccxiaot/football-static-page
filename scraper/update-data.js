/**
 * 主更新脚本 - 从原站拉取实时数据
 *
 * 用法:
 *   node update-data.js          拉取最新数据
 *
 * 定时任务 (建议每 5 分钟):
 *   node update-data.js
 *
 * 数据源: chen-1119.github.io (原站 GitHub Actions 每小时更新)
 */

const { execSync } = require('child_process');
const path = require('path');

const SCRAPER_DIR = __dirname;

function run(script) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`运行: ${script}`);
  console.log('='.repeat(50) + '\n');
  execSync(`node ${path.join(SCRAPER_DIR, script)}`, { stdio: 'inherit' });
}

// 拉取数据
run('fetch-matches.js');

console.log('\n✅ 数据更新完成');
