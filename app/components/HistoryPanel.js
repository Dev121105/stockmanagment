import React from 'react';

const HistoryPanel = ({
    history,
    historySearch,
    setHistorySearch,
    sortBy,
    setSortBy,
    exportCSV,
    undoLastChange
}) => {
    // Sort history based on the selected criteria (date or product name)
    const sortedHistory = [...history].sort((a, b) => {
        if (sortBy === 'date') {
            return new Date(b.date) - new Date(a.date); // Sort by date
        }
        return (a.action ? a.action.toLowerCase() : "").localeCompare(b.action ? b.action.toLowerCase() : ""); // Sort by action (name)
    });

    // Filter history based on the search input
    const filteredHistory = sortedHistory.filter((entry) => {
        const action = entry.action ? entry.action.toLowerCase() : "";
        const search = (historySearch || "").toLowerCase(); // Ensure historySearch is a string

        return action.includes(search);
    });

    const handleUndoClick = () => {
        undoLastChange();
        window.dispatchEvent(new Event('storage'));
    };

    return (
        <div className="container mx-auto p-6 bg-blue-100 rounded-lg">
            <h2 className="text-2xl font-bold mb-4">History</h2>

            {/* Search bar */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search history"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="p-2 border rounded w-full"
                />
            </div>

            {/* Sort by dropdown */}
            <div className="mb-4">
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="p-2 border rounded"
                >
                    <option value="date">Sort by Date</option>
                    <option value="name">Sort by Product Name</option>
                </select>
            </div>

            {/* History Table */}
            <div className="overflow-x-auto">
                <table className="table-auto w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="px-4 py-2 border">Action</th>
                            <th className="px-4 py-2 border">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredHistory.map((entry) => {
                            let displayAction = entry.action ? entry.action : "No Action";
                            if (entry.action && entry.action.startsWith("Deleted product with ID:")) {
                                const parts = entry.action.split(':');
                                if (parts.length > 1) {
                                    const details = parts[1].trim();
                                    const productInfo = details.split('-');
                                    if (productInfo.length >= 4) {
                                        displayAction = `Deleted product: ${productInfo[0]}, Batch: ${productInfo[1]}, Expiry: ${productInfo[2]}, MRP: ${productInfo[3]}`;
                                    }
                                }
                            } else if (entry.action && entry.action.startsWith("Added product")) {
                                // You might want to format the "Added product" action differently as well
                            } else if (entry.action && entry.action.startsWith("Undid")) {
                                // Format undo actions if needed
                            } else if (entry.action && (entry.action.startsWith("Added") || entry.action.startsWith("Removed")) && entry.action.includes("to")) {
                                // Format quantity changes
                            }

                            return (
                                <tr key={entry.id}>
                                    <td className="border px-4 py-2">
                                        {displayAction}
                                    </td>
                                    <td className="border px-4 py-2">
                                        {new Date(entry.date).toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Export button */}
            <button
                onClick={exportCSV}
                className="mt-4 bg-green-500 text-white px-4 py-2 rounded"
            >
                Export to CSV
            </button>

            {/* Undo button */}
            <button
                onClick={handleUndoClick}
                className="mt-4 ml-2 bg-red-500 text-white px-4 py-2 rounded"
            >
                Undo Last Change
            </button>
        </div>
    );
};

export default HistoryPanel;
