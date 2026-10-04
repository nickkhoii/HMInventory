import { AppError } from "./errors";
export async function jsonObject(
  req: Request,
): Promise<Record<string, unknown>> {
  if (
    req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new AppError("Send an application/json request", 415);
  const reader = req.body?.getReader();
  if (!reader) throw new AppError("A JSON object is required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) {
      await reader.cancel();
      throw new AppError("Request body exceeds 64 KB", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let result: unknown;
  try {
    result = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    throw new AppError("Malformed JSON request");
  }
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new AppError("A JSON object is required");
  return result as Record<string, unknown>;
}
