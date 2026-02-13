(() => {
  const { protocol, hostname, port, origin } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    window.API_BASE = `http://${hostname}:9876`;  // dev
  } else {
    window.API_BASE = `${origin}`;  // production, HTTPS via Traefik
  }
})();


window.apiRequest = async (endpoint, options = {}) => {
  const url = `${window.API_BASE}${endpoint}`;
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");

  const headers = { ...(options.headers || {}) };

  // Jangan paksa Content-Type kalau FormData
  const isFormData = options.body instanceof FormData;

  // Auto JSON stringify kalau body object biasa
  let body = options.body;
  if (body && !isFormData && typeof body === "object" && !(body instanceof Blob)) {
    body = JSON.stringify(body);
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  } else if (!isFormData && body && typeof body === "string") {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, body, headers });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "login.html";
    return;
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && data.message) ? data.message :
      (typeof data === "string" && data) ? data :
      `Request gagal (${res.status})`;
    throw new Error(msg);
  }

  return data;
};
