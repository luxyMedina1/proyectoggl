"use client";

import RingLoader from "react-spinners/RingLoader";
import './LoaderStyles.scss';
import { useAppStore } from "../hooks/useAppStore";

export const Loader = ( ) => {

    const { loaderStatus } = useAppStore();

    const override = {
        display: "relative",
        marginLeft: "0vh",
        marginTop: "0vh",
        borderColor: "red",
        zIndex: "1000px"
    };

    const divClassName = loaderStatus ? 'sweet-loading' : '';

    return (
        <div className={divClassName}>
            <RingLoader
                color={"#fdff00"}
                loading={ loaderStatus }
                cssOverride={override}
                size={50}
                className="loader"
                aria-label="Loading Spinner"
                data-testid="loader"
            />
        </div>
    )
}
