import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AppState {
    loaderStatus: boolean;
    appName: string;
}

const initialState: AppState = {
    loaderStatus: false,
    appName: 'Dashboard',
};

export const appSlice = createSlice({
    name: 'app',
    initialState,
    reducers: {
        onChangeLoaderStatus: (state, action: PayloadAction<boolean>) => {
            state.loaderStatus = action.payload;
        },
        onChangeAppName: (state, action: PayloadAction<string>) => {
            state.appName = action.payload;
        }
    },
});

export const { onChangeLoaderStatus, onChangeAppName } = appSlice.actions;
export default appSlice;
