import { FC , type ReactElement } from "react";

const Loader: FC = (): ReactElement => {

  return (
    <div className="backdrop">
        <div className="sk-chase sk-chase--big">
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
        </div>
    </div>
  );
};

export default Loader;