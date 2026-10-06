import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AccessDeniedProps {
  requiredRoles?: string[];
  message?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  requiredRoles,
  message = 'You do not have the required administrative permissions to access this module.',
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8 text-rose-500" />
        </div>

        <h2 className="text-2xl font-bold text-slate-100 mb-2">403 - Access Denied</h2>
        <p className="text-sm text-slate-400 mb-6">{message}</p>

        {requiredRoles && requiredRoles.length > 0 && (
          <div className="mb-6 p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg text-left">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Required Role(s):
            </span>
            <div className="flex flex-wrap gap-2">
              {requiredRoles.map((role) => (
                <span
                  key={role}
                  className="px-2 py-0.5 text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/admin')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Admin Dashboard
        </button>
      </div>
    </div>
  );
};
