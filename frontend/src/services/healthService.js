import api from "./api";

const HEALTH_ENDPOINT = import.meta.env.VITE_HEALTH_ENDPOINT || "/health";

export function checkHealth() {
  return api.get(HEALTH_ENDPOINT);
}