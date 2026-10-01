import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const source = require.resolve('@myriaddreamin/typst-ts-web-compiler/wasm');
const targetDir = fileURLToPath(new URL('../public/vendor/typst/', import.meta.url));

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, `${targetDir}typst_ts_web_compiler_bg.wasm`);
