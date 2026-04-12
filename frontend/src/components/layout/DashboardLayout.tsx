import { ReactNode, useState, useEffect } from 'react';

interface Props {
  children: ReactNode;
}

export function DashboardLayout({ children }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-100">Econoguard</h1>
            <p className="text-xs text-gray-500">グローバル経済リスクモニター</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-300">
              {now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="text-xs text-gray-500">
              {now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 更新
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {children}
      </main>
    </div>
  );
}
