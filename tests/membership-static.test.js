const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function includesAll(source, labels) {
  labels.forEach(label => assert(source.includes(label), `Missing expected text: ${label}`));
}

includesAll(html, [
  'function isMember()',
  'function renderMemberLock(',
  'function showMembershipModal(',
  'function redeemMembershipCode(',
  'const SUPER_ADMIN_ACCOUNT',
  "username: 'ccxiao12138'",
  "role: 'super_admin'",
  '不受会员期限限制',
  "trial: { label: '体验会员', price: '¥1', days: 1 }",
  '微信扫码支付 ¥1',
  '支付宝扫码支付 ¥1',
  '当前二维码已限制为 1 元体验价',
  'VIP-DEMO-30',
  "./assets/pay-' + payType + '.jpg",
]);

assert(
  /if \(isPremium && !isMember\(\)\)/.test(html),
  'Premium predictions must be locked for free users'
);
assert(
  /renderDetailProbability\(m\) \{\s*if \(!isMember\(\)\)/.test(html),
  'Probability detail tab must be member-gated'
);
assert(
  /renderDetailStats\(m\) \{\s*if \(!isMember\(\)\)/.test(html),
  'Stats detail tab must be member-gated'
);
assert(
  /showMembershipModal\(\);\s*return;/.test(html),
  'Betslip persistence should route free users to membership'
);

['pay-wechat.jpg', 'pay-alipay.jpg'].forEach(file => {
  const fullPath = path.join(root, 'assets', file);
  assert(fs.existsSync(fullPath), `${file} must exist`);
  assert(fs.statSync(fullPath).size > 10000, `${file} must not be empty`);
});

console.log('membership static checks passed');
