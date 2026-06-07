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
