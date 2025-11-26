
import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { CampaignData, DateRange, MetricKey } from '../types';
import { generateDailyChartData } from '../utils/csvParser';

interface MetricConfig {
  key: MetricKey;
  label: string;
  color: string;
  type: 'bar' | 'line';
  format: (val: number) => string;
}

interface TrendChartProps {
  data: CampaignData[];
  dateRange: DateRange;
  selectedMetrics: MetricKey[];
  metricConfigs: Record<string, MetricConfig>;
}

const TrendChart: React.FC<TrendChartProps> = ({ data, dateRange, selectedMetrics, metricConfigs }) => {
  
  // Generate daily data based on the passed date range
  const chartData = useMemo(() => {
    return generateDailyChartData(data, dateRange.startDate, dateRange.endDate);
  }, [data, dateRange]);

  return (
    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mt-4">
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart 
            data={chartData} 
            margin={{ top: 20, right: 60, bottom: 20, left: 60 }} 
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            
            <XAxis 
              dataKey="date" 
              tickLine={false} 
              axisLine={{ stroke: '#e5e7eb' }} 
              tick={{ fill: '#9ca3af', fontSize: 11 }} 
              dy={10}
              interval={0}
            />
            
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                borderRadius: '6px', 
                border: '1px solid #e5e7eb', 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                fontSize: '12px',
                padding: '10px'
              }}
              formatter={(value: number, name: string) => {
                // Find config for this label name
                const config = (Object.values(metricConfigs) as MetricConfig[]).find(c => c.label === name);
                if (config) {
                  return [config.format(value), name];
                }
                return [value, name];
              }}
            />
            
            <Legend 
              verticalAlign="top" 
              align="left" 
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', color: '#4b5563' }}
            />

            {/* Dynamic Axes */}
            {selectedMetrics.map((key, index) => {
               const config = metricConfigs[key];
               // Alternate orientation: 0->left, 1->right, 2->left, 3->right
               const orientation = index % 2 === 0 ? 'left' : 'right';
               
               return (
                  <YAxis 
                    key={key}
                    yAxisId={key}
                    orientation={orientation}
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: config.color, fontSize: 11 }}
                    tickFormatter={(val) => {
                      if (val >= 1000) return `${(val/1000).toFixed(1)}k`;
                      return val;
                    }}
                    // Allow independent axes to stack properly without overlap issues by relying on Recharts internal stacking
                  />
               );
            })}

            {/* Dynamic Charts */}
            {selectedMetrics.map((key) => {
              const config = metricConfigs[key];
              
              if (config.type === 'bar') {
                return (
                  <Bar 
                    key={key}
                    yAxisId={key} 
                    name={config.label} 
                    dataKey={key} 
                    fill={config.color} 
                    barSize={12} 
                    radius={[2, 2, 0, 0]} 
                    animationDuration={500}
                  />
                );
              } else {
                return (
                  <Line 
                    key={key}
                    yAxisId={key} 
                    name={config.label}
                    type="monotone" 
                    dataKey={key} 
                    stroke={config.color} 
                    strokeWidth={2} 
                    dot={{ r: 3, fill: config.color, strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 5 }}
                    animationDuration={500}
                  />
                );
              }
            })}

          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendChart;
