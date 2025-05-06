"use client";

const TotalSummary = ({ totalQuantity, totalValue }) => {
  return (
    <div className="bg-white p-4 rounded shadow mb-4">
      <p>Total Quantity: {totalQuantity}</p>
      <p>Total Value: ₹{totalValue.toFixed(2)}</p>
    </div>
  );
};

export default TotalSummary;
