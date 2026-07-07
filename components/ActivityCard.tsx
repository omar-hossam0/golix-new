import Image from "next/image";

export default function ActivityCard() {
  return (
    <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 border border-cyan-400/20 relative overflow-hidden">
      {/* Background image at bottom, fading upward */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/Background.jpg"
          alt=""
          fill
          className="object-cover object-bottom opacity-20"
          style={{ objectPosition: "bottom" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-slate-800/60 to-slate-800/90" />
      </div>

      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 z-[1]"></div>

      <div className="relative z-10">
        <h3 className="text-lg font-medium text-slate-300 mb-6">Today&apos;s Activity</h3>

        <div className="bg-slate-900/60 rounded-xl p-6 border border-slate-700/30 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 to-transparent rounded-xl"></div>

          <div className="relative flex items-center justify-center">
            <svg
              className="w-32 h-32"
              viewBox="0 0 120 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g className="animate-pulse">
                <circle
                  cx="60"
                  cy="60"
                  r="55"
                  stroke="url(#grad1)"
                  strokeWidth="2"
                  opacity="0.2"
                />

                <circle cx="40" cy="25" r="8" fill="#2d9ad5" />

                <ellipse cx="40" cy="40" rx="8" ry="12" fill="#2d9ad5" />

                <path
                  d="M32 42 L28 65 L35 80"
                  stroke="#2d9ad5"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M48 42 L52 65 L45 80"
                  stroke="#2d9ad5"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                <path
                  d="M40 50 L35 70 L25 90"
                  stroke="#2d9ad5"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M40 50 L45 70 L55 90"
                  stroke="#2d9ad5"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                <circle cx="70" cy="70" r="20" fill="#2d9ad5" opacity="0.3" />
                <circle cx="70" cy="70" r="15" fill="#2d9ad5" opacity="0.5" />
                <circle cx="70" cy="70" r="10" fill="#2d9ad5" />

                <path
                  d="M64 70 L68 74 L76 66"
                  stroke="#0f172a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </g>

              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2d9ad5" stopOpacity="1" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Duration</span>
              <span className="text-white font-semibold">45 min</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Distance</span>
              <span className="text-white font-semibold">5.2 km</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Calories</span>
              <span className="text-white font-semibold">342 kcal</span>
            </div>
          </div>
        </div>

        <button className="w-full mt-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-cyan-500/20">
          Start New Activity
        </button>
      </div>
    </div>
  );
}
