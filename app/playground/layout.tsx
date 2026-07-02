import { AppDialRoot } from "@/components/dial-root";
import "dialkit/styles.css";

export default function PlaygroundLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <AppDialRoot />
    </>
  );
}