import React, { ReactNode } from "react";

function CandyButtons({ children }: { children: ReactNode }) {
  return <button>{children}</button>;
}

export default CandyButtons;
