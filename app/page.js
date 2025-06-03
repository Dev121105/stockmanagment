// app/page.js
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Header from "./components/Header";
import Link from "next/link";
import { Button } from "./components/button";
// Import TotalSummary component
import TotalSummary from "./pages/TotalSummary"; // Ensure this path is correct
import { ChevronDown, ChevronUp, Download, AlertTriangle, BarChart as BarChartIcon } from "lucide-react"; // Added BarChartIcon for the button
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts'; // Import Recharts components

// IMPORTANT: If you encounter "Module not found: Can't resolve 'recharts'",
// you need to install it in your project's terminal:
// npm install recharts
// or
// yarn add recharts

// Helper function to format date as DD-MM-YYYY
function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Helper function to parse DD-MM-YYYY string to Date
// Enhanced to handle both DD-MM-YYYY and MM-YY formats
function parseDate(dateString) {
  if (
    !dateString ||
    typeof dateString !== "string" ||
    dateString.trim() === ""
  ) {
    return null;
  }

  // Handle DD-MM-YYYY format
  if (dateString.includes("-") && dateString.split("-").length === 3) {
    const [day, month, year] = dateString.split("-");
    const dayInt = parseInt(day, 10);
    const monthInt = parseInt(month, 10);
    const yearInt = parseInt(year, 10);
    if (
      !isNaN(dayInt) && dayInt >= 1 && dayInt <= 31 &&
      !isNaN(monthInt) && monthInt >= 1 && monthInt <= 12 &&
      !isNaN(yearInt) && yearInt >= 1900 && yearInt <= 2100
    ) {
      return new Date(yearInt, monthInt - 1, dayInt);
    }
  }

  // Handle MM-YY format (common for expiry dates)
  if (dateString.includes("-") && dateString.split("-").length === 2) {
    const [month, year] = dateString.split("-");
    const monthInt = parseInt(month, 10);
    // Assuming 'YY' is 2-digit year, convert to 4-digit. Adjust century if needed (e.g., 20xx vs 19xx)
    const yearInt = parseInt(year, 10) + (parseInt(year, 10) > 50 ? 1900 : 2000); // Simple heuristic
    
    if (
      !isNaN(monthInt) && monthInt >= 1 && monthInt <= 12 &&
      !isNaN(yearInt) && yearInt >= 1900 && yearInt <= 2100
    ) {
      // For expiry, we often care about the end of the month
      return new Date(yearInt, monthInt, 0); // Day 0 of next month is last day of current month
    }
  }

  return null; // Default to null if parsing fails
}

export default function Home() {
  const [products, setProducts] = useState([]); // This will hold product master data
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [salesBills, setSalesBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null); // State to track expanded row
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false); // State for analytics modal

  // --- Data Loading Functions ---
  const loadProductsData = () => {
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
              // quantity: Number(p.quantity) || 0, // This will be calculated from bills
              mrp: Number(p.mrp) || 0, // Current Selling price (from Master)
              originalMrp: Number(p.originalMrp) || 0, // Original Purchased MRP (if stored in master)
              itemsPerPack: Number(p.itemsPerPack) || 1, // Items per pack
              minStock: Number(p.minStock) || 0,
              maxStock: Number(p.maxStock) || 0,
              discount: Number(p.discount) || 0,
              name: p.name || "",
              unit: p.unit || "",
              category: p.category || "",
              company: p.company || "",
              id: p.id,
              batch: p.batch || "",
              expiry: p.expiry || "",
            };
          } catch (mapErr) {
            console.error(
              "Dashboard: Error processing product item during map:",
              p,
              mapErr
            );
            toast.error(
              `Error processing product data for item with ID: ${
                p?.id || "unknown"
              }.`
            );
            return null;
          }
        })
        .filter((p) => p !== null);

      console.log(
        "Dashboard: Finished processing products. Valid product count:",
        processedProducts.length
      );
      setProducts(processedProducts);
    } catch (err) {
      console.error(
        "Dashboard: Error loading or parsing products from localStorage:",
        err
      );
      setError("Error loading product master data.");
      toast.error("Error loading product master data.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseBillsData = () => {
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
      const processedBills = bills
        .map((bill) => {
          try {
            return {
              ...bill,
              date: bill.date || "",
              items: bill.items.map((item) => ({
                ...item,
                product: item.product || "",
                batch: item.batch || "",
                expiry: item.expiry || "",
                quantity: Number(item.quantity) || 0, // Quantity purchased in this line
                packsPurchased: Number(item.packsPurchased) || 0,
                itemsPerPack: Number(item.itemsPerPack) || 1,
                ptr: Number(item.ptr) || 0,
                mrp: Number(item.mrp) || 0, // Entered/Confirmed MRP from Purchase
                originalMrp: Number(item.originalMrp) || 0, // Original Master MRP from Purchase
                unit: item.unit || "",
                category: item.category || "",
                company: item.company || "",
                discount: Number(item.discount) || 0, // Discount on Purchase
                taxRate: Number(item.taxRate) || 0,
              })),
              totalAmount: Number(bill.totalAmount) || 0,
            };
          } catch (mapErr) {
            console.error(
              "Dashboard: Error processing purchase bill item during map:",
              bill,
              mapErr
            );
            // Decide if you want a toast here or just log the error
            return null; // Filter out problematic bills
          }
        })
        .filter((bill) => bill !== null);

      processedBills.sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB - dateA;
      });
      setPurchaseBills(processedBills);
    } catch (err) {
      console.error(
        "Dashboard: Error loading or parsing purchase bills:",
        err
      );
      setError("Error loading purchase bill data.");
      toast.error("Error loading purchase bill data.");
      setPurchaseBills([]);
    }
  };

  const loadSalesBillsData = () => {
    console.log("Dashboard: Attempting to load sales bills from localStorage...");
    try {
      // Changed from 'salesBills' to 'sales' to match SalesPage storage
      const storedBills = localStorage.getItem("sales");
      const bills = storedBills ? JSON.parse(storedBills) : [];
      console.log(
        "Dashboard: Successfully parsed sales bills. Count:",
        bills.length
      );
      const processedBills = bills
        .map((bill) => {
          try {
            return {
              ...bill,
              // Ensure date is formatted consistently if needed, or just use as is
              saleDate: bill.saleDate || "", // Use saleDate from SalesPage
              grandTotal: Number(bill.grandTotal) || 0, // Use grandTotal from SalesPage
              customerName: bill.customerName || "",
              items: bill.items.map((item) => ({
                ...item,
                // Use 'quantity' as stored in SalesPage, not 'quantitySold'
                quantity: Number(item.quantity) || 0,
                salePrice: Number(item.salePrice) || 0, // Use salePrice from SalesPage
                discount: Number(item.discount) || 0, // Discount on Sale
                itemTotal: Number(item.itemTotal) || 0, // Use itemTotal from SalesPage
                mrp: Number(item.mrp) || 0, // MRP from SalesPage item
                // productItemsPerPack: Number(item.productItemsPerPack) || 1, // Not directly from SalesPage item
                // purchasedMrp: Number(item.purchasedMrp) || 0, // Not directly from SalesPage item
                productName: item.productName || "", // Use productName from SalesPage
                batch: item.batch || "",
                expiry: item.expiry || "",
                unit: item.unit || "",
                category: item.category || "",
                // company: item.company || "", // Not directly from SalesPage item
              })),
            };
          } catch (mapErr) {
            console.error(
              "Dashboard: Error processing sales bill item during map:",
              bill,
              mapErr
            );
            // Decide if you want a toast here or just log the error
            return null; // Filter out problematic bills
          }
        })
        .filter((bill) => bill !== null);

      processedBills.sort((a, b) => {
        // Sort by saleDate from SalesPage
        const dateA = parseDate(a.saleDate);
        const dateB = parseDate(b.saleDate);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB - dateA;
      });
      setSalesBills(processedBills);
    } catch (err) {
      console.error("Dashboard: Error loading or parsing sales bills:", err);
      setError("Error loading sales bill data.");
      toast.error("Error loading sales bill data.");
      setSalesBills([]);
    }
  };


  // --- Initial Data Loading Effects ---
  useEffect(() => {
    loadProductsData();
    loadPurchaseBillsData();
    loadSalesBillsData();
  }, []);

  // Listen for updates from other pages (e.g., Product Master, Purchase, Sales)
  useEffect(() => {
    const handleDataUpdated = () => {
      console.log("Dashboard: Data updated event received. Reloading all data.");
      // Reload all data when any dataUpdated event is dispatched
      loadProductsData();
      loadPurchaseBillsData();
      loadSalesBillsData();
    };

    window.addEventListener("productsUpdated", handleDataUpdated);
    window.addEventListener("purchaseBillsUpdated", handleDataUpdated);
    window.addEventListener("salesUpdated", handleDataUpdated); // Listen for 'salesUpdated' from SalesPage

    return () => {
      window.removeEventListener("productsUpdated", handleDataUpdated);
      window.removeEventListener("purchaseBillsUpdated", handleDataUpdated);
      window.removeEventListener("salesUpdated", handleDataUpdated);
    };
  }, []);

  // Function to calculate stock by batch for a product - moved inside Home component
  // to access purchaseBills and salesBills directly without passing them explicitly
  const getStockByBatch = useCallback((productName) => {
    const batchMap = new Map(); // Key: batch_expiry, Value: quantity

    // Add quantities from purchase bills
    purchaseBills.forEach((bill) => {
      bill.items.forEach((item) => {
        if (item.product.toLowerCase() === productName.toLowerCase()) {
          const key = `${item.batch.trim()}_${item.expiry.trim()}`;
          batchMap.set(key, (batchMap.get(key) || 0) + Number(item.quantity));
        }
      });
    });

    // Subtract quantities from sales bills
    salesBills.forEach((bill) => {
      bill.items.forEach((item) => {
        // Use 'productName' from sales item and 'quantity'
        if (item.productName.toLowerCase() === productName.toLowerCase()) {
          const key = `${item.batch.trim()}_${item.expiry.trim()}`;
          batchMap.set(
            key,
            Math.max(0, (batchMap.get(key) || 0) - Number(item.quantity))
          );
        }
      });
    });

    // Convert map to array of objects
    const batchStockList = Array.from(batchMap.entries()).map(
      ([key, quantity]) => {
        const [batch, expiry] = key.split("_");
        return { batch, expiry, quantity };
      }
    );

    // Filter out batches with zero stock and sort by expiry date
    batchStockList.sort((a, b) => {
      const dateA = parseDate(a.expiry); // Use the enhanced parseDate
      const dateB = parseDate(b.expiry);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA - dateB; // Sort by oldest expiry first
    });

    return batchStockList;
  }, [purchaseBills, salesBills]); // Dependencies for useCallback

  // Calculate the total stock for a product using getStockByBatch
  const calculateTotalStockForProduct = useCallback((productName) => {
    const batchStocks = getStockByBatch(productName);
    return batchStocks.reduce((sum, batch) => sum + batch.quantity, 0);
  }, [getStockByBatch]);


  // --- Products with calculated current stock for display ---
  const productsWithCalculatedStock = useMemo(() => {
    console.log("Dashboard useMemo: Recalculating products with current stock...");
    return products.map(product => ({
      ...product,
      // Override the quantity from master with the calculated current stock
      // This ensures consistency between the main table and detailed batch stock
      quantity: calculateTotalStockForProduct(product.name)
    }));
  }, [products, calculateTotalStockForProduct]);


  // --- Other Calculations (Memoized) ---

  const totalStockValue = useMemo(() => {
    console.log("Dashboard useMemo: Calculating total stock value...");
    return productsWithCalculatedStock.reduce(
      (total, product) => total + (Number(product.quantity) * Number(product.mrp) || 0),
      0
    );
  }, [productsWithCalculatedStock]);

  const lowStockProducts = useMemo(() => {
    console.log("Dashboard useMemo: Calculating low stock products...");
    return productsWithCalculatedStock.filter(
      (product) => product.quantity <= product.minStock && product.quantity > 0
    );
  }, [productsWithCalculatedStock]);

  const outOfStockProducts = useMemo(() => {
    console.log("Dashboard useMemo: Calculating out of stock products...");
    return productsWithCalculatedStock.filter((product) => product.quantity === 0);
  }, [productsWithCalculatedStock]);

  // Calculate total purchase value
  const totalPurchaseValue = useMemo(() => {
    console.log("Dashboard useMemo: Calculating total purchase value...");
    return purchaseBills.reduce(
      (total, bill) => total + (Number(bill.totalAmount) || 0),
      0
    );
  }, [purchaseBills]);

  // Calculate total sales value
  const totalSalesValue = useMemo(() => {
    console.log("Dashboard useMemo: Calculating total sales value...");
    // Use grandTotal from salesBills
    return salesBills.reduce(
      (total, bill) => total + (Number(bill.grandTotal) || 0),
      0
    );
  }, [salesBills]);

  // Calculate products nearing expiry
  const nearExpiryProducts = useMemo(() => {
    console.log("Dashboard useMemo: Calculating near expiry products...");
    const today = new Date();
    // Set today's date to the beginning of the day for consistent comparison
    today.setHours(0, 0, 0, 0);

    const twoMonthsLater = new Date();
    twoMonthsLater.setMonth(today.getMonth() + 2);
    // Set to the end of the month for two months later for inclusive comparison
    twoMonthsLater.setDate(0); // Day 0 of next month is last day of current month
    twoMonthsLater.setHours(23, 59, 59, 999);

    const productsNearingExpiryList = [];

    // Iterate through productsWithCalculatedStock to get current stock and expiry
    productsWithCalculatedStock.forEach(product => {
      // Get stock for each batch of the product
      const batchStocks = getStockByBatch(product.name);

      batchStocks.forEach(batch => {
        const productExpiryDate = parseDate(batch.expiry); // Use parseDate for consistency
        if (productExpiryDate && batch.quantity > 0) { // Only consider batches with stock
          // Check if expiry date is after today AND before or on twoMonthsLater
          if (productExpiryDate > today && productExpiryDate <= twoMonthsLater) {
            productsNearingExpiryList.push({
              id: product.id,
              name: product.name,
              batch: batch.batch,
              expiry: batch.expiry,
              quantity: batch.quantity // Quantity for this specific batch
            });
          }
        }
      });
    });
    return productsNearingExpiryList;
  }, [productsWithCalculatedStock, getStockByBatch]);

  // --- Analytics Calculations ---

  const monthlyTrends = useMemo(() => {
    console.log("Dashboard useMemo: Calculating monthly sales and purchase trends...");
    const salesByMonth = new Map(); // Key: YYYY-MM, Value: total sales amount
    const purchasesByMonth = new Map(); // Key: YYYY-MM, Value: total purchase amount

    salesBills.forEach(bill => {
      const date = parseDate(bill.saleDate);
      if (date) {
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        salesByMonth.set(monthYear, (salesByMonth.get(monthYear) || 0) + Number(bill.grandTotal));
      }
    });

    purchaseBills.forEach(bill => {
      const date = parseDate(bill.date);
      if (date) {
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        purchasesByMonth.set(monthYear, (purchasesByMonth.get(monthYear) || 0) + Number(bill.totalAmount));
      }
    });

    const allMonths = new Set([...Array.from(salesByMonth.keys()), ...Array.from(purchasesByMonth.keys())]);
    const sortedMonths = Array.from(allMonths).sort();

    return sortedMonths.map(month => ({
      month,
      totalSales: salesByMonth.get(month) || 0,
      totalPurchase: purchasesByMonth.get(month) || 0,
    }));
  }, [salesBills, purchaseBills]);

  const productAnalytics = useMemo(() => {
    console.log("Dashboard useMemo: Calculating product-wise analytics...");
    const productData = new Map(); // Key: productName, Value: { totalSoldQuantity, totalPurchasedQuantity, totalSalesValue, totalPurchaseValue }

    // Aggregate sales data
    salesBills.forEach(bill => {
      bill.items.forEach(item => {
        const name = item.productName.toLowerCase();
        if (!productData.has(name)) {
          productData.set(name, {
            totalSoldQuantity: 0,
            totalPurchasedQuantity: 0,
            totalSalesValue: 0,
            totalPurchaseValue: 0,
            productName: item.productName // Keep original case for display
          });
        }
        const current = productData.get(name);
        current.totalSoldQuantity += Number(item.quantity);
        current.totalSalesValue += Number(item.itemTotal);
        productData.set(name, current);
      });
    });

    // Aggregate purchase data
    purchaseBills.forEach(bill => {
      bill.items.forEach(item => {
        const name = item.product.toLowerCase();
        if (!productData.has(name)) {
          productData.set(name, {
            totalSoldQuantity: 0,
            totalPurchasedQuantity: 0,
            totalSalesValue: 0,
            totalPurchaseValue: 0,
            productName: item.product // Keep original case for display
          });
        }
        const current = productData.get(name);
        current.totalPurchasedQuantity += Number(item.quantity);
        current.totalPurchaseValue += Number(item.totalItemAmount);
        productData.set(name, current);
      });
    });

    return Array.from(productData.values()).sort((a, b) => b.totalSoldQuantity - a.totalSoldQuantity); // Sort by most sold
  }, [salesBills, purchaseBills]);

  const mostSoldProduct = useMemo(() => {
    console.log("Dashboard useMemo: Identifying most sold product...");
    if (productAnalytics.length === 0) return null;
    return productAnalytics[0]; // Already sorted by totalSoldQuantity
  }, [productAnalytics]);


  // --- UI Handlers ---

  const toggleRowExpansion = (productId) => {
    console.log(`Toggling expansion for product ID: ${productId}`);
    setExpandedRow(expandedRow === productId ? null : productId);
  };

  // Function to get purchase history for a specific product
  const getPurchaseHistory = (productName) => {
    const history = [];
    purchaseBills.forEach((bill) => {
      bill.items.forEach((item) => {
        if (item.product.toLowerCase() === productName.toLowerCase()) {
          history.push({
            billNumber: bill.billNumber,
            date: bill.date,
            supplier: bill.supplierName,
            batch: item.batch,
            expiry: item.expiry,
            quantity: item.quantity,
            ptr: item.ptr,
            itemsPerPack: item.itemsPerPack,
            mrp: Number(item.mrp), // Ensure number
            originalMrp: Number(item.originalMrp), // Ensure number
            discount: item.discount,
            totalItemAmount: item.totalItemAmount,
          });
        }
      });
    });
    // Sort history by date, newest first
    history.sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB - dateA;
    });
    return history;
  };

  // Function to get sales history for a specific product
  const getSalesHistory = (productName) => {
    const history = [];
    salesBills.forEach((bill) => {
      bill.items.forEach((item) => {
        // Use 'productName' from sales item
        if (item.productName.toLowerCase() === productName.toLowerCase()) {
          history.push({
            // Use 'saleDate' from sales bill
            billNumber: bill.id, // SalesPage uses 'id' as bill identifier
            date: bill.saleDate, // Use saleDate from SalesPage
            customer: bill.customerName,
            batch: item.batch,
            expiry: item.expiry,
            quantity: Number(item.quantity), // Use 'quantity' from sales item
            salePrice: Number(item.salePrice), // Use 'salePrice' from sales item
            discount: Number(item.discount),
            itemTotal: Number(item.itemTotal), // Use 'itemTotal' from sales item
            mrp: Number(item.mrp), // MRP from SalesPage item
            // productItemsPerPack: Number(item.productItemsPerPack), // Not directly from SalesPage item
            // purchasedMrp: Number(item.purchasedMrp), // Not directly from SalesPage item
          });
        }
      });
    });
    // Sort history by date, newest first
    history.sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB - dateA;
    });
    return history;
  };

  // Helper function to convert data to CSV format
  const convertToCSV = (data, headers) => {
    const csvRows = [];
    csvRows.push(headers.join(',')); // Add header row

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header] || '';
        // Handle nested objects for purchase/sales items if needed, or flatten beforehand
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`; // Escape double quotes
        }
        return value;
      });
      csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  };

  // Function to download CSV
  const downloadCSV = (data, filename) => {
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // feature detection
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Function to trigger data export
  const handleExportData = () => {
    if (productsWithCalculatedStock.length === 0 && purchaseBills.length === 0 && salesBills.length === 0) {
      toast.info("No data to export.");
      return;
    }

    // Export Products
    if (productsWithCalculatedStock.length > 0) {
      const productHeaders = [
        'id', 'name', 'quantity', 'mrp', 'originalMrp', 'itemsPerPack',
        'minStock', 'maxStock', 'discount', 'unit', 'category', 'company',
        'batch', 'expiry'
      ];
      // Use productsWithCalculatedStock for export to reflect current calculated quantity
      const productCSV = convertToCSV(productsWithCalculatedStock, productHeaders);
      downloadCSV(productCSV, 'products_export.csv');
      toast.success("Product data exported successfully!");
    } else {
      toast.info("No product data to export.");
    }

    // Export Purchase Bills
    if (purchaseBills.length > 0) {
      // Flatten purchase bill data for CSV export
      const flattenedPurchaseData = [];
      purchaseBills.forEach(bill => {
        bill.items.forEach(item => {
          flattenedPurchaseData.push({
            billNumber: bill.billNumber,
            date: bill.date,
            supplierName: bill.supplierName,
            totalAmount: bill.totalAmount,
            product: item.product,
            batch: item.batch,
            expiry: item.expiry,
            quantity: item.quantity,
            packsPurchased: item.packsPurchased,
            itemsPerPack: item.itemsPerPack,
            ptr: item.ptr,
            mrp: item.mrp,
            originalMrp: item.originalMrp,
            unit: item.unit,
            category: item.category,
            company: item.company,
            discount: item.discount,
            taxRate: item.taxRate,
            totalItemAmount: item.totalItemAmount,
          });
        });
      });

      const purchaseHeaders = [
        'billNumber', 'date', 'supplierName', 'totalAmount', 'product', 'batch',
        'expiry', 'quantity', 'packsPurchased', 'itemsPerPack', 'ptr', 'mrp',
        'originalMrp', 'unit', 'category', 'company', 'discount', 'taxRate',
        'totalItemAmount'
      ];
      const purchaseCSV = convertToCSV(flattenedPurchaseData, purchaseHeaders);
      downloadCSV(purchaseCSV, 'purchase_bills_export.csv');
      toast.success("Purchase bill data exported successfully!");
    } else {
      toast.info("No purchase bill data to export.");
    }

    // Export Sales Bills
    if (salesBills.length > 0) {
      // Flatten sales bill data for CSV export
      const flattenedSalesData = [];
      salesBills.forEach(bill => {
        bill.items.forEach(item => {
          flattenedSalesData.push({
            billId: bill.id, // Use 'id' from SalesPage as bill ID
            saleDate: bill.saleDate, // Use 'saleDate' from SalesPage
            customerName: bill.customerName,
            grandTotal: bill.grandTotal, // Use 'grandTotal' from SalesPage
            productName: item.productName, // Use 'productName' from SalesPage item
            quantity: item.quantity, // Use 'quantity' from SalesPage item
            salePrice: item.salePrice, // Use 'salePrice' from SalesPage item
            discount: item.discount,
            itemTotal: item.itemTotal, // Use 'itemTotal' from SalesPage item
            mrp: item.mrp, // MRP from SalesPage item
            batch: item.batch,
            expiry: item.expiry,
            unit: item.unit,
            category: item.category,
          });
        });
      });

      const salesHeaders = [
        'billId', 'saleDate', 'customerName', 'grandTotal', 'productName',
        'quantity', 'salePrice', 'discount', 'itemTotal',
        'mrp', 'batch', 'expiry', 'unit', 'category'
      ];
      const salesCSV = convertToCSV(flattenedSalesData, salesHeaders);
      downloadCSV(salesCSV, 'sales_bills_export.csv');
      toast.success("Sales bill data exported successfully!");
    } else {
      toast.info("No sales bill data to export.");
    }
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="loader"></div>
        <p className="ml-4 text-gray-700">Loading data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  // Render logic starts here
  return (
    <div>
      <Header />
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 bg-gray-100 rounded-lg shadow-inner fade-in">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
          <div className="flex space-x-3">
            <Link href="/productmaster" passHref>
              <Button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200">
                Product Master
              </Button>
            </Link>
            <Link href="/purchase" passHref>
              <Button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200">
                New Purchase
              </Button>
            </Link>
            <Link href="/sales" passHref>
              <Button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200">
                New Sale
              </Button>
            </Link>
            {/* Export Button */}
            <Button
              onClick={handleExportData}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
            >
              <Download className="mr-2 h-4 w-4" /> Export Data
            </Button>
            {/* Analytics Button */}
            <Button
                onClick={() => setIsAnalyticsModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors duration-200"
            >
                <BarChartIcon className="mr-2 h-4 w-4" /> View Analytics
            </Button>
          </div>
        </div>

        {/* Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Stock Value */}
          <TotalSummary
            title="Total Stock Value (Current MRP)"
            value={`₹${totalStockValue.toFixed(2)}`}
            description="Value of current inventory based on latest Master MRP"
            bgColor="bg-blue-500"
          />
          <TotalSummary
            title="Total Purchase Value"
            value={`₹${totalPurchaseValue.toFixed(2)}`}
            description="Total value of all recorded purchases"
            bgColor="bg-green-500"
          />
          <TotalSummary
            title="Total Sales Value"
            value={`₹${totalSalesValue.toFixed(2)}`}
            description="Total value of all recorded sales"
            bgColor="bg-purple-500"
          />
        </div>

        {/* Product Stock List */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-8">
          <h3 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-3 border-gray-200">
            Product Stock Overview
          </h3>
          <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Product Name
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Current Stock (Items)
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Unit
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Company
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Current Master MRP/Pack
                  </th>
                   <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Original Purchased MRP/Pack
                  </th> {/* NEW column header */}
                  <th
                    scope="col"
                    className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="relative px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    <span className="sr-only">Expand</span>
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productsWithCalculatedStock.length > 0 ? (
                  productsWithCalculatedStock.map((product) => (
                    <React.Fragment key={product.id}>
                      {/* Main Product Row */}
                      <tr
                        className={`hover:bg-gray-100 transition duration-100 ease-in-out ${
                          expandedRow === product.id ? "bg-indigo-50" : ""
                        }`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                          {product.name}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                          {product.quantity}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                          {product.unit}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                          {product.category}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                          {product.company}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                          ₹{Number(product.mrp).toFixed(2)}
                        </td>
                         <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                          {product.originalMrp > 0 ? `₹${Number(product.originalMrp).toFixed(2)}` : '-'} {/* Display Original Purchased MRP */}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-center text-sm font-semibold">
                          {product.quantity === 0 ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              Out of Stock
                            </span>
                          ) : product.quantity <= product.minStock ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-center text-sm font-medium">
                          <Button
                            size="sm"
                            onClick={() => toggleRowExpansion(product.id)}
                            className="p-1 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors duration-200"
                            title={
                              expandedRow === product.id
                                ? "Collapse Details"
                                : "Expand Details"
                            }
                          >
                            {expandedRow === product.id ? (
                              <ChevronUp className="h-4 w-4 text-gray-700" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-700" />
                            )}
                          </Button>
                        </td>
                      </tr>
                      {/* Expandable Content Row */}
                      {/* Apply dynamic max-height based on expandedRow state */}
                      <tr className={`${expandedRow === product.id ? 'bg-indigo-50' : 'hidden'}`}>
                          <td colSpan="9" className="p-4">
                            {" "}
                            {/* Adjusted colspan */}
                            <div className={`expandable-content ${expandedRow === product.id ? 'expanded' : ''}`}>
                              {/* Batch Stock Details */}
                              <div className="mb-6">
                                <h4 className="text-md font-semibold text-gray-800 mb-2">
                                  Stock by Batch:
                                </h4>
                                <div className="overflow-x-auto border border-gray-300 rounded-md shadow-sm">
                                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Batch No.
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Expiry (MM-YY)
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Current Stock (Items)
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {getStockByBatch(product.name).length >
                                      0 ? (
                                        getStockByBatch(product.name).map(
                                          (batch, batchIndex) => (
                                            <tr
                                              key={batchIndex}
                                              className="hover:bg-gray-50"
                                            >
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {batch.batch}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {batch.expiry}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {batch.quantity}
                                              </td>
                                            </tr>
                                          )
                                        )
                                      ) : (
                                        <tr>
                                          <td
                                            colSpan="3"
                                            className="px-3 py-2 text-center text-sm text-gray-500"
                                          >
                                            No stock details by batch available.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Purchase History */}
                              <div className="mb-6">
                                <h4 className="text-md font-semibold text-gray-800 mb-2">
                                  Purchase History:
                                </h4>
                                <div className="overflow-x-auto border border-gray-300 rounded-md shadow-sm">
                                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Bill No
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Date
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Supplier
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Batch
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Expiry
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Qty (Items)
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          PTR/Pack
                                        </th>
                                         <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Entered MRP/Pack
                                        </th> {/* Display Entered MRP from Purchase */}
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Original Master MRP/Pack
                                        </th> {/* Display Original Master MRP from Purchase */}
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Discount (%)
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Item Total
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {getPurchaseHistory(product.name).length >
                                      0 ? (
                                        getPurchaseHistory(product.name).map(
                                          (purchase, purchaseIndex) => (
                                            <tr
                                              key={purchaseIndex}
                                              className="hover:bg-gray-50"
                                            >
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {purchase.billNumber}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {purchase.date}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {purchase.supplier}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {purchase.batch}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {purchase.expiry}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {purchase.quantity}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                ₹{Number(purchase.ptr).toFixed(2)}
                                              </td>
                                               <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                ₹{Number(purchase.mrp).toFixed(2)}
                                              </td> {/* Display Entered MRP from Purchase */}
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {purchase.originalMrp > 0 ? `₹${Number(purchase.originalMrp).toFixed(2)}` : '-'} {/* Display Original Master MRP from Purchase */}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {Number(purchase.discount).toFixed(2)}%
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                ₹{Number(purchase.totalItemAmount).toFixed(2)}
                                              </td>
                                            </tr>
                                          )
                                        )
                                      ) : (
                                        <tr>
                                          <td
                                            colSpan="11" /* Adjusted colspan */
                                            className="px-3 py-2 text-center text-sm text-gray-500"
                                          >
                                            No purchase history found for this
                                            product.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Sales History */}
                              <div>
                                <h4 className="text-md font-semibold text-gray-800 mb-2">
                                  Sales History:
                                </h4>
                                <div className="overflow-x-auto border border-gray-300 rounded-md shadow-sm">
                                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Bill No
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Date
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Customer
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Batch
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Expiry
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Qty Sold (Items)
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Price/Item
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Discount (%)
                                        </th>
                                         <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Sale MRP/Pack
                                        </th> {/* Display MRP used for this sale */}
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Purchased MRP/Pack
                                        </th> {/* Display Purchased MRP */}
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Item Total
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {getSalesHistory(product.name).length >
                                      0 ? (
                                        getSalesHistory(product.name).map(
                                          (sale, saleIndex) => (
                                            <tr
                                              key={saleIndex}
                                              className="hover:bg-gray-50"
                                            >
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {sale.billNumber}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {sale.date}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {sale.customer}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {sale.batch}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {sale.expiry}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {sale.quantity}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                ₹{Number(sale.salePrice).toFixed(2)}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {Number(sale.discount).toFixed(2)}%
                                              </td>
                                               <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                ₹{Number(sale.mrp).toFixed(2)}
                                              </td> {/* Display Sale MRP */}
                                               <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {sale.purchasedMrp > 0 ? `₹${Number(sale.purchasedMrp).toFixed(2)}` : '-'} {/* Display Purchased MRP */}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                ₹{Number(sale.itemTotal).toFixed(2)}
                                              </td>
                                            </tr>
                                          )
                                        )
                                      ) : (
                                        <tr>
                                          <td
                                            colSpan="11" /* Adjusted colspan */
                                            className="px-3 py-2 text-center text-sm text-gray-500"
                                          >
                                            No sales history found for this
                                            product.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="9" /* Adjusted colspan */
                      className="px-3 py-4 text-center text-sm text-gray-500"
                    >
                      No products found in the master list.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        

        {/* Low Stock and Out of Stock Alerts */}
        {(lowStockProducts.length > 0 || outOfStockProducts.length > 0 || nearExpiryProducts.length > 0) && (
          <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold text-yellow-800 mb-4 flex items-center">
              <AlertTriangle className="h-6 w-6 mr-3 text-yellow-600" /> Stock
              Alerts
            </h3>
            {outOfStockProducts.length > 0 && (
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-red-700 mb-2">
                  Out of Stock Products:
                </h4>
                <ul className="list-disc list-inside text-red-600">
                  {outOfStockProducts.map((product) => (
                    <li key={product.id}>
                      {product.name} (Batch: {product.batch || 'N/A'}, Expiry:{" "}
                      {product.expiry || 'N/A'})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lowStockProducts.length > 0 && (
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-yellow-700 mb-2">
                  Low Stock Products:
                </h4>
                <ul className="list-disc list-inside text-yellow-600">
                  {lowStockProducts.map((product) => (
                    <li key={product.id}>
                      {product.name} (Current Stock: {product.quantity})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {nearExpiryProducts.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-orange-700 mb-2">
                  Products Nearing Expiry (Next 2 Months):
                </h4>
                <ul className="list-disc list-inside text-orange-600">
                  {nearExpiryProducts.map((product) => (
                    <li key={product.id}>
                      {product.name} (Batch: {product.batch || 'N/A'}, Expiry:{" "}
                      {product.expiry || 'N/A'}, Current Stock: {product.quantity})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Analytics Modal */}
      {isAnalyticsModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 fade-in-backdrop">
          <div className="bg-white p-6 rounded-lg shadow-xl w-11/12 md:w-3/4 lg:w-2/3 max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-2xl font-bold text-gray-800">Business Analytics</h3>
              <Button
                onClick={() => setIsAnalyticsModalOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </Button>
            </div>

            {/* Monthly Trends */}
            <div className="mb-6">
              <h4 className="text-xl font-semibold text-gray-800 mb-3">Monthly Sales & Purchase Trends</h4>
              {monthlyTrends.length > 0 ? (
                <div className="h-80 w-full"> {/* Added height for chart */}
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={monthlyTrends}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => `₹${value.toFixed(2)}`} />
                      <Legend />
                      <Line type="monotone" dataKey="totalSales" stroke="#8884d8" activeDot={{ r: 8 }} name="Total Sales" />
                      <Line type="monotone" dataKey="totalPurchase" stroke="#82ca9d" name="Total Purchase" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No monthly sales or purchase data available for charting.</p>
              )}
            </div>

            {/* Most Demanded Product */}
            <div className="mb-6">
              <h4 className="text-xl font-semibold text-gray-800 mb-3">Most Demanded Product</h4>
              {mostSoldProduct ? (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-lg font-bold text-blue-800">{mostSoldProduct.productName}</p>
                  <p className="text-sm text-blue-700">Total Units Sold: <span className="font-semibold">{mostSoldProduct.totalSoldQuantity}</span></p>
                  <p className="text-sm text-blue-700">Total Sales Value: <span className="font-semibold">₹{mostSoldProduct.totalSalesValue.toFixed(2)}</span></p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No sales data to determine most demanded product.</p>
              )}
            </div>

            {/* Product-wise Sales & Purchase Overview (Table and Bar Chart) */}
            <div>
              <h4 className="text-xl font-semibold text-gray-800 mb-3">Product-wise Sales & Purchase Overview</h4>
              {productAnalytics.length > 0 ? (
                <>
                  <div className="h-80 w-full mb-6"> {/* Added height for chart */}
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={productAnalytics.slice(0, 10)} // Show top 10 products
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="productName" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip formatter={(value) => `₹${value.toFixed(2)}`} />
                        <Legend />
                        <Bar dataKey="totalSalesValue" fill="#8884d8" name="Total Sales Value" />
                        <Bar dataKey="totalPurchaseValue" fill="#82ca9d" name="Total Purchase Value" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sold (Units)</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales Value</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Purchased (Units)</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Purchase Value</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {productAnalytics.map((data, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{data.productName}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{data.totalSoldQuantity}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">₹{data.totalSalesValue.toFixed(2)}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{data.totalPurchasedQuantity}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">₹{data.totalPurchaseValue.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">No product-wise sales or purchase data available.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* Loader styles */
        .loader {
          border: 4px solid #f3f3f3; /* Light grey */
          border-top: 4px solid #3498db; /* Blue */
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        /* Fade-in animation for the main content */
        .fade-in {
          animation: fadeIn 0.5s ease-out forwards;
          opacity: 0; /* Start invisible */
        }

        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(20px);
          } /* Optional: slight slide up */
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Slide animation for expandable row content */
        .expandable-content {
          overflow: hidden; /* Hide content when collapsed */
          transition: max-height 0.3s ease-out; /* Smooth transition */
          max-height: 0; /* Start collapsed */
        }

        /* This class is applied by React when the row is expanded */
        tr.bg-indigo-50 + tr .expandable-content {
          /* A large enough value to accommodate the content */
          max-height: 1000px;
        }

        /* Modal specific styles */
        .fade-in-backdrop {
            animation: fadeInBackdrop 0.3s ease-out forwards;
            opacity: 0;
        }
        @keyframes fadeInBackdrop {
            0% { opacity: 0; }
            100% { opacity: 1; }
        }

        .animate-scale-in {
            animation: scaleIn 0.3s ease-out forwards;
        }
        @keyframes scaleIn {
            0% { transform: scale(0.95); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
