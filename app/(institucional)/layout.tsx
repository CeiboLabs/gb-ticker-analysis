import { Navbar } from "@/components/institucional/Navbar";
import { FooterInstitucional } from "@/components/institucional/FooterInstitucional";

export default function InstitucionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      {children}
      <FooterInstitucional />
    </>
  );
}
