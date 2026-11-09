// Worker thread for run.mjs: evaluations arrive as messages and are computed by evaluate.mjs.
import { parentPort } from "node:worker_threads";
import { evaluate } from "./evaluate.mjs";
export { evaluate };
parentPort?.on("message", ({ id, task }) => { const out = evaluate(task); parentPort.postMessage({ id, out }, [out.r.buffer]); });
