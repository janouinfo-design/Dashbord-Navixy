import { X, ExternalLink } from "lucide-react";

export const DashboardDetailDrawer = ({ title, subtitle, onClose, linkLabel, linkTestId, onLinkClick, children }) => (
  <>
    <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} data-testid="drawer-backdrop" />
    <div className="fixed inset-y-0 right-0 w-full sm:w-[540px] lg:w-[600px] bg-white shadow-2xl z-50 flex flex-col" data-testid="detail-drawer">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 flex-shrink-0">
        <div>
          <h3 className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" data-testid="drawer-close">
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {children}
      </div>

      {/* Footer link */}
      {linkLabel && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex-shrink-0">
          <button onClick={onLinkClick || onClose} data-testid={linkTestId || 'drawer-link'}
            className="flex items-center gap-2 text-sm font-medium text-[#111] hover:underline">
            <ExternalLink size={14} /> {linkLabel}
          </button>
        </div>
      )}
    </div>
  </>
);
