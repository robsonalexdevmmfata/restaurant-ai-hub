import { API_URL } from "./api";

const API_BASE = API_URL;

export function hasPublicApi() {
  return Boolean(API_BASE);
}

export function publicApiUrl(path: string) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
