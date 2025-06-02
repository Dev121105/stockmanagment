// app/components/TotalSummary.js
import React from 'react';

// Updated to accept 'title', 'value', 'description', and 'bgColor' props
const TotalSummary = ({ title, value, description, bgColor }) => {
  return (
    // Using the bgColor prop for dynamic background color, and removed explicit bg-white
    <div className={`p-6 rounded-lg shadow-md border border-gray-200 ${bgColor}`}>
      <div className="text-lg font-semibold text-white mb-1">
        {title}
      </div>
      {/* Displaying the 'value' prop directly, as it's already formatted */}
      <div className="text-2xl font-bold text-white mb-2">
        {value}
      </div>
      <div className="text-sm text-gray-100">
        {description}
      </div>
    </div>
  );
};

export default TotalSummary;