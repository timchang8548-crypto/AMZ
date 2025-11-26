import React from 'react';
import { OptimizationResultRow } from '../types';
import { ArrowLeft, Download } from 'lucide-react';

interface Props {
  data: OptimizationResultRow[];
  onBack: () => void;
}

const OptimizationResultTable: React.FC<Props> = ({ data, onBack }) => {
  
  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
  const formatPercent = (val: number) => `${val.toFixed(2)}%`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-800">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-gray-800">優化建議預覽</h1>
          <span className="px-3 py-1 bg-teal-100 text-teal-800 text-xs rounded-full font-medium">
            共 {data.length} 筆建議
          </span>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-800 text-white rounded hover:bg-teal-900 text-sm font-medium shadow-sm">
          <Download size={16} /> 匯出建議
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                <tr>
                  <th className="px-4 py-3 border-b whitespace-nowrap">廣告類型</th>
                  <th className="px-4 py-3 border-b whitespace-nowrap">廣告活動</th>
                  <th className="px-4 py-3 border-b whitespace-nowrap">廣告組</th>
                  <th className="px-4 py-3 border-b whitespace-nowrap">競價實體</th>
                  <th className="px-4 py-3 border-b whitespace-nowrap">定項</th>
                  <th className="px-4 py-3 border-b whitespace-nowrap">匹配類型</th>
                  <th className="px-4 py-3 border-b text-right whitespace-nowrap">現值</th>
                  <th className="px-4 py-3 border-b text-right whitespace-nowrap">建議值</th>
                  <th className="px-4 py-3 border-b text-right whitespace-nowrap">差異</th>
                  <th className="px-4 py-3 border-b text-right whitespace-nowrap">ACOS</th>
                  <th className="px-4 py-3 border-b text-right whitespace-nowrap">目標 ACOS</th>
                  <th className="px-4 py-3 border-b text-right whitespace-nowrap">花費</th>
                  <th className="px-4 py-3 border-b text-right whitespace-nowrap">銷售額</th>
                  <th className="px-4 py-3 border-b text-right whitespace-nowrap">曝光數</th>
                  <th className="px-4 py-3 border-b text-right whitespace-nowrap">點擊數</th>
                  <th className="px-4 py-3 border-b text-right whitespace-nowrap">訂單數</th>
                  <th className="px-4 py-3 border-b whitespace-nowrap">變更原因</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-100">
                {data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 whitespace-nowrap">{row.adType}</td>
                    <td className="px-4 py-2 whitespace-nowrap max-w-[150px] truncate" title={row.campaignName}>{row.campaignName}</td>
                    <td className="px-4 py-2 whitespace-nowrap max-w-[100px] truncate">{row.adGroupName}</td>
                    <td className="px-4 py-2 whitespace-nowrap max-w-[100px] truncate">{row.entity}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-800">{row.targeting}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500">{row.matchType}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(row.currentBid)}</td>
                    <td className="px-4 py-2 text-right font-bold text-blue-600">{formatCurrency(row.suggestedBid)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${row.diffPercent > 0 ? 'text-green-600' : row.diffPercent < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {row.diffPercent > 0 ? '+' : ''}{row.diffPercent.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-right">{formatPercent(row.acos)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{row.targetAcos}%</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.spend)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.sales)}</td>
                    <td className="px-4 py-2 text-right">{row.impressions.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{row.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{row.orders}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500 italic">{row.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizationResultTable;