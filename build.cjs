const path = require('path')
const fs = require('fs')
const os = require('os')

const ROOT = __dirname
const SRC = path.join(ROOT, 'src')
const DIST = path.join(ROOT, 'dist')

// Find esbuild — try local first, then workspace
let esbuildPath = path.join(ROOT, 'node_modules', 'esbuild')
if (!fs.existsSync(path.join(esbuildPath, 'package.json'))) {
  esbuildPath = path.join(ROOT, '..', 'anakot-agent', 'node_modules', 'vite', 'node_modules', 'esbuild')
}
if (!fs.existsSync(path.join(esbuildPath, 'package.json'))) {
  console.error('[Build] esbuild not found!')
  process.exit(1)
}
console.log(`[Build] Using esbuild from: ${esbuildPath}`)

// We need to require esbuild from the found path
// Use createRequire to load from a specific path
const { createRequire } = require('module')
const esbuild = createRequire(path.join(esbuildPath, 'package.json'))('esbuild')

// Clean dist
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true })
fs.mkdirSync(DIST, { recursive: true })

console.log('[Build] Compiling Tailwind CSS...')
const { execSync } = require('child_process')
const cssPath = path.join(SRC, 'index.css')
const cssSourcePath = path.join(SRC, 'index.css.source')

// Backup index.css to index.css.source if not already done
if (fs.existsSync(cssPath)) {
  fs.copyFileSync(cssPath, cssSourcePath)
}

try {
  execSync(`npx @tailwindcss/cli -i "${cssSourcePath}" -o "${cssPath}"`, { stdio: 'inherit' })
} catch (e) {
  console.error('[Build] Tailwind compilation failed!', e)
  // Restore if failed
  if (fs.existsSync(cssSourcePath)) {
    fs.copyFileSync(cssSourcePath, cssPath)
  }
  process.exit(1)
}

console.log('[Build] Building...')

// Find all TSX/TS entry points
const entryPoints = []
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f)
    if (fs.statSync(full).isDirectory()) walk(full)
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) entryPoints.push(full)
  }
}
walk(SRC)

console.log(`[Build] Found ${entryPoints.length} entry points`)

esbuild.buildSync({
  entryPoints: [entryPoints.find(e => e.endsWith('main.tsx')) || entryPoints[0]],
  bundle: true,
  outfile: path.join(DIST, 'bundle.js'),
  format: 'iife',
  globalName: 'jarvis',
  minify: true,
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: {
    '.css': 'css',
    '.svg': 'file',
    '.png': 'file',
    '.wav': 'file',
    '.mp3': 'file'
  }
})

// Copy index.html and inject CSS + JS references
let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf-8')
html = html.replace('</head>', '<link rel="stylesheet" href="bundle.css" /></head>')
html = html.replace('/main.tsx', 'bundle.js')
fs.writeFileSync(path.join(DIST, 'index.html'), html)

// Copy assets
const assetsSrc = path.join(ROOT, 'assets')
if (fs.existsSync(assetsSrc)) {
  fs.cpSync(assetsSrc, path.join(DIST, 'assets'), { recursive: true })
}

// Restore original index.css so dev server is unmodified
if (fs.existsSync(cssSourcePath)) {
  fs.copyFileSync(cssSourcePath, cssPath)
  fs.unlinkSync(cssSourcePath)
}

console.log(`[Build] Done! Files: ${fs.readdirSync(DIST).join(', ')}`)
