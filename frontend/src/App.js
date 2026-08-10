import { useState, useEffect } from "react";
import "@/App.css";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LoginPage } from "@/components/auth/LoginPage";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { API, api } from "@/lib/api";

const Spinner = () => (
  <div className="h-screen flex items-center justify-center bg-[#F7F7F8]">
    <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
  </div>
);

function Gate() {
  const { user } = useAuth();
  const [clientInfo, setClientInfo] = useState(null);

  useEffect(() => {
    api.get(`${API}/client/info`)
      .then((r) => { if (r.data.success) setClientInfo(r.data.client); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (clientInfo?.primary_color) {
      document.documentElement.style.setProperty('--primary-color', clientInfo.primary_color);
    }
  }, [clientInfo]);

  if (user === null) return <Spinner />;
  if (user === false) return <LoginPage clientInfo={clientInfo} />;

  return (
    <div className="h-screen flex flex-col bg-[#F7F7F8]" data-testid="app-container">
      <main className="flex-1 overflow-auto">
        <DashboardLayout />
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

export default App;
