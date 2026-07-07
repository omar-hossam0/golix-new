import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface UiState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: "dark" | "light";
  mobileSidebarOpen: boolean;
}

const initialState: UiState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  theme: "dark",
  mobileSidebarOpen: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    toggleSidebarCollapse(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setMobileSidebarOpen(state, action: PayloadAction<boolean>) {
      state.mobileSidebarOpen = action.payload;
    },
    setTheme(state, action: PayloadAction<"dark" | "light">) {
      state.theme = action.payload;
    },
  },
});

export const {
  toggleSidebar,
  toggleSidebarCollapse,
  setMobileSidebarOpen,
  setTheme,
} = uiSlice.actions;
export default uiSlice.reducer;
