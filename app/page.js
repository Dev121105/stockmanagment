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

// Import Firebase services
import { db, auth, initializeFirebaseAndAuth } from './lib/firebase';
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Import the new Login component

import LogoutButton from './components/LogoutButton'; // Or integrate Logout directly into Header

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
      // Date constructor: new Date(year, monthIndex, day)
      // monthIndex is 0-indexed, so monthInt is already correct for monthIndex
      // Day 0 of the next month gives the last day of the current month.
      return new Date(yearInt, monthInt, 0); 
    }
  }

  return null; // Default to null if parsing fails
}

export default function Home() {
  // Very early log to confirm component mounts
  console.log("Home component mounted/rendered.");

  const [products, setProducts] = useState([]); // This will hold product master data
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [salesBills, setSalesBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null); // State to track expanded row
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false); // State for analytics modal

  // Auth related states
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Get the app ID, with a fallback for environments where it might not be defined
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';


  // --- Initial Firebase Setup and Authentication Listener ---
  useEffect(() => {
    console.log("useEffect: Setting up Firebase and Auth listener.");
    const setupFirebase = async () => {
      await initializeFirebaseAndAuth(); // Initialize Firebase and sign in

      // Set up auth state observer
      const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user); // Set the user object
        setIsAuthReady(true); // Auth state has been determined
        setLoading(false); // Stop loading after auth state is determined
        console.log("Firebase: Auth state changed. User:", user ? user.uid : "No user");
      });

      return () => {
        console.log("useEffect cleanup: Unsubscribing auth listener.");
        unsubscribeAuth(); // Clean up auth listener on unmount
      };
    };

    setupFirebase();
  }, []);

  // --- Data Loading Functions (dependent on currentUser) ---
  useEffect(() => {
    if (!isAuthReady || !currentUser) {
      console.log("useEffect (data load): Not loading data. isAuthReady:", isAuthReady, "currentUser:", currentUser);
      // If auth is not ready or no user is logged in, don't attempt to load data
      setProducts([]);
      setPurchaseBills([]);
      setSalesBills([]);
      return;
    }

    console.log("useEffect (data load): User authenticated, setting up Firestore listeners for data.");

    // Load Products Data
    const productsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUser.uid}/products`);
    const unsubscribeProducts = onSnapshot(productsCollectionRef, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const processedProducts = productsData
        .map((p) => {
          try {
            // Expiry Data Check: Product Master
            console.log(`Expiry Data Check: Product '${p.name}' - Raw Expiry: '${p.expiry}'`);
            return {
              ...p,
              mrp: Number(p.mrp) || 0,
              originalMrp: Number(p.originalMrp) || 0,
              itemsPerPack: Number(p.itemsPerPack) || 1,
              minStock: Number(p.minStock) || 0,
              maxStock: Number(p.maxStock) || 0,
              discount: Number(p.discount) || 0,
              name: p.name || "",
              unit: p.unit || "",
              category: p.category || "",
              company: p.company || "",
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
      setProducts(processedProducts);
      console.log("Firestore: Products data loaded for user", currentUser.uid);
    }, (error) => {
      console.error("Firestore Products Error:", error);
      setError("Error loading product data from cloud.");
      toast.error("Error loading product data.");
    });

    // Load Purchase Bills Data
    const purchaseBillsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUser.uid}/purchaseBills`);
    const unsubscribePurchaseBills = onSnapshot(purchaseBillsCollectionRef, (snapshot) => {
      const billsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const processedBills = billsData
        .map((bill) => {
          try {
            bill.items.forEach(item => {
              // Expiry Data Check: Purchase Bill Item
              console.log(`Expiry Data Check: Purchase Bill ${bill.billNumber}, Product '${item.product}' - Raw Expiry: '${item.expiry}'`);
            });
            return {
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
                mrp: Number(item.mrp) || 0,
                originalMrp: Number(item.originalMrp) || 0,
                unit: item.unit || "",
                category: item.category || "",
                company: item.company || "",
                discount: Number(item.discount) || 0,
                taxRate: Number(item.taxRate) || 0,
                totalItemAmount: Number(item.totalItemAmount) || 0,
              })),
              totalAmount: Number(bill.totalAmount) || 0,
            };
          } catch (mapErr) {
            console.error(
              "Dashboard: Error processing purchase bill item during map:",
              bill,
              mapErr
            );
            return null;
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
      console.log("Firestore: Purchase bills data loaded for user", currentUser.uid);
    }, (error) => {
      console.error("Firestore Purchase Bills Error:", error);
      setError("Error loading purchase bill data from cloud.");
      toast.error("Error loading purchase bill data.");
    });

    // Load Sales Bills Data
    const salesCollectionRef = collection(db, `artifacts/${appId}/users/${currentUser.uid}/sales`);
    const unsubscribeSales = onSnapshot(salesCollectionRef, (snapshot) => {
      const billsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const processedBills = billsData
        .map((bill) => {
          try {
            bill.items.forEach(item => {
              // Expiry Data Check: Sales Bill Item
              console.log(`Expiry Data Check: Sales Bill ${bill.id}, Product '${item.productName}' - Raw Expiry: '${item.expiry}'`);
            });
            return {
              ...bill,
              saleDate: bill.saleDate || "",
              grandTotal: Number(bill.grandTotal) || 0,
              customerName: bill.customerName || "",
              items: bill.items.map((item) => ({
                ...item,
                quantity: Number(item.quantity) || 0,
                salePrice: Number(item.salePrice) || 0,
                discount: Number(item.discount) || 0,
                itemTotal: Number(item.itemTotal) || 0,
                mrp: Number(item.mrp) || 0,
                productName: item.productName || "",
                batch: item.batch || "",
                expiry: item.expiry || "",
                unit: item.unit || "",
                category: item.category || "",
              })),
            };
          } catch (mapErr) {
            console.error(
              "Dashboard: Error processing sales bill item during map:",
              bill,
              mapErr
            );
            return null;
          }
        })
        .filter((bill) => bill !== null);

      processedBills.sort((a, b) => {
        const dateA = parseDate(a.saleDate);
        const dateB = parseDate(b.saleDate);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB - dateA;
      });
      setSalesBills(processedBills);
      console.log("Firestore: Sales bills data loaded for user", currentUser.uid);
    }, (error) => {
      console.error("Firestore Sales Bills Error:", error);
      setError("Error loading sales bill data.");
      toast.error("Error loading sales bill data.");
    });

    return () => {
      console.log("useEffect cleanup (data load): Unsubscribing Firestore listeners.");
      unsubscribeProducts();
      unsubscribePurchaseBills();
      unsubscribeSales();
    };
  }, [isAuthReady, currentUser, appId]);


  // --- Data update event listener (still useful for other pages to trigger re-renders) ---
  // This listener will now cause the Firestore onSnapshot listeners to re-evaluate,
  // effectively reloading data if underlying data changes (e.g., from other tabs).
  useEffect(() => {
    const handleDataUpdated = () => {
      console.log("Dashboard: Data updated event received. Firestore listeners will handle reload.");
      // The onSnapshot listeners above will automatically update state when data changes in Firestore.
      // No explicit load functions needed here anymore, just a log for awareness.
    };

    window.addEventListener("productsUpdated", handleDataUpdated);
    window.addEventListener("purchaseBillsUpdated", handleDataUpdated);
    window.addEventListener("salesUpdated", handleDataUpdated);

    return () => {
      window.removeEventListener("productsUpdated", handleDataUpdated);
      window.removeEventListener("purchaseBillsUpdated", handleDataUpdated);
      window.removeEventListener("salesUpdated", handleDataUpdated);
    };
  }, []); // Empty dependency array as it just sets up the listeners

  // Function to calculate stock by batch for a product
  const getStockByBatch = useCallback((productName) => {
    const batchMap = new Map(); // Key: batch_expiry, Value: quantity

    // Add quantities from purchase bills
    purchaseBills.forEach((bill) => {
      bill.items.forEach((item) => {
        if (item.product.toLowerCase() === productName.toLowerCase()) {
          const key = `${item.batch.trim()}_${item.expiry.trim()}`;
          // Expiry Data Check: getStockByBatch (Purchase)
          console.log(`Expiry Data Check: getStockByBatch (Purchase) - Product: '${productName}', Batch Key: '${key}', Raw Expiry: '${item.expiry}'`);
          batchMap.set(key, (batchMap.get(key) || 0) + Number(item.quantity));
        }
      });
    });

    // Subtract quantities from sales bills
    salesBills.forEach((bill) => {
      bill.items.forEach((item) => {
        if (item.productName.toLowerCase() === productName.toLowerCase()) {
          const key = `${item.batch.trim()}_${item.expiry.trim()}`;
          // Expiry Data Check: getStockByBatch (Sales)
          console.log(`Expiry Data Check: getStockByBatch (Sales) - Product: '${productName}', Batch Key: '${key}', Raw Expiry: '${item.expiry}'`);
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
      const dateA = parseDate(a.expiry);
      const dateB = parseDate(b.expiry);
      // Expiry Data Check: getStockByBatch (Sorting)
      console.log(`Expiry Data Check: getStockByBatch (Sorting) - A.expiry: '${a.expiry}', B.expiry: '${b.expiry}', Parsed A: ${dateA}, Parsed B: ${dateB}`);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA - dateB; // Sort by oldest expiry first
    });

    return batchStockList;
  }, [purchaseBills, salesBills]);

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

  const totalPurchaseValue = useMemo(() => {
    console.log("Dashboard useMemo: Calculating total purchase value...");
    return purchaseBills.reduce(
      (total, bill) => total + (Number(bill.totalAmount) || 0),
      0
    );
  }, [purchaseBills]);

  const totalSalesValue = useMemo(() => {
    console.log("Dashboard useMemo: Calculating total sales value...");
    return salesBills.reduce(
      (total, bill) => total + (Number(bill.grandTotal) || 0),
      0
    );
  }, [salesBills]);

  const nearExpiryProducts = useMemo(() => {
    console.log("Dashboard useMemo: Calculating near expiry products...");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const twoMonthsLater = new Date();
    // Corrected calculation: Set to the month *three* months from now, then set day to 0
    // to get the last day of the month that is two months from 'today'.
    twoMonthsLater.setMonth(today.getMonth() + 3);
    twoMonthsLater.setDate(0); 
    twoMonthsLater.setHours(23, 59, 59, 999);

    console.log(`Expiry Date Range Check: Today: ${today.toDateString()}, Two Months Later (end of month): ${twoMonthsLater.toDateString()}`);

    const productsNearingExpiryList = [];

    productsWithCalculatedStock.forEach(product => {
      const batchStocks = getStockByBatch(product.name);

      batchStocks.forEach(batch => {
        const productExpiryDate = parseDate(batch.expiry);
        // Expiry Data Check: nearExpiryProducts (Processing)
        console.log(`Expiry Data Check: nearExpiryProducts - Product: '${product.name}', Batch: '${batch.batch}', Raw Expiry: '${batch.expiry}', Parsed Date: ${productExpiryDate}`);
        
        const isNearExpiry = productExpiryDate && batch.quantity > 0 &&
                             productExpiryDate > today && productExpiryDate <= twoMonthsLater;
        
        console.log(`Expiry Data Check: nearExpiryProducts - Condition check for '${product.name}' (Batch: '${batch.batch}', Expiry: '${batch.expiry}'):`);
        console.log(`  - Parsed Date valid: ${!!productExpiryDate}`);
        console.log(`  - Quantity > 0: ${batch.quantity > 0}`);
        console.log(`  - Expiry > Today: ${productExpiryDate > today}`);
        console.log(`  - Expiry <= Two Months Later: ${productExpiryDate <= twoMonthsLater}`);
        console.log(`  - Overall isNearExpiry: ${isNearExpiry}`);

        if (isNearExpiry) {
          productsNearingExpiryList.push({
            id: product.id,
            name: product.name,
            batch: batch.batch,
            expiry: batch.expiry,
            quantity: batch.quantity
          });
        }
      });
    });
    console.log("Final nearExpiryProducts list:", productsNearingExpiryList);
    return productsNearingExpiryList;
  }, [productsWithCalculatedStock, getStockByBatch]);

  // --- Analytics Calculations ---
  const monthlyTrends = useMemo(() => {
    console.log("Dashboard useMemo: Calculating monthly sales and purchase trends...");
    const salesByMonth = new Map();
    const purchasesByMonth = new Map();

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
    const productData = new Map();

    salesBills.forEach(bill => {
      bill.items.forEach(item => {
        const name = item.productName.toLowerCase();
        if (!productData.has(name)) {
          productData.set(name, {
            totalSoldQuantity: 0,
            totalPurchasedQuantity: 0,
            totalSalesValue: 0,
            totalPurchaseValue: 0,
            productName: item.productName
          });
        }
        const current = productData.get(name);
        current.totalSoldQuantity += Number(item.quantity);
        current.totalSalesValue += Number(item.itemTotal);
        productData.set(name, current);
      });
    });

    purchaseBills.forEach(bill => {
      bill.items.forEach(item => {
        const name = item.product.toLowerCase();
        if (!productData.has(name)) {
          productData.set(name, {
            totalSoldQuantity: 0,
            totalPurchasedQuantity: 0,
            totalSalesValue: 0,
            totalPurchaseValue: 0,
            productName: item.product
          });
        }
        const current = productData.get(name);
        current.totalPurchasedQuantity += Number(item.quantity);
        current.totalPurchaseValue += Number(item.totalItemAmount);
        productData.set(name, current);
      });
    });

    return Array.from(productData.values()).sort((a, b) => b.totalSoldQuantity - a.totalSoldQuantity);
  }, [salesBills, purchaseBills]);

  const mostSoldProduct = useMemo(() => {
    console.log("Dashboard useMemo: Identifying most sold product...");
    if (productAnalytics.length === 0) return null;
    return productAnalytics[0];
  }, [productAnalytics]);


  // --- UI Handlers ---
  const toggleRowExpansion = (productId) => {
    console.log(`Toggling expansion for product ID: ${productId}`);
    setExpandedRow(expandedRow === productId ? null : productId);
  };

  const getPurchaseHistory = (productName) => {
    const history = [];
    purchaseBills.forEach((bill) => {
      bill.items.forEach((item) => {
        if (item.product.toLowerCase() === productName.toLowerCase()) {
          // Expiry Data Check: Purchase History Item
          console.log(`Expiry Data Check: Purchase History - Product: '${productName}', Bill: '${bill.billNumber}', Raw Expiry: '${item.expiry}'`);
          history.push({
            billNumber: bill.billNumber,
            date: bill.date,
            supplier: bill.supplierName,
            batch: item.batch,
            expiry: item.expiry,
            quantity: item.quantity,
            ptr: item.ptr,
            itemsPerPack: item.itemsPerPack,
            mrp: Number(item.mrp),
            originalMrp: Number(item.originalMrp),
            discount: Number(item.discount),
            totalItemAmount: Number(item.totalItemAmount),
          });
        }
      });
    });
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

  const getSalesHistory = (productName) => {
    const history = [];
    salesBills.forEach((bill) => {
      bill.items.forEach((item) => {
        if (item.productName.toLowerCase() === productName.toLowerCase()) {
          // Expiry Data Check: Sales History Item
          console.log(`Expiry Data Check: Sales History - Product: '${productName}', Bill: '${bill.id}', Raw Expiry: '${item.expiry}'`);
          history.push({
            billNumber: bill.id,
            date: bill.saleDate,
            customer: bill.customerName,
            batch: item.batch,
            expiry: item.expiry,
            quantity: Number(item.quantity),
            salePrice: Number(item.salePrice),
            discount: Number(item.discount),
            itemTotal: Number(item.itemTotal),
            mrp: Number(item.mrp),
          });
        }
      });
    });
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

  const convertToCSV = (data, headers) => {
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header] || '';
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  };

  const downloadCSV = (data, filename) => {
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExportData = () => {
    console.log("Attempting to export data..."); // Added for debugging
    if (productsWithCalculatedStock.length === 0 && purchaseBills.length === 0 && salesBills.length === 0) {
      toast.info("No data to export.");
      return;
    }

    if (productsWithCalculatedStock.length > 0) {
      const productHeaders = [
        'id', 'name', 'quantity', 'mrp', 'originalMrp', 'itemsPerPack',
        'minStock', 'maxStock', 'discount', 'unit', 'category', 'company',
        'batch', 'expiry'
      ];
      const productCSV = convertToCSV(productsWithCalculatedStock, productHeaders);
      downloadCSV(productCSV, 'products_export.csv');
      toast.success("Product data exported successfully!");
    } else {
      toast.info("No product data to export.");
    }

    if (purchaseBills.length > 0) {
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

    if (salesBills.length > 0) {
      const flattenedSalesData = [];
      salesBills.forEach(bill => {
        bill.items.forEach(item => {
          flattenedSalesData.push({
            billId: bill.id,
            saleDate: bill.saleDate,
            customerName: bill.customerName,
            grandTotal: bill.grandTotal,
            productName: item.productName,
            quantity: item.quantity,
            salePrice: Number(item.salePrice), // Ensure discount is a number
            discount: Number(item.discount), // Ensure discount is a number
            itemTotal: Number(item.itemTotal), // Ensure itemTotal is a number
            mrp: Number(item.mrp), // Ensure mrp is a number
            batch: item.batch,
            expiry: item.expiry,
            unit: item.unit,
            category: item.category,
            // Add purchasedMrp if it exists in your sales item data
            purchasedMrp: Number(item.purchasedMrp) || 0,
          });
        });
      });

      const salesHeaders = [
        'billId', 'saleDate', 'customerName', 'grandTotal', 'productName',
        'quantity', 'salePrice', 'discount', 'itemTotal',
        'mrp', 'batch', 'expiry', 'unit', 'category', 'purchasedMrp' // Added purchasedMrp to headers
      ];
      const salesCSV = convertToCSV(flattenedSalesData, salesHeaders);
      downloadCSV(salesCSV, 'sales_bills_export.csv');
      toast.success("Sales bill data exported successfully!");
    } else {
      toast.info("No sales bill data to export.");
    }
  };


  if (loading || !isAuthReady) { // Also wait for authentication to be ready
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="loader"></div>
        <p className="ml-4 text-gray-700">Loading data and authenticating...</p>
      </div>
    );
  }

  // If user is not logged in, show the Login component
  if (!currentUser) {
    console.log("Rendering Login component as no current user.");
    return <Login />;
  }

  if (error) {
    console.error("Dashboard error:", error);
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
            {/* New Link for Supplier Master */}
            <Link href="/supplier" passHref>
              <Button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors duration-200">
                Supplier Master
              </Button>
            </Link>
            {/* New Link for Customer Master */}
            <Link href="/customer" passHref>
              <Button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors duration-200">
                Customer Master
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
            {/* Logout Button */}
            
          </div>
        </div>

        {currentUser && (
            <div className="mb-4 p-3 bg-gray-200 rounded-md text-sm text-gray-700">
                <span className="font-semibold">Current User ID:</span> {currentUser.uid}
            </div>
        )}

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
                  </th>
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
                          {product.originalMrp > 0 ? `₹${Number(product.originalMrp).toFixed(2)}` : '-'}
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
                      <tr className={`${expandedRow === product.id ? 'bg-indigo-50' : 'hidden'}`}>
                          <td colSpan="9" className="p-4">
                            {" "}
                            <div className={`expandable-content ${expandedRow === product.id ? 'expanded' : ''}`}>
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
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Original Master MRP/Pack
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
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {purchase.originalMrp > 0 ? `₹${Number(purchase.originalMrp).toFixed(2)}` : '-'}
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
                                            colSpan="11"
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
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                        >
                                          Purchased MRP/Pack
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
                                              </td>
                                               <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {sale.purchasedMrp > 0 ? `₹${Number(sale.purchasedMrp).toFixed(2)}` : '-'}
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
                                            colSpan="11"
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
                      colSpan="9"
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
                <div className="h-80 w-full">
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
                  <div className="h-80 w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={productAnalytics.slice(0, 10)}
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
