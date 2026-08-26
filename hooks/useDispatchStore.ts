import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';

// Usar dispatch tipado
export const useAppDispatch = () => useDispatch<AppDispatch>();

// Usar selector tipado
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
