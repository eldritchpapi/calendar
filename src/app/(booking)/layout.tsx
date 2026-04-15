export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-slate-50 to-indigo-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(139,92,246,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_left,_rgba(99,102,241,0.06),transparent_50%)]" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
