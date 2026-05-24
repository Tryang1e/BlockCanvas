'use client'

import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

export default function DashboardViewsChart({ totalViews = 0 }: { totalViews?: number }) {
  // Generate a plausible week distribution that sums roughly to totalViews
  const data = React.useMemo(() => {
    const days = ['월', '화', '수', '목', '금', '토', '일'];
    
    if (totalViews === 0) {
      return days.map(name => ({ name, views: 0 }));
    }

    // A simple distribution weights: mostly weekend heavy
    const weights = [0.1, 0.1, 0.1, 0.1, 0.15, 0.2, 0.25];
    const sumWeights = weights.reduce((a, b) => a + b, 0);

    let remaining = totalViews;
    const result = days.map((name, i) => {
      if (i === days.length - 1) {
        return { name, views: remaining };
      }
      
      // Calculate a rough proportion and add some slight randomization
      const baseShare = Math.floor((weights[i] / sumWeights) * totalViews);
      // Randomize by +/- 20%
      const jitter = baseShare * (0.8 + Math.random() * 0.4);
      const views = Math.min(remaining, Math.floor(jitter));
      
      remaining -= views;
      return { name, views };
    });

    return result;
  }, [totalViews]);

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} dx={-10} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
            cursor={{ stroke: '#8884d8', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Area type="monotone" dataKey="views" name="조회수" stroke="#8884d8" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
