import { ReactNode } from "react";
import { DotmSquare11 } from "../ui/dotm-square-11";

export default function GridButton({children} : {children : ReactNode}) {
  return (
    <button className="flex items-center justify-center gap-1 border-border bg-border/10 border p-1 rounded active:translate-y-0.5 transition-all duration-75 active:scale-[0.98]">
      <Box />
      {children}
    </button>
  );
}

const Box = () => {
  return (
    <div className="bg-amber-500 size-7 rounded flex items-center justify-center">
      <DotmSquare11 dotSize={2} cellPadding={1} className="text-white" boxSize={21} minSize={16} />
    </div>
  );
};
