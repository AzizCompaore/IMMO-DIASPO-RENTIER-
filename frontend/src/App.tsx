import { Link, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Questionnaire from "./pages/Questionnaire";
import ThankYou from "./pages/ThankYou";
import Login from "./pages/admin/Login";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import SessionDetail from "./pages/admin/SessionDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/questionnaire" element={<Questionnaire />} />
      <Route path="/merci" element={<ThankYou />} />
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="sessions/:id" element={<SessionDetail />} />
      </Route>
      <Route path="*" element={<div className="notice"><p>Page introuvable.</p><Link to="/">Retour à l'accueil</Link></div>} />
    </Routes>
  );
}
