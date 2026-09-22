import { CabeceraPublica, PiePublico } from "@/components/CabeceraPublica";

export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <CabeceraPublica />
      <main className="flex-1">{children}</main>
      <PiePublico />
    </div>
  );
}
