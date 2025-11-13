const esbuild = require('esbuild');
const path     = require('path');
const fs       = require('fs');
const fsp      = fs.promises;

const outDir = path.resolve(__dirname, 'dist');
const wasmPaths = new Set();

const detectWasmImportsPlugin = {
  name: 'detect-wasm-imports',
  setup(build) {
    build.onResolve({ filter: /\.wasm$/ }, args => {
      // Directly compute full path (relative to resolveDir)
      const fullPath = path.resolve(args.resolveDir, args.path);
      wasmPaths.add(fullPath);
      console.log(wasmPaths)
      // Return nothing so esbuild does the default resolution
      return;
    });
  }
};

async function copyWasmFiles() {
  for (const fullPath of wasmPaths) {
    try {
      const rel = path.relative(path.resolve(__dirname, 'node_modules'), fullPath);
      const dest = path.join(outDir, rel);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.copyFile(fullPath, dest);
      console.log(`Copied WASM (imported): ${rel}`);
    } catch (err) {
      console.warn(`Failed copying WASM ${fullPath}:`, err);
    }
  }
}

async function build() {
  await esbuild.build({
    entryPoints: [
      'src/background/index.js',
      'src/content.js',
      'src/popup.js'
    ],
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    sourcemap: true,
    outdir: outDir,
    target: ['chrome109'],
    logLevel: 'info',
    external: ['chrome', "silentImport"],
    loader: {
      '.wasm': 'file'
    },
    plugins: [
      detectWasmImportsPlugin
    ]
  });

  await copyWasmFiles();
  console.log('Build completed with selective WASM copy!');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
