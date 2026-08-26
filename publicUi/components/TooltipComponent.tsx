import { FC, ReactNode, useRef , type ReactElement } from "react";

interface Props {
  children: ReactNode;
  tooltip?: string;
}

const ToolTipComponent: FC<Props> = ({ children, tooltip }): ReactElement => {
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const container = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={container}
      onMouseEnter={({ clientX }) => {
        if (!tooltipRef.current || !container.current) return;
        const { left } = container.current.getBoundingClientRect();

        tooltipRef.current.style.left = clientX - left + "px";
      }}
      className="group relative inline-block"
    >
      {children}
      {tooltip ? (
        <span
          ref={tooltipRef}
          className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition bg-gray-700 text-gray-50 p-1 rounded absolute top-full whitespace-nowrap text-sm"
        >
          {tooltip}
        </span>
      ) : null}
    </div>
  );
};

export default ToolTipComponent;