import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserAuthDTO } from '../../types/UserAuthDTO';

interface AuthState {
    status: 'checking' | 'authenticated' | 'unauthenticated';
    token?: string;
    user: UserAuthDTO | undefined;
    isVerified?: boolean;
    errorMessage?: string;
    loaderState?: boolean;
}

const initialState: AuthState = {
    status: 'checking',
    token: undefined,
    user: undefined,
    isVerified: undefined,
    errorMessage: undefined,
    loaderState: false
};

export const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        onChecking: (state) => {
            state.status = 'checking';
            state.token = undefined;
            state.user = undefined;
            state.isVerified = undefined;
            state.errorMessage = undefined;
        },
        onLogin: (state, action: PayloadAction<{ user: UserAuthDTO; token: string; isVerified?: boolean }>) => {
            state.status = 'authenticated';
            state.user = action.payload.user;
            state.token = action.payload.token;
            state.isVerified = action.payload.isVerified;
            state.errorMessage = undefined;
            state.loaderState = false;
        },
        onLogout: (state, action: PayloadAction<string | undefined>) => {
            state.status = 'unauthenticated';
            state.user = undefined;
            state.token = undefined;
            state.isVerified = undefined;
            state.errorMessage = action.payload;
            state.loaderState = false;
        },
        onChangeLoaderStatus: (state, action: PayloadAction<boolean>) => {
            state.loaderState = action.payload;
        },
        clearErrorMessage: (state) => {
            state.errorMessage = undefined;
        }
    }
});

export const { onChecking, onLogin, onLogout, clearErrorMessage, onChangeLoaderStatus } = authSlice.actions;

export default authSlice;
