const fs = require('fs');
const path = require('path');

function resolveFragmentPath() {
  const candidates = [];

  if (process.env.SLAM_FRAGMENT_FILE) candidates.push(process.env.SLAM_FRAGMENT_FILE);
  if (process.env.HOME) candidates.push(path.join(process.env.HOME, 'voice', 'slam_fragment.txt'));
  if (process.env.USERPROFILE) candidates.push(path.join(process.env.USERPROFILE, 'voice', 'slam_fragment.txt'));

  candidates.push(path.join(process.cwd(), 'assets', 'slam_fragment.txt'));
  candidates.push(path.join(process.cwd(), 'content', 'slam_fragment.txt'));

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (e) {}
  }

  return null;
}

module.exports = async (req, res) => {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const filePath = resolveFragmentPath();
  let text = '';

  if (filePath) {
    try {
      text = fs.readFileSync(filePath, 'utf8').trim();
    } catch (e) {}
  }

  if (!text) {
    text = 'ربما أنا الخريف منذ البداية، ذلك الفصل الذي لا يأتي ليُصلح، بل ليُسقِط دون أن يسأل عمّا سيتكسّر.';
  }

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ text });
};
