export type PendingRequest = { payload: string; id: string } | null;

// Reuse the key after a lost response, but give edited submissions their own key.
export function requestKey(previous: PendingRequest, value: unknown) {
  const payload = JSON.stringify(value);
  return previous?.payload === payload
    ? previous
    : { payload, id: crypto.randomUUID() };
}
