const { execFileSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.SMOKE_URL || 'http://localhost:4173';
const profile = path.join(os.tmpdir(), 'msedge-check');
fs.rmSync(profile, { recursive: true, force: true });

const out = execFileSync(
  EDGE,
  ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${profile}`, '--virtual-time-budget=12000', '--dump-dom', BASE + '/?seed=1'],
  { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
);
const text = out.toString('utf8');
const marks = [
  ['shell navy #212346 (AppBar/Drawer)', 'rgb(33, 35, 70)'],
  ['dark shell #0f1029', 'rgb(15, 16, 41)'],
  ['Inter Variable font', 'Inter Variable'],
  ['brand gradient на рубашке', '#212346'],
  ['data-mode=dark', 'data-mode="dark"'],
  ['tokens css var', '--shell'],
];
for (const [name, m] of marks) console.log((text.includes(m) ? 'OK   ' : 'MISS ') + name);
console.log('DOM:', text.length, 'chars');
