// app/page.js
"use client"; // This directive is needed for client-side functionality in App Router

import React, { useState, useEffect, useMemo } from "react"; // Added useMemo
import Header from "./components/Header";
// Removed HistoryPanel import as it seems unused on the dashboard now
// import HistoryPanel from "./components/HistoryPanel";
import Link from "next/link";
import { Button } from "./components/button";
// Assuming TotalSummary is in your ./pages folder
import TotalSummary from "./pages/TotalSummary"; // Corrected import path assuming it's in ./pages
// Removed ProductTable import as we will render the table directly here
// import ProductTable from "./components/ProductTable";


// Import icons for expand/collapse, export
import { ChevronDown, ChevronUp, Download } from 'lucide-react';

// Import toast for potential loading errors
import { toast } from 'sonner';


// Helper function to format date as DD-MM-YYYY (Used for display and filtering)
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

// Helper function to parse DD-MM-YYYY string to Date (Used for sorting)
function parseDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null;
    }
    const [day, month, year] = dateString.split('-');
     if (day && month && year && !isNaN(parseInt(day, 10)) && !isNaN(parseInt(month, 10)) && !isNaN(parseInt(year, 10))) {
         const dayInt = parseInt(day, 10);
         const monthInt = parseInt(month, 10);
         const yearInt = parseInt(year, 10);
         // Month is 0-indexed in Date constructor
         if (dayInt >= 1 && dayInt <= 31 && monthInt >= 1 && monthInt <= 12 && yearInt >= 1900 && yearInt <= 2100) {
             return new Date(yearInt, monthInt - 1, dayInt);
         }
     }
    return null; // Default to null if parsing fails
}


// Helper function to parse MM-YY date strings into a Date object (Used for sorting expiry dates)
function parseMonthYearDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null; // Return null for empty or invalid string
    }
    const parts = dateString.split('-');
    if (parts.length !== 2) {
        return null; // Must have exactly two parts (MM and YY)
    }
    const [month, year] = parts;
    const monthInt = parseInt(month, 10);
    const yearInt = parseInt(year, 10);

    if (month && year && !isNaN(monthInt) && !isNaN(yearInt)) {
        if (monthInt >= 1 && monthInt <= 12 && yearInt >= 0 && yearInt <= 99) {
            const fullYear = 2000 + yearInt; // Simple approach: assume 20xx
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
    console.log("Dashboard: Successfully parsed products. Count:", products.length);

    const processedProducts = products.map(p => {
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
          name: p.name || '',
          unit: p.unit || '',
          category: p.category || '',
          company: p.company || '',
          id: p.id,
          batch: p.batch || '',
          expiry: p.expiry || '',
        };
      } catch (mapErr) {
        console.error("Dashboard: Error processing product item during map:", p, mapErr);
        return null;
      }
    }).filter(p => p !== null);

    console.log("Dashboard: Finished processing products. Valid product count:", processedProducts.length);
    return processedProducts;

  } catch (err) {
    console.error("Dashboard: Error loading or parsing products from localStorage:", err);
    toast.error("Error loading product data for dashboard.");
    return [];
  }
};


// Helper function to load purchase bills from localStorage
const loadPurchaseBillsFromLocalStorage = () => {
     console.log("Dashboard: Attempting to load purchase bills from localStorage...");
     try {
         const storedBills = localStorage.getItem('purchaseBills');
         const bills = storedBills ? JSON.parse(storedBills) : [];
         console.log("Dashboard: Successfully parsed purchase bills. Count:", bills.length);
         const processedBills = bills.map(bill => ({
             ...bill,
              // Ensure bill date is formatted or consistent for sorting/comparison
              date: bill.date || '', // Keep as DD-MM-YYYY string
             items: bill.items.map(item => ({
                  ...item,
                  product: item.product || '',
                  batch: item.batch || '',
                  expiry: item.expiry || '',
                  quantity: Number(item.quantity) || 0, // Quantity in items for purchase line
                  packsPurchased: Number(item.packsPurchased) || 0, // Packs purchased
                  itemsPerPack: Number(item.itemsPerPack) || 1, // Items per pack in purchase
                  ptr: Number(item.ptr) || 0,
                  totalItemAmount: Number(item.totalItemAmount) || 0,
             })),
             totalAmount: Number(bill.totalAmount) || 0, // Ensure totalAmount is number
         }));
          // Sort by date descending for history display
         processedBills.sort((a, b) => {
             const dateA = parseDate(a.date);
             const dateB = parseDate(b.date);
             if (!dateA && !dateB) return 0;
             if (!dateA) return 1;
             if (!dateB) return -1;
             return dateB - dateA; // Sort descending (newest first)
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
         const storedBills = localStorage.getItem('salesBills');
         const bills = storedBills ? JSON.parse(storedBills) : [];
         console.log("Dashboard: Successfully parsed sales bills. Count:", bills.length);
         const processedBills = bills.map(bill => ({
             ...bill,
             // Ensure bill date is formatted or consistent for sorting/comparison
              date: bill.date || '', // Keep as DD-MM-YYYY string
             items: bill.items.map(item => ({
                  ...item,
                  product: item.product || '',
                  batch: item.batch || '',
                  expiry: item.expiry || '',
                  quantitySold: Number(item.quantitySold) || 0,
                  pricePerItem: Number(item.pricePerItem) || 0,
                  totalItemAmount: Number(item.totalItemAmount) || 0,
             })),
             totalAmount: Number(bill.totalAmount) || 0, // Ensure totalAmount is number
         }));
         // Sort by date descending for history display
         processedBills.sort((a, b) => {
             const dateA = parseDate(a.date);
             const dateB = parseDate(b.date);
             if (!dateA && !dateB) return 0;
             if (!dateA) return 1;
             if (!dateB) return -1;
             return dateB - dateA; // Sort descending (newest first)
         });
         return processedBills;
     } catch (err) {
         console.error("Dashboard: Error loading or parsing sales bills:", err);
         toast.error("Error loading sales bill data for dashboard.");
         return [];
     }
};


export default function Home() {
  // State for the list of all products (from master)
 const [products, setProducts] = useState([]);
    // State for Purchase and Sales Bills (needed for stock calculation and history)
    const [purchaseBills, setPurchaseBills] = useState([]);
    const [salesBills, setSalesBills] = useState([]);

    // State for bills specific to today
    const [todayPurchaseBills, setTodayPurchaseBills] = useState([]); // ADDED
    const [todaySalesBills, setTodaySalesBills] = useState([]); // ADDED

  // State to track initial loading for displaying a loading message
  const [loading, setLoading] = useState(true);

  // State for overall stock calculations (derived from batch stock)
 const [totalQuantity, setTotalQuantity] = useState(0);
 const [totalValue, setTotalValue] = useState(0);

    // State for managing expanded rows in the batch stock table
    const [expandedRows, setExpandedRows] = useState({}); // Use product ID as key


 // --- EFFECT: Load initial data and set up event listener ---
 useEffect(() => {
    console.log("Dashboard useEffect: Component mounted. Starting initial data load.");

    try {
      // Load products, purchase bills, and sales bills from localStorage
      const initialProducts = loadProductsFromLocalStorage();
             const initialPurchaseBills = loadPurchaseBillsFromLocalStorage();
             const initialSalesBills = loadSalesBillsFromLocalStorage();

      console.log("Dashboard useEffect: Initial products loaded.", initialProducts.length);
             console.log("Dashboard useEffect: Initial purchase bills loaded.", initialPurchaseBills.length);
             console.log("Dashboard useEffect: Initial sales bills loaded.", initialSalesBills.length);

    setProducts(initialProducts); // Update the products state
             setPurchaseBills(initialPurchaseBills); // Update purchase bills state
             setSalesBills(initialSalesBills); // Update sales bills state

      // Set loading to false after initial data load attempt
      console.log("Dashboard useEffect: Setting loading to false.");
      setLoading(false);

    } catch (initialLoadError) {
      // Catch any unexpected errors during the synchronous initial load
      console.error("Dashboard useEffect: Unexpected error during initial load:", initialLoadError);
      setProducts([]); // Ensure products state is empty on error
             setPurchaseBills([]);
             setSalesBills([]);
      setLoading(false); // Ensure loading state is set to false
      toast.error("An unexpected error occurred during initial data load."); // Notify user
    }


    // Set up event listener for data updates from other pages.
  const handleDataUpdated = () => { // Renamed handler
   console.log("Dashboard: 'productsUpdated' event received. Reloading all relevant data from storage.");
   const updatedProducts = loadProductsFromLocalStorage();
        const updatedPurchaseBills = loadPurchaseBillsFromLocalStorage();
        const updatedSalesBills = loadSalesBillsFromLocalStorage();
   setProducts(updatedProducts);
        setPurchaseBills(updatedPurchaseBills);
        setSalesBills(updatedSalesBills);
  };

    console.log("Dashboard useEffect: Adding 'productsUpdated' event listener.");
  window.addEventListener('productsUpdated', handleDataUpdated); // Use renamed handler

    // Clean up the event listener when the component unmounts
  return () => {
      console.log("Dashboard useEffect: Component unmounting. Removing event listener.");
   window.removeEventListener('productsUpdated', handleDataUpdated); // Use renamed handler
  };

 }, []); // Empty dependency array means this effect runs only once on mount


     // --- EFFECT: Filter for Today's Transactions ---
     useEffect(() => {
         console.log("Dashboard Today's Transactions useEffect: Sales or Purchase bills changed. Filtering for today.");
         const todayFormatted = formatDate(new Date()); // Get today's date in DD-MM-YYYY

         const salesToday = salesBills.filter(bill => bill.date === todayFormatted);
         const purchaseToday = purchaseBills.filter(bill => bill.date === todayFormatted);

         setTodaySalesBills(salesToday);
         setTodayPurchaseBills(purchaseToday);

         console.log(`Dashboard Today's Transactions: Found ${salesToday.length} sales and ${purchaseToday.length} purchases for today (${todayFormatted}).`);

     }, [salesBills, purchaseBills]); // Re-run when sales or purchase bills change


     // --- Stock Calculation Logic (Memoized for performance) ---
     // Recalculate batch stock whenever products, purchaseBills, or salesBills change
     const batchStock = useMemo(() => {
         console.log("Dashboard: Calculating batch stock...");
         const stockMap = new Map(); // Map to hold { "ProductName_Batch_Expiry": quantity }

         // Process Purchases: Add quantities to stockMap
         purchaseBills.forEach(bill => {
             bill.items.forEach(item => {
                 // Use product name, batch, and expiry (case-insensitive, trimmed) as key
                 if (item.product && item.batch && item.expiry) {
                     const key = `${item.product.trim().toLowerCase()}_${item.batch.trim().toLowerCase()}_${item.expiry.trim().toLowerCase()}`;
                     const quantity = Number(item.quantity) || 0; // Quantity is total items purchased in this line
                     stockMap.set(key, (stockMap.get(key) || 0) + quantity);
                 }
             });
         });

         // Process Sales: Subtract quantities from stockMap
         salesBills.forEach(bill => {
             bill.items.forEach(item => {
                 // Use product name, batch, and expiry (case-insensitive, trimmed) as key
                 if (item.product && item.batch && item.expiry) {
                     const key = `${item.product.trim().toLowerCase()}_${item.batch.trim().toLowerCase()}_${item.expiry.trim().toLowerCase()}`;
                     const quantitySold = Number(item.quantitySold) || 0; // Quantity sold is individual items
                      stockMap.set(key, (stockMap.get(key) || 0) - quantitySold);
                 }
             });
         });

         // Group stock by product name and format for display
         const productBatchStock = new Map(); // Map to hold { "OriginalProductName": [{ batch, expiry, quantity }] }

         stockMap.forEach((quantity, key) => {
             const [productNameLower, batchLower, expiryLower] = key.split('_');

              // Find the original casing product name from the products list for display
              // CORRECTED: Changed 'product' to 'p' inside the find callback
              const originalProduct = products.find(p => p && p.name && p.name.toLowerCase() === productNameLower);
              if (!originalProduct) {
                  // This batch/expiry stock belongs to a product not currently in the master list
                   console.warn(`Dashboard: Calculated batch stock for unknown product: "${productNameLower}". Skipping display.`);
                  return;
              }
              const displayProductName = originalProduct.name;

              if (!productBatchStock.has(displayProductName)) { // Use original casing for map key now
                  productBatchStock.set(displayProductName, []);
              }


             // Only add batches with positive stock for display in the breakdown
             if (quantity > 0) {
                  // Try to find original batch/expiry casing from purchase bills if possible? Or just use the lower case ones?
                  // Let's just use the lower case for the key but try to preserve original casing for display.
                  let displayBatch = batchLower;
                  let displayExpiry = expiryLower;
                   // Optional: Find original casing - search purchase bills for a match
                   const purchaseItemMatch = purchaseBills.flatMap(bill => bill.items).find(item =>
                       item.product?.trim().toLowerCase() === productNameLower &&
                       item.batch?.trim().toLowerCase() === batchLower &&
                       item.expiry?.trim().toLowerCase() === expiryLower
                   );
                   if (purchaseItemMatch) {
                       displayBatch = purchaseItemMatch.batch.trim();
                       displayExpiry = purchaseItemMatch.expiry.trim();
                   }


                 productBatchStock.get(displayProductName).push({ // Use original casing product name
                     batch: displayBatch,
                     expiry: displayExpiry,
                     quantity: quantity, // This is the calculated net quantity
                 });
             }
         });

          // Sort batches by expiry date within each product
          productBatchStock.forEach(batches => {
              batches.sort((a, b) => {
                  const dateA = parseMonthYearDate(a.expiry);
                  const dateB = parseMonthYearDate(b.expiry);
                  // Handle null/invalid dates - put them last
                  if (!dateA && !dateB) return 0;
                  if (!dateA) return 1;
                  if (!dateB) return -1;
                  return dateA - dateB; // Sort by date ascending
              });
          });


         console.log("Dashboard: Batch stock calculated.", Object.fromEntries(productBatchStock));
         return productBatchStock; // Returns a Map { "OriginalProductName": [{batch, expiry, quantity}, ...] }

     }, [products, purchaseBills, salesBills]); // Recalculate when any of these dependencies change


    // Function to calculate total stock for a product based on batch stock
    const getTotalStock = (productName) => {
         // Use the original casing product name from the products list to find the entry in batchStock map
         // CORRECTED: Changed 'product' to 'p' inside the find callback
         const originalProduct = products.find(p => p && p.name && p.name.toLowerCase() === productName.toLowerCase());
         if (!originalProduct) return 0; // Should not happen if called correctly, but defensive

         const batches = batchStock.get(originalProduct.name) || []; // Use original casing key
         const total = batches.reduce((sum, batch) => sum + batch.quantity, 0);
         return total;
    };

    // Handle search query change (This will filter the main product list)
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
         // Close any expanded rows when search query changes
        setExpandedRows({});
    };

     // Memoized filtered products list for the stock table
     const filteredProducts = useMemo(() => {
         console.log("Dashboard: Filtering products...");
         const query = searchQuery.toLowerCase();
         if (!query) {
             return products; // Return all products if query is empty
         }
         return products.filter(product =>
              product && product.name && ( // Added product and name existence check
                 product.name.toLowerCase().includes(query) ||
                 product.unit.toLowerCase().includes(query) ||
                 product.category.toLowerCase().includes(query) ||
                 product.company.toLowerCase().includes(query) ||
                  // *** Search within calculated batch stock details ***
                  // Find the batch stock for this product (use original casing for lookup in batchStock map)
                  (batchStock.has(product.name) &&
                   batchStock.get(product.name).some(batchDetail =>
                       batchDetail.batch.toLowerCase().includes(query) ||
                       batchDetail.expiry.toLowerCase().includes(query)
                   )
                  )
              )
         );
     }, [searchQuery, products, batchStock]); // Filter whenever query, products, or batchStock changes


     // Function to toggle expansion of a product row
     const toggleRowExpansion = (productId) => {
          console.log(`Dashboard: Toggling expansion for product ID: ${productId}`);
         setExpandedRows(prevExpandedRows => ({
             ...prevExpandedRows,
             [productId]: !prevExpandedRows[productId], // Toggle the boolean value
         }));
     };

     // --- Export Functions ---

     const exportToCsv = (data, filename, type) => {
         console.log(`Dashboard Export: Preparing to export ${type} data.`);

         if (!data || data.length === 0) {
             toast.info(`No ${type} data to export.`);
             console.log(`Dashboard Export: No ${type} data found.`);
             return;
         }

         // Define CSV headers and extract data based on type
         let headers = [];
         let csvRows = [];

         if (type === 'sales') {
             headers = ['Bill Number', 'Customer Name', 'Date', 'Total Amount'];
             csvRows = data.map(bill => [
                 `"${bill.billNumber}"`, // Wrap in quotes in case of commas
                 `"${bill.customerName}"`,
                 `"${bill.date}"`,
                 bill.totalAmount.toFixed(2),
             ].join(','));
         } else if (type === 'purchase') {
             headers = ['Bill Number', 'Supplier Name', 'Date', 'Total Amount'];
             csvRows = data.map(bill => [
                 `"${bill.billNumber}"`, // Wrap in quotes
                 `"${bill.supplierName}"`, // Ensure supplierName exists on purchase bills
                 `"${bill.date}"`,
                 bill.totalAmount.toFixed(2),
             ].join(','));
         } else {
             console.error("Dashboard Export: Unknown export type:", type);
             return; // Exit if type is unknown
         }

         // Add header row
         const headerRow = headers.join(',');
         csvRows.unshift(headerRow); // Add header to the beginning

         // Join all rows with newline characters
         const csvString = csvRows.join('\n');

         // Create a Blob
         const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

         // Create a download link
         const link = document.createElement('a');
         const url = URL.createObjectURL(blob);

         link.setAttribute('href', url);
         link.setAttribute('download', `${filename}_${formatDate(new Date())}.csv`); // Add date to filename

         // Append to body, trigger click, and clean up
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         URL.revokeObjectURL(url);

         console.log(`Dashboard Export: Successfully exported ${type} data as "${link.download}".`);
         toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} history exported!`);
     };

     const exportSalesCSV = () => {
         console.log("Dashboard Export: Initiating sales CSV export.");
         // Export the *full* sales history
         exportToCsv(salesBills, 'sales_history', 'sales');
     };

     const exportPurchaseCSV = () => {
         console.log("Dashboard Export: Initiating purchase CSV export.");
         // Export the *full* purchase history
         exportToCsv(purchaseBills, 'purchase_history', 'purchase');
     };

     // --- End Export Functions ---


 return (
  <> {/* Use React Fragment <> or <div> to wrap if Header doesn't return a single element */}
   <Header /> {/* Assuming Header component exists and works */}

   <div className="container mx-auto p-4"> {/* Added container for centering and padding */}
    <div className="flex justify-between items-center mb-4"> {/* Flex container for title and buttons */}
     <h1 className="text-2xl font-semibold">Dashboard</h1> {/* Dashboard title */}

     {/* Navigation Buttons */}
     <div>
      {/* Link to Sales Page */}
      <Link href="/sales" className="mr-2">
       <Button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
        Go to Sales
       </Button>
      </Link>
      {/* Link to Purchase Page */}
      <Link href="/purchase" className="mr-2">
       <Button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
        Go to Purchase
       </Button>
      </Link>
      {/* Link to Product Master Page */}
      <Link href="/productmaster"> {/* Assuming /productmaster is the route for Product Master */}
       <Button className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded">
        Product Master
       </Button>
      </Link>
     </div>
    </div>

    {/* Overall Stock Summary Section */}
    <div className="bg-white p-4 rounded shadow mb-6">
     <h2 className="text-xl font-semibold mb-2">Overall Stock Summary</h2>
     {/* Pass the calculated totals to the TotalSummary component */}
     <TotalSummary totalQuantity={totalQuantity} totalValue={totalValue} />
    </div>

    {/* Current Stock Inventory Section (Renders table directly) */}
   <div className="bg-white p-4 rounded shadow mb-6">
    <h2 className="text-xl font-semibold mb-2">Current Stock Inventory</h2>
          <div className="mb-4"> {/* Search bar */}
              <input
                  type="text"
                  placeholder="Search products or batches..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="border p-2 rounded w-full md:w-1/3"
              />
          </div>
    {loading ? (
     <div className="text-center text-gray-500">Loading stock data...</div>
    ) : (

             <div className="overflow-x-auto">
                 <table className="min-w-full table-auto border-collapse border border-gray-300">
                     <thead>
                         <tr className="bg-gray-100 text-left text-sm">
                             <th className="border border-gray-300 px-4 py-2 w-[20%]">Product Name</th> {/* Adjusted width */}
                             <th className="border border-gray-300 px-4 py-2 w-[8%]">Unit</th>
                             <th className="border border-gray-300 px-4 py-2 w-[10%]">Category</th>
                             <th className="border border-gray-300 px-4 py-2 w-[12%]">Company</th>
                             <th className="border border-gray-300 px-4 py-2 w-[8%]">MRP (₹)</th>
                             <th className="border border-gray-300 px-4 py-2 w-[8%]">Items/Pack</th>
                              {/* Removed Min/Max Stock headers for simplicity on Dashboard main table */}
                             {/* <th className="border border-gray-300 px-4 py-2 w-[8%]">Min Stock</th>
                             <th className="border border-gray-300 px-4 py-2 w-[8%]">Max Stock</th> */}
                             <th className="border border-gray-300 px-4 py-2 w-[10%]">Total Stock (Items)</th>
                             {/* Removed Tax Rate Header */}
                         </tr>
                     </thead>
                     <tbody>
                         {filteredProducts.length > 0 ? (
                             filteredProducts.map((product) => (
                                  <React.Fragment key={product.id}>
                                     {/* Main Product Row */}
                                      {/* Make the row clickable to toggle batch details */}
                                      {/* Added styles for hover effect and cursor */}
                                     <tr
                                         className={`hover:bg-gray-50 ${expandedRows[product.id] ? 'bg-gray-100' : ''} cursor-pointer`}
                                          onClick={() => toggleRowExpansion(product.id)}
                                     >
                                          <td className="border border-gray-300 px-4 py-2 font-medium flex items-center">
                                              {/* Expand/Collapse Icon */}
                                              {expandedRows[product.id] ? <ChevronUp className="h-4 w-4 mr-2 shrink-0" /> : <ChevronDown className="h-4 w-4 mr-2 shrink-0" />}
                                              <span className="truncate">{product.name}</span> {/* Truncate long names */}
                                          </td>
                                          <td className="border border-gray-300 px-4 py-2">{product.unit}</td>
                                          <td className="border border-gray-300 px-4 py-2">{product.category}</td>
                                          <td className="border border-gray-300 px-4 py-2">{product.company}</td>
                                          <td className="border border-gray-300 px-4 py-2">₹{Number(product.mrp).toFixed(2)}</td>
                                          <td className="border border-gray-300 px-4 py-2">{product.itemsPerPack}</td>
                                           {/* Display Calculated Total Stock */}
                                           <td className="border border-gray-300 px-4 py-2 font-semibold">
                                               {getTotalStock(product.name)} {/* Display calculated total stock */}
                                           </td>
                                      </tr>

                                      {/* Expandable Row for Batch Details */}
                                       {expandedRows[product.id] && (
                                           <tr key={`batch-details-${product.id}`}>
                                                {/* Colspan should match the number of columns in the main header */}
                                                {/* Main columns: Product, Unit, Category, Company, MRP, Items/Pack, Total Stock = 7 columns */}
                                               <td colSpan="7" className="border border-gray-300 px-4 py-2 bg-gray-50">
                                                    <h4 className="font-semibold mb-2 text-sm">Batch Stock Details:</h4>
                                                    {/* Get and display batch stock for this product */}
                                                    {/* Use original casing product name for lookup */}
                                                    {batchStock.has(product.name) && batchStock.get(product.name).length > 0 ? (
                                                        <div className="overflow-x-auto"> {/* Added overflow for inner table */}
                                                             <table className="min-w-full table-auto border-collapse border border-gray-200 text-xs">
                                                                  <thead>
                                                                      <tr className="bg-gray-200 text-left"> {/* Slightly darker background for sub-table header */}
                                                                          <th className="border border-gray-200 px-2 py-1">Batch No.</th>
                                                                          <th className="border border-gray-200 px-2 py-1">Expiry (MM-YY)</th>
                                                                          <th className="border border-gray-200 px-2 py-1">Stock (Items)</th>
                                                                      </tr>
                                                                  </thead>
                                                                  <tbody>
                                                                      {/* Sort batches by expiry date (ascending) */}
                                                                      {batchStock.get(product.name) // Use original casing product name
                                                                          .sort((a, b) => {
                                                                              const dateA = parseMonthYearDate(a.expiry);
                                                                              const dateB = parseMonthYearDate(b.expiry);
                                                                              if (!dateA && !dateB) return 0;
                                                                              if (!dateA) return 1; // Nulls last
                                                                              if (!dateB) return -1; // Nulls last
                                                                              return dateA - dateB; // Ascending date sort
                                                                          })
                                                                          .map((batchDetail, batchIndex) => (
                                                                          <tr key={batchIndex} className="hover:bg-gray-100"> {/* Hover effect for batch rows */}
                                                                              <td className="border border-gray-200 px-2 py-1">{batchDetail.batch}</td>
                                                                              <td className="border border-gray-200 px-2 py-1">{batchDetail.expiry}</td>
                                                                              <td className="border border-gray-200 px-2 py-1 font-medium">{batchDetail.quantity}</td>
                                                                          </tr>
                                                                      ))}
                                                                 </tbody>
                                                             </table>
                                                        </div>
                                                    ) : (
                                                        <p className="text-gray-600 text-sm">No batch details available or zero stock batches for this product.</p>
                                                    )}
                                               </td>
                                           </tr>
                                       )}
                                  </React.Fragment>
                             ))
                         ) : (
                             <tr>
                                  {/* Colspan should match the number of columns in the main header */}
                                 <td colSpan="7" className="border border-gray-300 px-4 py-2 text-center">No products found</td>
                             </tr>
                         )}
                     </tbody>
                 </table>
             </div>

    )}
   </div>


        {/* --- Today's Transactions and History Section --- */}
        <div className="bg-white p-4 rounded shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">Transaction Summary and History</h2>

            {/* Today's Summary */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                 <div className="border p-4 rounded">
                      <h3 className="text-lg font-semibold mb-2">Today's Sales ({formatDate(new Date())})</h3>
                      <p>Total Bills: <span className="font-medium">{todaySalesBills.length}</span></p>
                      <p>Total Amount: <span className="font-medium">₹{todaySalesBills.reduce((sum, bill) => sum + bill.totalAmount, 0).toFixed(2)}</span></p>
                      {/* You could add more summaries like total items sold etc. */}
                 </div>
                 <div className="border p-4 rounded">
                     <h3 className="text-lg font-semibold mb-2">Today's Purchases ({formatDate(new Date())})</h3>
                     <p>Total Bills: <span className="font-medium">{todayPurchaseBills.length}</span></p>
                     <p>Total Amount: <span className="font-medium">₹{todayPurchaseBills.reduce((sum, bill) => sum + bill.totalAmount, 0).toFixed(2)}</span></p>
                      {/* You could add more summaries */}
                 </div>
             </div>

            {/* Transaction History Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold">Sales History</h3>
                         <Button onClick={exportSalesCSV} size="sm" className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
                            <Download className="mr-1 h-4 w-4" /> Export Sales
                         </Button>
                    </div>
                    <div className="overflow-x-auto">
                         <table className="min-w-full table-auto border-collapse border border-gray-300 text-sm">
                             <thead>
                                 <tr className="bg-gray-100 text-left">
                                     <th className="border border-gray-300 px-3 py-1">Bill No</th>
                                     <th className="border border-gray-300 px-3 py-1">Date</th>
                                     <th className="border border-gray-300 px-3 py-1">Customer</th>
                                     <th className="border border-gray-300 px-3 py-1">Total (₹)</th>
                                      {/* Add more columns if needed */}
                                 </tr>
                             </thead>
                             <tbody>
                                 {salesBills.length > 0 ? (
                                     salesBills.map(bill => (
                                         <tr key={bill.id} className="hover:bg-gray-50">
                                             <td className="border border-gray-300 px-3 py-1">{bill.billNumber}</td>
                                             <td className="border border-gray-300 px-3 py-1">{bill.date}</td>
                                             <td className="border border-gray-300 px-3 py-1 truncate max-w-[100px]">{bill.customerName}</td> {/* Added truncate */}
                                             <td className="border border-gray-300 px-3 py-1">{bill.totalAmount.toFixed(2)}</td>
                                             {/* Add more data cells */}
                                         </tr>
                                     ))
                                 ) : (
                                     <tr>
                                         <td colSpan="4" className="border border-gray-300 px-3 py-1 text-center">No sales bills found.</td>
                                     </tr>
                                 )}
                             </tbody>
                         </table>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-3">
                         <h3 className="text-lg font-semibold">Purchase History</h3>
                         <Button onClick={exportPurchaseCSV} size="sm" className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm">
                             <Download className="mr-1 h-4 w-4" /> Export Purchase
                         </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full table-auto border-collapse border border-gray-300 text-sm">
                            <thead>
                                <tr className="bg-gray-100 text-left">
                                    <th className="border border-gray-300 px-3 py-1">Bill No</th>
                                    <th className="border border-gray-300 px-3 py-1">Date</th>
                                    <th className="border border-gray-300 px-3 py-1">Supplier</th>
                                    <th className="border border-gray-300 px-3 py-1">Total (₹)</th>
                                     {/* Add more columns if needed */}
                                </tr>
                            </thead>
                            <tbody>
                                 {purchaseBills.length > 0 ? (
                                     purchaseBills.map(bill => (
                                         <tr key={bill.id} className="hover:bg-gray-50">
                                             <td className="border border-gray-300 px-3 py-1">{bill.billNumber}</td>
                                             <td className="border border-gray-300 px-3 py-1">{bill.date}</td>
                                             <td className="border border-gray-300 px-3 py-1 truncate max-w-[100px]">{bill.supplierName}</td> {/* Added truncate */}
                                             <td className="border border-gray-300 px-3 py-1">{bill.totalAmount.toFixed(2)}</td>
                                             {/* Add more data cells */}
                                         </tr>
                                     ))
                                 ) : (
                                     <tr>
                                         <td colSpan="4" className="border border-gray-300 px-3 py-1 text-center">No purchase bills found.</td>
                                     </tr>
                                 )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>


   </div> {/* Closes the main container div */}
  </>
 );
}