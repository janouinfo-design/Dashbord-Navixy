import { useState, useEffect } from "react";
import "@/App.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { API, api } from "@/lib/api";

const useClientInfo = () => {
  const [clientInfo, setClientInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClientInfo = async () => {
      try {
        const response = await api.get(`${API}/client/info`);
        if (response.data.success) setClientInfo(response.data.client);
      } catch (error) { console.error("Error fetching client info:", error); }
      setLoading(false);
    };
    fetchClientInfo();
  }, []);

  return { clientInfo, loading };
};

function App() {
  const [activeModule, setActiveModule] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { clientInfo, loading: clientLoading } = useClientInfo();

  useEffect(() => {
    if (clientInfo?.primary_color) {
      document.documentElement.style.setProperty('--primary-color', clientInfo.primary_color);
    }
  }, [clientInfo]);

  if (clientLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F7F7F8]">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#F7F7F8]" data-testid="app-container">
      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        clientInfo={clientInfo}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-auto">
          {activeModule === "dashboard" && (
            <DashboardLayout onMenuClick={() => setSidebarOpen(true)} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
