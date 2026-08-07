import { useState } from "react";
import {
  LayoutDashboard, ChevronLeft, X
} from "lucide-react";

const modules = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export const Sidebar = ({ activeModule, setActiveModule, isOpen, setIsOpen, clientInfo }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setIsOpen(false)} />}

      <aside data-testid="sidebar" className={`
        fixed lg:static inset-y-0 left-0 z-50
        ${collapsed ? 'w-[72px]' : 'w-60'} bg-white border-r border-gray-200
        transform transition-all duration-200 flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100 flex-shrink-0">
          {!collapsed && (
            <h1 className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <span className="text-[#111]">{clientInfo?.name || 'LOGITAG'}</span>
            </h1>
          )}
          <button className="hidden lg:flex p-1.5 hover:bg-gray-100 rounded-lg" onClick={() => setCollapsed(!collapsed)} data-testid="sidebar-collapse">
            <ChevronLeft size={16} className={`text-gray-400 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          <button className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg" onClick={() => setIsOpen(false)}>
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {!collapsed && <div className="px-3 py-2 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Modules</div>}
          {modules.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button key={item.id} data-testid={`module-${item.id}`}
                onClick={() => { setActiveModule(item.id); setIsOpen(false); }}
                className={`
                  w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3
                  ${collapsed ? 'px-0 py-3' : 'px-3 py-2.5'} rounded-xl
                  transition-all duration-150 text-left group
                  ${isActive ? 'bg-[#111] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}
                `}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={17} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'} />
                {!collapsed && <span className="text-[13px] font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="p-4 border-t border-gray-100 flex-shrink-0">
            <div className="text-[9px] text-gray-400 uppercase tracking-widest">Plateforme</div>
            <div className="text-xs font-medium text-gray-600 mt-0.5">LOGITRAK IoT</div>
          </div>
        )}
      </aside>
    </>
  );
};
