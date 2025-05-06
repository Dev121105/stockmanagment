"use client";

import React, { useState, useEffect } from "react";
import HistoryPanel from "../components/HistoryPanel";
import Header from "../components/Header";

export default function HistoryPage() {
    const [history, setHistory] = useState([]);
    const [historySearch, setHistorySearch] = useState("");
    const [sortBy, setSortBy] = useState("date");

    useEffect(() => {
        const storedHistory = localStorage.getItem("history");
        if (storedHistory) {
            try {
                setHistory(JSON.parse(storedHistory));
            } catch (error) {
                console.error("Error parsing history from localStorage:", error);
                // Handle the error, e.g., clear the corrupted data
                localStorage.removeItem("history");
                setHistory([]); // Set history to an empty array to avoid further errors
            }
        } else {
            setHistory([]); // Initialize as empty array if nothing in localStorage
        }
    }, []);

    const exportCSV = () => {
        if (history.length === 0) {
            alert("No history to export."); // Provide user feedback
            return;
        }
        const csv = ["Action,Date"];
        history.forEach((h) =>
            csv.push(`"${h.action}","${new Date(h.date).toLocaleString()}"`)
        );
        const blob = new Blob([csv.join("\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "change-history.csv";
        document.body.appendChild(a); // Append, click, and remove
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    };

    const undoLastChange = () => {
        alert("Undo is not available on this page.  Please go to the main page to undo.");
    };

    return (
        <div className="p-6">
            <Header />
            <h1 className="text-2xl font-bold mb-4">Inventory History</h1>
            <HistoryPanel
                history={history}
                historySearch={historySearch}
                setHistorySearch={setHistorySearch}
                sortBy={sortBy}
                setSortBy={setSortBy}
                exportCSV={exportCSV}
                undoLastChange={undoLastChange}
            />
        </div>
    );
}