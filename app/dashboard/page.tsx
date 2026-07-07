import MetricsCard from '@/components/MetricsCard';
import ActivityCard from '@/components/ActivityCard';
import Sidebar from '@/components/Sidebar';

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Sidebar />

      <main className="flex-1 p-8 ml-64">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-white">Dashboard</h1>
            <button className="px-6 py-2 border border-cyan-400/30 rounded-lg text-cyan-300 hover:bg-cyan-400/10 transition-all">
              Add Goal
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <MetricsCard
              title="Heart Rate"
              type="heartbeat"
            />

            <MetricsCard
              title="Steps Today"
              type="steps"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ActivityCard />

            <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 border border-cyan-400/20">
              <h3 className="text-xl font-semibold text-white mb-4">Recent Goals</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-white font-medium">Run 5K</h4>
                      <span className="text-xs text-cyan-400">Active</span>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-2 mb-2">
                      <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full" style={{width: '60%'}}></div>
                    </div>
                    <p className="text-sm text-slate-400">3.0 / 5.0 km</p>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
