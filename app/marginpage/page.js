"use client";
import React, { useState } from 'react';

// Helper function to calculate profit and margin
const calculateProfitAndMargin = (ptr, mrp) => {
  // Ensure inputs are valid numbers
  const purchasePrice = parseFloat(ptr);
  const retailPrice = parseFloat(mrp);

  if (isNaN(purchasePrice) || isNaN(retailPrice) || retailPrice <= 0) {
    return { profit: null, margin: null };
  }

  const profit = retailPrice - purchasePrice;
  const margin = (profit / retailPrice) * 100;

  return { profit, margin };
};

// Define a list of available products with their PTR and MRP
const availableProducts = [
  { id: 1, name: 'Product A', ptr: 100, mrp: 150 },
  { id: 2, name: 'Product B', ptr: 250, mrp: 350 },
  { id: 3, name: 'Product C', ptr: 50, mrp: 80 },
  { id: 4, name: 'Product D', ptr: 400, mrp: 600 },
];

const ProfitMarginCalculatorPage = () => {
  // State for the single product calculator
  const [singlePtr, setSinglePtr] = useState('');
  const [singleMrp, setSingleMrp] = useState('');
  const [singleResult, setSingleResult] = useState({ profit: null, margin: null });

  // Handle calculation for the single product
  const handleSingleCalculate = () => {
    const result = calculateProfitAndMargin(singlePtr, singleMrp);
    setSingleResult(result);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gray-100 min-h-screen rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Profit and Margin Calculator</h1>

      {/* Single Product Calculator Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Calculate for a Single Product</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label htmlFor="ptr" className="block text-sm font-medium text-gray-700 mb-1">Purchase Tax Rate (PTR)</label>
            <input
              type="number"
              id="ptr"
              value={singlePtr}
              onChange={(e) => setSinglePtr(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter PTR"
            />
          </div>
          <div>
            <label htmlFor="mrp" className="block text-sm font-medium text-gray-700 mb-1">Maximum Retail Price (MRP)</label>
            <input
              type="number"
              id="mrp"
              value={singleMrp}
              onChange={(e) => setSingleMrp(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter MRP"
            />
          </div>
        </div>
        <button
          onClick={handleSingleCalculate}
          className="w-full md:w-auto px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
        >
          Calculate
        </button>

        {singleResult.profit !== null && (
          <div className="mt-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
            <p className="font-semibold">Calculated Results:</p>
            <p>Profit: <span className="font-bold">{singleResult.profit.toFixed(2)}</span></p>
            <p>Margin: <span className="font-bold">{singleResult.margin.toFixed(2)}%</span></p>
          </div>
        )}
      </div>

      {/* Available Products Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Available Products Profit/Margin</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PTR
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MRP
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profit
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Margin (%)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {availableProducts.map((product) => {
                const { profit, margin } = calculateProfitAndMargin(product.ptr, product.mrp);
                return (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.ptr.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.mrp.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {profit !== null ? profit.toFixed(2) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {margin !== null ? margin.toFixed(2) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProfitMarginCalculatorPage;
