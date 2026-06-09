import { Navbar } from "@/components/institucional/Navbar";
import { FooterInstitucional } from "@/components/institucional/FooterInstitucional";
import { LenisProvider } from "@/components/LenisProvider";
import { PageTransitions } from "@/components/institucional/PageTransitions";

export default function InstitucionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LenisProvider>
      <PageTransitions />
      <Navbar />
      {children}
      <FooterInstitucional />
    </LenisProvider>
  );
}
