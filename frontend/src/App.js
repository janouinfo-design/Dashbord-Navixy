import { useState, useEffect } from "react";
import "@/App.css";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { API, api } from "@/lib/api";

function App() {
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

  useEffect(() => {
    if (clientInfo?.primary_color) {
      document.documentElement.style.setProperty('--primary-color', clientInfo.primary_color);
    }
  }, [clientInfo]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F7F7F8]">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F7F7F8]" data-testid="app-container">
      <main className="flex-1 overflow-auto">
        <DashboardLayout />
      </main>
    </div>
  );
}

export default App;
