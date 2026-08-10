import { useEffect } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import { LayoutDashboard, Building2, LogOut, ExternalLink, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export const SuperAdminLayout = () => {
  const { user, logout, actAs, endImpersonation } = useAuth();

  useEffect(() => {
    if (actAs) endImpersonation();
  }, []); // retour au super admin = fin d'aperçu

  const linkCls = ({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
      isActive ? "bg-white/10 text-white" : "text-blue-100/70 hover:bg-white/5 hover:text-white"}`;

  return (
    <div className="min-h-screen flex bg-[#F4F6FA]" data-testid="super-admin-layout">
      <aside className="w-60 shrink-0 flex flex-col text-white" style={{ background: "#0E2A52" }}>
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
          <img src="/logo-logitrak.png" alt="LOGITRAK" className="w-9 h-9 rounded-lg" />
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>LOGITRAK</p>
            <p className="text-[10px] text-blue-200/70 flex items-center gap-1"><ShieldCheck size={10} /> SUPER ADMIN</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/super-admin" end className={linkCls} data-testid="sa-nav-dashboard">
            <LayoutDashboard size={16} /> Dashboard
          </NavLink>
          <NavLink to="/super-admin/clients" className={linkCls} data-testid="sa-nav-clients">
            <Building2 size={16} /> Clients
          </NavLink>
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          <Link to="/" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-blue-100/70 hover:bg-white/5 hover:text-white transition-colors" data-testid="sa-open-dashboard">
            <ExternalLink size={15} /> Dashboard client
          </Link>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[11px] text-blue-200/60 truncate max-w-[140px]" title={user?.email}>{user?.email}</span>
            <button onClick={logout} className="p-1.5 rounded-md hover:bg-white/10 text-blue-200/70 hover:text-white transition-colors" data-testid="sa-logout-btn" title="Se déconnecter">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};
