import { useEffect } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export function getAuthToken() {
  return localStorage.getItem("attendance_token");
}

export function setAuthToken(token: string) {
  localStorage.setItem("attendance_token", token);
}

export function clearAuthToken() {
  localStorage.removeItem("attendance_token");
}

export function useAuthInit() {
  useEffect(() => {
    setAuthTokenGetter(getAuthToken);
  }, []);
}
