import { ReactNode } from "react";

function ShinyButton({ children }: { children: ReactNode }) {
  return (
    <button className=" bg-linear-0 from-indigo-500 to-indigo-800  px-1 py-1 text-white rounded-2xl overflow-hidden active:translate-y-0.5 active:scale-[0.99] transition-all duration-75">
      <div className="px-3 py-1 bg-linear-0 from-indigo-600 to-indigo-700 rounded-xl active:shadow-[inset_0px_0px_3px_0px_#4338ca] ">
        {children}
      </div>
    </button>
  );
}

export default ShinyButton;


