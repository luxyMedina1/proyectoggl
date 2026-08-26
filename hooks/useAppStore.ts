import { useAppDispatch, useAppSelector } from "./useDispatchStore";
import { onChangeLoaderStatus, onChangeAppName } from "../store/app/appSlice";

export const useAppStore = () => {

    const dispatch = useAppDispatch();
    const { loaderStatus, appName } = useAppSelector((state) => state.app);

    const setLoaderStatus = (status: boolean) => {
        dispatch(onChangeLoaderStatus(status));
    };

    const setAppName = (name: string) => {
        dispatch(onChangeAppName(name));
    }

    return {
        loaderStatus,
        appName,
        setLoaderStatus,
        setAppName,
    };
};
