// app/page.js
"use client"; // This directive is needed for client-side functionality in App Router

import React, { useState, useEffect, useMemo } from "react";
import Header from "./components/Header";
import Link from "next/link";
import { Button } from "./components/button";
import TotalSummary from "./pages/TotalSummary"; // Corrected import path assuming it's in ./pages

// Import icons for expand/collapse, export
import { ChevronDown, ChevronUp, Download, AlertTriangle } from "lucide-react"; // Added AlertTriangle

// Import toast for potential loading errors
import { toast } from "sonner";

// Helper function to format date as DD-MM-YYYY (Used for display and filtering)
function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Helper function to parse DD-MM-YYYY string to Date (Used for sorting)
function parseDate(dateString) {
  if (
    !dateString ||
    typeof dateString !== "string" ||
    dateString.trim() === ""
  ) {
    return null;
  }
  const [day, month, year] = dateString.split("-");
  if (
    day &&
    month &&
    year &&
    !isNaN(parseInt(day, 10)) &&
    !isNaN(parseInt(month, 10)) &&
    !isNaN(parseInt(year, 10))
  ) {
    const dayInt = parseInt(day, 10);
    const monthInt = parseInt(month, 10);
    const yearInt = parseInt(year, 10);
    // Month is 0-indexed in Date constructor
    if (
      dayInt >= 1 &&
      dayInt <= 31 &&
      monthInt >= 1 &&
      monthInt <= 12 &&
      yearInt >= 1900 &&
      yearInt <= 2100
    ) {
      return new Date(yearInt, monthInt - 1, dayInt);
    }
  }
  return null; // Default to null if parsing fails
}

// Helper function to parse MM-YY date strings into a Date object (Used for sorting expiry dates)
function parseMonthYearDate(dateString) {
  if (
    !dateString ||
    typeof dateString !== "string" ||
    dateString.trim() === ""
  ) {
    return null; // Return null for empty or invalid string
  }
  const parts = dateString.split("-");
  if (parts.length !== 2) {
    return null; // Must have exactly two parts (MM and YY)
  }
  const [month, year] = parts;
  const monthInt = parseInt(month, 10);
  const yearInt = parseInt(year, 10);

  if (month && year && !isNaN(monthInt) && !isNaN(yearInt)) {
    if (monthInt >= 1 && monthInt <= 12 && yearInt >= 0 && yearInt <= 99) {
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      let fullYear = currentCentury + yearInt;
      // Heuristic: if the parsed year is more than 20 years in the past, assume next century
      // (e.g., if current year is 2024 and YY is '03', it's 2003, not 2103. If YY is '98' it's 2098 or 1998)
      // This simple approach assumes 20xx for YY < (currentYear % 100 + 20)
      // A more robust solution might be needed if dealing with dates far in past/future.
      // For typical expiry dates (usually within a few years), 2000 + yearInt is common.
      // Let's stick to a simple 2000 + yearInt for now, common for product expiry.
      fullYear = 2000 + yearInt;
      return new Date(fullYear, monthInt - 1, 1); // Use day 1 for consistency
    }
  }
  return null; // Return null for invalid format or values
}

// Helper function to load products from localStorage and ensure data types
const loadProductsFromLocalStorage = () => {
  console.log("Dashboard: Attempting to load products from localStorage...");
  try {
    const storedProducts = localStorage.getItem("products");
    console.log("Dashboard: localStorage 'products' raw data loaded.");

    const products = storedProducts ? JSON.parse(storedProducts) : [];
    console.log(
      "Dashboard: Successfully parsed products. Count:",
      products.length
    );

    const processedProducts = products
      .map((p) => {
        try {
          return {
            ...p,
            quantity: Number(p.quantity) || 0,
            mrp: Number(p.mrp) || 0,
            itemsPerPack: Number(p.itemsPerPack) || 1,
            minStock: Number(p.minStock) || 0,
            maxStock: Number(p.maxStock) || 0,
            discount: Number(p.discount) || 0,
            taxRate: Number(p.taxRate) || 0,
            name: p.name || "",
            unit: p.unit || "",
            category: p.category || "",
            company: p.company || "",
            id: p.id, // Assuming ID is always present and unique
            batch: p.batch || "", // Though batch details are usually per purchase
            expiry: p.expiry || "", // Though expiry details are usually per purchase
          };
        } catch (mapErr) {
          console.error(
            "Dashboard: Error processing product item during map:",
            p,
            mapErr
          );
          return null;
        }
      })
      .filter((p) => p !== null);

    console.log(
      "Dashboard: Finished processing products. Valid product count:",
      processedProducts.length
    );
    return processedProducts;
  } catch (err) {
    console.error(
      "Dashboard: Error loading or parsing products from localStorage:",
      err
    );
    toast.error("Error loading product data for dashboard.");
    return [];
  }
};

// Helper function to load purchase bills from localStorage
const loadPurchaseBillsFromLocalStorage = () => {
  console.log(
    "Dashboard: Attempting to load purchase bills from localStorage..."
  );
  try {
    const storedBills = localStorage.getItem("purchaseBills");
    const bills = storedBills ? JSON.parse(storedBills) : [];
    console.log(
      "Dashboard: Successfully parsed purchase bills. Count:",
      bills.length
    );
    const processedBills = bills.map((bill) => ({
      ...bill,
      date: bill.date || "",
      items: bill.items.map((item) => ({
        ...item,
        product: item.product || "",
        batch: item.batch || "",
        expiry: item.expiry || "",
        quantity: Number(item.quantity) || 0,
        packsPurchased: Number(item.packsPurchased) || 0,
        itemsPerPack: Number(item.itemsPerPack) || 1,
        ptr: Number(item.ptr) || 0,
        totalItemAmount: Number(item.totalItemAmount) || 0,
      })),
      totalAmount: Number(bill.totalAmount) || 0,
    }));
    processedBills.sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB - dateA;
    });
    return processedBills;
  } catch (err) {
    console.error("Dashboard: Error loading or parsing purchase bills:", err);
    toast.error("Error loading purchase bill data for dashboard.");
    return [];
  }
};

// Helper function to load sales bills from localStorage
const loadSalesBillsFromLocalStorage = () => {
  console.log("Dashboard: Attempting to load sales bills from localStorage...");
  try {
    const storedBills = localStorage.getItem("salesBills");
    const bills = storedBills ? JSON.parse(storedBills) : [];
    console.log(
      "Dashboard: Successfully parsed sales bills. Count:",
      bills.length
    );
    const processedBills = bills.map((bill) => ({
      ...bill,
      date: bill.date || "",
      items: bill.items.map((item) => ({
        ...item,
        product: item.product || "",
        batch: item.batch || "",
        expiry: item.expiry || "",
        quantitySold: Number(item.quantitySold) || 0,
        pricePerItem: Number(item.pricePerItem) || 0,
        totalItemAmount: Number(item.totalItemAmount) || 0,
      })),
      totalAmount: Number(bill.totalAmount) || 0,
    }));
    processedBills.sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB - dateA;
    });
    return processedBills;
  } catch (err) {
    console.error("Dashboard: Error loading or parsing sales bills:", err);
    toast.error("Error loading sales bill data for dashboard.");
    return [];
  }
};

export default function Home() {
  const [products, setProducts] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [salesBills, setSalesBills] = useState([]);
  const [todayPurchaseBills, setTodayPurchaseBills] = useState([]);
  const [todaySalesBills, setTodaySalesBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalQuantity, setTotalQuantity] = useState(0); // This might need recalculation based on batchStock
  const [totalValue, setTotalValue] = useState(0); // This might need recalculation based on batchStock & MRP/PTR
  const [expandedRows, setExpandedRows] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  
  // NEW STATE: For products nearing expiry
  const [expiringSoonProducts, setExpiringSoonProducts] = useState([]);

  // --- EFFECT: Load initial data and set up event listener ---
  useEffect(() => {
    console.log(
      "Dashboard useEffect: Component mounted. Starting initial data load."
    );
    try {
      const initialProducts = loadProductsFromLocalStorage();
      const initialPurchaseBills = loadPurchaseBillsFromLocalStorage();
      const initialSalesBills = loadSalesBillsFromLocalStorage();

      setProducts(initialProducts);
      setPurchaseBills(initialPurchaseBills);
      setSalesBills(initialSalesBills);
      setLoading(false);
    } catch (initialLoadError) {
      console.error(
        "Dashboard useEffect: Unexpected error during initial load:",
        initialLoadError
      );
      setProducts([]);
      setPurchaseBills([]);
      setSalesBills([]);
      setLoading(false);
      toast.error("An unexpected error occurred during initial data load.");
    }

    const handleDataUpdated = () => {
      console.log(
        "Dashboard: 'productsUpdated' event received. Reloading all relevant data from storage."
      );
      const updatedProducts = loadProductsFromLocalStorage();
      const updatedPurchaseBills = loadPurchaseBillsFromLocalStorage();
      const updatedSalesBills = loadSalesBillsFromLocalStorage();
      setProducts(updatedProducts);
      setPurchaseBills(updatedPurchaseBills);
      setSalesBills(updatedSalesBills);
    };

    window.addEventListener("productsUpdated", handleDataUpdated);
    return () => {
      window.removeEventListener("productsUpdated", handleDataUpdated);
    };
  }, []);

  // --- EFFECT: Filter for Today's Transactions ---
  useEffect(() => {
    const todayFormatted = formatDate(new Date());
    const salesToday = salesBills.filter(
      (bill) => bill.date === todayFormatted
    );
    const purchaseToday = purchaseBills.filter(
      (bill) => bill.date === todayFormatted
    );
    setTodaySalesBills(salesToday);
    setTodayPurchaseBills(purchaseToday);
  }, [salesBills, purchaseBills]);

  // --- Stock Calculation Logic (Memoized for performance) ---
  const batchStock = useMemo(() => {
    console.log("Dashboard: Calculating batch stock...");
    const stockMap = new Map();

    purchaseBills.forEach((bill) => {
      bill.items.forEach((item) => {
        if (item.product && item.batch && item.expiry) {
          const key = `${item.product.trim().toLowerCase()}_${item.batch
            .trim()
            .toLowerCase()}_${item.expiry.trim().toLowerCase()}`;
          const quantity = Number(item.quantity) || 0;
          stockMap.set(key, (stockMap.get(key) || 0) + quantity);
        }
      });
    });

    salesBills.forEach((bill) => {
      bill.items.forEach((item) => {
        if (item.product && item.batch && item.expiry) {
          const key = `${item.product.trim().toLowerCase()}_${item.batch
            .trim()
            .toLowerCase()}_${item.expiry.trim().toLowerCase()}`;
          const quantitySold = Number(item.quantitySold) || 0;
          stockMap.set(key, (stockMap.get(key) || 0) - quantitySold);
        }
      });
    });

    const productBatchStock = new Map();
    stockMap.forEach((quantity, key) => {
      const [productNameLower, batchLower, expiryLower] = key.split("_");
      const originalProduct = products.find(
        (p) => p && p.name && p.name.toLowerCase() === productNameLower
      );

      if (!originalProduct) {
        console.warn(
          `Dashboard: Calculated batch stock for unknown product: "${productNameLower}". Skipping display.`
        );
        return;
      }
      const displayProductName = originalProduct.name;

      if (!productBatchStock.has(displayProductName)) {
        productBatchStock.set(displayProductName, []);
      }

      if (quantity > 0) { // Only include batches with positive stock
        let displayBatch = batchLower;
        let displayExpiry = expiryLower;
        const purchaseItemMatch = purchaseBills
          .flatMap((bill) => bill.items)
          .find(
            (item) =>
              item.product?.trim().toLowerCase() === productNameLower &&
              item.batch?.trim().toLowerCase() === batchLower &&
              item.expiry?.trim().toLowerCase() === expiryLower
          );
        if (purchaseItemMatch) {
          displayBatch = purchaseItemMatch.batch.trim();
          displayExpiry = purchaseItemMatch.expiry.trim();
        }

        productBatchStock.get(displayProductName).push({
          batch: displayBatch,
          expiry: displayExpiry,
          quantity: quantity,
        });
      }
    });

    productBatchStock.forEach((batches) => {
      batches.sort((a, b) => {
        const dateA = parseMonthYearDate(a.expiry);
        const dateB = parseMonthYearDate(b.expiry);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA - dateB;
      });
    });
    console.log("Dashboard: Batch stock calculated.", Object.fromEntries(productBatchStock));
    return productBatchStock;
  }, [products, purchaseBills, salesBills]);

  // --- EFFECT: Update Overall Stock Summary based on batchStock ---
  useEffect(() => {
    let newTotalQuantity = 0;
    let newTotalValue = 0; // Based on MRP for now, can be PTR if needed

    batchStock.forEach((batches, productName) => {
      const productMasterInfo = products.find(p => p.name === productName);
      const mrp = productMasterInfo ? Number(productMasterInfo.mrp) || 0 : 0;

      batches.forEach(batch => {
        newTotalQuantity += batch.quantity;
        newTotalValue += batch.quantity * mrp;
      });
    });

    setTotalQuantity(newTotalQuantity);
    setTotalValue(newTotalValue);
    console.log(`Dashboard: Overall stock summary updated. Total Qty: ${newTotalQuantity}, Total Value: ${newTotalValue.toFixed(2)}`);
  }, [batchStock, products]); // Recalculate when batchStock or product master (for MRP) changes


  // --- EFFECT: Calculate Products Nearing Expiry (Next 2 Months) --- // NEW EFFECT
  useEffect(() => {
    console.log("Dashboard: Calculating products nearing expiry...");
    const today = new Date();
    // Set to the first day of the current month for consistent comparison start
    const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Calculate the date two months from the first day of the current month
    // This means if today is May 7th, we consider May, June, July.
    // So, we want items expiring ON or BEFORE the last day of July.
    // The target month is currentMonth + 2.
    const targetMonth = new Date(firstDayOfCurrentMonth);
    targetMonth.setMonth(firstDayOfCurrentMonth.getMonth() + 2); // e.g., May -> July
    
    // Get the last day of the target month
    const lastDayOfTwoMonthsFromNow = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

    console.log("Dashboard Expiry Check: Today:", today.toDateString());
    console.log("Dashboard Expiry Check: Expiry check up to (inclusive):", lastDayOfTwoMonthsFromNow.toDateString());


    const nearingExpiry = [];

    batchStock.forEach((batches, productName) => {
      const originalProduct = products.find(p => p.name === productName);

      batches.forEach(batch => {
        const expiryDate = parseMonthYearDate(batch.expiry); // Uses MM-YY string
        if (expiryDate) { // expiryDate is the 1st of the expiry month
          // We want to include items if their expiry month is on or before our target month.
          // Example:
          // Today: May 7, 2025.
          // lastDayOfTwoMonthsFromNow is July 31, 2025.
          // If product expires 07-25 (July 2025), expiryDate will be July 1, 2025. This IS <= July 31, 2025. Include.
          // If product expires 08-25 (August 2025), expiryDate will be Aug 1, 2025. This IS NOT <= July 31, 2025. Exclude.
          // If product expires 05-25 (May 2025), expiryDate will be May 1, 2025. This IS <= July 31, 2025. Include.
          // Also check if expiry date is not in the past (already expired and should ideally not be in positive stock)
          // However, for "nearing expiry", we include items that might have just expired too if they have stock.
          // The primary check is against `lastDayOfTwoMonthsFromNow`.
          if (expiryDate <= lastDayOfTwoMonthsFromNow) {
            if (batch.quantity > 0) {
              nearingExpiry.push({
                productName: productName,
                category: originalProduct?.category || "N/A",
                company: originalProduct?.company || "N/A",
                batch: batch.batch,
                expiry: batch.expiry, // Original MM-YY string
                quantity: batch.quantity,
                id: originalProduct ? `${originalProduct.id}-${batch.batch}-${batch.expiry}` : `${productName}-${batch.batch}-${batch.expiry}`, // More unique key
              });
            }
          }
        }
      });
    });

    // Sort by expiry date (earliest first)
    nearingExpiry.sort((a, b) => {
      const dateA = parseMonthYearDate(a.expiry);
      const dateB = parseMonthYearDate(b.expiry);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1; // Nulls/invalid dates last
      if (!dateB) return -1; // Nulls/invalid dates last
      return dateA - dateB; // Ascending sort
    });

    setExpiringSoonProducts(nearingExpiry);
    console.log(
      "Dashboard: Products nearing expiry calculated.",
      nearingExpiry.length, "items found."
    );
  }, [batchStock, products]); // Re-run when batchStock or products list changes


  // Function to calculate total stock for a product based on batch stock
  const getTotalStock = (productName) => {
    const originalProduct = products.find(
      (p) => p && p.name && p.name.toLowerCase() === productName.toLowerCase()
    );
    if (!originalProduct) return 0;

    const batches = batchStock.get(originalProduct.name) || [];
    const total = batches.reduce((sum, batch) => sum + batch.quantity, 0);
    return total;
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setExpandedRows({});
  };

  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) {
      return products;
    }
    return products.filter(
      (product) =>
        product &&
        product.name &&
        (product.name.toLowerCase().includes(query) ||
          (product.unit && product.unit.toLowerCase().includes(query)) ||
          (product.category && product.category.toLowerCase().includes(query)) ||
          (product.company && product.company.toLowerCase().includes(query)) ||
          (batchStock.has(product.name) &&
            batchStock
              .get(product.name)
              .some(
                (batchDetail) =>
                  batchDetail.batch.toLowerCase().includes(query) ||
                  batchDetail.expiry.toLowerCase().includes(query)
              )))
    );
  }, [searchQuery, products, batchStock]);

  const toggleRowExpansion = (productId) => {
    setExpandedRows((prevExpandedRows) => ({
      ...prevExpandedRows,
      [productId]: !prevExpandedRows[productId],
    }));
  };

  const exportToCsv = (data, filename, type) => {
    if (!data || data.length === 0) {
      toast.info(`No ${type} data to export.`);
      return;
    }
    let headers = [];
    let csvRows = [];

    if (type === "sales") {
      headers = ["Bill Number", "Customer Name", "Date", "Total Amount"];
      csvRows = data.map((bill) =>
        [
          `"${bill.billNumber || ""}"`,
          `"${bill.customerName || ""}"`,
          `"${bill.date || ""}"`,
          (Number(bill.totalAmount) || 0).toFixed(2),
        ].join(",")
      );
    } else if (type === "purchase") {
      headers = ["Bill Number", "Supplier Name", "Date", "Total Amount"];
      csvRows = data.map((bill) =>
        [
          `"${bill.billNumber || ""}"`,
          `"${bill.supplierName || ""}"`,
          `"${bill.date || ""}"`,
          (Number(bill.totalAmount) || 0).toFixed(2),
        ].join(",")
      );
    } else {
      return;
    }

    const headerRow = headers.join(",");
    csvRows.unshift(headerRow);
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${formatDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(
      `${type.charAt(0).toUpperCase() + type.slice(1)} history exported!`
    );
  };

  const exportSalesCSV = () => exportToCsv(salesBills, "sales_history", "sales");
  const exportPurchaseCSV = () => exportToCsv(purchaseBills, "purchase_history", "purchase");

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 antialiased text-gray-800">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-700">Dashboard</h1>
          <div className="flex flex-wrap gap-2">
            <Link href="/sales">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow hover:shadow-md transition-all duration-150">
                Go to Sales
              </Button>
            </Link>
            <Link href="/purchase">
              <Button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow hover:shadow-md transition-all duration-150">
                Go to Purchase
              </Button>
            </Link>
            <Link href="/productmaster">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow hover:shadow-md transition-all duration-150">
                Product Master
              </Button>
            </Link>
          </div>
        </div>

        {/* Overall Stock Summary Section */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-100 p-6 rounded-xl shadow-lg mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">Overall Stock Summary</h2>
          <TotalSummary totalQuantity={totalQuantity} totalValue={totalValue} />
        </div>

        {/* Products Nearing Expiry Section - ADDED & ENHANCED */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg mb-8">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-6 w-6 text-orange-500 mr-3 shrink-0" />
            <h2 className="text-xl font-semibold text-orange-600">
              Products Nearing Expiry (Next 2 Months)
            </h2>
          </div>
          {loading ? (
            <div className="text-center text-gray-500 py-4">Loading expiry data...</div>
          ) : expiringSoonProducts.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-orange-200">
              <table className="min-w-full table-auto">
                <thead className="bg-orange-50">
                  <tr className="text-left text-sm text-orange-700">
                    <th className="px-4 py-3 font-medium">Product Name</th>
                    <th className="px-4 py-3 font-medium">Batch No.</th>
                    <th className="px-4 py-3 font-medium">Expiry (MM-YY)</th>
                    <th className="px-4 py-3 font-medium text-right">Stock (Items)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100">
                  {expiringSoonProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-orange-50/50 transition-colors duration-150">
                      <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                        {product.productName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{product.batch}</td>
                      <td className="px-4 py-3 text-sm text-red-600 font-semibold">
                        {product.expiry}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right font-medium">{product.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600 py-4 text-center">
              No products nearing expiry in the next two months.
            </p>
          )}
        </div>
        {/* END Products Nearing Expiry Section */}


        {/* Current Stock Inventory Section */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">
            Current Stock Inventory
          </h2>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search products, batches, categories..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="border border-gray-300 p-3 rounded-lg w-full md:w-2/5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
            />
          </div>
          {loading ? (
            <div className="text-center text-gray-500 py-8">
              Loading stock data...
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-50">
                  <tr className="text-left text-sm text-gray-600">
                    <th className="px-4 py-3 font-medium w-[25%]">Product Name</th>
                    <th className="px-4 py-3 font-medium w-[10%]">Unit</th>
                    <th className="px-4 py-3 font-medium w-[15%]">Category</th>
                    <th className="px-4 py-3 font-medium w-[15%]">Company</th>
                    <th className="px-4 py-3 font-medium w-[10%] text-right">MRP (₹)</th>
                    <th className="px-4 py-3 font-medium w-[10%] text-center">Items/Pack</th>
                    <th className="px-4 py-3 font-medium w-[15%] text-right">Total Stock (Items)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <React.Fragment key={product.id}>
                        <tr
                          className={`hover:bg-gray-50 transition-colors duration-150 ${
                            expandedRows[product.id] ? "bg-indigo-50" : ""
                          } cursor-pointer`}
                          onClick={() => toggleRowExpansion(product.id)}
                        >
                          <td className="px-4 py-3 text-sm text-gray-700 font-medium flex items-center">
                            {expandedRows[product.id] ? (
                              <ChevronUp className="h-4 w-4 mr-2 shrink-0 text-indigo-600" />
                            ) : (
                              <ChevronDown className="h-4 w-4 mr-2 shrink-0 text-gray-500" />
                            )}
                            <span className="truncate">{product.name}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{product.unit}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{product.category}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{product.company}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">
                            {Number(product.mrp).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-center">
                            {product.itemsPerPack}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 font-semibold text-right">
                            {getTotalStock(product.name)}
                          </td>
                        </tr>

                        {expandedRows[product.id] && (
                          <tr key={`batch-details-${product.id}`} className="bg-gray-50">
                            <td colSpan="7" className="px-4 py-3">
                              <div className="p-3 bg-white rounded-md border border-gray-200">
                                <h4 className="font-semibold text-sm text-gray-700 mb-2">
                                  Batch Stock Details:
                                </h4>
                                {batchStock.has(product.name) &&
                                batchStock.get(product.name).length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full table-auto text-xs">
                                      <thead className="bg-gray-100">
                                        <tr className="text-left text-gray-600">
                                          <th className="px-2 py-2 font-medium">Batch No.</th>
                                          <th className="px-2 py-2 font-medium">Expiry (MM-YY)</th>
                                          <th className="px-2 py-2 font-medium text-right">Stock (Items)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {batchStock
                                          .get(product.name)
                                          .map((batchDetail, batchIndex) => (
                                            <tr key={batchIndex} className="hover:bg-gray-100/50">
                                              <td className="px-2 py-2 text-gray-700">{batchDetail.batch}</td>
                                              <td className={`px-2 py-2 ${parseMonthYearDate(batchDetail.expiry) < new Date() ? 'text-red-500 font-semibold' : 'text-gray-700'}`}>
                                                {batchDetail.expiry}
                                              </td>
                                              <td className="px-2 py-2 text-gray-700 font-medium text-right">{batchDetail.quantity}</td>
                                            </tr>
                                          ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 text-sm">
                                    No batch details or zero stock for this product.
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="7"
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No products found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* --- Today's Transactions and History Section --- */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg mb-6">
          <h2 className="text-2xl font-semibold text-gray-700 mb-6">
            Transaction Summary & History
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="border border-gray-200 p-4 rounded-lg bg-slate-50">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Today's Sales ({formatDate(new Date())})
              </h3>
              <p className="text-sm text-gray-600">
                Total Bills:{" "}
                <span className="font-medium text-gray-800">{todaySalesBills.length}</span>
              </p>
              <p className="text-sm text-gray-600">
                Total Amount:{" "}
                <span className="font-medium text-gray-800">
                  ₹
                  {todaySalesBills
                    .reduce((sum, bill) => sum + (Number(bill.totalAmount) || 0), 0)
                    .toFixed(2)}
                </span>
              </p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg bg-slate-50">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Today's Purchases ({formatDate(new Date())})
              </h3>
              <p className="text-sm text-gray-600">
                Total Bills:{" "}
                <span className="font-medium text-gray-800">{todayPurchaseBills.length}</span>
              </p>
              <p className="text-sm text-gray-600">
                Total Amount:{" "}
                <span className="font-medium text-gray-800">
                  ₹
                  {todayPurchaseBills
                    .reduce((sum, bill) => sum + (Number(bill.totalAmount) || 0), 0)
                    .toFixed(2)}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-semibold text-gray-700">Sales History</h3>
                <Button
                  onClick={exportSalesCSV}
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs shadow hover:shadow-md transition-all"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export Sales
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-96">
                <table className="min-w-full table-auto text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-gray-600">
                      <th className="px-3 py-2.5 font-medium">Bill No</th>
                      <th className="px-3 py-2.5 font-medium">Date</th>
                      <th className="px-3 py-2.5 font-medium">Customer</th>
                      <th className="px-3 py-2.5 font-medium text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {salesBills.length > 0 ? (
                      salesBills.map((bill) => (
                        <tr key={bill.id || bill.billNumber} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-3 py-2.5 text-gray-700">{bill.billNumber}</td>
                          <td className="px-3 py-2.5 text-gray-600">{bill.date}</td>
                          <td className="px-3 py-2.5 text-gray-600 truncate max-w-[120px] sm:max-w-[150px]">
                            {bill.customerName}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 text-right">
                            {(Number(bill.totalAmount) || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-3 py-6 text-center text-gray-500">
                          No sales bills found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-semibold text-gray-700">Purchase History</h3>
                <Button
                  onClick={exportPurchaseCSV}
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md text-xs shadow hover:shadow-md transition-all"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export Purchase
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-96">
                <table className="min-w-full table-auto text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-gray-600">
                      <th className="px-3 py-2.5 font-medium">Bill No</th>
                      <th className="px-3 py-2.5 font-medium">Date</th>
                      <th className="px-3 py-2.5 font-medium">Supplier</th>
                      <th className="px-3 py-2.5 font-medium text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {purchaseBills.length > 0 ? (
                      purchaseBills.map((bill) => (
                        <tr key={bill.id || bill.billNumber} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-3 py-2.5 text-gray-700">{bill.billNumber}</td>
                          <td className="px-3 py-2.5 text-gray-600">{bill.date}</td>
                          <td className="px-3 py-2.5 text-gray-600 truncate max-w-[120px] sm:max-w-[150px]">
                            {bill.supplierName}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 text-right">
                            {(Number(bill.totalAmount) || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-3 py-6 text-center text-gray-500">
                          No purchase bills found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
