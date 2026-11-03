export async function api<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(
    "/api" + path,
    body === undefined
      ? undefined
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Request failed",
    );
  return data;
}
export function params(
  values: Record<string, string | number | boolean | undefined>,
) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== "" && v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
