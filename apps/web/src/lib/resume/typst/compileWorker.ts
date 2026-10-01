import { createTypstCompiler, CompileFormatEnum, type TypstCompiler } from "@myriaddreamin/typst.ts/compiler";
// Deep import on purpose: the package's main entry also loads its renderer, which we don't ship.
import { loadFonts } from "@myriaddreamin/typst.ts/dist/esm/options.init.mjs";
import type { RenderData } from "@dossier/core/resume";
import { RESUME_TEMPLATE } from "./template";

export interface CompileRequest {
  id: number;
  data: RenderData;
}

export type CompileResponse = { id: number; ok: true; pdf: Uint8Array } | { id: number; ok: false; error: string };

const WASM_URL = "/vendor/typst/typst_ts_web_compiler_bg.wasm";
const FONTS = ["/fonts/carlito/Carlito-Regular.ttf", "/fonts/carlito/Carlito-Bold.ttf"];

let compilerPromise: Promise<TypstCompiler> | null = null;

function getCompiler(): Promise<TypstCompiler> {
  compilerPromise ??= (async () => {
    const compiler = createTypstCompiler();
    await compiler.init({
      getModule: () => WASM_URL,
      beforeBuild: [loadFonts(FONTS, { assets: false })],
    });
    compiler.addSource("/main.typ", RESUME_TEMPLATE);
    return compiler;
  })().catch((err) => {
    compilerPromise = null;
    throw err;
  });
  return compilerPromise;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Typed by hand: pulling in the "webworker" lib clashes with the app's DOM lib.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<CompileRequest>) => void) | null;
  postMessage(message: CompileResponse, transfer?: Transferable[]): void;
};

scope.onmessage = async (event: MessageEvent<CompileRequest>) => {
  const { id, data } = event.data;
  try {
    const compiler = await getCompiler();
    const { photo, ...rest } = data;
    if (photo) compiler.mapShadow("/photo.jpg", dataUrlToBytes(photo.dataUrl));
    compiler.mapShadow(
      "/data.json",
      new TextEncoder().encode(JSON.stringify({ ...rest, hasPhoto: Boolean(photo) })),
    );

    const { result, diagnostics } = await compiler.compile({
      mainFilePath: "/main.typ",
      format: CompileFormatEnum.pdf,
      diagnostics: "unix",
    });
    if (!result) throw new Error(diagnostics?.join("\n") || "The resume could not be rendered.");

    const response: CompileResponse = { id, ok: true, pdf: result };
    scope.postMessage(response, [result.buffer as ArrayBuffer]);
  } catch (err) {
    const response: CompileResponse = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
    scope.postMessage(response);
  }
};
