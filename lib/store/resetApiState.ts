import { adminApi } from "./api/adminApi";
import { calendarApi } from "./api/calendarApi";
import { coachApi } from "./api/coachApi";
import { dashboardApi } from "./api/dashboardApi";
import type { AppDispatch } from "./store";

export function resetApiState(dispatch: AppDispatch) {
  dispatch(adminApi.util.resetApiState());
  dispatch(calendarApi.util.resetApiState());
  dispatch(coachApi.util.resetApiState());
  dispatch(dashboardApi.util.resetApiState());
}
