async function request(path, options = {}) {
  const response = await fetch(path.startsWith("/api") ? path : `/api${path}`, {
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    ...options,
  });
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    if (!response.ok) throw new Error(`Request failed (${response.status}).`);
    return response.text();
  }
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.status = response.status;
    error.details = data.details;
    throw error;
  }
  return data;
}

export const api = {
  get: (path, options = {}) => request(path, { ...options, method: "GET" }),
  post: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  upload: (path, formData, options = {}) =>
    request(path, { ...options, method: "POST", body: formData }),
  patch: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
    }),
  delete: (path, options = {}) =>
    request(path, { ...options, method: "DELETE" }),
  download: async (path, fileName = "export.csv") => {
    const response = await fetch(
      path.startsWith("/api") ? path : `/api${path}`,
      { credentials: "include" },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Could not export this report.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  },
};

export async function trackActivity(event) {
  try {
    return await api.post("/student/activity", event);
  } catch {
    return null;
  }
}
