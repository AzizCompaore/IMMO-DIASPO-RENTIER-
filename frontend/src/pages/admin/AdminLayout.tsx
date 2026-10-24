import { createContext, useContext, useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import * as api from "../../services/adminApi";
import "../../styles/admin.css";

export const MeContext = createContext<api.Me | null>(null);
export const useMe = () => useContext(MeContext)!;

export default function AdminLayout() {
  const [me, setMe] = useState<api.Me | null>(null);
  const nav = useNavigate();
  useEffect(() => { api.me().then(setMe).catch(() => nav("/admin/login", { replace: true })); }, [nav]);
  if (!me) return <div className="adm"><p className="adm-loading">Chargement…</p></div>;
  return (
    <MeContext.Provider value={me}>
      <div className="adm">
        <header className="adm-top">
          <Link to="/admin" className="adm-brand">IMMO DIASPO RENTIER <span>· Administration</span></Link>
          <div className="adm-user">{me.username} <em>({me.role})</em>
            <button className="adm-btn ghost" onClick={async () => { await api.logout().catch(() => undefined); nav("/admin/login"); }}>Déconnexion</button></div>
        </header>
        <main className="adm-main"><Outlet /></main>
      </div>
    </MeContext.Provider>
  );
}
